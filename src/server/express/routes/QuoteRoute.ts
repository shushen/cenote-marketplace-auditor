import { Router, Request, Response } from 'express';
import { injectable, inject } from 'inversify';
import { TYPES } from '../../config/types.js';
import { QuoteDao } from '../../database/dao/QuoteDao.js';
import { QuoteQueryParams, QuoteQueryResult, QuoteQuerySortType } from '#common/types/apiTypes.js';

@injectable()
export class QuoteRoute {
    public router: Router;

    constructor(
        @inject(TYPES.QuoteDao) private quoteDao: QuoteDao
    ) {
        this.router = Router();
        this.initializeRoutes();
    }

    private initializeRoutes() {
        this.router.get('/', this.getQuotes.bind(this));
    }

    private async getQuotes(req: Request, res: Response) {
        try {
            const params: QuoteQueryParams = {
                start: parseInt(req.query.start as string) || 0,
                limit: parseInt(req.query.limit as string) || 25,
                sortBy: (req.query.sortBy as QuoteQuerySortType) || QuoteQuerySortType.CreatedDate,
                sortOrder: (req.query.sortOrder as 'ASC' | 'DESC') || 'DESC',
                search: req.query.search as string,
            };

            if (params.start! < 0) {
                res.status(400).json({ error: 'start must be non-negative' });
                return;
            }
            if (params.limit! < 1 || params.limit! > 100) {
                res.status(400).json({ error: 'limit must be between 1 and 100' });
                return;
            }

            if (!Object.values(QuoteQuerySortType).includes(params.sortBy as QuoteQuerySortType)) {
                res.status(400).json({
                    error: `sortBy must be one of: ${Object.values(QuoteQuerySortType).join(', ')}`,
                });
                return;
            }

            if (params.sortOrder !== 'ASC' && params.sortOrder !== 'DESC') {
                res.status(400).json({ error: 'sortOrder must be either ASC or DESC' });
                return;
            }

            const result: QuoteQueryResult = await this.quoteDao.getQuotes(params);
            res.json(result);
        } catch (error) {
            console.error('Error fetching quotes:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
}
