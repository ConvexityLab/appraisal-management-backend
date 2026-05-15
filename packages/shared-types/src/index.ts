/**
 * @l1/shared-types — single source of truth for types shared between
 * appraisal-management-backend and l1-valuation-platform-ui.
 *
 * Canonical source: appraisal-management-backend/packages/shared-types
 *
 * Do NOT add runtime logic here — types only.
 *
 * NOTE: CanonicalAddress exists in two forms:
 *   - canonical-schema.ts  → { streetAddress, zipCode } — appraisal report shape
 *   - property-record.types.ts → { street, zip } — property domain aggregate shape
 *
 * To avoid a duplicate-export collision in the barrel the property-record types
 * are re-exported under the `PropertyRecord` namespace sub-path.
 * Direct consumers that need the property-record CanonicalAddress should import:
 *   import type { CanonicalAddress as PropertyAddress } from '@l1/shared-types/property-record';
 */

export * from './canonical-schema';
export * from './canonical-completion-report';
export * from './uad-3.6';
export * from './report-config.types';
// property-record.types is NOT barrel-exported here due to CanonicalAddress naming conflict.
// Import directly from '@l1/shared-types/property-record' when needed.
// Pure-type exports (interfaces, type aliases)
export type {
  PropertyRecord,
  PropertyVersionEntry,
  PropertyCurrentCanonicalView,
  PropertyIdResolutionMethod,
  PropertyResolutionResult,
  CreatePropertyRecordInput,
  PermitRecord,
  TaxAssessmentRecord,
  PropertyVersionEntry as PropertyAddressVersionEntry,
} from './property-record.types';
// Enum exports — must be value exports (not `export type`)
export { PropertyRecordType, PropertyRecordCondition, BuildingQualityRating } from './property-record.types';
export type { PermitType } from './property-record.types';
// Re-export the property-record CanonicalAddress under a distinct name so both
// shapes can coexist in the same module graph.
export type { CanonicalAddress as PropertyRecordAddress } from './property-record.types';
