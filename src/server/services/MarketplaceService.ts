import { inject, injectable } from 'inversify';
import { Readable } from 'stream';
import {
    InitiateAsyncLicense,
    InitiateAsyncLicenseCollection,
    StatusAsyncTransactionCollection,
} from '#common/types/marketplace.js';
import { LicenseHistorySnapshot } from '#common/util/licenseVersionUtils.js';
import { components as v3Components, paths as v3Paths } from '#common/types/marketplace-v3-api.js';
import { components as commerceComponents } from '#common/types/commerce-api.js';
import { TYPES } from '../config/types.js';
import { ConfigDao } from '../database/dao/ConfigDao.js';
import { ConfigKey } from '#common/types/configItem.js';
import { CloudOrServer, LiveOrPending } from '#server/services/types.js';
import { MarketplaceHttpClient } from './MarketplaceHttpClient.js';

type ListingResponse = v3Paths["/rest/3/product-listing/developer-space/{developerId}"]["get"]["responses"]["200"]["content"]["application/json"];
type GetLicensesResponse = v3Components['schemas']['Reports_GetLicenses'];

export interface OurPricingItem {
    /**
     * Format: int32
     * @description The time period that this pricing is for: 1 for monthly, 12 for annual
     */
    monthsValid: number;
    /**
     * Format: float
     * @description The amount (in USD) that a customer pays for a license at this tier
     */
    amount: number;
    /**
     * Format: int32
     * @description The user count (or other unit if appropriate, such as remote agents in Bamboo) defining this pricing tier; -1 for unlimited
     */
    unitCount: number;
};

export interface OurPricingData {
    items: OurPricingItem[];
    perUnitItems?: OurPricingItem[];
    expertDiscountOptOut: boolean;
}

@injectable()
export class MarketplaceService {
    private readonly baseUrl = 'https://marketplace.atlassian.com';
    private readonly baseUrlV3 = 'https://api.atlassian.com/marketplace/rest/3';
    private readonly commerceBaseUrl = 'https://api.atlassian.com/commerce/api/v2';
    private readonly commerceBaseUrlV1 = 'https://api.atlassian.com/commerce/api/v1';
    private username: string = '';
    private password: string = '';
    private developerId: string = '';

    constructor(
        @inject(TYPES.ConfigDao) private readonly configDao: ConfigDao,
        @inject(TYPES.MarketplaceHttpClient) private readonly httpClient: MarketplaceHttpClient,
    ) {}

    private async initializeConfig(): Promise<void> {
        this.username = await this.configDao.get<string>(ConfigKey.AtlassianAccountUser) || '';
        this.password = await this.configDao.get<string>(ConfigKey.AtlassianAccountApiToken) || '';
        this.developerId = await this.configDao.get<string>(ConfigKey.AtlassianDeveloperId) || '';
    }

    /**
     * Resolves developer ID from vendor ID via Marketplace V3 developer-space API.
     */
    async fetchDeveloperIdByVendorId(vendorId: string): Promise<string> {
        const url = `${this.baseUrl}/rest/3/developer-space/vendor/${vendorId}`;
        console.log(`Calling Marketplace API: ${url}`);

        const response = await this.httpClient.get<v3Components['schemas']['DeveloperId']>(url, {
            headers: await this.getRequestHeaders(),
            context: `Fetch developer ID for vendor ${vendorId}`,
        });

        return response.developerId;
    }

