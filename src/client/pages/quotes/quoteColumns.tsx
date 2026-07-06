import React from 'react';
import { ColumnConfig } from '../../components/ColumnConfig';
import { QuoteResult, QuoteQuerySortType } from '#common/types/apiTypes.js';
import { EntitlementIdLink } from '#client/components/styles.js';
import { isoStringWithOnlyDate } from '#common/util/dateUtils.js';
import {
    formatScheduleUserTierSummary,
    formatUniqueLineValues,
    getLineCount,
    getScheduleCount,
    getScheduleDateRange,
    getTotalListPrice,
    getUniqueLineValues,
} from '#common/util/quoteAggregateUtils.js';

export interface QuoteCellContext {}

function formatQuoteDate(date?: string): string {
    if (!date) {
        return '';
    }
    return isoStringWithOnlyDate(date);
}

function formatListPrice(listPrice?: number): string {
    if (listPrice === undefined || listPrice === null) {
        return '';
    }
    return `$${listPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatEntitlementSummary(quoteResult: QuoteResult): React.ReactNode {
    const entitlements = getUniqueLineValues(quoteResult.quote.data, line => line.entitlementNumber);
    if (entitlements.length === 0) {
        return '';
    }

    return entitlements.map((entitlement, index) => (
        <React.Fragment key={entitlement}>
            {index > 0 && ', '}
            <EntitlementIdLink to={`/licenses?search=${encodeURIComponent(entitlement)}`}>
                {entitlement}
            </EntitlementIdLink>
        </React.Fragment>
    ));
}

export const defaultQuoteColumns: ColumnConfig<QuoteResult, QuoteCellContext, QuoteQuerySortType>[] = [
    {
        id: 'quoteCreatedDate',
        label: 'Created Date',
        visible: true,
        sortField: QuoteQuerySortType.CreatedDate,
        renderSimpleCell: (quoteResult) => formatQuoteDate(quoteResult.quote.data.quoteCreatedDate),
    },
    {
        id: 'updatedAt',
        label: 'Updated Date',
        visible: true,
        nowrap: true,
        sortField: QuoteQuerySortType.UpdatedAt,
        renderSimpleCell: (quoteResult) => isoStringWithOnlyDate(quoteResult.quote.updatedAt.toString()),
    },
    {
        id: 'quoteNumber',
        label: 'Quote Number',
        visible: true,
        nowrap: true,
        renderSimpleCell: (quoteResult) => quoteResult.quote.data.quoteNumber ?? quoteResult.quote.marketplaceQuoteNumber,
    },
    {
        id: 'company',
        label: 'Company',
        visible: true,
        renderSimpleCell: (quoteResult) => formatUniqueLineValues(quoteResult.quote.data, line => line.technicalContactCompany),
    },
    {
        id: 'quoteStatus',
        label: 'Status',
        visible: true,
        renderSimpleCell: (quoteResult) => quoteResult.quote.data.quoteStatus ?? '',
    },
    {
        id: 'quoteExpiryDate',
        label: 'Expiry Date',
        visible: true,
        sortField: QuoteQuerySortType.ExpiryDate,
        renderSimpleCell: (quoteResult) => formatQuoteDate(quoteResult.quote.data.quoteExpiryDate),
    },
    {
        id: 'entitlementNumber',
        label: 'Entitlement Number',
        visible: true,
        nowrap: true,
        renderSimpleCell: (quoteResult) => formatEntitlementSummary(quoteResult),
    },
    {
        id: 'productName',
        label: 'Product Name',
        visible: true,
        renderSimpleCell: (quoteResult) => formatUniqueLineValues(quoteResult.quote.data, line => line.productName),
    },
    {
        id: 'lineCount',
        label: 'Lines',
        visible: true,
        sortField: QuoteQuerySortType.LineCount,
        align: 'right',
        renderSimpleCell: (quoteResult) => getLineCount(quoteResult.quote.data),
    },
    {
        id: 'scheduleCount',
        label: 'Schedules',
        visible: true,
        sortField: QuoteQuerySortType.ScheduleCount,
        align: 'right',
        renderSimpleCell: (quoteResult) => getScheduleCount(quoteResult.quote.data),
    },
    {
        id: 'startDate',
        label: 'Start Date',
        visible: true,
        sortField: QuoteQuerySortType.StartDate,
        renderSimpleCell: (quoteResult) => formatQuoteDate(getScheduleDateRange(quoteResult.quote.data).startDate),
    },
    {
        id: 'endDate',
        label: 'End Date',
        visible: true,
        sortField: QuoteQuerySortType.EndDate,
        renderSimpleCell: (quoteResult) => formatQuoteDate(getScheduleDateRange(quoteResult.quote.data).endDate),
    },
    {
        id: 'userTier',
        label: 'User Tier',
        visible: true,
        align: 'right',
        renderSimpleCell: (quoteResult) => formatScheduleUserTierSummary(quoteResult.quote.data),
    },
    {
        id: 'listPrice',
        label: 'List Price',
        visible: true,
        align: 'right',
        renderSimpleCell: (quoteResult) => formatListPrice(getTotalListPrice(quoteResult.quote.data)),
    },
    {
        id: 'versionCount',
        label: 'Versions',
        visible: true,
        sortField: QuoteQuerySortType.VersionCount,
        align: 'right',
        renderSimpleCell: (quoteResult) => quoteResult.versionCount,
    },
];
