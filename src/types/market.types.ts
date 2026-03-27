/**
 * Market Intelligence types — Market Map + Alert System (Phase 4.1 / 4.2)
 */

// ─── Market Stats (Phase 4.1) ─────────────────────────────────────────────────

export interface MarketStats {
  id: string;                  // zipCode
  tenantId: string;
  type: 'market-stats';
  zipCode: string;
  msaCode?: string;            // Metropolitan Statistical Area
  stateCode: string;
  // Aggregated metrics (recalculated nightly)
  medianPrice: number;
  medianPricePerSqft: number;
  medianDaysOnMarket: number;
  salesVolume: number;         // number of sales in the period
  listToSaleRatio: number;     // sale price / list price, e.g. 0.98
  investorSalesShare: number;  // % of sales to investor/corporate entities
  // Time series (last 12 months, ordered oldest → newest)
  monthlyMedianPrices: MonthlyDataPoint[];
  monthlyVolumes: MonthlyDataPoint[];
  calculatedForMonth: string;  // YYYY-MM — which month these stats cover
  updatedAt: string;
}

export interface MonthlyDataPoint {
  month: string;  // YYYY-MM
  value: number;
}

export interface MarketHeatmapEntry {
  zipCode: string;
  lat: number;
  lon: number;
  value: number;  // normalised 0–100 relative to dataset
  rawValue: number;
  metric: HeatmapMetric;
}

export type HeatmapMetric =
  | 'median_price'
  | 'price_psf'
  | 'days_on_market'
  | 'investor_activity'
  | 'price_change_pct';

// ─── Alert System (Phase 4.2) ──────────────────────────────────────────────────

export type AlertTriggerType =
  | 'new_listing'
  | 'price_reduction'
  | 'new_sold'
  | 'investor_activity'
  | 'market_trend';

export type AlertChannel = 'email' | 'sms' | 'push' | 'webhook';

export interface AlertCriteria {
  markets?: string[];               // zip codes or MSA codes
  minPrice?: number;
  maxPrice?: number;
  minSqft?: number;
  maxSqft?: number;
  propertyTypes?: string[];
  minPriceReductionPct?: number;    // for price_reduction trigger — e.g. 5 = 5%
  trendMetric?: HeatmapMetric;      // for market_trend trigger
  trendThresholdPct?: number;       // % change threshold to fire
}

export interface Alert {
  id: string;
  tenantId: string;
  userId: string;
  type: 'market-alert';
  name: string;
  triggerType: AlertTriggerType;
  criteria: AlertCriteria;
  channels: AlertChannel[];
  webhookUrl?: string;
  isActive: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ── DTOs ────────────────────────────────────────────────────────────────────

export interface CreateAlertRequest {
  name: string;
  triggerType: AlertTriggerType;
  criteria: AlertCriteria;
  channels: AlertChannel[];
  webhookUrl?: string;
}

export interface MarketTrendsResponse {
  zipCode: string;
  metric: HeatmapMetric;
  months: number;
  dataPoints: MonthlyDataPoint[];
}
