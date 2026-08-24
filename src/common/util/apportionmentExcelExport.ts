import { YearlyApportionmentByAddon } from '#common/types/apportionment.js';

export const APPORTIONMENT_EXCEL_HEADERS = [
    'App',
    'Hosting',
    'Year',
    'Sale Type',
    'Entitlement Number',
    'Company',
    'Maintenance Start Date',
    'Maintenance End Date',
    'Transaction ID',
    'Auditor Transaction ID',
    'Marketplace Transaction ID',
    'App Entitlement ID',
    'Transaction Version',
    'Purchase Date',
    'Transaction Creation Date',
    'Transaction Last Updated',
    'Actual Amount'
] as const;

export const APPORTIONMENT_EXCEL_ACCOUNTING_NUM_FMT =
    '_($* #,##0.00_);_($* (#,##0.00);_($* "-"??_);_(@_)';

export const APPORTIONMENT_EXCEL_AUTO_FIT_COLUMN_INDEXES = {
    app: 1,
    transactionId: 9,
    auditorTransactionId: 10,
    marketplaceTransactionId: 11,
    actualAmount: 17
} as const;

export const APPORTIONMENT_EXCEL_AUTO_FIT_ROW_INDEXES = {
    app: 0,
    transactionId: 8,
    auditorTransactionId: 9,
    marketplaceTransactionId: 10
} as const;

export type ApportionmentExcelRow = [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    number,
    string,
    string,
    string,
    number
];

export function buildApportionmentExcelRows(byAddon: YearlyApportionmentByAddon[]): ApportionmentExcelRow[] {
    const rows: ApportionmentExcelRow[] = [];

    for (const addon of byAddon) {
        const appName = addon.addonName ?? addon.addonKey;

        for (const hostingGroup of addon.byHosting) {
            for (const yearEntry of hostingGroup.years) {
                for (const transaction of yearEntry.transactions ?? []) {
                    rows.push([
                        appName,
                        hostingGroup.hosting,
                        yearEntry.year,
                        transaction.saleType,
                        transaction.entitlementNumber,
                        transaction.company,
                        transaction.maintenanceStartDate,
                        transaction.maintenanceEndDate,
                        transaction.transactionId,
                        transaction.auditorTransactionId,
                        transaction.marketplaceTransactionId,
                        transaction.appEntitlementId,
                        transaction.transactionVersion,
                        transaction.purchaseDate,
                        transaction.transactionCreatedAt,
                        transaction.transactionVersionCreatedAt,
                        transaction.actualAmount
                    ]);
                }
            }
        }
    }

    return rows;
}

export function collectApportionmentColumnStrings(
    header: string,
    rows: ApportionmentExcelRow[],
    rowIndex: number
): string[] {
    return [header, ...rows.map(row => String(row[rowIndex]))];
}

export function calculateExcelColumnWidth(values: string[]): number {
    const maxLength = Math.max(0, ...values.map(value => value.length));
    return Math.min(Math.max(maxLength + 2, 10), 80);
}
