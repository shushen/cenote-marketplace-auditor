import React from 'react';
import {
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    Table,
    TableBody,
    TableCell,
    TableRow,
    Typography,
    Button,
} from '@mui/material';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { QuoteVersion } from '#common/entities/QuoteVersion.js';
import {
    VersionDataBox,
    InfoTableBox,
    InfoTableHeader,
    TreeViewScrollContainer,
    TreeViewScrollContent
} from '../../components/styles';
import { JsonDiffObjectTreeView } from '../../components/JsonDiffObjectTreeView';
import { getObjectDiff } from '#common/util/objectDiff.js';
import { CloseButton } from '../../components/CloseButton';
import { collectIdsForDiffObject } from '#client/util/collectIds.js';
import { isoStringWithDateAndTime } from '#common/util/dateUtils.js';
import { formatQuoteDetailsData, formatQuoteVersionDiffLabel } from './quoteUtils';
import { handleExportQuote } from './util';
import { normalizeQuoteAggregateData, normalizeQuoteDetailsData } from '#common/util/quoteAggregateUtils.js';

interface QuoteVersionDialogProps {
    version: QuoteVersion | null;
    priorVersion: QuoteVersion | null;
    open: boolean;
    onClose: () => void;
}

export const QuoteVersionDialog: React.FC<QuoteVersionDialogProps> = ({
    version,
    priorVersion,
    open,
    onClose,
}) => {
    if (!version) return null;

    const quoteDiffObject = getObjectDiff(
        priorVersion ? normalizeQuoteAggregateData(priorVersion.data) : undefined,
        normalizeQuoteAggregateData(version.data)
    );
    const detailsDiffObject = getObjectDiff(
        priorVersion ? formatQuoteDetailsData(normalizeQuoteDetailsData(priorVersion.details)) : undefined,
        formatQuoteDetailsData(normalizeQuoteDetailsData(version.details))
    );
    const quoteDiffIds = collectIdsForDiffObject(quoteDiffObject);
    const detailsDiffIds = collectIdsForDiffObject(detailsDiffObject);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
        >
            <DialogTitle sx={{ pr: { xs: 11, sm: 8 }, position: 'relative' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Box component="span" sx={{ flex: '1 1 auto', minWidth: 0 }}>
                        Quote Version Details
                    </Box>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleExportQuote({
                            data: version.data,
                            quoteNumber: version.marketplaceQuoteNumber,
                            suffix: `v${version.version}`
                        })}
                        sx={{ textTransform: 'none', flexShrink: 0 }}
                    >
                        Export Quote as JSON
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleExportQuote({
                            data: version.details,
                            quoteNumber: version.marketplaceQuoteNumber,
                            suffix: `details-v${version.version}`
                        })}
                        sx={{ textTransform: 'none', flexShrink: 0 }}
                    >
                        Export Details as JSON
                    </Button>
                    <CloseButton onClose={onClose} />
                </Box>
            </DialogTitle>
            <DialogContent dividers>
                <InfoTableBox>
                    <Table size="small">
                        <TableBody>
                            <TableRow>
                                <InfoTableHeader>Version</InfoTableHeader>
                                <TableCell>{version.version}</TableCell>
                                <InfoTableHeader>Created At</InfoTableHeader>
                                <TableCell>{isoStringWithDateAndTime(version.createdAt.toString())}</TableCell>
                            </TableRow>
                            <TableRow>
                                <InfoTableHeader>Quote Number</InfoTableHeader>
                                <TableCell>{version.marketplaceQuoteNumber}</TableCell>
                                <InfoTableHeader>Quote Changes</InfoTableHeader>
                                <TableCell>{formatQuoteVersionDiffLabel(version.version, version.diffQuote)}</TableCell>
                            </TableRow>
                            <TableRow>
                                <InfoTableHeader>Details Changes</InfoTableHeader>
                                <TableCell colSpan={3}>
                                    {formatQuoteVersionDiffLabel(version.version, version.diffDetails)}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </InfoTableBox>

                <Box sx={{ mt: 2, mb: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                        Quote data changes
                    </Typography>
                </Box>

                <VersionDataBox>
                    <TreeViewScrollContainer>
                        <TreeViewScrollContent>
                            <SimpleTreeView
                                slots={{ expandIcon: ExpandMore, collapseIcon: ExpandLess }}
                                defaultExpandedItems={quoteDiffIds}
                            >
                                <JsonDiffObjectTreeView
                                    data={quoteDiffObject}
                                    humanizeKeys={true}
                                    highlightNew={version.version !== 1}
                                />
                            </SimpleTreeView>
                        </TreeViewScrollContent>
                    </TreeViewScrollContainer>
                </VersionDataBox>

                <Box sx={{ mt: 2, mb: 1 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                        Quote details changes
                    </Typography>
                </Box>

                <VersionDataBox>
                    <TreeViewScrollContainer>
                        <TreeViewScrollContent>
                            <SimpleTreeView
                                slots={{ expandIcon: ExpandMore, collapseIcon: ExpandLess }}
                                defaultExpandedItems={detailsDiffIds}
                            >
                                <JsonDiffObjectTreeView
                                    data={detailsDiffObject}
                                    humanizeKeys={true}
                                    highlightNew={version.version !== 1}
                                />
                            </SimpleTreeView>
                        </TreeViewScrollContent>
                    </TreeViewScrollContainer>
                </VersionDataBox>
            </DialogContent>
        </Dialog>
    );
};
