import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    Box
} from '@mui/material';
import { QuoteResult } from '#common/types/apiTypes.js';
import { StyledDialog } from '../../components/styles';
import { QuoteVersionList } from './QuoteVersionList';
import { CloseButton } from '../../components/CloseButton';
import { formatUniqueLineValues } from '#common/util/quoteAggregateUtils.js';

interface QuoteVersionListDialogProps {
    quoteResult: QuoteResult | null;
    open: boolean;
    onClose: () => void;
}

export const QuoteVersionListDialog: React.FC<QuoteVersionListDialogProps> = ({
    quoteResult,
    open,
    onClose,
}) => {
    if (!quoteResult) return null;

    const { data } = quoteResult.quote;
    const { quoteNumber, quoteStatus } = data;
    const company = formatUniqueLineValues(data, line => line.technicalContactCompany);
    const products = formatUniqueLineValues(data, line => line.productName);

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
        >
            <DialogTitle>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="h6">Quote Versions</Typography>
                    <Typography variant="subtitle1" color="text.secondary">
                        {quoteNumber ?? quoteResult.quote.marketplaceQuoteNumber} • {quoteStatus} • {products} • {company}
                    </Typography>
                </Box>
                <CloseButton onClose={onClose} />
            </DialogTitle>
            <DialogContent>
                <StyledDialog>
                    <QuoteVersionList quoteId={quoteResult.quote.id} />
                </StyledDialog>
            </DialogContent>
        </Dialog>
    );
};
