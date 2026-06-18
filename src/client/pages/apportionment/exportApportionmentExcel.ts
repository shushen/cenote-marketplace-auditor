import { YearlyApportionmentByAddon } from '#common/types/apportionment.js';
import {
    APPORTIONMENT_EXCEL_ACCOUNTING_NUM_FMT,
    APPORTIONMENT_EXCEL_AUTO_FIT_COLUMN_INDEXES,
    APPORTIONMENT_EXCEL_AUTO_FIT_ROW_INDEXES,
    APPORTIONMENT_EXCEL_HEADERS,
    ApportionmentExcelRow,
    buildApportionmentExcelRows,
    calculateExcelColumnWidth,
    collectApportionmentColumnStrings
} from '#common/util/apportionmentExcelExport.js';

function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function applyDataSheetFormatting(
    dataSheet: {
        addRow(values: ApportionmentExcelRow | string[]): { getCell(col: number): { numFmt: string } };
        getColumn(col: number): { width?: number; numFmt?: string };
    },
    rows: ApportionmentExcelRow[]
): void {
    dataSheet.addRow([...APPORTIONMENT_EXCEL_HEADERS]);
    for (const row of rows) {
        const addedRow = dataSheet.addRow(row);
        addedRow.getCell(APPORTIONMENT_EXCEL_AUTO_FIT_COLUMN_INDEXES.actualAmount).numFmt =
            APPORTIONMENT_EXCEL_ACCOUNTING_NUM_FMT;
    }

    dataSheet.getColumn(APPORTIONMENT_EXCEL_AUTO_FIT_COLUMN_INDEXES.actualAmount).numFmt =
        APPORTIONMENT_EXCEL_ACCOUNTING_NUM_FMT;

    const autoFitColumns = [
        {
            columnIndex: APPORTIONMENT_EXCEL_AUTO_FIT_COLUMN_INDEXES.app,
            rowIndex: APPORTIONMENT_EXCEL_AUTO_FIT_ROW_INDEXES.app
        },
        {
            columnIndex: APPORTIONMENT_EXCEL_AUTO_FIT_COLUMN_INDEXES.transactionId,
            rowIndex: APPORTIONMENT_EXCEL_AUTO_FIT_ROW_INDEXES.transactionId
        },
        {
            columnIndex: APPORTIONMENT_EXCEL_AUTO_FIT_COLUMN_INDEXES.marketplaceTransactionId,
            rowIndex: APPORTIONMENT_EXCEL_AUTO_FIT_ROW_INDEXES.marketplaceTransactionId
        }
    ];

    for (const { columnIndex, rowIndex } of autoFitColumns) {
        const values = collectApportionmentColumnStrings(
            APPORTIONMENT_EXCEL_HEADERS[rowIndex],
            rows,
            rowIndex
        );
        dataSheet.getColumn(columnIndex).width = calculateExcelColumnWidth(values);
    }
}

export async function exportApportionmentExcel(opts: {
    purchaseMonth: string;
    byAddon: YearlyApportionmentByAddon[];
}): Promise<void> {
    const { purchaseMonth, byAddon } = opts;
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const dataSheet = workbook.addWorksheet('Data');
    const rows = buildApportionmentExcelRows(byAddon);

    applyDataSheetFormatting(dataSheet, rows);

    const pivotSheet = workbook.addWorksheet('Pivot Table');
    const addPivotTable = (pivotSheet as { addPivotTable?: (config: {
        sourceSheet: typeof dataSheet;
        rows: string[];
        columns: string[];
        values: string[];
        metric: 'sum';
    }) => unknown }).addPivotTable;

    if (typeof addPivotTable !== 'function') {
        throw new Error('Excel export requires exceljs 4.4.1-prerelease.0 or newer for pivot table support.');
    }

    addPivotTable.call(pivotSheet, {
        sourceSheet: dataSheet,
        rows: ['App', 'Hosting'],
        columns: ['Year'],
        values: ['Actual Amount'],
        metric: 'sum'
    });

    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(
        new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        }),
        `apportionment-${purchaseMonth}.xlsx`
    );
}
