import { deepEqual, normalizeObject } from '../objectUtils.js';
import {
    normalizeQuoteAggregateData,
    normalizeQuoteDetailsData,
    normalizeQuoteScheduleData,
    quoteLinesEqual,
} from '../quoteAggregateUtils.js';

describe('quoteAggregateUtils', () => {
    describe('normalizeQuoteScheduleData', () => {
        it('omits empty discounts arrays', () => {
            expect(normalizeQuoteScheduleData({
                startDate: '2025-05-23',
                endDate: '2025-12-12',
                userTier: 2500,
                listPrice: 5168.46,
                discounts: [],
            })).toEqual({
                startDate: '2025-05-23',
                endDate: '2025-12-12',
                userTier: 2500,
                listPrice: 5168.46,
            });
        });

        it('preserves non-empty discounts arrays', () => {
            const discounts = [{ type: 'EXPERT', percent: 10 }];
            expect(normalizeQuoteScheduleData({
                startDate: '2025-05-23',
                endDate: '2025-12-12',
                listPrice: 5168.46,
                discounts,
            }).discounts).toEqual(discounts);
        });
    });

    describe('normalizeQuoteAggregateData', () => {
        it('treats stored empty discounts the same as missing discounts', () => {
            const withEmptyDiscounts = normalizeObject(normalizeQuoteAggregateData({
                quoteNumber: 'QT-123',
                lines: [{
                    productName: 'Test App',
                    schedules: [{
                        startDate: '2025-05-23',
                        endDate: '2025-12-12',
                        userTier: 2500,
                        listPrice: 5168.46,
                        discounts: [],
                    }],
                }],
            }));

            const withoutDiscounts = normalizeObject(normalizeQuoteAggregateData({
                quoteNumber: 'QT-123',
                lines: [{
                    productName: 'Test App',
                    schedules: [{
                        startDate: '2025-05-23',
                        endDate: '2025-12-12',
                        userTier: 2500,
                        listPrice: 5168.46,
                    }],
                }],
            }));

            expect(deepEqual(withEmptyDiscounts, withoutDiscounts)).toBe(true);
        });

        it('omits details-only fields like createdBy from aggregate data', () => {
            const normalized = normalizeQuoteAggregateData({
                quoteNumber: 'QT-123',
                createdBy: 'CUSTOMER_ADVOCATE',
                vendorId: '1215549',
                quoteId: 'quote-id',
                lines: [],
            });

            expect(normalized).toEqual({
                quoteNumber: 'QT-123',
                lines: [],
            });
        });
    });

    describe('normalizeQuoteDetailsData', () => {
        it('treats missing and empty createdBy the same', () => {
            const withCreatedBy = normalizeObject(normalizeQuoteDetailsData({
                quoteNumber: 'QT-123',
                createdBy: 'CUSTOMER_ADVOCATE',
            }));

            const withoutCreatedBy = normalizeObject(normalizeQuoteDetailsData({
                quoteNumber: 'QT-123',
            }));

            const withEmptyCreatedBy = normalizeObject(normalizeQuoteDetailsData({
                quoteNumber: 'QT-123',
                createdBy: '   ',
            }));

            expect(deepEqual(withCreatedBy, withoutCreatedBy)).toBe(false);
            expect(deepEqual(withoutCreatedBy, withEmptyCreatedBy)).toBe(true);
        });

        it('ignores quotesLines when normalizing top-level details fields', () => {
            const normalized = normalizeQuoteDetailsData({
                quoteNumber: 'QT-123',
                createdBy: 'CUSTOMER_ADVOCATE',
                quotesLines: [{
                    productName: 'Test App',
                    schedules: [{ startDate: '2025-01-01', endDate: '2026-01-01' }],
                }],
            });

            expect(normalized.quoteNumber).toBe('QT-123');
            expect(normalized.createdBy).toBe('CUSTOMER_ADVOCATE');
            expect(normalized.quotesLines).toHaveLength(1);
        });
    });

    describe('quoteLinesEqual', () => {
        const baseLine = {
            productName: 'Test App',
            schedules: [{
                startDate: '2025-05-23',
                endDate: '2025-12-12',
                userTier: 2500,
                listPrice: 5168.46,
            }],
        };

        it('returns true when line data matches after normalization', () => {
            expect(quoteLinesEqual(
                [{ ...baseLine, schedules: [{ ...baseLine.schedules[0], discounts: [] }] }],
                [baseLine]
            )).toBe(true);
        });

        it('returns false when schedule data changes', () => {
            expect(quoteLinesEqual(
                [baseLine],
                [{
                    ...baseLine,
                    schedules: [{ ...baseLine.schedules[0], listPrice: 9999 }],
                }]
            )).toBe(false);
        });
    });
});
