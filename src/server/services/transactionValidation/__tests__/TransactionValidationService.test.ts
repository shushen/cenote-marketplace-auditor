import { TransactionValidationService } from '../TransactionValidationService.js';
import { DiscountResult, TransactionValidationResult } from '../types.js';
import { PreviousTransactionResult } from '#server/services/types.js';

const makeDiscountResult = (): DiscountResult => ({
    discountToUse: 0,
    hasExpectedAdjustments: false,
    hasActualAdjustments: false,
    adjustmentNotes: []
});

const makeValidationResult = (): TransactionValidationResult => ({
    isExpectedPrice: true,
    valid: true,
    vendorAmount: 10,
    expectedVendorAmount: 10,
    expectedDiscountApplied: 0,
    notes: [],
    price: {
        vendorPrice: 10,
        purchasePrice: 12.5,
        dailyNominalPrice: 1,
        descriptors: []
    },
    pricingOpts: {} as any,
    legacyPricingEndDate: undefined,
    previousPurchaseLegacyPricingEndDate: undefined,
    useLegacyPricingTierForCurrent: false,
    hasActualAdjustments: false
});

const makeTransaction = (saleDate: string, saleType: 'Refund' | 'Upgrade' | 'New' = 'Refund'): any => ({
    data: {
        customerDetails: {
            country: 'United States'
        },
        purchaseDetails: {
            saleDate,
            saleType,
            hosting: 'Cloud',
            tier: 'Per Unit Pricing (173 Users)',
            maintenanceStartDate: '2026-05-01',
            maintenanceEndDate: '2026-06-01',
            billingPeriod: 'Monthly',
            licenseType: 'COMMERCIAL',
            discounts: [],
            proratedDetails: undefined
        }
    }
});

describe('TransactionValidationService refund discount reference date', () => {
    it('passes refunded transaction sale date for standalone refunds', async () => {
        const transactionSandboxService = { isTransactionForSandbox: jest.fn().mockResolvedValue(false) } as any;
        const transactionAdjustmentValidationService = {
            calculateFinalExpectedDiscountForTransaction: jest.fn().mockResolvedValue(makeDiscountResult())
        } as any;
        const transactionValidator = {
            validateOneTransaction: jest.fn().mockResolvedValue(makeValidationResult())
        } as any;

        const refundedTx = makeTransaction('2026-03-15', 'New');
        const previousTransactionService = {
            findRefundedTransaction: jest.fn().mockResolvedValue(refundedTx),
            findPreviousTransaction: jest.fn().mockResolvedValue(undefined),
            isRefundPartOfUpgradePair: jest.fn().mockResolvedValue(false),
            findParentTransactionForProratedTransaction: jest.fn()
        } as any;

        const service = new TransactionValidationService(
            transactionSandboxService,
            transactionAdjustmentValidationService,
            transactionValidator,
            previousTransactionService
        );

        await service.validateTransaction({
            transaction: makeTransaction('2026-05-10', 'Refund'),
            pricing: { expertDiscountOptOut: false } as any
        });

        expect(transactionValidator.validateOneTransaction).toHaveBeenCalled();
        const firstCallOpts = transactionValidator.validateOneTransaction.mock.calls[0][0];
        expect(firstCallOpts.discountReferenceSaleDate).toBe('2026-03-15');
        expect(previousTransactionService.findPreviousTransaction).not.toHaveBeenCalled();
    });

    it('does not override discount reference date for paired refunds', async () => {
        const transactionSandboxService = { isTransactionForSandbox: jest.fn().mockResolvedValue(false) } as any;
        const transactionAdjustmentValidationService = {
            calculateFinalExpectedDiscountForTransaction: jest.fn().mockResolvedValue(makeDiscountResult())
        } as any;
        const transactionValidator = {
            validateOneTransaction: jest.fn().mockResolvedValue(makeValidationResult())
        } as any;

        const refundedTx = makeTransaction('2026-03-15', 'New');
        const previousPurchaseFindResult: PreviousTransactionResult = {
            transaction: makeTransaction('2025-12-01', 'New'),
            effectiveMaintenanceEndDate: '2026-05-01'
        };
        const previousTransactionService = {
            findRefundedTransaction: jest.fn().mockResolvedValue(refundedTx),
            findPreviousTransaction: jest.fn().mockResolvedValue(previousPurchaseFindResult),
            isRefundPartOfUpgradePair: jest.fn().mockResolvedValue(true),
            findParentTransactionForProratedTransaction: jest.fn()
        } as any;

        const service = new TransactionValidationService(
            transactionSandboxService,
            transactionAdjustmentValidationService,
            transactionValidator,
            previousTransactionService
        );

        await service.validateTransaction({
            transaction: makeTransaction('2026-05-10', 'Refund'),
            pricing: { expertDiscountOptOut: false } as any
        });

        expect(transactionValidator.validateOneTransaction).toHaveBeenCalled();
        const firstCallOpts = transactionValidator.validateOneTransaction.mock.calls[0][0];
        expect(firstCallOpts.discountReferenceSaleDate).toBeUndefined();
    });

    it('looks up previous purchase for overlap when the refunded transaction is an upgrade', async () => {
        const transactionSandboxService = { isTransactionForSandbox: jest.fn().mockResolvedValue(false) } as any;
        const transactionAdjustmentValidationService = {
            calculateFinalExpectedDiscountForTransaction: jest.fn().mockResolvedValue(makeDiscountResult())
        } as any;
        const transactionValidator = {
            validateOneTransaction: jest.fn().mockResolvedValue(makeValidationResult())
        } as any;

        const refundedTx = makeTransaction('2026-03-15', 'Upgrade');
        const previousPurchaseFindResult: PreviousTransactionResult = {
            transaction: makeTransaction('2025-12-01', 'New'),
            effectiveMaintenanceEndDate: '2026-05-01'
        };
        const previousTransactionService = {
            findRefundedTransaction: jest.fn().mockResolvedValue(refundedTx),
            findPreviousTransaction: jest.fn().mockResolvedValue(previousPurchaseFindResult),
            isRefundPartOfUpgradePair: jest.fn().mockResolvedValue(false),
            findParentTransactionForProratedTransaction: jest.fn()
        } as any;

        const service = new TransactionValidationService(
            transactionSandboxService,
            transactionAdjustmentValidationService,
            transactionValidator,
            previousTransactionService
        );

        await service.validateTransaction({
            transaction: makeTransaction('2026-05-10', 'Refund'),
            pricing: { expertDiscountOptOut: false } as any
        });

        expect(previousTransactionService.findPreviousTransaction).toHaveBeenCalledWith(refundedTx);
        expect(transactionAdjustmentValidationService.calculateFinalExpectedDiscountForTransaction)
            .toHaveBeenCalledWith(previousPurchaseFindResult.transaction);
    });
});

