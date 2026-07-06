import { deepEqual, normalizeObject } from '../objectUtils.js';
import {
    normalizeQuoteAggregateData,
    normalizeQuoteDetailsData,
    normalizeQuoteScheduleData,
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
    });
});
