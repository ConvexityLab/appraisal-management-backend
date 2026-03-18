/**
 * Auto Deal Finder types (Phase 3.2)
 * Match investor buy-box criteria against live and off-market inventory.
 */

import type { InvestmentStrategy } from './investor.types.js';

export interface BuyBox {
  id: string;
  tenantId: string;
  investorId: string;
  type: 'buy-box';
  name: string;
  markets: string[];          // zip codes or MSA codes
  propertyTypes: string[];    // 'single_family' | 'multi_family' | 'condo' | 'townhouse' | 'land'
  minBeds?: number;
  maxBeds?: number;
  minSqft?: number;
  maxSqft?: number;
  maxPurchasePrice: number;
  targetArv?: number;         // after-repair value target
  maxRehabBudget?: number;
  strategies: InvestmentStrategy[];
  minCocReturn?: number;      // minimum cash-on-cash return %
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type DealMatchSource = 'mls_active' | 'mls_sold' | 'off_market';

export interface DealMatch {
  id: string;
  tenantId: string;
  buyBoxId: string;
  runId: string;
  type: 'deal-match';
  source: DealMatchSource;
  sourceId: string;          // MLS number or off-market property id
  address: string;
  city: string;
  state: string;
  zipCode: string;
  lat?: number;
  lon?: number;
  listPrice: number;
  estimatedArv?: number;
  estimatedRehab?: number;
  score: number;             // 0–100 composite score
  scoreBreakdown: {
    priceToBudget: number;   // 0–25: how close to max purchase price
    arvSpread?: number;      // 0–25: price-to-ARV ratio quality
    daysOnMarket?: number;   // 0–25: urgency signal
    cocReturn?: number;      // 0–25: cash-on-cash return quality
  };
  createdAt: string;
}

export interface DealFinderRun {
  id: string;
  tenantId: string;
  buyBoxId: string;
  type: 'deal-finder-run';
  status: 'pending' | 'running' | 'completed' | 'failed';
  matchCount: number;
  startedAt: string;
  completedAt?: string;
  errorMessage?: string;
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateBuyBoxRequest {
  investorId: string;
  name: string;
  markets: string[];
  propertyTypes: string[];
  minBeds?: number;
  maxBeds?: number;
  minSqft?: number;
  maxSqft?: number;
  maxPurchasePrice: number;
  targetArv?: number;
  maxRehabBudget?: number;
  strategies: InvestmentStrategy[];
  minCocReturn?: number;
}

export interface RunDealFinderRequest {
  buyBoxId: string;
  sources?: DealMatchSource[];  // default: all sources
  limit?: number;
}

export interface DealMatchPageResult {
  data: DealMatch[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
