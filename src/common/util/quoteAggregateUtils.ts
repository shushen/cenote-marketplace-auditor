import { QuoteAggregateData, QuoteData, QuoteDetailsData, QuoteLineAggregate, QuoteScheduleData } from '#common/types/marketplace.js';
import { deepEqual, normalizeObject } from '#common/util/objectUtils.js';

type QuoteDetailsLine = NonNullable<QuoteDetailsData['quotesLines']>[number];

function normalizeOptionalString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed || undefined;
}

function normalizeCreatedBy(value: unknown): string | undefined {
    if (typeof value === 'string') {
        return normalizeOptionalString(value);
    }
    if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        return normalizeOptionalString(
            typeof record.email === 'string' ? record.email
                : typeof record.name === 'string' ? record.name
                : typeof record.type === 'string' ? record.type
                : typeof record.authorType === 'string' ? record.authorType
                : undefined
        );
    }
    return undefined;
}

function normalizeQuoteLineFields(
    line: QuoteLineAggregate | QuoteDetailsLine
): Omit<QuoteLineAggregate, 'schedules'> {
    const normalized: Omit<QuoteLineAggregate, 'schedules'> = {};

    const entries: Array<[keyof Omit<QuoteLineAggregate, 'schedules'>, string | undefined]> = [
        ['entitlementEid', normalizeOptionalString(line.entitlementEid)],
        ['entitlementNumber', normalizeOptionalString(line.entitlementNumber)],
        ['commerceProductId', normalizeOptionalString(line.commerceProductId)],
        ['productId', normalizeOptionalString(line.productId)],
        ['productName', normalizeOptionalString(line.productName)],
        ['appEdition', normalizeOptionalString(line.appEdition)],
        ['technicalContactCompany', normalizeOptionalString(line.technicalContactCompany)],
        ['technicalEmail', normalizeOptionalString(line.technicalEmail)],
        ['productPlatform', normalizeOptionalString(line.productPlatform)],
        ['commerceSystem', normalizeOptionalString(line.commerceSystem)],
    ];

    for (const [key, value] of entries) {
        if (value !== undefined) {
            normalized[key] = value;
        }
    }

    return normalized;
}

function normalizeQuoteLevelFields(
    data: Pick<QuoteAggregateData, 'quoteNumber' | 'quoteStatus' | 'quoteCreatedDate' | 'acceptedDate' | 'quoteExpiryDate'>
): Record<string, string> {
    const normalized: Record<string, string> = {};

    for (const [key, value] of Object.entries(data)) {
        const normalizedValue = normalizeOptionalString(value);
        if (normalizedValue !== undefined) {
            normalized[key] = normalizedValue;
        }
    }

    return normalized;
}

function normalizeQuoteDetailsLevelFields(
    details: QuoteDetailsData
): Record<string, string> {
    const normalized: Record<string, string> = {};

    const entries: Array<[keyof QuoteDetailsData, string | undefined]> = [
        ['quoteId', normalizeOptionalString(details.quoteId)],
        ['quoteNumber', normalizeOptionalString(details.quoteNumber)],
        ['quoteStatus', normalizeOptionalString(details.quoteStatus)],
        ['quoteCreatedDate', normalizeOptionalString(details.quoteCreatedDate)],
        ['quoteExpiryDate', normalizeOptionalString(details.quoteExpiryDate)],
        ['createdBy', normalizeCreatedBy(details.createdBy)],
        ['vendorId', normalizeOptionalString(details.vendorId)],
    ];

    for (const [key, value] of entries) {
        if (value !== undefined) {
            normalized[key] = value;
        }
    }

    return normalized;
}

export function getQuoteNumberFromRow(row: QuoteData): string {
    if (row.quoteNumber?.trim()) {
        return row.quoteNumber.trim();
    }
    if (row.quoteId?.trim()) {
        return row.quoteId.trim();
    }
    throw new Error(`No quote number found for quote with product ${row.productName ?? 'unknown'}`);
}

