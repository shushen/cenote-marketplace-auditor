import { TransactionVersion } from "#common/entities/TransactionVersion.js";
import { Transaction } from "#common/entities/Transaction.js";
import { TYPES } from "#server/config/types.js";
import { inject, injectable } from "inversify";
import { DataSource, In, Repository } from "typeorm";
import { isUUID } from '#common/util/validator.js';

@injectable()
export class TransactionVersionDao {
    private transactionVersionRepo: Repository<TransactionVersion>;

    constructor(@inject(TYPES.DataSource) dataSource: DataSource) {
        this.transactionVersionRepo = dataSource.getRepository(TransactionVersion);
    }

    public async getTransactionVersions(transactionId: string): Promise<TransactionVersion[]> {
        if (!isUUID(transactionId)) {
            throw new Error('Invalid transaction ID: must be a valid UUID');
        }

        return await this.transactionVersionRepo.find({
            where: { transaction: { id: transactionId } },
            order: { version: 'DESC' }
        });
    }

    public async getCurrentVersionCreatedAtByTransactionIds(
        transactions: Pick<Transaction, 'id' | 'currentVersion'>[]
    ): Promise<Map<string, Date>> {
        if (transactions.length === 0) {
            return new Map();
        }

        const currentVersionByTransactionId = new Map(
            transactions.map(transaction => [transaction.id, transaction.currentVersion])
        );
        const versions = await this.transactionVersionRepo.find({
            where: { transaction: { id: In([...currentVersionByTransactionId.keys()]) } },
            relations: ['transaction']
        });

        const createdAtByTransactionId = new Map<string, Date>();
        for (const version of versions) {
            const transactionId = version.transaction.id;
            if (version.version === currentVersionByTransactionId.get(transactionId)) {
                createdAtByTransactionId.set(transactionId, version.createdAt);
            }
        }

        return createdAtByTransactionId;
    }

    public async getTransactionVersionByNumber(opts: { transactionId: string, version: number }): Promise<TransactionVersion | null> {
        const { transactionId, version } = opts;

        if (!isUUID(opts.transactionId)) {
            throw new Error('Invalid transaction ID: must be a valid UUID');
        }

        return await this.transactionVersionRepo.findOne({
            where: { transaction: { id: transactionId }, version }
        });
    }

    public async getTransactionHighestVersion(transaction: Transaction) : Promise<number> {
        const queryBuilder = this.transactionVersionRepo.createQueryBuilder('transaction_version');
        queryBuilder.select('MAX(transaction_version.version)', 'maxVersion');
        queryBuilder.where('transaction_version.transaction_id = :transactionId', { transactionId: transaction.id });

        const result = await queryBuilder.getRawOne();
        const maxVersion = result?.maxVersion;
        return maxVersion ?? 0;
    }

    public async saveTransactionVersions(...versions: TransactionVersion[]) : Promise<void> {
        await this.transactionVersionRepo.save(versions);
    }
}