    /**
     * If a vendor ID is configured but developer ID is not, fetch and persist the developer ID.
     */
    async migrateDeveloperIdFromVendorIdIfNeeded(): Promise<void> {
        const vendorId = await this.configDao.get<string>(ConfigKey.AtlassianVendorId);
        const developerId = await this.configDao.get<string>(ConfigKey.AtlassianDeveloperId);

        if (!vendorId?.trim() || developerId?.trim()) {
            return;
        }

        const username = await this.configDao.get<string>(ConfigKey.AtlassianAccountUser);
        const apiToken = await this.configDao.get<string>(ConfigKey.AtlassianAccountApiToken);
        if (!username?.trim() || !apiToken?.trim()) {
            console.warn(
                'Atlassian vendor ID is configured but developer ID is missing; ' +
                'cannot resolve developer ID without account credentials.'
            );
            return;
        }

        try {
            const resolvedDeveloperId = await this.fetchDeveloperIdByVendorId(vendorId.trim());
            await this.configDao.set(ConfigKey.AtlassianDeveloperId, resolvedDeveloperId);
            this.developerId = resolvedDeveloperId;
            console.log(`Resolved and saved Atlassian developer ID for vendor ID ${vendorId}`);
        } catch (error) {
            console.error('Failed to resolve Atlassian developer ID from vendor ID:', error);
        }
    }

    private async getRequestHeaders(extraHeaders?: Record<string, string>): Promise<Record<string, string>> {
        await this.initializeConfig();
        const credentials = Buffer.from(`${this.username}:${this.password}`).toString('base64');
        return {
            'Authorization': `Basic ${credentials}`,
            ...extraHeaders,
        };
    }

