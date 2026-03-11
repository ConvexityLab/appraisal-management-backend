/**
 * Report Normalization & Vendor Mapper Registry
 *
 * Ensures every report document returned from the API is in canonical schema
 * format, regardless of whether it was originally stored as a legacy BatchData
 * document or a modern canonical document.
 *
 * ## Document-level normalization
 *
 * `normalizeReportDocument(raw)` detects the vendor format and dispatches
 * to the correct document-level mapper:
 *   - If `schemaVersion` is present → already canonical, return as-is.
 *   - Otherwise → detect vendor from document shape, look up mapper, convert.
 *
 * ## Vendor mapper registry
 *
 * `registerVendorMapper()` / `getVendorMapper()` provide a dynamic registry
 * for field-level VendorMapper implementations. Each mapper handles:
 *   - `mapToSubject(raw)` — vendor property data → CanonicalSubject
 *   - `mapToComps(raw)` — vendor comps blob → CanonicalComp[]
 *
 * New vendors register at startup; the registry is used by ingestion services
 * and by normalizeReportDocument for format detection.
 */

import type { CanonicalReportDocument, VendorMapper } from '../types/canonical-schema.js';
import { mapBatchDataReport, batchDataMapper } from './batch-data.mapper.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('VendorMapperRegistry');

// ── Document-level mapper type ────────────────────────────────────────────────

/**
 * A function that maps a raw Cosmos document into a CanonicalReportDocument.
 * This is for full-document normalization (as opposed to field-level VendorMapper).
 */
type DocumentMapper = (raw: Record<string, unknown>) => CanonicalReportDocument;

// ── Registries ────────────────────────────────────────────────────────────────

/** Field-level vendor mappers keyed by vendorId. */
const vendorMappers = new Map<string, VendorMapper>();

/** Document-level mappers keyed by vendorId. */
const documentMappers = new Map<string, DocumentMapper>();

// ── Bootstrap: register all known mappers ─────────────────────────────────────

vendorMappers.set(batchDataMapper.vendorId, batchDataMapper);
documentMappers.set('batch_data', mapBatchDataReport);

// ── Public API: field-level registry ──────────────────────────────────────────

/**
 * Register a VendorMapper for field-level mapping (subject + comps).
 * Call at application startup for each supported vendor.
 */
export function registerVendorMapper(mapper: VendorMapper): void {
  if (vendorMappers.has(mapper.vendorId)) {
    logger.warn(`Overwriting existing vendor mapper for "${mapper.vendorId}"`);
  }
  vendorMappers.set(mapper.vendorId, mapper);
  logger.info(`Registered vendor mapper: ${mapper.vendorId}`);
}

/**
 * Register a document-level mapper for full report normalization.
 * Call at application startup for each supported vendor.
 */
export function registerDocumentMapper(vendorId: string, mapper: DocumentMapper): void {
  if (documentMappers.has(vendorId)) {
    logger.warn(`Overwriting existing document mapper for "${vendorId}"`);
  }
  documentMappers.set(vendorId, mapper);
  logger.info(`Registered document mapper: ${vendorId}`);
}

/**
 * Look up a field-level VendorMapper by vendor ID.
 * @returns The mapper, or undefined if no mapper is registered for this vendor.
 */
export function getVendorMapper(vendorId: string): VendorMapper | undefined {
  return vendorMappers.get(vendorId);
}

/**
 * List all registered vendor IDs (field-level mappers).
 */
export function getRegisteredVendorIds(): string[] {
  return Array.from(vendorMappers.keys());
}

// ── Public API: document-level normalization ──────────────────────────────────

/**
 * Detect the vendor format of a raw Cosmos report document.
 *
 * Heuristic (in order):
 *   1. `vendorId` field → direct lookup
 *   2. Known structural signatures (e.g. BatchData has `propertyData` at top level)
 *   3. Fallback → 'batch_data' (current only legacy format)
 */
function detectVendor(raw: Record<string, unknown>): string {
  // Explicit vendor marker
  if (typeof raw['vendorId'] === 'string' && raw['vendorId']) {
    return raw['vendorId'] as string;
  }

  // BatchData structural signature: top-level propertyData + compsData arrays
  if (raw['propertyData'] || raw['compsData']) {
    return 'batch_data';
  }

  // Default: assume BatchData for backward compatibility with existing documents
  return 'batch_data';
}

/**
 * Normalize a raw Cosmos report document into canonical schema.
 *
 * @param raw - The raw Cosmos DB document (may be canonical or legacy).
 * @returns A `CanonicalReportDocument` ready for the API response.
 */
export function normalizeReportDocument(
  raw: Record<string, unknown>,
): CanonicalReportDocument {
  // Already canonical — pass through
  if (raw.schemaVersion) {
    return raw as unknown as CanonicalReportDocument;
  }

  const vendorId = detectVendor(raw);
  const mapper = documentMappers.get(vendorId);

  if (!mapper) {
    throw new Error(
      `No document mapper registered for vendor "${vendorId}". ` +
      `Registered vendors: [${Array.from(documentMappers.keys()).join(', ')}]. ` +
      `Document id: ${raw.id ?? raw.reportRecordId ?? 'unknown'}`,
    );
  }

  logger.info('Normalizing report document to canonical schema', {
    reportId: raw.id ?? raw.reportRecordId,
    vendorId,
  });

  return mapper(raw);
}
