import { SlackService, SlackLicenseData } from '../SlackService.js';
import { ConfigKey } from '#common/types/configItem.js';
import { License } from '#common/entities/License.js';

function license(licenseType: string, overrides: Record<string, unknown> = {}): License {
    return {
        data: {
            licenseType,
            hosting: 'Cloud',
            licenseId: 'LEGACY-1',
            appEntitlementNumber: 'E-44M-AF9-FG5-5X4',
            addonName: 'Test Free App',
            lastUpdated: '2026-04-24',
            tier: '1397 Users',
            maintenanceStartDate: '2026-04-24',
            cloudSiteHostname: 'curriculumassociates.atlassian.net',
            contactDetails: { company: 'curriculumassociates' },
            ...overrides,
        },
    } as unknown as License;
}

function slackLicense(kind: 'EVALUATION' | 'FREE', id: string, overrides: Partial<SlackLicenseData> = {}): SlackLicenseData {
    return {
        licenseKind: kind,
        tier: kind === 'FREE' ? '1397 Users' : undefined,
        lastUpdated: '2026-11-09',
        entitlementId: id,
        addonName: 'Test App',
        hosting: 'Cloud',
        company: 'Acme',
        cloudSiteHostname: 'acme.atlassian.net',
        maintenanceStartDate: '2026-11-08',
        maintenanceEndDate: kind === 'EVALUATION' ? '2026-12-08' : undefined,
        oldMaintenanceEndDate: undefined,
        extended: false,
        evaluationOpportunitySize: undefined,
        ...overrides,
    };
}

describe('SlackService - free installs in the evaluations channel', () => {
    function setup(filter?: string) {
        const values: Record<string, string | undefined> = {
            [ConfigKey.SlackChannelEvaluations]: 'evals',
            [ConfigKey.SlackEvaluationsSiteFilter]: filter,
        };
        const configDao = { get: jest.fn(async (key: string) => values[key]) } as any;
        const service = new SlackService(configDao);
        const postMessage = jest.spyOn(service, 'postMessage').mockResolvedValue();
        return { service, postMessage };
    }
    const blocksText = (postMessage: jest.SpyInstance) => JSON.stringify(postMessage.mock.calls.map(c => c[2]));

    describe('mapLicenseForSlack', () => {
        const { service } = setup();
        const map = (l: License) => service.mapLicenseForSlack({ license: l, oldLicenseData: undefined, extended: false });

        it('maps a FREE license, keeping the tier and leaving the missing end date undefined', () => {
            const result = map(license('FREE'));
            expect(result).toMatchObject({
                licenseKind: 'FREE',
                tier: '1397 Users',
                entitlementId: 'E-44M-AF9-FG5-5X4',
                cloudSiteHostname: 'curriculumassociates.atlassian.net',
            });
            expect(result?.maintenanceEndDate).toBeUndefined();
        });

        it('still maps an EVALUATION license', () => {
            expect(map(license('EVALUATION', { maintenanceEndDate: '2026-05-24' }))).toMatchObject({
                licenseKind: 'EVALUATION',
                maintenanceEndDate: '2026-05-24',
            });
        });

        it.each(['COMMERCIAL', 'LEGACY_FREE', 'OPEN_SOURCE', 'ACADEMIC'])('does not map %s licenses', (type) => {
            expect(map(license(type))).toBeUndefined();
        });
    });

    describe('postNewLicensesToSlack', () => {
        it('shows a free install with its tier and no NaN or Unknown dates', async () => {
            const { service, postMessage } = setup();
            await service.postNewLicensesToSlack([slackLicense('FREE', 'E-FREE-1')]);

            expect(postMessage).toHaveBeenCalledTimes(1);
            expect(postMessage.mock.calls[0][1]).toBe('🔍 1 New Free Install');
            const text = blocksText(postMessage);
            expect(text).toContain('License:\\n*Free* (no expiry, started 2026-11-08)');
            expect(text).toContain('1397 Users');
            expect(text).not.toContain('NaN');
            expect(text).not.toContain('Evaluation Period');
        });

        it('leaves evaluation-only messages unchanged', async () => {
            const { service, postMessage } = setup();
            await service.postNewLicensesToSlack([slackLicense('EVALUATION', 'E-EVAL-1')]);

            expect(postMessage.mock.calls[0][1]).toBe('🔍 1 New Evaluation');
            expect(blocksText(postMessage)).toContain('Evaluation Period:\\n*30 days* (2026-11-08 to 2026-12-08)');
        });

        it('counts each kind in the header of a mixed batch', async () => {
            const { service, postMessage } = setup();
            await service.postNewLicensesToSlack([
                slackLicense('EVALUATION', 'E-1'),
                slackLicense('FREE', 'E-2'),
                slackLicense('FREE', 'E-3'),
            ]);

            expect(postMessage).toHaveBeenCalledTimes(1);
            expect(postMessage.mock.calls[0][1]).toBe('🔍 1 New Evaluation, 2 New Free Installs');
        });

        it('applies the site filter to free installs too', async () => {
            const { service, postMessage } = setup('^(?!.*(bugbounty|bugcrowd))');
            await service.postNewLicensesToSlack([
                slackLicense('FREE', 'E-KEEP', { cloudSiteHostname: 'curriculumassociates.atlassian.net' }),
                slackLicense('FREE', 'E-BOUNTY', { cloudSiteHostname: 'bugbounty-test-microck.atlassian.net' }),
            ]);

            expect(postMessage.mock.calls[0][1]).toBe('🔍 1 New Free Install');
            const text = blocksText(postMessage);
            expect(text).toContain('E-KEEP');
            expect(text).not.toContain('E-BOUNTY');
        });

        it('does not produce NaN for an evaluation that has no end date', async () => {
            const { service, postMessage } = setup();
            await service.postNewLicensesToSlack([slackLicense('EVALUATION', 'E-NOEND', { maintenanceEndDate: undefined })]);
            expect(blocksText(postMessage)).not.toContain('NaN');
        });
    });
});
