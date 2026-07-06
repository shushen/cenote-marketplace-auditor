import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Link,
    Table,
    TableBody,
    TableCell,
    TableRow,
    Button,
    Box,
    Typography,
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { QuoteResult } from '#common/types/apiTypes.js';
import { JsonTreeView } from '../../components/JsonTreeView';
import {
    InfoTableBox,
    InfoTableHeader,
    TreeViewScrollContainer,
    TreeViewScrollContent
} from '../../components/styles';
import { collectIds } from '#client/util/collectIds.js';
import { CloseButton } from '../../components/CloseButton';
import { isoStringWithDateAndTime, isoStringWithOnlyDate } from '#common/util/dateUtils.js';
import {
    formatUniqueLineValues,
    getLineCount,
    getScheduleCount,
} from '#common/util/quoteAggregateUtils.js';
import { formatQuoteDetailsDataWithoutLines, getQuoteLinesForDisplay } from './quoteUtils';
import { QuoteVersionListDialog } from './QuoteVersionListDialog';
import { QuoteLinesSection } from './QuoteLinesSection';
import { QuoteDetailsHeadingBox } from './styles';

interface QuoteDetailsProps {
    quoteResult: QuoteResult | null;
    open: boolean;
    onClose: () => void;
}

export const QuoteDetailsDialog: React.FC<QuoteDetailsProps> = ({ quoteResult, open, onClose }) => {
    const [showVersions, setShowVersions] = useState(false);

    if (!quoteResult) return null;

    const { quote } = quoteResult;
    const summary = quote.details?.quoteNumber ? quote.details : quote.data;
    const formattedDetailsData = formatQuoteDetailsDataWithoutLines(quote.details);
    const detailsIds = collectIds(formattedDetailsData, 'details-root');
    const quoteLines = getQuoteLinesForDisplay(quote.data, quote.details);

    return (
        <>
            <Dialog
                open={open}
                onClose={onClose}
                maxWidth="lg"
                fullWidth
            >
                <DialogTitle sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 1,
                    pr: { xs: 11, sm: 8 },
                    position: 'relative'
                }}>
                    <Box component="span" sx={{ flex: { xs: '1 1 100%', sm: 1 }, minWidth: 0 }}>
                        Quote Details
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => setShowVersions(true)}
                            sx={{ textTransform: 'none' }}
                        >
                            Show all versions
                        </Button>
                    </Box>
                    <CloseButton onClose={onClose} />
                </DialogTitle>
                <DialogContent dividers>
                    <InfoTableBox>
                        <Table size="small">
                            <TableBody>
                                <TableRow>
                                    <InfoTableHeader>Created At</InfoTableHeader>
                                    <TableCell>{isoStringWithDateAndTime(quote.createdAt.toString())}</TableCell>
                                    <InfoTableHeader>Updated At</InfoTableHeader>
                                    <TableCell>{isoStringWithDateAndTime(quote.updatedAt.toString())}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <InfoTableHeader>Quote Version</InfoTableHeader>
                                    <TableCell>
                                        <Link
                                            component="button"
                                            variant="body2"
                                            onClick={() => setShowVersions(true)}
                                            sx={{ textDecoration: 'none' }}
                                        >
                                            {quote.currentVersion}
                                        </Link>
                                    </TableCell>
                                    <InfoTableHeader>Lines</InfoTableHeader>
                                    <TableCell>{getLineCount(quote.data)}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <InfoTableHeader>Schedules</InfoTableHeader>
                                    <TableCell>{getScheduleCount(quote.data)}</TableCell>
                                    <InfoTableHeader>Company</InfoTableHeader>
                                    <TableCell>{formatUniqueLineValues(quote.data, line => line.technicalContactCompany)}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <InfoTableHeader>Created Date</InfoTableHeader>
                                    <TableCell>{summary.quoteCreatedDate ? isoStringWithOnlyDate(summary.quoteCreatedDate) : (quote.data.quoteCreatedDate ? isoStringWithOnlyDate(quote.data.quoteCreatedDate) : '')}</TableCell>
                                    <InfoTableHeader>Expiry Date</InfoTableHeader>
                                    <TableCell>{summary.quoteExpiryDate ? isoStringWithOnlyDate(summary.quoteExpiryDate) : (quote.data.quoteExpiryDate ? isoStringWithOnlyDate(quote.data.quoteExpiryDate) : '')}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <InfoTableHeader>Entitlements</InfoTableHeader>
                                    <TableCell colSpan={3}>{formatUniqueLineValues(quote.data, line => line.entitlementNumber)}</TableCell>
                                </TableRow>
                                <TableRow>
                                    <InfoTableHeader>Products</InfoTableHeader>
                                    <TableCell colSpan={3}>{formatUniqueLineValues(quote.data, line => line.productName)}</TableCell>
                                </TableRow>
                            </TableBody>
                        </Table>
                    </InfoTableBox>

                    <QuoteDetailsHeadingBox>
                        <Typography variant="subtitle1" fontWeight="bold" color="text.secondary">
                            Quote Details
                        </Typography>
                    </QuoteDetailsHeadingBox>

                    <TreeViewScrollContainer>
                        <TreeViewScrollContent>
                            <SimpleTreeView
                                slots={{ expandIcon: ExpandMore, collapseIcon: ExpandLess }}
                                defaultExpandedItems={detailsIds}
                            >
                                <JsonTreeView data={formattedDetailsData} nodeId="details-root" humanizeKeys={true} />
                            </SimpleTreeView>
                        </TreeViewScrollContent>
                    </TreeViewScrollContainer>

                    <QuoteLinesSection lines={quoteLines} />
                </DialogContent>
            </Dialog>

            <QuoteVersionListDialog
                open={showVersions}
                onClose={() => setShowVersions(false)}
                quoteResult={quoteResult}
            />
        </>
    );
};
