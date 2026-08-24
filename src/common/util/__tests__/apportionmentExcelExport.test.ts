import {
    APPORTIONMENT_EXCEL_HEADERS,
    buildApportionmentExcelRows,
    calculateExcelColumnWidth,
    collectApportionmentColumnStrings
} from '../apportionmentExcelExport.js';
import { YearlyApportionmentByAddon } from '#common/types/apportionment.js';

describe('buildApportionmentExcelRows', () => {
    const byAddon: YearlyApportionmentByAddon[] = [
        {
            addonKey: 'com.app.a',
            addonName: 'App A',
            byHosting: [
                {
                    hosting: 'Cloud',
                    years: [
                        {
                            year: '2026',
                            actualValue: 100,
                            transactions: [{
                                transactionId: 'tx-1',
                                auditorTransactionId: 'mp-tx-1',
                                marketplaceTransactionId: 'AT-1001',
                                appEntitlementId: 'entitlement-1',
                                transactionVersion: 2,
                                purchaseDate: '2026-06-15',
                                saleType: 'New',
                                entitlementNumber: 'SEN-1001',
                                company: 'Acme Corp',
                                maintenanceStartDate: '2026-01-01',
                                maintenanceEndDate: '2027-01-01',
                                transactionCreatedAt: '2026-06-01',
                                transactionVersionCreatedAt: '2026-06-10',
                                actualAmount: 100,
                                addonKey: 'com.app.a',
                                hosting: 'Cloud'
                            }]
                        }
                    ]
                }
            ]
        },
        {
            addonKey: 'com.app.b',
            byHosting: [
                {
                    hosting: 'Data Center',
                    years: [{
                        year: '2026',
                        actualValue: 50,
                        transactions: [{
                            transactionId: 'tx-2',
                            auditorTransactionId: 'mp-tx-2',
                            marketplaceTransactionId: 'AT-1002',
                            appEntitlementId: 'entitlement-2',
                            transactionVersion: 1,
                            purchaseDate: '2026-06-20',
                            saleType: 'Renewal',
                            entitlementNumber: 'SEN-1002',
                            company: 'Globex',
                            maintenanceStartDate: '2026-06-01',
                            maintenanceEndDate: '2027-06-01',
                            transactionCreatedAt: '2026-06-02',
                            transactionVersionCreatedAt: '2026-06-20',
                            actualAmount: 50,
                            addonKey: 'com.app.b',
                            hosting: 'Data Center'
                        }]
                    }]
                }
            ]
        }
    ];

    it('uses human-readable app names and omits duplicate addonKey and hosting fields', () => {
        expect(buildApportionmentExcelRows(byAddon)).toEqual([
            [
                'App A',
                'Cloud',
                '2026',
                'New',
                'SEN-1001',
                'Acme Corp',
                '2026-01-01',
                '2027-01-01',
                'tx-1',
                'mp-tx-1',
                'AT-1001',
                'entitlement-1',
                2,
                '2026-06-15',
                '2026-06-01',
                '2026-06-10',
                100
            ],
            [
                'com.app.b',
                'Data Center',
                '2026',
                'Renewal',
                'SEN-1002',
                'Globex',
                '2026-06-01',
                '2027-06-01',
                'tx-2',
                'mp-tx-2',
                'AT-1002',
                'entitlement-2',
                1,
                '2026-06-20',
                '2026-06-02',
                '2026-06-20',
                50
            ]
        ]);
    });

    it('defines export headers for the data sheet and pivot table', () => {
        expect(APPORTIONMENT_EXCEL_HEADERS).toEqual([
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
            'Marketplace Invoice',
            'App Entitlement ID',
            'Transaction Version',
            'Purchase Date',
            'Transaction Creation Date',
            'Transaction Last Updated',
            'Actual Amount'
        ]);
    });

    it('sizes columns from the widest header or cell value', () => {
        const values = collectApportionmentColumnStrings(
            'Marketplace Invoice',
            [[
                'App A',
                'Cloud',
                '2026',
                'New',
                'SEN-1001',
                'Acme Corp',
                '2026-01-01',
                '2027-01-01',
                'tx-1',
                'mp-tx-1',
                'mp-transaction-with-a-long-id',
                'entitlement-1',
                1,
                '2026-06-15',
                '2026-06-01',
                '2026-06-10',
                10
            ]],
            10
        );

        expect(calculateExcelColumnWidth(values)).toBe(31);
        expect(calculateExcelColumnWidth(['App'])).toBe(10);
    });

    it('sorts rows by purchase date then auditor transaction id', () => {
        const unsortedByAddon: YearlyApportionmentByAddon[] = [
            {
                addonKey: 'com.app.b',
                addonName: 'App B',
                byHosting: [{
                    hosting: 'Data Center',
                    years: [{
                        year: '2026',
                        actualValue: 50,
                        transactions: [{
                            transactionId: 'tx-2',
                            auditorTransactionId: 'mp-tx-z',
                            marketplaceTransactionId: 'AT-1002',
                            appEntitlementId: 'entitlement-2',
                            transactionVersion: 1,
                            purchaseDate: '2026-06-20',
                            saleType: 'Renewal',
                            entitlementNumber: 'SEN-1002',
                            company: 'Globex',
                            maintenanceStartDate: '2026-06-01',
                            maintenanceEndDate: '2027-06-01',
                            transactionCreatedAt: '2026-06-02',
                            transactionVersionCreatedAt: '2026-06-20',
                            actualAmount: 50,
                            addonKey: 'com.app.b',
                            hosting: 'Data Center'
                        }]
                    }]
                }]
            },
            {
                addonKey: 'com.app.a',
                addonName: 'App A',
                byHosting: [{
                    hosting: 'Cloud',
                    years: [{
                        year: '2026',
                        actualValue: 200,
                        transactions: [
                            {
                                transactionId: 'tx-3',
                                auditorTransactionId: 'mp-tx-b',
                                marketplaceTransactionId: 'AT-1003',
                                appEntitlementId: 'entitlement-3',
                                transactionVersion: 1,
                                purchaseDate: '2026-06-15',
                                saleType: 'New',
                                entitlementNumber: 'SEN-1003',
                                company: 'Acme Corp',
                                maintenanceStartDate: '2026-01-01',
                                maintenanceEndDate: '2027-01-01',
                                transactionCreatedAt: '2026-06-01',
                                transactionVersionCreatedAt: '2026-06-10',
                                actualAmount: 100,
                                addonKey: 'com.app.a',
                                hosting: 'Cloud'
                            },
                            {
                                transactionId: 'tx-1',
                                auditorTransactionId: 'mp-tx-a',
                                marketplaceTransactionId: 'AT-1001',
                                appEntitlementId: 'entitlement-1',
                                transactionVersion: 2,
                                purchaseDate: '2026-06-15',
                                saleType: 'New',
                                entitlementNumber: 'SEN-1001',
                                company: 'Acme Corp',
                                maintenanceStartDate: '2026-01-01',
                                maintenanceEndDate: '2027-01-01',
                                transactionCreatedAt: '2026-06-01',
                                transactionVersionCreatedAt: '2026-06-10',
                                actualAmount: 100,
                                addonKey: 'com.app.a',
                                hosting: 'Cloud'
                            }
                        ]
                    }]
                }]
            }
        ];

        const rows = buildApportionmentExcelRows(unsortedByAddon);

        expect(rows.map(row => [row[13], row[9]])).toEqual([
            ['2026-06-15', 'mp-tx-a'],
            ['2026-06-15', 'mp-tx-b'],
            ['2026-06-20', 'mp-tx-z']
        ]);
    });
});