    private buildUrlWithParams(baseUrl: string, params: Record<string, any>): string {
        const queryString = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
            if (value !== undefined) {
                queryString.append(key, value.toString());
            }
        });
        return `${baseUrl}?${queryString.toString()}`;
    }

    /** Resolve `_links.next.href` from the Marketplace reporting API (may omit `/rest/3`). */
    private resolveMarketplacePaginationUrl(href: string): string {
        if (href.startsWith('http://') || href.startsWith('https://')) {
            return href;
        }
        const origin = 'https://api.atlassian.com/marketplace';
        if (href.startsWith('/rest/')) {
            return `${origin}${href}`;
        }
        if (href.startsWith('/')) {
            return `${origin}/rest/3${href}`;
        }
        return `${origin}/rest/3/${href}`;
    }

    private async pollForCompletion<T>(
        baseUrl: string,
        statusLink: string,
        downloadLink: string,
        checkStatus: (data: any) => string
    ): Promise<string> {
        let status = 'IN_PROGRESS';
        let resultUrl: string | undefined;

        while (status === 'IN_PROGRESS' || status === 'QUEUED') {
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds between polls

            const statusResponse = await this.httpClient.get<T>(baseUrl + statusLink, {
                headers: await this.getRequestHeaders(),
                context: `Poll async export status (${statusLink})`,
            });

            status = checkStatus(statusResponse);
            if (status === 'COMPLETED') {
                resultUrl = baseUrl + downloadLink;
            } else if (status === 'FAILED') {
                throw new Error(`Export failed: ${JSON.stringify(statusResponse)}`);
            }
        }

        if (!resultUrl) {
            throw new Error('No result URL available after export completion');
        }

        return resultUrl;
    }

    private async getStreamForResultUrl(resultUrl: string): Promise<Readable> {
        return this.httpClient.getStream(resultUrl, {
            headers: await this.getRequestHeaders(),
            context: `Download async export (${resultUrl})`,
        });
    }

    /**
     * Start transaction export and return a stream of the JSON array. Caller must consume and destroy the stream.
     */
    async getTransactionsStream(): Promise<Readable> {
        await this.initializeConfig();
        const exportUrl = this.buildUrlWithParams(
            `${this.baseUrlV3}/reporting/developer-space/${this.developerId}/sales/transactions/async/export`,
            { excludeZeroTransactions: false, includeManualInvoice: true }
        );
        console.log(`Calling Marketplace API: ${exportUrl}`);

        const exportResponse = await this.httpClient.post<v3Components["schemas"]["Reports_InitiateAsyncExportTransactions"]>(
            exportUrl,
            {},
            {
                headers: await this.getRequestHeaders({ 'Content-Type': 'application/json' }),
                context: 'Initiate transactions export',
            }
        );

        const resultUrl = await this.pollForCompletion<StatusAsyncTransactionCollection>(
            this.baseUrlV3,
            exportResponse._links.status.href,
            exportResponse._links.download.href,
            (data) => data.export.status
        );

        console.log(`Streaming transactions from API`);
        return this.getStreamForResultUrl(resultUrl);
    }

    private fixQuotesExportUrl(url: string): string {
        // As of 2026-06, Marketplace API V.3 returns broken V.2 URLs in its response
        if (!/\/rest\/2\/vendors/.test(url)) {
            return url;
        }

        const quotesSuffix = url.match(/\/quotes(\/.*)?$/)?.[0];
        if (!quotesSuffix) {
            return url;
        }

        return `/reporting/developer-space/${this.developerId}${quotesSuffix}`;
    }

    /**
     * Start quotes export and return a stream of the JSON array. Caller must consume and destroy the stream.
     */
    async getQuotesStream(): Promise<Readable> {
        return this.initiateQuotesExportStream();
    }

    private async initiateQuotesExportStream(): Promise<Readable> {
        await this.initializeConfig();
        const today = new Date().toISOString().split('T')[0];
        const exportUrl = this.buildUrlWithParams(
            `${this.baseUrlV3}/reporting/developer-space/${this.developerId}/quotes/async/export`,
            { createdStartDate: '2010-01-01', createdEndDate: today, accept: 'json' }
        );
        console.log(`Calling Marketplace API: ${exportUrl}`);

        const exportResponse = await this.httpClient.post<v3Components['schemas']['Reports_InitiateAsyncExportQuotes']>(
            exportUrl,
            {},
            {
                headers: await this.getRequestHeaders({ 'Content-Type': 'application/json' }),
                context: 'Initiate quotes export',
            }
        );

        const statusHref = this.fixQuotesExportUrl(exportResponse._links.status.href);
        const downloadHref = this.fixQuotesExportUrl(exportResponse._links.download.href);

        const resultUrl = await this.pollForCompletion<v3Components['schemas']['Reports_GetStatusAsyncExportQuotes']>(
            this.baseUrlV3,
            statusHref,
            downloadHref,
            (data) => data.export.status
        );

        console.log(`Streaming quotes from API`);
        return this.getStreamForResultUrl(resultUrl);
    }

    async getQuoteDetails(params: {
        quoteNumber: string;
        entitlementNumber?: string;
    }): Promise<v3Components['schemas']['Reports_GetQuoteDetails']> {
        await this.initializeConfig();

        const url = this.buildUrlWithParams(
            `${this.baseUrlV3}/reporting/developer-space/${this.developerId}/quotes/details`,
            {
                quoteNumber: params.quoteNumber,
                entitlementNumber: params.entitlementNumber,
            }
        );
        console.log(`Calling Marketplace API: ${url}`);

        return this.httpClient.get<v3Components['schemas']['Reports_GetQuoteDetails']>(url, {
            headers: await this.getRequestHeaders(),
            context: `Fetch quote details (${params.quoteNumber})`,
        });
    }

    /**
     * Start both license exports and return streams of the JSON arrays (one per date range). Caller must consume and destroy the streams.
     */
    async getLicensesStreams(): Promise<Readable[]> {
        await this.initializeConfig();
        const streams: Readable[] = [];

        const licenseExportUrl = `${this.baseUrlV3}/reporting/developer-space/${this.developerId}/licenses/async/export`;

        const firstExportUrl = this.buildUrlWithParams(
            licenseExportUrl,
            { startDate: '2010-01-01', endDate: '2018-06-30', includeAtlassianLicenses: true }
        );
        console.log(`Calling Marketplace API: ${firstExportUrl}`);

        const firstExportResponse = await this.httpClient.post<v3Components["schemas"]["Reports_InitiateAsyncExportLicenses"]>(
            firstExportUrl,
            {},
            {
                headers: await this.getRequestHeaders({ 'Content-Type': 'application/json' }),
                context: 'Initiate licenses export (batch 1)',
            }
        );

        const firstResultUrl = await this.pollForCompletion<InitiateAsyncLicense>(
            this.baseUrlV3,
            firstExportResponse._links.status.href,
            firstExportResponse._links.download.href,
            (data) => data.export.status
        );

        console.log(`Streaming licenses (batch 1) from API`);
        const stream1 = await this.getStreamForResultUrl(firstResultUrl);

        const secondExportUrl = this.buildUrlWithParams(
            licenseExportUrl,
            { startDate: '2018-07-01', withDataInsights: true, includeAtlassianLicenses: true }
        );
        console.log(`Calling Marketplace API: ${secondExportUrl}`);

        const secondExportResponse = await this.httpClient.post<InitiateAsyncLicenseCollection>(
            secondExportUrl,
            {},
            {
                headers: await this.getRequestHeaders({ 'Content-Type': 'application/json' }),
                context: 'Initiate licenses export (batch 2)',
            }
        );

        const secondResultUrl = await this.pollForCompletion<InitiateAsyncLicense>(
            this.baseUrlV3,
            secondExportResponse._links.status.href,
            secondExportResponse._links.download.href,
            (data) => data.export.status
        );

        console.log(`Streaming licenses (batch 2) from API`);
        const stream2 = await this.getStreamForResultUrl(secondResultUrl);

        // Push in reverse order so that we process the newer licenses (with attribution data)
        // first, to work around MP-557 by ensuring that if there are duplicates, we always process
        // first the one with attribution data.

        streams.push(stream2);
        streams.push(stream1);

        return streams;
    }

    private mapCloudOrServerToHostingType(cloudOrServer: CloudOrServer): string|undefined {
        return cloudOrServer === 'cloud' ? 'CLOUD'
            : cloudOrServer === 'server' ? 'SERVER'
            : cloudOrServer === 'datacenter' ? 'DATACENTER'
            : undefined;
    }

    async getPricing(
        addonKey: string,
        productId: string|undefined,
        cloudOrServer: CloudOrServer,
        liveOrPending: LiveOrPending
    ): Promise<OurPricingData|undefined> {
        if (!productId) {
            throw new Error('Product ID is required');
        }

        await this.initializeConfig();

        // First, find out if this product is opted out of expert discounts

        const expertDiscountOptOutUrl = this.buildUrlWithParams(`${this.commerceBaseUrlV1}/product-ignore-rule/${productId}/promotion-type/partner`, {});
        console.log(`Calling Marketplace API: ${expertDiscountOptOutUrl}`);

        const expertDiscountOptOutResponse = await this.httpClient.get<commerceComponents["schemas"]["Promos_PublicProductIgnoreRuleResponse"]>(
            expertDiscountOptOutUrl,
            {
                headers: await this.getRequestHeaders(),
                context: `Fetch expert discount opt out for product ${productId}`,
            }
        );

        const expertDiscountOptOut = expertDiscountOptOutResponse.ignored ?? false;

        // Next, fetch the offerings for this product

        const offeringsUrl = this.buildUrlWithParams(`${this.commerceBaseUrl}/products/${productId}/offerings`, {
            status: liveOrPending === 'live' ? 'ACTIVE' : 'DRAFT',
            'hosting-type': this.mapCloudOrServerToHostingType(cloudOrServer)
        });
        console.log(`Calling Marketplace API: ${offeringsUrl}`);

        const offeringsResponse = await this.httpClient.get<commerceComponents["schemas"]["Offerings_PaginatedResponsePublicOfferingResponse"]>(
            offeringsUrl,
            {
                headers: await this.getRequestHeaders(),
                context: `Fetch offerings for product ${productId}`,
            }
        );

        let newResult : OurPricingData|undefined = undefined;

        // Iterate through all offerings

        for (const offering of offeringsResponse.values) {
            const { id } = offering;

            // Supported offering names: See https://developer.atlassian.com/platform/marketplace/marketplace-app-pricing-api/

            if (offering.name !== 'Standard' && offering.name !== 'Data Center') {
                // console.log(`Skipping offering because it is not Standard or Data Center: ${offering.name}`);
                continue;
            }

            // console.log('--------------------------------');
            // console.log(`OFFERING FOUND: ${offering.name}:`);
            // console.dir(offering);

            const pricingPlansUrl = this.buildUrlWithParams(`${this.commerceBaseUrl}/offerings/${id}/pricing-plans`,
                { 'page-size': 50 }
            );

            console.log(`Calling Marketplace API: ${pricingPlansUrl}`);
            const pricingPlansResponse = await this.httpClient.get<commerceComponents["schemas"]["Offerings_PaginatedResponsePublicPricingPlanResponse"]>(
                pricingPlansUrl,
                {
                    headers: await this.getRequestHeaders(),
                    context: `Fetch pricing plans for offering ${id}`,
                }
            );

            // console.log(`Pricing plans found for offering ${id} (${offering.name}): `, pricingPlansResponse.values.map(pp => pp.description));
            // console.dir('***Raw pricing plan response:')
            // console.dir(pricingPlansResponse);

            const commercialPricingPlans = pricingPlansResponse.values.filter(pp => pp.currency === 'USD' && pp.type==='COMMERCIAL');

            for (const commercialPricingPlan of commercialPricingPlans) {
                // console.log('Commercial pricing plan found:');
                // console.dir(commercialPricingPlan);

                const tiers = commercialPricingPlan.items[0].tiers;
                // console.log('Tiers found (top 10):');
                // console.dir(tiers.slice(0, 10));

                const cycleType = commercialPricingPlan.items[0].cycle.name;
                if (cloudOrServer !== 'cloud' &&cycleType==='ANNUAL') {
                    newResult = {
                        expertDiscountOptOut,
                        items: tiers
                            .map(tier => ({
                                monthsValid: 12,
                                amount: tier.flatAmount ? Math.floor(tier.flatAmount / 100) : 0,
                                unitCount: tier.ceiling ?? -1
                            }))
                            // sort -1 as highest, but otherwise ascending
                            .sort((a, b) => (a.unitCount === -1 ? 1 : b.unitCount === -1 ? -1 : a.unitCount - b.unitCount)),
                        perUnitItems: undefined
                    }
                } else if (cloudOrServer === 'cloud' &&cycleType==='MONTHLY') {
                    newResult = {
                        expertDiscountOptOut,
                        items: tiers
                            .filter(tier => tier.ceiling !== tier.floor) // strip out the weird floor=11, ceiling=11
                            .map(tier => ({
                                monthsValid: 1,
                                amount: tier.flatAmount ? tier.flatAmount / 100
                                        : tier.unitAmount ? tier.unitAmount / 100
                                        : 0,
                                unitCount: tier.ceiling ?? -1
                            }))
                            // sort -1 as highest, but otherwise ascending
                            .sort((a, b) => (a.unitCount === -1 ? 1 : b.unitCount === -1 ? -1 : a.unitCount - b.unitCount)),
                        perUnitItems: undefined
                    }
                }
            }
        }

        return newResult;

        /*
        // Legacy V.2 API request

        const url = `${this.baseUrl}/rest/2/addons/${addonKey}/pricing/${cloudOrServer}/${liveOrPending}`;
        console.log(`Calling Marketplace API: ${url}`);

        const response = await axios.get<PricingData>(url, {
            headers: {
                'Authorization': await this.getAuthHeader()
            }
        });

        const lr = response.data;

        const result = {
            expertDiscountOptOut: lr.expertDiscountOptOut,
            items: lr.items.map(item => ({
                monthsValid: item.monthsValid,
                amount: item.amount,
                unitCount: item.unitCount
            })),
            perUnitItems: lr.perUnitItems?.map(item => ({
                monthsValid: item.monthsValid,
                amount: item.amount,
                unitCount: item.unitCount
            }))
        };

        console.log('Legacy pricing data:')
        console.dir(result);
        return result;
        */
    }

    /**
     * Fetch all historical license snapshots for a SEN or entitlement ID from Atlassian.
     */
    async getLicenseHistory(searchText: string): Promise<LicenseHistorySnapshot[]> {
        await this.initializeConfig();

        const allLicenses: LicenseHistorySnapshot[] = [];
        let nextUrl: string | undefined = this.buildUrlWithParams(
            `${this.baseUrlV3}/reporting/developer-space/${this.developerId}/licenses`,
            {
                text: searchText,
                withDataInsights: true,
                includeAtlassianLicenses: true,
                showLicensesHistory: true,
                limit: 50
            }
        );

        while (nextUrl) {
            console.log(`Calling Marketplace API: ${nextUrl}`);

            const page: GetLicensesResponse = await this.httpClient.get<GetLicensesResponse>(nextUrl, {
                headers: await this.getRequestHeaders(),
                context: `Fetch license history (${searchText})`,
            });

            const licenses = page.licenses;
            if (Array.isArray(licenses)) {
                allLicenses.push(...licenses as LicenseHistorySnapshot[]);
            } else if (licenses) {
                allLicenses.push(licenses as LicenseHistorySnapshot);
            }

            const nextHref: string | undefined = page._links?.next?.href;
            nextUrl = nextHref ? this.resolveMarketplacePaginationUrl(nextHref) : undefined;
        }

        return allLicenses;
    }

    async getVendorSpecificAddons(): Promise<{ key: string; name: string; productId: string; }[]> {
        await this.initializeConfig();
        const url = this.buildUrlWithParams(
            `${this.baseUrlV3}/product-listing/developer-space/${this.developerId}`,
            { limit: 50 }
        );
        console.log(`Calling Marketplace API: ${url}`);

        const response = await this.httpClient.get<ListingResponse>(url, {
            headers: await this.getRequestHeaders({
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'
            }),
            context: 'Fetch vendor-specific addons',
        });

        if (response.links.next) {
            throw new Error('Pagination not supported yet: maximum number of registered apps exceeded');
        }

        return response.items.map(item => ({ key: item.appKey, name: item.appName, productId: item.productId }));
    }

    async getParentProductForAddon(appKey: string): Promise<string|undefined> {
        await this.initializeConfig();

        const softwareIdUrl = `${this.baseUrlV3}/app-software/app-key/${appKey}`;
        console.log(`Calling Marketplace API: ${softwareIdUrl}`);

        const softwareIdResponse = await this.httpClient.get<v3Components["schemas"]["AppSoftwareByAppKeyResponse"][]>(
            softwareIdUrl,
            {
                headers: await this.getRequestHeaders(),
                context: `Fetch app software ID for ${appKey}`,
            }
        );

        const softwareId = softwareIdResponse[0].appSoftwareId;

        const versionsUrl = `${this.baseUrlV3}/app-software/${softwareId}/versions`;
        console.log(`Calling Marketplace API: ${versionsUrl}`);

        const response = await this.httpClient.get<v3Components["schemas"]["AppSoftwareVersionsGetResponse"]>(
            versionsUrl,
            {
                headers: await this.getRequestHeaders(),
                context: `Fetch app software versions for ${appKey}`,
            }
        );

        if (!response.versions || response.versions.length === 0) {
            return undefined;
        }

        const parentSoftwareId = response.versions[0].compatibilities
            ? response.versions[0].compatibilities[0].parentSoftwareId
            : undefined;

        return parentSoftwareId;
    }
}
