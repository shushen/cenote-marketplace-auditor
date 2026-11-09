import { SlackService, SlackLicenseData, SlackTransactionData } from '../SlackService.js';
import { ConfigKey } from '#common/types/configItem.js';
import { SlackChannelType } from '#common/types/slackChannel.js';

const MARKETPLACE = 'https://marketplace.atlassian.com/manage/vendors/1225857/report/licenses/details/';

function sale(entitlementId: string): SlackTransactionData {
    return {
        saleDate: '2026-11-07', saleType: 'Renewal', addonName: 'Test App', licenseType: 'COMMERCIAL',
        hosting: 'Cloud', tier: '1 User', company: 'Acme', maintenanceStartDate: '2026-11-07',
        maintenanceEndDate: '2026-12-07', entitlementId, vendorAmount: 100,
    };
}

function evaluation(entitlementId: string): SlackLicenseData {
    return {
        licenseKind: 'EVALUATION', tier: undefined, lastUpdated: '2026-11-09', entitlementId,
        addonName: 'Test App', hosting: 'Cloud', company: 'Acme', cloudSiteHostname: 'acme.atlassian.net',
        maintenanceStartDate: '2026-11-08', maintenanceEndDate: '2026-12-08', oldMaintenanceEndDate: undefined,
        extended: false, evaluationOpportunitySize: undefined,
    };
}

describe('SlackService - entitlement links', () => {
    function setup(opts: { link?: boolean; vendorId?: string; baseUrl?: string } = {}) {
        const values: Record<string, unknown> = {
            [ConfigKey.SlackChannelEvaluations]: 'evals',
            [ConfigKey.SlackLinkToMarketplace]: opts.link,
            [ConfigKey.AtlassianVendorId]: 'vendorId' in opts ? opts.vendorId : '1225857',
            [ConfigKey.BaseUrl]: opts.baseUrl,
        };
        const configDao = { get: jest.fn(async (key: string) => values[key]) } as any;
        const service = new SlackService(configDao);
        const postMessage = jest.spyOn(service, 'postMessage').mockResolvedValue();
        return { service, postMessage };
    }
    const blocksText = (postMessage: jest.SpyInstance) => JSON.stringify(postMessage.mock.calls.map(c => c[2]));

    describe('when the option is off', () => {
        it('links sales to this app', async () => {
            const { service, postMessage } = setup({ baseUrl: 'https://auditor.example.com/' });
            await service.postNewTransactionsToSlack([sale('E-1')]);
            expect(blocksText(postMessage)).toContain('<https://auditor.example.com/transactions?search=E-1|');
            expect(blocksText(postMessage)).not.toContain('marketplace.atlassian.com');
        });

        it('links evaluations to this app, defaulting to localhost', async () => {
            const { service, postMessage } = setup();
            await service.postNewLicensesToSlack([evaluation('E-2')]);
            expect(blocksText(postMessage)).toContain('<http://localhost:3000/licenses?search=E-2|');
        });
    });

    describe('when the option is on', () => {
        it('links sales to the Marketplace license report', async () => {
            const { service, postMessage } = setup({ link: true });
            await service.postNewTransactionsToSlack([sale('E-458-MAY-MUA-N3Y')]);
            expect(postMessage.mock.calls[0][0]).toBe(SlackChannelType.Sales);
            expect(blocksText(postMessage)).toContain(`<${MARKETPLACE}E-458-MAY-MUA-N3Y|`);
            expect(blocksText(postMessage)).not.toContain('localhost');
        });

        it('links evaluations and free installs to the Marketplace license report', async () => {
            const { service, postMessage } = setup({ link: true });
            await service.postNewLicensesToSlack([evaluation('E-458-MAK-9YB-XUV')]);
            expect(blocksText(postMessage)).toContain(`<${MARKETPLACE}E-458-MAK-9YB-XUV|`);
        });

        it('keeps the entitlement ID as the visible link text', async () => {
            const { service, postMessage } = setup({ link: true });
            await service.postNewLicensesToSlack([evaluation('E-3')]);
            expect(blocksText(postMessage)).toContain('|*E-3*>');
        });

        it('uses the configured vendor ID, not a fixed one', async () => {
            const { service, postMessage } = setup({ link: true, vendorId: ' 999 ' });
            await service.postNewLicensesToSlack([evaluation('E-4')]);
            expect(blocksText(postMessage)).toContain('<https://marketplace.atlassian.com/manage/vendors/999/report/licenses/details/E-4|');
        });

        it('does not change quote links, which are not entitlements', async () => {
            const { service, postMessage } = setup({ link: true, baseUrl: 'https://auditor.example.com' });
            await service.postNewQuotesToSlack([{
                quoteNumber: 'Q-1', quoteStatus: 'ACCEPTED', quoteCreatedDate: '2026-11-01', quoteExpiryDate: undefined,
                company: 'Acme', productNames: 'Test App', lineCount: 1, totalListPrice: 10,
                scheduleStartDate: undefined, scheduleEndDate: undefined,
            }]);
            expect(blocksText(postMessage)).toContain('<https://auditor.example.com/quotes?search=Q-1|');
        });
    });
});
