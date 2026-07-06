import { QuoteVersion } from '#common/entities/QuoteVersion.js';
import { Quote } from '#common/entities/Quote.js';
import { TYPES } from '#server/config/types.js';
import { inject, injectable } from 'inversify';
import { DataSource, Repository } from 'typeorm';
import { isUUID } from '#common/util/validator.js';

@injectable()
export class QuoteVersionDao {
    private quoteVersionRepo: Repository<QuoteVersion>;

    constructor(@inject(TYPES.DataSource) dataSource: DataSource) {
        this.quoteVersionRepo = dataSource.getRepository(QuoteVersion);
    }

    public async getQuoteVersions(quoteId: string): Promise<QuoteVersion[]> {
        if (!isUUID(quoteId)) {
            throw new Error('Invalid quote ID: must be a valid UUID');
        }

        return await this.quoteVersionRepo.find({
            where: { quote: { id: quoteId } },
            order: { version: 'DESC' },
        });
    }

    public async getQuoteHighestVersion(quote: Quote): Promise<number> {
        const queryBuilder = this.quoteVersionRepo.createQueryBuilder('quote_version');
        queryBuilder.select('MAX(quote_version.version)', 'maxVersion');
        queryBuilder.where('quote_version.quote_id = :quoteId', { quoteId: quote.id });

        const result = await queryBuilder.getRawOne();
        const maxVersion = result?.maxVersion;
        return maxVersion ?? 0;
    }

    public async saveQuoteVersions(...versions: QuoteVersion[]): Promise<void> {
        await this.quoteVersionRepo.save(versions);
    }
}
