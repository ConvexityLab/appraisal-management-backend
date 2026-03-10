/**
 * Report Normalization
 *
 * Ensures every report document returned from the API is in canonical schema
 * format, regardless of whether it was originally stored as a legacy BatchData
 * document or a modern canonical document.
 *
 * Detection heuristic:
 *   - If `schemaVersion` is present → already canonical, return as-is.
 *   - Otherwise → run through the BatchData mapper (the only legacy vendor
 *     format currently in the reporting container).
 *
 * When additional vendor formats are added, this file becomes the vendor
 * mapper registry: inspect the raw document to determine vendor, then dispatch
 * to the correct mapper.
 */

import type { CanonicalReportDocument } from '../types/canonical-schema.js';
import { mapBatchDataReport } from './batch-data.mapper.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger();

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

  // Legacy BatchData document — map to canonical
  logger.info('Normalizing legacy report document to canonical schema', {
    reportId: raw.id ?? raw.reportRecordId,
  });
  return mapBatchDataReport(raw);
}
