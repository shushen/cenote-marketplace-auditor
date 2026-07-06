import { computeBackoffMs, parseRetryAfterMs } from '../marketplaceHttpRetry.js';
import { resolveMarketplaceHostKey } from '../marketplaceHttpConfig.js';

describe('marketplaceHttpRetry', () => {
    describe('parseRetryAfterMs', () => {
        it('parses Retry-After seconds', () => {
            expect(parseRetryAfterMs({ 'retry-after': '2' })).toBe(2000);
        });

        it('parses Retry-After HTTP date', () => {
            const future = new Date(Date.now() + 5000).toUTCString();
            const waitMs = parseRetryAfterMs({ 'Retry-After': future });
            expect(waitMs).toBeGreaterThanOrEqual(4000);
            expect(waitMs).toBeLessThanOrEqual(6000);
        });
    });

    describe('computeBackoffMs', () => {
        it('grows with attempt count', () => {
            expect(computeBackoffMs(0)).toBeGreaterThanOrEqual(1000);
            expect(computeBackoffMs(2)).toBeGreaterThan(computeBackoffMs(0));
        });
    });
});

describe('marketplaceHttpConfig', () => {
    describe('resolveMarketplaceHostKey', () => {
        it('maps legacy marketplace host', () => {
            expect(resolveMarketplaceHostKey('https://marketplace.atlassian.com/rest/3/foo'))
                .toBe('marketplace-legacy');
        });

        it('maps commerce host', () => {
            expect(resolveMarketplaceHostKey('https://api.atlassian.com/commerce/api/v2/products/1'))
                .toBe('commerce');
        });

        it('maps marketplace v3 host', () => {
            expect(resolveMarketplaceHostKey('https://api.atlassian.com/marketplace/rest/3/reporting'))
                .toBe('marketplace-v3');
        });
    });
});