describe('TransactionValidationService late refund exception', () => {
    const makeService = (previousTransactionService: any) => {
        const transactionSandboxService = { isTransactionForSandbox: jest.fn() } as any;
        const transactionAdjustmentValidationService = {
            calculateFinalExpectedDiscountForTransaction: jest.fn()
        } as any;
        const transactionValidator = { validateOneTransaction: jest.fn() } as any;

        return new TransactionValidationService(
            transactionSandboxService,
            transactionAdjustmentValidationService,
            transactionValidator,
            previousTransactionService
        );
    };

    it('flags a standalone refund of a purchase made more than 30 days ago', async () => {
        const refundedTx = makeTransaction('2026-03-15', 'New');
        const previousTransactionService = {
            findRefundedTransaction: jest.fn().mockResolvedValue(refundedTx),
            isRefundPartOfUpgradePair: jest.fn().mockResolvedValue(false)
        } as any;

        const service = makeService(previousTransactionService);
        const result = await service.applyPostValidationRules({
            transaction: makeTransaction('2026-05-10', 'Refund'),
            validationResult: makeValidationResult()
        });

        expect(result?.valid).toBe(false);
        expect(result?.notes).toContain(
            'Refund is for a purchase made more than 30 days ago (original sale date 2026-03-15)'
        );
    });

    it('does not flag a refund of a purchase made exactly 30 days ago', async () => {
        const refundedTx = makeTransaction('2026-04-10', 'New');
        const previousTransactionService = {
            findRefundedTransaction: jest.fn().mockResolvedValue(refundedTx),
            isRefundPartOfUpgradePair: jest.fn().mockResolvedValue(false)
        } as any;

        const service = makeService(previousTransactionService);
        const result = await service.applyPostValidationRules({
            transaction: makeTransaction('2026-05-10', 'Refund'),
            validationResult: makeValidationResult()
        });

        expect(result?.valid).toBe(true);
        expect(result?.notes).toEqual([]);
    });

    it('does not flag a refund of a purchase made fewer than 30 days ago', async () => {
        const refundedTx = makeTransaction('2026-04-20', 'New');
        const previousTransactionService = {
            findRefundedTransaction: jest.fn().mockResolvedValue(refundedTx),
            isRefundPartOfUpgradePair: jest.fn().mockResolvedValue(false)
        } as any;

        const service = makeService(previousTransactionService);
        const result = await service.applyPostValidationRules({
            transaction: makeTransaction('2026-05-10', 'Refund'),
            validationResult: makeValidationResult()
        });

        expect(result?.valid).toBe(true);
        expect(result?.notes).toEqual([]);
    });

    it('does not flag an upgrade-pair refund even if the original purchase is older than 30 days', async () => {
        const refundedTx = makeTransaction('2026-01-01', 'New');
        const previousTransactionService = {
            findRefundedTransaction: jest.fn().mockResolvedValue(refundedTx),
            isRefundPartOfUpgradePair: jest.fn().mockResolvedValue(true)
        } as any;

        const service = makeService(previousTransactionService);
        const result = await service.applyPostValidationRules({
            transaction: makeTransaction('2026-05-10', 'Refund'),
            validationResult: makeValidationResult()
        });

        expect(result?.valid).toBe(true);
        expect(result?.notes).toEqual([]);
        expect(previousTransactionService.findRefundedTransaction).not.toHaveBeenCalled();
    });

    it('does not flag a non-refund transaction', async () => {
        const previousTransactionService = {
            findRefundedTransaction: jest.fn(),
            isRefundPartOfUpgradePair: jest.fn()
        } as any;

        const service = makeService(previousTransactionService);
        const result = await service.applyPostValidationRules({
            transaction: makeTransaction('2026-05-10', 'Upgrade'),
            validationResult: makeValidationResult()
        });

        expect(result?.valid).toBe(true);
        expect(result?.notes).toEqual([]);
        expect(previousTransactionService.isRefundPartOfUpgradePair).not.toHaveBeenCalled();
        expect(previousTransactionService.findRefundedTransaction).not.toHaveBeenCalled();
    });

    it('does not flag a refund when the original purchase cannot be found', async () => {
        const previousTransactionService = {
            findRefundedTransaction: jest.fn().mockResolvedValue(undefined),
            isRefundPartOfUpgradePair: jest.fn().mockResolvedValue(false)
        } as any;

        const service = makeService(previousTransactionService);
        const result = await service.applyPostValidationRules({
            transaction: makeTransaction('2026-05-10', 'Refund'),
            validationResult: makeValidationResult()
        });

        expect(result?.valid).toBe(true);
        expect(result?.notes).toEqual([]);
    });
});
