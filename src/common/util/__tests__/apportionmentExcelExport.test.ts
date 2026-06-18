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
                                marketplaceTransactionId: 'mp-tx-1',
                                transactionVersion: 2,
                                purchaseDate: '2026-06-15',
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
                            marketplaceTransactionId: 'mp-tx-2',
                            transactionVersion: 1,
                            purchaseDate: '2026-06-20',
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
                'tx-1',
                'mp-tx-1',
                2,
                '2026-06-15',
                100
            ],
            [
                'com.app.b',
                'Data Center',
                '2026',
                'tx-2',
                'mp-tx-2',
                1,
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
            'Transaction ID',
            'Marketplace Transaction ID',
            'Transaction Version',
            'Purchase Date',
            'Actual Amount'
        ]);
    });

    it('sizes columns from the widest header or cell value', () => {
        const values = collectApportionmentColumnStrings(
            'Marketplace Transaction ID',
            [[
                'App A',
                'Cloud',
                '2026',
                'tx-1',
                'mp-transaction-with-a-long-id',
                1,
                '2026-06-15',
                10
            ]],
            4
        );

        expect(calculateExcelColumnWidth(values)).toBe(31);
        expect(calculateExcelColumnWidth(['App'])).toBe(10);
    });
});
