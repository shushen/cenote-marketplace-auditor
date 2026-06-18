import { formatMarketplaceTransactionIdForDisplay } from '../marketplaceTransactionId.js';

describe('formatMarketplaceTransactionIdForDisplay', () => {
    it('inverts lineItemId:transactionId to transactionId:lineItemId', () => {
        expect(formatMarketplaceTransactionIdForDisplay('line-42:txn-99')).toBe('txn-99:line-42');
    });

    it('returns the original value when no separator is present', () => {
        expect(formatMarketplaceTransactionIdForDisplay('txn-only')).toBe('txn-only');
    });

    it('preserves additional colons in the transaction id portion', () => {
        expect(formatMarketplaceTransactionIdForDisplay('line-42:txn:extra:part')).toBe('txn:extra:part:line-42');
    });
});
