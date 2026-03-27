/**
 * Investment Proforma types — ROI, Cap Rate, Cash-on-Cash calculations (Phase 3.5)
 * Pure calculation engine + persistence layer for investment projections.
 */

import type { InvestmentStrategy } from './investor.types.js';

export interface InvestmentProforma {
  id: string;
  tenantId: string;
  type: 'investment-proforma';
  propertyId: string;
  dealId?: string;       // optional link to a DealMatch
  scenarioName: string;
  strategy: InvestmentStrategy;

  // ── Purchase inputs ──────────────────────────────────────────────────────
  purchasePrice: number;
  closingCosts: number;
  rehabBudget: number;

  // ── Financing inputs ─────────────────────────────────────────────────────
  loanAmount?: number;
  interestRate?: number;        // annual %
  loanTermMonths?: number;
  downPayment?: number;

  // ── Rental income (hold strategy) ────────────────────────────────────────
  monthlyRent?: number;
  vacancyRate?: number;         // % e.g. 5 = 5%
  managementFeeRate?: number;   // % e.g. 10 = 10%
  annualExpenses?: number;      // taxes + insurance + maintenance

  // ── Flip projection ──────────────────────────────────────────────────────
  arvEstimate?: number;
  holdMonths?: number;

  // ── Calculated outputs (stored for history; recalculate on read if needed) 
  totalInvestment: number;
  netProfit: number;
  roi: number;                  // % return on investment
  cocReturn?: number;           // % cash-on-cash
  capRate?: number;             // % capitalization rate
  monthlyMortgage?: number;     // P+I payment
  monthlyCashFlow?: number;

  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── Stateless calculation request/response ────────────────────────────────────

export type ProformaCalculateRequest = Omit<
  InvestmentProforma,
  'id' | 'tenantId' | 'type' | 'propertyId' | 'dealId' | 'scenarioName' | 'addedBy' | 'createdAt' | 'updatedAt' |
  'totalInvestment' | 'netProfit' | 'roi' | 'cocReturn' | 'capRate' | 'monthlyMortgage' | 'monthlyCashFlow'
>;

export interface ProformaCalculateResponse {
  totalInvestment: number;
  netProfit: number;
  roi: number;
  cocReturn?: number;
  capRate?: number;
  monthlyMortgage?: number;
  monthlyCashFlow?: number;
}

// ── Persistence DTOs ──────────────────────────────────────────────────────────

export interface SaveProformaRequest {
  propertyId: string;
  dealId?: string;
  scenarioName: string;
  inputs: ProformaCalculateRequest;
}
