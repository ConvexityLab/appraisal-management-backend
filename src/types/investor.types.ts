/**
 * Investor Activity Tracking types (Phase 3.1)
 * Tracks who is buying what, where, how often — institutional vs individual,
 * flip vs hold, price bands.
 */

export type InvestmentStrategy = 'fix_and_flip' | 'buy_and_hold' | 'wholesale' | 'development' | 'brrrr';
export type EntityType = 'individual' | 'llc' | 'corporation' | 'reit' | 'fund';

export interface InvestorProfile {
  id: string;
  tenantId: string;
  type: 'investor-profile';
  entityName: string;       // LLC name, person name, corp name
  entityType: EntityType;
  primaryMarkets: string[]; // zip codes or MSA codes
  acquisitionCount: number;
  avgPurchasePrice: number;
  avgHoldDays: number;
  strategies: InvestmentStrategy[];
  /** Most recently active zip codes, derived from transaction history */
  activeZipCodes: string[];
  totalVolumeDealt: number; // sum of all acquisition prices
  firstSeenAt: string;      // ISO — earliest known transaction date
  lastSeenAt: string;       // ISO — most recent known transaction date
  createdAt: string;
  updatedAt: string;
}

export interface InvestorTransaction {
  id: string;
  tenantId: string;
  type: 'investor-transaction';
  investorId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  lat?: number;
  lon?: number;
  acquisitionPrice: number;
  acquisitionDate: string;  // ISO
  salePrice?: number;
  saleDate?: string;        // ISO — null if still held
  holdDays?: number;        // derived: saleDate - acquisitionDate
  strategy?: InvestmentStrategy;
  mlsNumber?: string;
  dataSource: 'mls' | 'public_records' | 'manual';
  createdAt: string;
  updatedAt: string;
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface InvestorSearchRequest {
  market?: string;           // zip code or MSA
  strategy?: InvestmentStrategy;
  minPurchasePrice?: number;
  maxPurchasePrice?: number;
  activeWithinDays?: number; // filter by lastSeenAt
  entityType?: EntityType;
  page?: number;
  limit?: number;
}

export interface InvestorPageResult {
  data: InvestorProfile[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface CreateInvestorTransactionRequest {
  investorId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  lat?: number;
  lon?: number;
  acquisitionPrice: number;
  acquisitionDate: string;
  salePrice?: number;
  saleDate?: string;
  strategy?: InvestmentStrategy;
  mlsNumber?: string;
  dataSource: 'mls' | 'public_records' | 'manual';
}
