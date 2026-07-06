import { JsonObject } from '#client/util/collectIds.js';
import { formatCurrency } from '#common/util/formatCurrency.js';
import {
    QuoteAggregateData,
    QuoteDetailsData,
    QuoteLineAggregate,
    QuoteScheduleData,
} from '#common/types/marketplace.js';
import { sortSchedules, getLineListPriceTotal } from '#common/util/quoteAggregateUtils.js';
import { isoStringWithOnlyDate } from '#common/util/dateUtils.js';

type QuoteDiscount = NonNullable<QuoteScheduleData['discounts']>[number];

const LINE_SUMMARY_FIELDS: Array<{
    key: keyof Omit<QuoteLineAggregate, 'schedules'>;
    label: string;
    emphasized?: boolean;
}> = [
    { key: 'technicalContactCompany', label: 'Company', emphasized: true },
    { key: 'productPlatform', label: 'Product Platform' },
    { key: 'appEdition', label: 'App Edition' },
    { key: 'entitlementNumber', label: 'Entitlement Number' },
    { key: 'entitlementEid', label: 'Entitlement EID' },
    { key: 'commerceProductId', label: 'Commerce Product ID' },
    { key: 'productId', label: 'Product ID' },
    { key: 'technicalEmail', label: 'Technical Email' },
    { key: 'commerceSystem', label: 'Commerce System' },
];

function formatListPriceFields(value: unknown): unknown {
    if (Array.isArray(value)) {
        return value.map(formatListPriceFields);
    }
    if (value && typeof value === 'object') {
        const result: JsonObject = {};
        for (const [key, child] of Object.entries(value as JsonObject)) {
            if (key === 'listPrice' && typeof child === 'number') {
                result[key] = formatCurrency(child);
            } else {
                result[key] = formatListPriceFields(child) as JsonObject[keyof JsonObject];
            }
        }
        return result;
    }
    return value;
}

export const formatQuoteDetailsData = (data: QuoteDetailsData): JsonObject => {
    return formatListPriceFields(structuredClone(data)) as JsonObject;
};

export function formatQuoteDetailsDataWithoutLines(data?: QuoteDetailsData | null): JsonObject {
    if (!data) {
        return {};
    }

    const { quotesLines: _quotesLines, ...rest } = data;
    return formatListPriceFields(structuredClone(rest)) as JsonObject;
}

export function getQuoteLinesForDisplay(
    data: QuoteAggregateData,
    details?: QuoteDetailsData | null
): QuoteLineAggregate[] {
    if (details?.quotesLines?.length) {
        return details.quotesLines.map(line => ({
            entitlementEid: line.entitlementEid,
            entitlementNumber: line.entitlementNumber,
            commerceProductId: line.commerceProductId,
            productId: line.productId,
            productName: line.productName,
            appEdition: line.appEdition,
            technicalContactCompany: line.technicalContactCompany,
            technicalEmail: line.technicalEmail,
            productPlatform: line.productPlatform,
            commerceSystem: line.commerceSystem,
            schedules: sortSchedules(line.schedules ?? []),
        }));
    }

    return data.lines ?? [];
}

export function getQuoteLineSummaryEntries(
    line: QuoteLineAggregate
): Array<{ label: string; value: string; emphasized?: boolean }> {
    return LINE_SUMMARY_FIELDS
        .map(({ key, label, emphasized }) => ({
            label,
            value: line[key]?.trim() ?? '',
            emphasized,
        }))
        .filter(entry => entry.value);
}

export function getLineScheduleDateRange(line: QuoteLineAggregate): { startDate?: string; endDate?: string } {
    const starts = line.schedules
        .map(schedule => schedule.startDate)
        .filter((date): date is string => Boolean(date))
        .sort();
    const ends = line.schedules
        .map(schedule => schedule.endDate)
        .filter((date): date is string => Boolean(date))
        .sort();

    return {
        startDate: starts[0],
        endDate: ends[ends.length - 1],
    };
}

export function formatQuoteLineHeading(line: QuoteLineAggregate, index: number): string {
    const productName = line.productName?.trim() || 'Unknown Product';
    const parentheticalParts: string[] = [];

    const company = line.technicalContactCompany?.trim();
    if (company) {
        parentheticalParts.push(company);
    }

    const { startDate, endDate } = getLineScheduleDateRange(line);
    if (startDate || endDate) {
        const start = startDate ? isoStringWithOnlyDate(startDate) : '';
        const end = endDate ? isoStringWithOnlyDate(endDate) : '';
        parentheticalParts.push(`${start} - ${end}`);
    }

    const total = getLineListPriceTotal(line);
    if (total !== undefined) {
        parentheticalParts.push(formatCurrency(total));
    }

    const parenthetical = parentheticalParts.length > 0
        ? ` (${parentheticalParts.join(' / ')})`
        : '';

    return `Line #${index + 1}: ${productName}${parenthetical}`;
}

export function formatQuoteDiscountsSummary(discounts?: QuoteDiscount[]): string {
    if (!discounts?.length) {
        return '';
    }

    return discounts.map(discount => {
        const parts: string[] = [];
        if (discount.percent !== undefined && discount.percent !== null) {
            parts.push(`${discount.percent}%`);
        }
        if (discount.amount !== undefined && discount.amount !== null) {
            parts.push(formatCurrency(discount.amount));
        }
        if (discount.promoCode) {
            parts.push(discount.promoCode);
        } else if (discount.type) {
            parts.push(discount.type);
        }
        return parts.join(' ');
    }).join('; ');
}

export function formatQuoteVersionDiffLabel(version: number, diff?: string | null): string {
    if (version === 1) {
        return 'Initial version';
    }
    return diff?.trim() ? diff : 'No changes';
}

export function getQuoteLineKey(line: QuoteLineAggregate, index: number): string {
    return line.entitlementNumber
        || line.entitlementEid
        || line.commerceProductId
        || line.productId
        || `line-${index}`;
}