export function getLineKeyFromRow(row: QuoteData): string {
    return row.entitlementNumber?.trim()
        || row.entitlementEid?.trim()
        || row.commerceProductId?.trim()
        || row.productId?.trim()
        || row.productName?.trim()
        || '';
}

export function normalizeQuoteScheduleData(schedule: QuoteScheduleData): QuoteScheduleData {
    const normalized: QuoteScheduleData = {
        startDate: schedule.startDate,
        endDate: schedule.endDate,
        userTier: schedule.userTier,
        listPrice: schedule.listPrice,
    };

    if (schedule.discounts?.length) {
        normalized.discounts = schedule.discounts;
    }

    return normalized;
}

export function normalizeQuoteLines(lines: QuoteLineAggregate[]): QuoteLineAggregate[] {
    return lines.map(line => ({
        ...normalizeQuoteLineFields(line),
        schedules: line.schedules.map(normalizeQuoteScheduleData),
    }));
}

export function quoteLinesEqual(
    incomingLines: QuoteLineAggregate[],
    existingLines: QuoteLineAggregate[]
): boolean {
    return deepEqual(
        normalizeObject(normalizeQuoteLines(incomingLines)),
        normalizeObject(normalizeQuoteLines(existingLines))
    );
}

export function normalizeQuoteAggregateData(data: QuoteAggregateData): QuoteAggregateData {
    return {
        ...normalizeQuoteLevelFields({
            quoteNumber: data.quoteNumber,
            quoteStatus: data.quoteStatus,
            quoteCreatedDate: data.quoteCreatedDate,
            acceptedDate: data.acceptedDate,
            quoteExpiryDate: data.quoteExpiryDate,
        }),
        lines: normalizeQuoteLines(data.lines),
    };
}

export function normalizeQuoteDetailsData(details: QuoteDetailsData): QuoteDetailsData {
    const normalized: QuoteDetailsData = {
        ...normalizeQuoteDetailsLevelFields(details),
    };

    if (details.quotesLines?.length) {
        normalized.quotesLines = details.quotesLines.map(line => ({
            ...normalizeQuoteLineFields(line),
            schedules: sortSchedules((line.schedules ?? []).map(normalizeQuoteScheduleData)),
        }));
    }

    return normalized;
}

export function extractScheduleFromRow(row: QuoteData): QuoteScheduleData {
    return normalizeQuoteScheduleData({
        startDate: row.startDate,
        endDate: row.endDate,
        userTier: row.userTier,
        listPrice: row.listPrice,
        discounts: row.discounts,
    });
}

export function sortSchedules(schedules: QuoteScheduleData[]): QuoteScheduleData[] {
    return [...schedules].sort((a, b) => {
        const startA = a.startDate ?? '';
        const startB = b.startDate ?? '';
        if (startA !== startB) {
            return startA.localeCompare(startB);
        }

        const endA = a.endDate ?? '';
        const endB = b.endDate ?? '';
        if (endA !== endB) {
            return endA.localeCompare(endB);
        }

        const tierA = a.userTier ?? Number.NEGATIVE_INFINITY;
        const tierB = b.userTier ?? Number.NEGATIVE_INFINITY;
        if (tierA !== tierB) {
            return tierA - tierB;
        }

        const priceA = a.listPrice ?? Number.NEGATIVE_INFINITY;
        const priceB = b.listPrice ?? Number.NEGATIVE_INFINITY;
        return priceA - priceB;
    });
}

function dedupeSchedules(schedules: QuoteScheduleData[]): QuoteScheduleData[] {
    const seen = new Set<string>();
    const result: QuoteScheduleData[] = [];

    for (const schedule of sortSchedules(schedules)) {
        const key = JSON.stringify(normalizeObject(schedule));
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        result.push(schedule);
    }

    return result;
}

