import {
    MARKETPLACE_HTTP_INITIAL_BACKOFF_MS,
    MARKETPLACE_HTTP_MAX_BACKOFF_MS,
} from './marketplaceHttpConfig.js';

export const RETRYABLE_HTTP_STATUS_CODES = new Set([429, 503]);

export function parseRetryAfterMs(headers: Record<string, unknown> | undefined): number | undefined {
    if (!headers) {
        return undefined;
    }

    const retryAfter = headers['retry-after'] ?? headers['Retry-After'];
    if (retryAfter === undefined || retryAfter === null) {
        return undefined;
    }

    const asNumber = Number(retryAfter);
    if (!Number.isNaN(asNumber)) {
        return Math.max(0, asNumber * 1000);
    }

    const asDate = Date.parse(String(retryAfter));
    if (!Number.isNaN(asDate)) {
        return Math.max(0, asDate - Date.now());
    }

    return undefined;
}

export function computeBackoffMs(attempt: number): number {
    const exponential = MARKETPLACE_HTTP_INITIAL_BACKOFF_MS * (2 ** attempt);
    const capped = Math.min(exponential, MARKETPLACE_HTTP_MAX_BACKOFF_MS);
    const jitter = Math.floor(Math.random() * 500);
    return capped + jitter;
}

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}
