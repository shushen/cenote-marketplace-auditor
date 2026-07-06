import { DataSource, Repository } from 'typeorm';
import { Quote } from '#common/entities/Quote.js';
import { inject, injectable } from 'inversify';
import { TYPES } from '../../config/types.js';
import { QuoteQueryParams, QuoteQueryResult, QuoteQuerySortType } from '#common/types/apiTypes.js';
import { QuoteResult } from '#common/types/apiTypes.js';

@injectable()
export class QuoteDao {
    private quoteRepo: Repository<Quote>;

    private readonly sortFieldMap: Record<QuoteQuerySortType, string[]> = {
        [QuoteQuerySortType.CreatedAt]: ['quote.createdAt'],
        [QuoteQuerySortType.UpdatedAt]: ['quote.updatedAt'],
        [QuoteQuerySortType.CreatedDate]: ["quote.data->>'quoteCreatedDate'", 'quote.createdAt'],
        [QuoteQuerySortType.ExpiryDate]: ["quote.data->>'quoteExpiryDate'", 'quote.createdAt'],
        [QuoteQuerySortType.StartDate]: [
            `(SELECT min(schedule->>'startDate') FROM jsonb_array_elements(quote.data->'lines') line, jsonb_array_elements(line->'schedules') schedule)`,
            'quote.createdAt',
        ],
        [QuoteQuerySortType.EndDate]: [
            `(SELECT max(schedule->>'endDate') FROM jsonb_array_elements(quote.data->'lines') line, jsonb_array_elements(line->'schedules') schedule)`,
            'quote.createdAt',
        ],
        [QuoteQuerySortType.VersionCount]: ['version_count.version_count', 'quote.createdAt'],
        [QuoteQuerySortType.LineCount]: [
            `jsonb_array_length(COALESCE(quote.data->'lines', '[]'::jsonb))`,
            'quote.createdAt',
        ],
        [QuoteQuerySortType.ScheduleCount]: [
            `(SELECT coalesce(sum(jsonb_array_length(line->'schedules')), 0) FROM jsonb_array_elements(quote.data->'lines') line)`,
            'quote.createdAt',
        ],
    };

    constructor(@inject(TYPES.DataSource) dataSource: DataSource) {
        this.quoteRepo = dataSource.getRepository(Quote);
    }

    public async getQuoteForQuoteNumber(marketplaceQuoteNumber: string): Promise<Quote | null> {
        return await this.quoteRepo.findOne({ where: { marketplaceQuoteNumber } });
    }

    public async getQuoteById(quoteId: string): Promise<Quote | null> {
        return await this.quoteRepo.findOne({ where: { id: quoteId } });
    }

    public async saveQuote(quote: Quote): Promise<void> {
        await this.quoteRepo.save(quote);
    }

    public async getQuoteCount(): Promise<number> {
        return await this.quoteRepo.count();
    }

    private escapeDoubleQuotes(str: string): string {
        return str.replace(/"/g, '\\"');
    }

    async getQuotes(params: QuoteQueryParams): Promise<QuoteQueryResult> {
        const {
            start = 0,
            limit = 25,
            sortBy = QuoteQuerySortType.CreatedDate,
            sortOrder = 'DESC',
            search,
        } = params;

        const queryBuilder = this.quoteRepo.createQueryBuilder('quote');

        queryBuilder.addCommonTableExpression(`
            SELECT quote_version.quote_id as qid, count(id) as version_count
            FROM quote_version
            GROUP BY quote_version.quote_id`,
            'version_count'
        );

        queryBuilder.addSelect('COALESCE(version_count.version_count, 0)', 'quote_versionCount');
        queryBuilder.leftJoin('version_count', 'version_count', 'version_count.qid = quote.id');

        if (search) {
            queryBuilder.where(
                'jsonb_path_exists(quote.data, format(\'$.** ? (@.type() == "string" && @ like_regex %s flag "qi")\', :search::text)::jsonpath) OR jsonb_path_exists(quote.details, format(\'$.** ? (@.type() == "string" && @ like_regex %s flag "qi")\', :search::text)::jsonpath)',
                { search: `"${this.escapeDoubleQuotes(search)}"` }
            );
        }

        const orderByField = this.sortFieldMap[sortBy as QuoteQuerySortType];
        if (!orderByField) {
            throw new Error(`Invalid sortBy: ${sortBy}`);
        }

        orderByField.forEach(field => queryBuilder.addOrderBy(field, sortOrder));

        const total = await queryBuilder.getCount();

        queryBuilder.offset(start).limit(limit);

        const { raw: rawResults, entities: quotes } = await queryBuilder.getRawAndEntities();

        const quoteResults = quotes.map((quote, index) => {
            const versionCount = parseInt(rawResults[index].quote_versionCount) || 0;

            return {
                quote,
                versionCount,
            } as QuoteResult;
        });

        return {
            quotes: quoteResults,
            total,
            count: quoteResults.length,
        };
    }
}