function buildQuoteLineAggregate(rows: QuoteData[]): QuoteLineAggregate {
    const base = rows[0];

    return {
        entitlementEid: base.entitlementEid,
        entitlementNumber: base.entitlementNumber,
        commerceProductId: base.commerceProductId,
        productId: base.productId,
        productName: base.productName,
        appEdition: base.appEdition,
        technicalContactCompany: base.technicalContactCompany,
        technicalEmail: base.technicalEmail,
        productPlatform: base.productPlatform,
        commerceSystem: base.commerceSystem,
        schedules: dedupeSchedules(rows.map(extractScheduleFromRow)),
    };
}

export function buildQuoteAggregateData(rows: QuoteData[]): QuoteAggregateData {
    if (rows.length === 0) {
        throw new Error('Cannot build quote aggregate data from no rows');
    }

    const lineGroups = new Map<string, QuoteData[]>();
    for (const row of rows) {
        const lineKey = getLineKeyFromRow(row);
        const existing = lineGroups.get(lineKey);
        if (existing) {
            existing.push(row);
        } else {
            lineGroups.set(lineKey, [row]);
        }
    }

    const lines = Array.from(lineGroups.values()).map(buildQuoteLineAggregate);
    const base = rows[0];

    return {
        quoteId: base.quoteId,
        quoteNumber: base.quoteNumber,
        quoteStatus: base.quoteStatus,
        quoteCreatedDate: base.quoteCreatedDate,
        acceptedDate: base.acceptedDate,
        quoteExpiryDate: base.quoteExpiryDate,
        createdBy: base.createdBy,
        vendorId: base.vendorId,
        lines,
    };
}

export function getAllSchedules(data: QuoteAggregateData): QuoteScheduleData[] {
    return data.lines.flatMap(line => line.schedules);
}

export function getLineCount(data: QuoteAggregateData): number {
    return data.lines.length;
}

export function getScheduleCount(data: QuoteAggregateData): number {
    return getAllSchedules(data).length;
}

export function getUniqueLineValues(
    data: QuoteAggregateData,
    selector: (line: QuoteLineAggregate) => string | undefined
): string[] {
    return [...new Set(
        data.lines
            .map(selector)
            .filter((value): value is string => Boolean(value?.trim()))
            .map(value => value.trim())
    )];
}

export function formatUniqueLineValues(
    data: QuoteAggregateData,
    selector: (line: QuoteLineAggregate) => string | undefined
): string {
    return getUniqueLineValues(data, selector).join(', ');
}

export function getScheduleDateRange(data: QuoteAggregateData): { startDate?: string; endDate?: string } {
    const schedules = getAllSchedules(data);
    const starts = schedules.map(schedule => schedule.startDate).filter((date): date is string => Boolean(date)).sort();
    const ends = schedules.map(schedule => schedule.endDate).filter((date): date is string => Boolean(date)).sort();

    return {
        startDate: starts[0],
        endDate: ends[ends.length - 1],
    };
}

export function getTotalListPrice(data: QuoteAggregateData): number | undefined {
    const prices = getAllSchedules(data)
        .map(schedule => schedule.listPrice)
        .filter((price): price is number => price !== undefined && price !== null);

    if (prices.length === 0) {
        return undefined;
    }

    return prices.reduce((total, price) => total + price, 0);
}

export function getLineListPriceTotal(line: QuoteLineAggregate): number | undefined {
    const prices = line.schedules
        .map(schedule => schedule.listPrice)
        .filter((price): price is number => price !== undefined && price !== null);

    if (prices.length === 0) {
        return undefined;
    }

    return prices.reduce((total, price) => total + price, 0);
}

export function formatQuoteUserTier(userTier?: number): string {
    if (userTier === undefined || userTier === null) {
        return '';
    }
    return userTier === -1 ? 'Unlimited' : userTier.toString();
}

export function formatScheduleUserTierSummary(data: QuoteAggregateData): string {
    const tiers = [...new Set(
        getAllSchedules(data)
            .map(schedule => schedule.userTier)
            .filter((tier): tier is number => tier !== undefined && tier !== null)
    )];

    if (tiers.length === 0) {
        return '';
    }

    return tiers.map(tier => tier === -1 ? 'Unlimited' : tier.toString()).join(', ');
}
