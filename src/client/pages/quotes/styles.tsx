import { Box, Table, TableCell, TableRow, styled } from '@mui/material';
import { NotesHeadingBox } from '#client/components/styles.js';

export const QuoteLineSectionBox = styled(Box)(({ theme }) => ({
    marginBottom: theme.spacing(3),
}));

export const QuoteLineSummaryTableBox = styled(Box)(({ theme }) => ({
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
}));

export const QuoteScheduleTableContainer = styled(Box)(({ theme }) => ({
    marginTop: theme.spacing(1.5),
}));

export const QuoteScheduleTable = styled(Table)(({ theme }) => ({
    '& th': {
        fontWeight: 600,
        color: theme.palette.text.secondary,
        whiteSpace: 'nowrap',
    },
    '& td': {
        whiteSpace: 'nowrap',
    },
    '& .numeric': {
        textAlign: 'right',
    },
}));

export const QuoteScheduleTotalRow = styled(TableRow)({
    '& td': {
        fontWeight: 600,
        borderBottom: 'none',
    },
});

export const QuoteLineSummaryEmphasizedHeader = styled(TableCell)({
    fontWeight: 'bold',
});

export const QuoteLineSummaryEmphasizedValue = styled(TableCell)({
    fontWeight: 'bold',
});

export const QuoteDetailsHeadingBox = styled(NotesHeadingBox)(({ theme }) => ({
    marginTop: theme.spacing(2),
}));

export const QuoteLinesHeadingBox = styled(NotesHeadingBox)(({ theme }) => ({
    marginTop: theme.spacing(2),
}));
