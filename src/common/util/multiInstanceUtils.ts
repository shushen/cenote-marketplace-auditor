import { LicenseData, TransactionData } from '#common/types/marketplace.js';
import { getDisplayId, getLicenseDisplayId, getTransactionDisplayId } from './displayIdUtils.js';

export function isMultiInstanceLicenseLevel(licenseLevel?: string | null): boolean {
    return licenseLevel === 'multi-instance';
}

export function isMultiInstanceTransaction(transactionData: TransactionData): boolean {
    return isMultiInstanceLicenseLevel(transactionData.licenseLevel);
}

export function isMultiInstanceLicense(licenseData: LicenseData): boolean {
    return isMultiInstanceLicenseLevel(licenseData.licenseLevel);
}

export type LicenseEntitlementDisplayPart = {
    displayId: string;
    showMultiInstanceTag: boolean;
};

export function getLicenseEntitlementDisplayParts(licenseData: LicenseData): LicenseEntitlementDisplayPart[] {
    const mainDisplayId = getLicenseDisplayId(licenseData);
    const multiInstanceEntitlementNumber = licenseData.multiInstanceEntitlementNumber;
    const showMultiInstanceTag = isMultiInstanceLicense(licenseData);

    if (multiInstanceEntitlementNumber) {
        const parts: LicenseEntitlementDisplayPart[] = [];

        if (mainDisplayId && mainDisplayId !== multiInstanceEntitlementNumber) {
            parts.push({ displayId: mainDisplayId, showMultiInstanceTag: false });
        }

        parts.push({
            displayId: multiInstanceEntitlementNumber,
            showMultiInstanceTag
        });

        return parts;
    }

    if (!mainDisplayId) {
        return [];
    }

    return [{ displayId: mainDisplayId, showMultiInstanceTag }];
}

export function collectRelatedEntitlementDisplayIds(
    searchEntitlementId: string,
    licenseRows: Array<{
        hosting: string | null;
        licenseId?: string | null;
        appEntitlementNumber?: string | null;
        multiInstanceEntitlementNumber?: string | null;
    }>
): string[] {
    const displayIds = new Set<string>();

    for (const row of licenseRows) {
        const matchesSearchEntitlement =
            row.appEntitlementNumber === searchEntitlementId ||
            row.multiInstanceEntitlementNumber === searchEntitlementId;

        if (!matchesSearchEntitlement) {
            continue;
        }

        const displayId = getDisplayId(row.hosting, row.licenseId, row.appEntitlementNumber);
        if (displayId) {
            displayIds.add(displayId);
        }
    }

    if (displayIds.size === 0) {
        return [searchEntitlementId];
    }

    return [...displayIds].sort();
}

export function getTransactionEntitlementDisplayIds(
    transactionData: TransactionData,
    relatedEntitlementNumbers?: string[]
): string[] {
    if (relatedEntitlementNumbers && relatedEntitlementNumbers.length > 0) {
        return relatedEntitlementNumbers;
    }

    const displayId = getTransactionDisplayId(transactionData);
    return displayId ? [displayId] : [];
}
