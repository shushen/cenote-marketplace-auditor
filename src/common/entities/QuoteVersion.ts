import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, Unique } from 'typeorm';
import type { Relation } from 'typeorm';
import type { Quote } from './Quote.js';
import type { QuoteAggregateData, QuoteDetailsData } from '../types/marketplace.js';

@Entity()
@Unique(['quote', 'version'])
export class QuoteVersion {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @Column({ type: 'varchar' })
    @Index()
    marketplaceQuoteNumber!: string;

    @Column({ type: 'int' })
    version!: number;

    @Column('jsonb')
    @Index('IDX_quote_version_data_gin', { synchronize: false })
    data!: QuoteAggregateData;

    @Column('jsonb')
    @Index('IDX_quote_version_details_gin', { synchronize: false })
    details!: QuoteDetailsData;

    @Column({ type: 'text', nullable: true })
    diffQuote?: string | null;

    @Column({ type: 'text', nullable: true })
    diffDetails?: string | null;

    @ManyToOne('Quote', 'versions')
    quote!: Relation<Quote>;
}
