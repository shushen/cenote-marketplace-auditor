import { Readable } from 'stream';
import StreamArray from 'stream-json/streamers/StreamArray.js';
import { Quote } from '#common/entities/Quote.js';
import { QuoteVersion } from '#common/entities/QuoteVersion.js';
import { deepEqual, normalizeObject, computeJsonPaths } from '#common/util/objectUtils.js';
import { printJsonDiff } from '#common/util/jsonDiff.js';
import { QuoteData, QuoteDetailsData, QuoteAggregateData } from '#common/types/marketplace.js';
import {
    buildQuoteAggregateData,
    getQuoteNumberFromRow,
} from '#common/util/quoteAggregateUtils.js';
import { TYPES } from '../config/types.js';
import { inject, injectable } from 'inversify';
import { QuoteDao } from '../database/dao/QuoteDao.js';
import { QuoteVersionDao } from '#server/database/dao/QuoteVersionDao.js';
import { MarketplaceService } from '../services/MarketplaceService.js';

export interface ProcessOneQuoteResult {
    processed: number;
    new: number;
    modified: number;
    skipped: number;
}

const QUOTE_DETAILS_CONCURRENCY = 10;

interface QuoteGroup {
    quoteNumber: string;
    rows: QuoteData[];
}

@injectable()
export class QuoteJob {
    constructor(
        @inject(TYPES.QuoteDao) private quoteDao: QuoteDao,
        @inject(TYPES.QuoteVersionDao) private quoteVersionDao: QuoteVersionDao,
        @inject(TYPES.MarketplaceService) private marketplaceService: MarketplaceService
    ) {}

    async processOneQuote(
        quoteNumber: string,
        quoteData: QuoteAggregateData,
        detailsData: QuoteDetailsData
    ): Promise<ProcessOneQuoteResult> {
        const existingQuote = await this.quoteDao.getQuoteForQuoteNumber(quoteNumber);

        const normalizedData = normalizeObject(quoteData);
        const normalizedDetails = normalizeObject(detailsData);
        let currentVersion = 1;

        if (existingQuote) {
            const quoteChanged = !deepEqual(existingQuote.data, normalizedData);
            const detailsChanged = !deepEqual(existingQuote.details, normalizedDetails);

            if (!quoteChanged && !detailsChanged) {
                return { processed: 1, new: 0, modified: 0, skipped: 0 };
            }

            const changedQuotePaths = quoteChanged
                ? computeJsonPaths(existingQuote.data, normalizedData)
                : [];
            const changedDetailsPaths = detailsChanged
                ? computeJsonPaths(existingQuote.details, normalizedDetails)
                : [];

            console.log(`Quote changed: ${quoteNumber}`);
            if (changedQuotePaths.length > 0) {
                console.log('Changed quote paths:', changedQuotePaths.join(' | '));
                printJsonDiff(existingQuote.data, normalizedData);
            }
            if (changedDetailsPaths.length > 0) {
                console.log('Changed details paths:', changedDetailsPaths.join(' | '));
                printJsonDiff(existingQuote.details, normalizedDetails);
            }

            const oldVersionNum = await this.quoteVersionDao.getQuoteHighestVersion(existingQuote);
            currentVersion = oldVersionNum + 1;

            const version = new QuoteVersion();
            version.data = normalizedData;
            version.details = normalizedDetails;
            version.quote = existingQuote;
            version.marketplaceQuoteNumber = quoteNumber;
            version.diffQuote = changedQuotePaths.length > 0 ? changedQuotePaths.join(' | ') : undefined;
            version.diffDetails = changedDetailsPaths.length > 0 ? changedDetailsPaths.join(' | ') : undefined;
            version.version = currentVersion;

            await this.quoteVersionDao.saveQuoteVersions(version);

            existingQuote.data = normalizedData;
            existingQuote.details = normalizedDetails;
            existingQuote.currentVersion = currentVersion;
            await this.quoteDao.saveQuote(existingQuote);

            return { processed: 1, new: 0, modified: 1, skipped: 0 };
        }

        const quote = new Quote();
        quote.marketplaceQuoteNumber = quoteNumber;
        quote.data = normalizedData;
        quote.details = normalizedDetails;
        quote.currentVersion = currentVersion;
        await this.quoteDao.saveQuote(quote);

        const version = new QuoteVersion();
        version.data = normalizedData;
        version.details = normalizedDetails;
        version.quote = quote;
        version.marketplaceQuoteNumber = quoteNumber;
        version.version = currentVersion;
        await this.quoteVersionDao.saveQuoteVersions(version);

        const company = normalizedData.lines[0]?.technicalContactCompany ?? 'unknown company';
        console.log(`Created new quote: ${quoteNumber} (${company})`);

        return { processed: 1, new: 1, modified: 0, skipped: 0 };
    }

