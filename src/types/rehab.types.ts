/**
 * Rehab Record types — Before/After Photos + Rehab Cost Data (Phase 3.4)
 * Capture pre/post-rehab photos tied to a transaction; track scope + spend.
 */

import type { InvestmentStrategy } from './investor.types.js';

export type RehabCategory =
  | 'kitchen'
  | 'bathrooms'
  | 'roof'
  | 'mechanical'
  | 'cosmetic'
  | 'additions'
  | 'foundation'
  | 'flooring'
  | 'windows'
  | 'landscaping'
  | 'other';

export interface RehabLineItem {
  id: string;
  category: RehabCategory;
  description: string;
  budgeted: number;
  actual?: number;
  completedAt?: string; // ISO
}

export interface PhotoRecord {
  id: string;
  blobName: string;         // Azure Blob Storage blob name
  url?: string;             // signed URL (transient — do not persist)
  caption?: string;
  takenAt?: string;         // ISO
  uploadedBy: string;
  uploadedAt: string;
}

export interface RehabRecord {
  id: string;
  tenantId: string;
  type: 'rehab-record';
  propertyId: string;       // links to off-market property or MLS comp id
  address: string;
  city: string;
  state: string;
  zipCode: string;
  strategy?: InvestmentStrategy;
  acquisitionPrice: number;
  acquisitionDate: string;  // ISO
  rehabBudget: number;
  rehabActual?: number;
  rehabStartDate?: string;  // ISO
  rehabCompletedDate?: string; // ISO
  salePrice?: number;
  saleDate?: string;        // ISO
  beforePhotos: PhotoRecord[];
  afterPhotos: PhotoRecord[];
  rehabLineItems: RehabLineItem[];
  notes?: string;
  addedBy: string;
  createdAt: string;
  updatedAt: string;
}

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface CreateRehabRecordRequest {
  propertyId: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  strategy?: InvestmentStrategy;
  acquisitionPrice: number;
  acquisitionDate: string;
  rehabBudget: number;
  rehabActual?: number;
  rehabStartDate?: string;
  rehabCompletedDate?: string;
  salePrice?: number;
  saleDate?: string;
  rehabLineItems?: Omit<RehabLineItem, 'id'>[];
  notes?: string;
}

export interface UpdateRehabRecordRequest {
  rehabActual?: number;
  rehabStartDate?: string;
  rehabCompletedDate?: string;
  salePrice?: number;
  saleDate?: string;
  rehabLineItems?: RehabLineItem[];
  notes?: string;
}
