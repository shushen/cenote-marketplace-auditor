import { QuoteAggregateData, QuoteData, QuoteLineAggregate, QuoteScheduleData } from '#common/types/marketplace.js';
import { normalizeObject } from '#common/util/objectUtils.js';

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

export function normalizeQuoteAggregateData(data: QuoteAggregateData): QuoteAggregateData {
    return {
        ...data,
        lines: data.lines.map(line => ({
            ...line,
            schedules: line.schedules.map(normalizeQuoteScheduleData),
        })),
    };
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
