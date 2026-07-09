import React, { useState, useEffect } from 'react';
import {
    Box,
    TableRow,
    TablePagination,
    CircularProgress,
    Alert,
    Button,
    TextField,
    InputAdornment,
    Typography,
} from '@mui/material';
import { Settings as SettingsIcon, Search as SearchIcon } from '@mui/icons-material';
import { QuoteQuerySortType, QuoteResult } from '#common/types/apiTypes.js';
import {
    StyledTable,
    StyledTableHead,
    StyledTableBody,
    StyledTableRow,
    StyledListPaper,
    StyledTableCell,
    TableLoadingCell,
    ListPageRoot,
    ListTableScrollZone,
    ListControlsScrollLayer,
    ListTitleBar,
    ListPaginationBar,
} from '../../components/styles';
import { QuoteDetailsDialog } from './QuoteDetailsDialog';
import { ColumnConfigDialog } from '../../components/ColumnConfig';
import { useColumnConfig } from '../../components/useColumnConfig';
import { defaultQuoteColumns, QuoteCellContext } from './quoteColumns';
import { renderHeader, renderCell } from '../../components/columnRenderHelpers';
import { ResponsiveSearchContainer } from '../../components/ResponsiveSearchContainer';
import { SortOrder } from '../../components/SortableHeader';
import { useSearchParamState } from '../../hooks/useSearchParamState';

function getQuoteRowKey(quoteResult: QuoteResult): string {
    return quoteResult.quote.id;
}

export const QuoteList: React.FC = () => {
    const [quotes, setQuotes] = useState<QuoteResult[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedQuote, setSelectedQuote] = useState<QuoteResult | null>(null);
    const [showColumnConfig, setShowColumnConfig] = useState(false);
    const [search, setSearch] = useSearchParamState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sortBy, setSortBy] = useState<QuoteQuerySortType>(QuoteQuerySortType.CreatedDate);
    const [sortOrder, setSortOrder] = useState<SortOrder>('DESC');

    const { columns, visibleColumns, updateColumns, isLoaded } = useColumnConfig(
        defaultQuoteColumns,
        'quote-column-config'
    );

    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(search.trim());
        }, 500);

        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        setPage(0);
    }, [debouncedSearch]);

    const fetchQuotes = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(
                `/api/quotes?start=${page * rowsPerPage}&limit=${rowsPerPage}&sortBy=${sortBy}&sortOrder=${sortOrder}&search=${encodeURIComponent(debouncedSearch)}`
            );
            const data = await response.json();
            if (!response.ok) {
                setError(data.error ?? 'Failed to fetch quotes');
                setQuotes([]);
                setTotal(0);
                return;
            }
            setQuotes(data.quotes ?? []);
            setTotal(data.total ?? 0);
        } catch (fetchError) {
            console.error('Error fetching quotes:', fetchError);
            setError('Failed to fetch quotes');
            setQuotes([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchQuotes();
    }, [page, rowsPerPage, sortBy, sortOrder, debouncedSearch]);

    const handleChangePage = (_event: unknown, newPage: number) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value);
        setPage(0);
    };

    const handleKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            setDebouncedSearch(search.trim());
        }
    };

    const handleSort = (field: QuoteQuerySortType) => {
        if (field === sortBy) {
            setSortOrder(sortOrder === 'ASC' ? 'DESC' : 'ASC');
        } else {
            setSortBy(field);
            setSortOrder('DESC');
        }
        setPage(0);
    };

    const cellContext: QuoteCellContext = {};

    return (
        <ListPageRoot>
            <ListTableScrollZone>
                <ListControlsScrollLayer>
                    <ListTitleBar>
                        <Typography variant="h4" component="h1">
                            Quotes
                        </Typography>
                    </ListTitleBar>
                    {error && (
                        <Box sx={{ mb: 2 }}>
                            <Alert severity="error">{error}</Alert>
                        </Box>
                    )}
                    <ResponsiveSearchContainer sx={{ mb: 0 }}>
                        <TextField
                            className="search-field"
                            label=""
                            variant="outlined"
                            value={search}
                            onChange={handleSearchChange}
                            onKeyPress={handleKeyPress}
                            size="small"
                            placeholder="Search"
                            spellCheck={false}
                            autoCorrect="off"
                            autoCapitalize="off"
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <Button
                            className="columns-button"
                            variant="outlined"
                            size="small"
                            startIcon={<SettingsIcon />}
                            onClick={() => setShowColumnConfig(true)}
                            sx={{ textTransform: 'none' }}
                        >
                            Columns
                        </Button>
                    </ResponsiveSearchContainer>
                    <Box aria-hidden sx={{ height: 16, flexShrink: 0 }} />
                </ListControlsScrollLayer>

                <StyledListPaper>
                    <StyledTable>
                        <StyledTableHead>
                            <TableRow>
                                {visibleColumns.map((column) =>
                                    renderHeader(column, { sortBy, sortOrder, onSort: handleSort })
                                )}
                            </TableRow>
                        </StyledTableHead>
                        <StyledTableBody>
                            {loading ? (
                                <StyledTableRow>
                                    <TableLoadingCell colSpan={visibleColumns.length || 1}>
                                        <CircularProgress />
                                    </TableLoadingCell>
                                </StyledTableRow>
                            ) : quotes.length > 0 ? (
                                quotes.map((quoteResult) => (
                                    <StyledTableRow
                                        key={getQuoteRowKey(quoteResult)}
                                        onClick={() => setSelectedQuote(quoteResult)}
                                    >
                                        {visibleColumns.map((column) =>
                                            renderCell(column, quoteResult, cellContext)
                                        )}
                                    </StyledTableRow>
                                ))
                            ) : (
                                <StyledTableRow>
                                    <StyledTableCell colSpan={visibleColumns.length || 1} align="center" sx={{ py: 4 }}>
                                        {error ? 'Unable to load quotes' : debouncedSearch ? 'No quotes match your search' : 'No quotes found'}
                                    </StyledTableCell>
                                </StyledTableRow>
                            )}
                        </StyledTableBody>
                    </StyledTable>
                </StyledListPaper>
            </ListTableScrollZone>

            <ListPaginationBar>
                <TablePagination
                    component="div"
                    count={total}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                />
            </ListPaginationBar>

            <QuoteDetailsDialog
                quoteResult={selectedQuote}
                open={selectedQuote !== null}
                onClose={() => setSelectedQuote(null)}
            />

            <ColumnConfigDialog
                open={showColumnConfig}
                onClose={() => setShowColumnConfig(false)}
                columns={columns}
                onColumnsChange={updateColumns}
                title="Configure Quote Columns"
                isLoaded={isLoaded}
            />
        </ListPageRoot>
    );
};
