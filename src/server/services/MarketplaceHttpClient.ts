import { injectable } from 'inversify';
import axios, { AxiosError, AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import { Readable } from 'stream';
import { MarketplaceApiError } from './MarketplaceApiError.js';
import {
    MARKETPLACE_HOST_LIMITS,
    MARKETPLACE_HTTP_MAX_RETRIES,
    MarketplaceHostKey,
    resolveMarketplaceHostKey,
} from './marketplaceHttpConfig.js';
import { MarketplaceRateLimiterRegistry } from './MarketplaceHostRateLimiter.js';
import {
    computeBackoffMs,
    parseRetryAfterMs,
    RETRYABLE_HTTP_STATUS_CODES,
    sleep,
} from './marketplaceHttpRetry.js';

export interface MarketplaceHttpRequestOptions {
    headers?: Record<string, string>;
    method?: Method;
    data?: unknown;
    responseType?: 'json' | 'stream';
    context?: string;
}

@injectable()
export class MarketplaceHttpClient {
    private readonly limiters = new MarketplaceRateLimiterRegistry(MARKETPLACE_HOST_LIMITS);

    async get<T>(url: string, options: MarketplaceHttpRequestOptions = {}): Promise<T> {
        const response = await this.request<T>({
            ...options,
            method: 'GET',
            url,
            responseType: options.responseType ?? 'json',
        });
        return response.data;
    }

    async post<T>(url: string, data: unknown = {}, options: MarketplaceHttpRequestOptions = {}): Promise<T> {
        const response = await this.request<T>({
            ...options,
            method: 'POST',
            url,
            data,
            responseType: options.responseType ?? 'json',
        });
        return response.data;
    }

    async getStream(url: string, options: MarketplaceHttpRequestOptions = {}): Promise<Readable> {
        const response = await this.request<Readable>({
            ...options,
            method: 'GET',
            url,
            responseType: 'stream',
        });
        return response.data;
    }

    private async request<T>(config: AxiosRequestConfig & MarketplaceHttpRequestOptions): Promise<AxiosResponse<T>> {
        const hostKey = resolveMarketplaceHostKey(config.url ?? '');
        const method = (config.method ?? 'GET').toUpperCase();
        const context = config.context ?? `${method} ${config.url}`;
        let lastError: unknown;

        for (let attempt = 0; attempt <= MARKETPLACE_HTTP_MAX_RETRIES; attempt += 1) {
            await this.limiters.acquire(hostKey);

            try {
                const response = await axios.request<T>({
                    url: config.url,
                    method: config.method,
                    data: config.data,
                    headers: config.headers,
                    responseType: config.responseType,
                    validateStatus: () => true,
                });

                if (response.status >= 200 && response.status < 300) {
                    return response;
                }

                if (RETRYABLE_HTTP_STATUS_CODES.has(response.status) && attempt < MARKETPLACE_HTTP_MAX_RETRIES) {
                    const waitMs = parseRetryAfterMs(response.headers as Record<string, unknown>)
                        ?? computeBackoffMs(attempt);
                    console.warn(
                        `[marketplace-http] ${response.status} on ${context}; ` +
                        `retrying in ${waitMs}ms (attempt ${attempt + 1}/${MARKETPLACE_HTTP_MAX_RETRIES})`
                    );
                    await sleep(waitMs);
                    continue;
                }

                throw this.createApiError(response.status, response.data, context);
            } catch (error) {
                lastError = error;

                if (error instanceof MarketplaceApiError) {
                    throw error;
                }

                const axiosError = error as AxiosError;
                const status = axiosError.response?.status;
                if (status && RETRYABLE_HTTP_STATUS_CODES.has(status) && attempt < MARKETPLACE_HTTP_MAX_RETRIES) {
                    const waitMs = parseRetryAfterMs(axiosError.response?.headers as Record<string, unknown>)
                        ?? computeBackoffMs(attempt);
                    console.warn(
                        `[marketplace-http] ${status} on ${context}; ` +
                        `retrying in ${waitMs}ms (attempt ${attempt + 1}/${MARKETPLACE_HTTP_MAX_RETRIES})`
                    );
                    await sleep(waitMs);
                    continue;
                }

                if (axios.isAxiosError(error) && error.response) {
                    throw this.createApiError(error.response.status, error.response.data, context);
                }

                throw error;
            } finally {
                this.limiters.release(hostKey);
            }
        }

        if (lastError instanceof MarketplaceApiError) {
            throw lastError;
        }

        throw new MarketplaceApiError(
            `${context}: rate limited after ${MARKETPLACE_HTTP_MAX_RETRIES} retries`,
            429
        );
    }

    private createApiError(status: number, data: unknown, context: string): MarketplaceApiError {
        const body = data as { message?: string; error?: string } | undefined;
        const upstreamMessage = body?.message ?? body?.error;
        const message = upstreamMessage
            ? `${context}: ${upstreamMessage}`
            : `${context} (HTTP ${status})`;
        return new MarketplaceApiError(message, status, upstreamMessage);
    }
}
