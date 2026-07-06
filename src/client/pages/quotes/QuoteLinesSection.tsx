import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from '@mui/material';
import { QuoteLineAggregate } from '#common/types/marketplace.js';
import {
    formatQuoteUserTier,
    getLineListPriceTotal,
} from '#common/util/quoteAggregateUtils.js';
import { formatCurrency } from '#common/util/formatCurrency.js';
import { isoStringWithOnlyDate } from '#common/util/dateUtils.js';
import { EntitlementIdLink, InfoTableHeader } from '#client/components/styles.js';
import {
    formatQuoteDiscountsSummary,
    formatQuoteLineHeading,
    getQuoteLineKey,
    getQuoteLineSummaryEntries,
} from './quoteUtils';
import {
    QuoteLineSectionBox,
    QuoteLineSummaryEmphasizedHeader,
    QuoteLineSummaryEmphasizedValue,
    QuoteLineSummaryTableBox,
    QuoteLinesHeadingBox,
    QuoteScheduleTable,
    QuoteScheduleTableContainer,
    QuoteScheduleTotalRow,
} from './styles';

interface QuoteLinesSectionProps {
    lines: QuoteLineAggregate[];
}

function renderEntitlementValue(value: string): React.ReactNode {
    return (
        <EntitlementIdLink to={`/transactions?search=${encodeURIComponent(value)}`}>
            {value}
        </EntitlementIdLink>
    );
}

function renderSummaryValue(label: string, value: string): React.ReactNode {
    if (label === 'Entitlement Number') {
        return renderEntitlementValue(value);
    }
    return value;
}

interface QuoteLineItemProps {
    line: QuoteLineAggregate;
    index: number;
}

const QuoteLineItem: React.FC<QuoteLineItemProps> = ({ line, index }) => {
    const summaryEntries = getQuoteLineSummaryEntries(line);
    const lineTotal = getLineListPriceTotal(line);
    const heading = formatQuoteLineHeading(line, index);

    return (
        <QuoteLineSectionBox>
            <Typography variant="subtitle1" fontWeight="bold" color="text.primary">
                {heading}
            </Typography>

            {summaryEntries.length > 0 && (
                <QuoteLineSummaryTableBox>
                    <Table size="small">
                        <TableBody>
                            {summaryEntries.map((entry, entryIndex) => {
                                const HeaderCell = entry.emphasized
                                    ? QuoteLineSummaryEmphasizedHeader
                                    : InfoTableHeader;
                                const ValueCell = entry.emphasized
                                    ? QuoteLineSummaryEmphasizedValue
                                    : TableCell;

                                return (
                                    <TableRow key={`${entry.label}-${entryIndex}`}>
                                        <HeaderCell>{entry.label}</HeaderCell>
                                        <ValueCell colSpan={3}>
                                            {renderSummaryValue(entry.label, entry.value)}
                                        </ValueCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </QuoteLineSummaryTableBox>
            )}

            {line.schedules.length > 0 && (
                <QuoteScheduleTableContainer>
                    <QuoteScheduleTable size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Start Date</TableCell>
                                <TableCell>End Date</TableCell>
                                <TableCell className="numeric">User Tier</TableCell>
                                <TableCell className="numeric">List Price</TableCell>
                                <TableCell>Discounts</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {line.schedules.map((schedule, scheduleIndex) => (
                                <TableRow key={scheduleIndex}>
                                    <TableCell>
                                        {schedule.startDate ? isoStringWithOnlyDate(schedule.startDate) : ''}
                                    </TableCell>
                                    <TableCell>
                                        {schedule.endDate ? isoStringWithOnlyDate(schedule.endDate) : ''}
                                    </TableCell>
                                    <TableCell className="numeric">
                                        {formatQuoteUserTier(schedule.userTier)}
                                    </TableCell>
                                    <TableCell className="numeric">
                                        {schedule.listPrice !== undefined && schedule.listPrice !== null
                                            ? formatCurrency(schedule.listPrice)
                                            : ''}
                                    </TableCell>
                                    <TableCell>
                                        {formatQuoteDiscountsSummary(schedule.discounts)}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        {lineTotal !== undefined && (
                            <TableBody>
                                <QuoteScheduleTotalRow>
                                    <TableCell colSpan={3}>Total</TableCell>
                                    <TableCell className="numeric">{formatCurrency(lineTotal)}</TableCell>
                                    <TableCell />
                                </QuoteScheduleTotalRow>
                            </TableBody>
                        )}
                    </QuoteScheduleTable>
                </QuoteScheduleTableContainer>
            )}
        </QuoteLineSectionBox>
    );
};

export const QuoteLinesSection: React.FC<QuoteLinesSectionProps> = ({ lines }) => {
    if (lines.length === 0) {
        return null;
    }

    return (
        <>
            <QuoteLinesHeadingBox>
                <Typography variant="subtitle1" fontWeight="bold" color="text.secondary">
                    Quote Lines
                </Typography>
            </QuoteLinesHeadingBox>

            {lines.map((line, index) => (
                <QuoteLineItem
                    key={getQuoteLineKey(line, index)}
                    line={line}
                    index={index}
                />
            ))}
        </>
    );
};