    private async fetchAndProcessQuoteGroup(group: QuoteGroup): Promise<ProcessOneQuoteResult> {
        const { quoteNumber, rows } = group;
        const quoteData = buildQuoteAggregateData(rows);

        let detailsData: QuoteDetailsData;
        try {
            detailsData = await this.marketplaceService.getQuoteDetails({
                quoteNumber,
            });
        } catch (error) {
            console.error(`Failed to fetch details for quote ${quoteNumber}:`, error);
            throw error;
        }

        return this.processOneQuote(quoteNumber, quoteData, detailsData);
    }

    private async processQuoteGroupsInParallel(
        groups: QuoteGroup[],
        onProgress?: (current: number, total: number) => void | Promise<void>
    ): Promise<{ processed: number; new: number; modified: number; skipped: number }> {
        const total = groups.length;
        let nextGroupIndex = 0;
        let processedCount = 0;
        let newCount = 0;
        let modifiedCount = 0;
        let skippedCount = 0;

        const worker = async (): Promise<void> => {
            while (true) {
                const groupIndex = nextGroupIndex;
                nextGroupIndex += 1;

                if (groupIndex >= groups.length) {
                    return;
                }

                const result = await this.fetchAndProcessQuoteGroup(groups[groupIndex]);
                processedCount += result.processed;
                newCount += result.new;
                modifiedCount += result.modified;
                skippedCount += result.skipped;

                if ((processedCount % 10) === 0 || processedCount === total) {
                    await onProgress?.(processedCount, total);
                }
            }
        };

        const workerCount = Math.min(QUOTE_DETAILS_CONCURRENCY, groups.length);
        await Promise.all(Array.from({ length: workerCount }, () => worker()));

        return { processed: processedCount, new: newCount, modified: modifiedCount, skipped: skippedCount };
    }

    /**
     * Process quotes from an API response stream. List rows are grouped by quote number,
     * details are fetched once per quote, and each quote is persisted as it is processed.
     */
    async processQuotesFromStream(
        responseStream: Readable,
        onProgress?: (current: number, total?: number) => void | Promise<void>
    ): Promise<void> {
        const groupedRows = new Map<string, QuoteGroup>();
        let streamedRowCount = 0;

        await onProgress?.(0);

        const parserStream = StreamArray.withParser();
        responseStream.pipe(parserStream as NodeJS.WritableStream);

        for await (const data of parserStream as AsyncIterable<{ value: QuoteData }>) {
            const row = data.value;
            const quoteNumber = getQuoteNumberFromRow(row);
            const existingGroup = groupedRows.get(quoteNumber);

            if (existingGroup) {
                existingGroup.rows.push(row);
            } else {
                groupedRows.set(quoteNumber, { quoteNumber, rows: [row] });
            }

            streamedRowCount += 1;
            if ((streamedRowCount % 100) === 0) {
                await onProgress?.(streamedRowCount);
            }
        }

        const groups = Array.from(groupedRows.values());
        const quoteCount = groups.length;

        if (quoteCount > 0) {
            await onProgress?.(0, quoteCount);
        }

        const { processed: processedCount, new: newCount, modified: modifiedCount, skipped: skippedCount } =
            await this.processQuoteGroupsInParallel(groups, async (current, total) => {
                await onProgress?.(current, total);
            });

        await onProgress?.(processedCount, quoteCount);

        console.log(
            `Completed processing ${streamedRowCount} quote rows into ${groups.length} quotes; ` +
            `${newCount} were new; ${modifiedCount} were updated; ${skippedCount} were unchanged`
        );
    }
}
