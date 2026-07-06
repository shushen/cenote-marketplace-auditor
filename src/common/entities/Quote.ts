import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, OneToMany } from 'typeorm';
import type { Relation } from 'typeorm';
import type { QuoteVersion } from './QuoteVersion.js';
import type { QuoteAggregateData, QuoteDetailsData } from '../types/marketplace.js';

@Entity()
export class Quote {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @UpdateDateColumn()
    updatedAt!: Date;

    @Column({ type: 'varchar' })
    @Index({ unique: true })
    marketplaceQuoteNumber!: string;

    @Column({ type: 'int' })
    currentVersion!: number;

    @Column('jsonb')
    @Index('IDX_quote_data_gin', { synchronize: false })
    data!: QuoteAggregateData;

    @Column('jsonb')
    @Index('IDX_quote_details_gin', { synchronize: false })
    details!: QuoteDetailsData;

    @OneToMany('QuoteVersion', 'versions')
    versions!: Relation<QuoteVersion>[];
}
