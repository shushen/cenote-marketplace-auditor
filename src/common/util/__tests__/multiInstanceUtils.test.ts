import {
    collectRelatedEntitlementDisplayIds,
    getLicenseEntitlementDisplayParts,
    isMultiInstanceLicense,
    isMultiInstanceTransaction
} from '../multiInstanceUtils.js';
import { LicenseData, TransactionData } from '#common/types/marketplace.js';

describe('multiInstanceUtils', () => {
    describe('isMultiInstanceTransaction', () => {
        it('returns true when licenseLevel is multi-instance', () => {
            const transactionData = { licenseLevel: 'multi-instance' } as TransactionData;
            expect(isMultiInstanceTransaction(transactionData)).toBe(true);
        });

        it('returns false for other license levels', () => {
            const transactionData = { licenseLevel: 'single-instance' } as TransactionData;
            expect(isMultiInstanceTransaction(transactionData)).toBe(false);
        });
    });

    describe('isMultiInstanceLicense', () => {
        it('returns true when licenseLevel is multi-instance', () => {
            const licenseData = { licenseLevel: 'multi-instance' } as LicenseData;
            expect(isMultiInstanceLicense(licenseData)).toBe(true);
        });

        it('returns false for other license levels', () => {
            const licenseData = { licenseLevel: 'single-instance' } as LicenseData;
            expect(isMultiInstanceLicense(licenseData)).toBe(false);
        });
    });

    describe('getLicenseEntitlementDisplayParts', () => {
        it('shows both entitlement numbers for secondary multi-instance licenses', () => {
            const licenseData = {
                hosting: 'Cloud',
                appEntitlementNumber: 'E-222-AAA-AAA-22A',
                multiInstanceEntitlementNumber: 'E-111-AAA-AAA-11A',
                licenseLevel: 'multi-instance'
            } as LicenseData;

            expect(getLicenseEntitlementDisplayParts(licenseData)).toEqual([
                { displayId: 'E-222-AAA-AAA-22A', showMultiInstanceTag: false },
                { displayId: 'E-111-AAA-AAA-11A', showMultiInstanceTag: true }
            ]);
        });

        it('tags the primary entitlement for primary multi-instance licenses', () => {
            const licenseData = {
                hosting: 'Cloud',
                appEntitlementNumber: 'E-111-AAA-AAA-11A',
                licenseLevel: 'multi-instance'
            } as LicenseData;

            expect(getLicenseEntitlementDisplayParts(licenseData)).toEqual([
                { displayId: 'E-111-AAA-AAA-11A', showMultiInstanceTag: true }
            ]);
        });
    });

    describe('collectRelatedEntitlementDisplayIds', () => {
        it('returns all related entitlement numbers for a multi-instance set', () => {
            const displayIds = collectRelatedEntitlementDisplayIds('E-111-AAA-AAA-11A', [
                {
                    hosting: 'Cloud',
                    appEntitlementNumber: 'E-111-AAA-AAA-11A'
                },
                {
                    hosting: 'Cloud',
                    appEntitlementNumber: 'E-222-AAA-AAA-22A',
                    multiInstanceEntitlementNumber: 'E-111-AAA-AAA-11A'
                }
            ]);

            expect(displayIds).toEqual(['E-111-AAA-AAA-11A', 'E-222-AAA-AAA-22A']);
        });

        it('falls back to the search entitlement when no related licenses are found', () => {
            expect(collectRelatedEntitlementDisplayIds('E-111-AAA-AAA-11A', [])).toEqual(['E-111-AAA-AAA-11A']);
        });
    });
});
