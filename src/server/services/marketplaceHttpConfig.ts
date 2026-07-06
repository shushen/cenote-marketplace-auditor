export interface MarketplaceHostLimitConfig {
    maxConcurrent: number;
    minTimeMs: number;
}

export type MarketplaceHostKey = 'commerce' | 'marketplace-v3' | 'marketplace-legacy';

export const MARKETPLACE_HOST_LIMITS: Record<MarketplaceHostKey, MarketplaceHostLimitConfig> = {
    commerce: {
        maxConcurrent: 5,
        minTimeMs: 200,
    },
    'marketplace-v3': {
        maxConcurrent: 8,
        minTimeMs: 150,
    },
    'marketplace-legacy': {
        maxConcurrent: 2,
        minTimeMs: 500,
    },
};

export const MARKETPLACE_HTTP_MAX_RETRIES = 6;
export const MARKETPLACE_HTTP_MAX_BACKOFF_MS = 60_000;
export const MARKETPLACE_HTTP_INITIAL_BACKOFF_MS = 1_000;

export function resolveMarketplaceHostKey(url: string): MarketplaceHostKey {
    const parsed = new URL(url);

    if (parsed.hostname === 'marketplace.atlassian.com') {
        return 'marketplace-legacy';
    }

    if (parsed.pathname.startsWith('/commerce/')) {
        return 'commerce';
    }

    return 'marketplace-v3';
}
