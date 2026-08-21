import { HostingType } from '#common/types/marketplace.js';

export interface ApportionmentTransactionRef {
    transactionId: string;
    marketplaceTransactionId: string;
    transactionVersion: number;
    purchaseDate: string;
    saleType: string;
    entitlementNumber: string;
    company: string;
    maintenanceStartDate: string;
    maintenanceEndDate: string;
    transactionCreatedAt: string;
    transactionVersionCreatedAt: string;
    actualAmount: number;
    addonKey: string;
    hosting: HostingType;
}

export interface MonthlyAggregateApportionmentEntry {
    month: string;
    actualValue: number;
    transactions: ApportionmentTransactionRef[];
}

export interface YearlyApportionmentEntry {
    year: string;
    actualValue: number;
    transactions?: ApportionmentTransactionRef[];
}

export interface YearlyApportionmentByHosting {
    hosting: HostingType;
    years: YearlyApportionmentEntry[];
}

export interface YearlyApportionmentByAddon {
    addonKey: string;
    addonName?: string;
    byHosting: YearlyApportionmentByHosting[];
}

export interface MonthlyAggregateApportionmentResponse {
    purchaseMonth: string;
    years: YearlyApportionmentEntry[];
    byAddon: YearlyApportionmentByAddon[];
    months: MonthlyAggregateApportionmentEntry[];
}

export interface CalculateApportionmentRequest {
    purchaseMonth: string;
}
