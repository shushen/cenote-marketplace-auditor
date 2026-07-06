import { Router, Request, Response } from 'express';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../config/types.js';
import { QuoteVersionDao } from '../../database/dao/QuoteVersionDao.js';

@injectable()
export class QuoteVersionRoute {
    public readonly router: Router;

    constructor(
        @inject(TYPES.QuoteVersionDao) private quoteVersionDao: QuoteVersionDao
    ) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes(): void {
        this.router.get('/:quoteId/versions', this.getQuoteVersions.bind(this));
    }

    private async getQuoteVersions(req: Request, res: Response): Promise<void> {
        try {
            const { quoteId } = req.params;

            if (!quoteId) {
                res.status(400).json({ error: 'Quote ID is required' });
                return;
            }

            const versions = await this.quoteVersionDao.getQuoteVersions(quoteId);
            res.json(versions);
        } catch (error) {
            console.error('Error fetching quote versions:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
