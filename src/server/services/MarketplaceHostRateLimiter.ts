import { MarketplaceHostKey, MarketplaceHostLimitConfig } from './marketplaceHttpConfig.js';
import { sleep } from './marketplaceHttpRetry.js';

interface QueuedRequest {
    resolve: () => void;
}

export class MarketplaceHostRateLimiter {
    private activeCount = 0;
    private lastStartedAt = 0;
    private readonly queue: QueuedRequest[] = [];
    private drainChain: Promise<void> = Promise.resolve();

    constructor(private readonly config: MarketplaceHostLimitConfig) {}

    async acquire(): Promise<void> {
        await new Promise<void>(resolve => {
            this.queue.push({ resolve });
            this.scheduleDrain();
        });
    }

    release(): void {
        this.activeCount = Math.max(0, this.activeCount - 1);
        this.scheduleDrain();
    }

    private scheduleDrain(): void {
        this.drainChain = this.drainChain.then(() => this.drainQueue());
    }

    private async drainQueue(): Promise<void> {
        while (this.activeCount < this.config.maxConcurrent && this.queue.length > 0) {
            const next = this.queue.shift();
            if (!next) {
                return;
            }

            const now = Date.now();
            const waitMs = Math.max(0, this.config.minTimeMs - (now - this.lastStartedAt));
            if (waitMs > 0) {
                await sleep(waitMs);
            }

            this.activeCount += 1;
            this.lastStartedAt = Date.now();
            next.resolve();
        }
    }
}

export class MarketplaceRateLimiterRegistry {
    private readonly limiters = new Map<MarketplaceHostKey, MarketplaceHostRateLimiter>();

    constructor(
        private readonly configs: Record<MarketplaceHostKey, MarketplaceHostLimitConfig>
    ) {}

    async acquire(hostKey: MarketplaceHostKey): Promise<void> {
        await this.getLimiter(hostKey).acquire();
    }

    release(hostKey: MarketplaceHostKey): void {
        this.getLimiter(hostKey).release();
    }

    private getLimiter(hostKey: MarketplaceHostKey): MarketplaceHostRateLimiter {
        let limiter = this.limiters.get(hostKey);
        if (!limiter) {
            limiter = new MarketplaceHostRateLimiter(this.configs[hostKey]);
            this.limiters.set(hostKey, limiter);
        }
        return limiter;
    }
}
