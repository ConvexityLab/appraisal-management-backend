/**
 * Construction Cost Catalog Types
 *
 * RSMeans-style unit cost database organized by CSI MasterFormat divisions.
 * Used for budget feasibility review, line-item benchmarking, and AI
 * budget-reasonability analysis.
 *
 * Partition key in Cosmos: /division  (two-digit CSI division code, e.g. "03")
 */

// CSI MasterFormat 16-division structure (simplified for residential/commercial lender use)
export type CsiDivision =
  | '01' // General Requirements
  | '02' // Existing Conditions / Site Demolition
  | '03' // Concrete
  | '04' // Masonry
  | '05' // Metals
  | '06' // Wood, Plastics & Composites
  | '07' // Thermal & Moisture Protection
  | '08' // Openings (Doors, Windows, Glazing)
  | '09' // Finishes
  | '10' // Specialties
  | '11' // Equipment
  | '13' // Special Construction
  | '21' // Fire Suppression
  | '22' // Plumbing
  | '23' // HVAC
  | '26'; // Electrical

export type CostUnit =
  | 'SF'   // Square foot
  | 'LF'   // Linear foot
  | 'CY'   // Cubic yard
  | 'CF'   // Cubic foot
  | 'EA'   // Each
  | 'SQ'   // Square (roofing — 100 SF)
  | 'TON'  // Ton
  | 'LB'   // Pound
  | 'GAL'  // Gallon
  | 'HR'   // Hour
  | 'LS';  // Lump sum

/**
 * A single RSMeans-style cost line item in the catalog.
 * Partition key: division
 */
export interface CostCatalogItem {
  /** Cosmos item ID — format: "csi-{sectionCode.replace(/ /g, '-')}-{seq:03d}" */
  id: string;
  /** Two-digit CSI division (partition key) */
  division: CsiDivision;
  /** Human-readable division name */
  divisionName: string;
  /** Full CSI section code (e.g. "03 30 00") */
  sectionCode: string;
  /** Section name (e.g. "Cast-in-Place Concrete") */
  sectionName: string;
  /** Specific item description (e.g. "Concrete, ready mix, normal weight, 3000 psi, pumped") */
  description: string;
  /** Unit of measure */
  unit: CostUnit;
  /** Material component of unit cost (USD) */
  materialCost: number;
  /** Labor component of unit cost (USD) */
  laborCost: number;
  /** Equipment component of unit cost (USD) */
  equipmentCost: number;
  /** Total unit cost = material + labor + equipment (USD) */
  totalCost: number;
  /** Search keywords for full-text lookup */
  keywords: string[];
  /** Type discriminator for Cosmos multi-model container (if ever needed) */
  type: 'construction-cost-catalog-item';
  createdAt: string;
  updatedAt: string;
}

// ─── Service I/O ──────────────────────────────────────────────────────────────

export interface CatalogSearchParams {
  /** Free-text search across description + keywords */
  q?: string;
  /** Filter by CSI division (e.g. "03") */
  division?: CsiDivision;
  /** Filter by section code (e.g. "03 30 00") */
  sectionCode?: string;
  page?: number;
  pageSize?: number;
}

export interface CatalogSearchResult {
  items: CostCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
}
