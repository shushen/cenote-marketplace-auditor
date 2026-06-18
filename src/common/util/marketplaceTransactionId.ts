export function formatMarketplaceTransactionIdForDisplay(marketplaceTransactionId: string): string {
    const separatorIndex = marketplaceTransactionId.indexOf(':');
    if (separatorIndex === -1) {
        return marketplaceTransactionId;
    }

    const lineItemId = marketplaceTransactionId.slice(0, separatorIndex);
    const transactionId = marketplaceTransactionId.slice(separatorIndex + 1);
    if (!lineItemId || !transactionId) {
        return marketplaceTransactionId;
    }

    return `${transactionId}:${lineItemId}`;
}
