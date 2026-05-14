/**
 * Property Field Diff Controller
 *
 * Compares the report's claimed subject-property values against the
 * latest public-records enrichment for an order. Stateless compute —
 * pulls already-stored canonical snapshot + property enrichment, hands
 * to PropertyFieldDiffService.
 *
 *   GET /api/orders/:orderId/property-field-diff
 *
 * Returns 200 with a partial-diff report when one side is missing
 * (callers want to surface "no public records" or "no extraction yet"
 * in the UI rather than treating it as an error).
 *
 * Auth: order:read — anyone authorized to view the order can view its diff.
 */

import { Router, Response } from 'express';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { CanonicalSnapshotService } from '../services/canonical-snapshot.service.js';
import {
  PropertyFieldDiffService,
  type ClaimInput,
  type PublicRecordInput,
} from '../services/property-field-diff.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { AuthorizationMiddleware } from '../middleware/authorization.middleware.js';

const logger = new Logger('PropertyFieldDiffController');

/**
 * Minimal row shape pulled from the property-enrichments container. We
 * don't use PropertyEnrichmentService directly because its constructor
 * requires a geocoder + property-record service for the write paths,
 * which we don't exercise here — this is a read-only diff endpoint.
 */
interface EnrichmentRow {
  orderId: string;
  tenantId: string;
  dataResult: {
    source?: string;
    fetchedAt?: string;
    core?: Record<string, unknown>;
    publicRecord?: Record<string, unknown>;
  } | null;
}

const PROPERTY_ENRICHMENTS_CONTAINER = 'property-enrichments';

export class PropertyFieldDiffController {
  public router: Router;
  private snapshotService: CanonicalSnapshotService;
  private diffService: PropertyFieldDiffService;

  constructor(
    private readonly dbService: CosmosDbService,
    authzMiddleware?: AuthorizationMiddleware,
  ) {
    this.router = Router();
    this.snapshotService = new CanonicalSnapshotService(dbService);
    this.diffService = new PropertyFieldDiffService();

    const lp = authzMiddleware ? [authzMiddleware.loadUserProfile()] : [];
    const readAuth = authzMiddleware ? [...lp, authzMiddleware.authorize('order', 'read')] : [];

    this.router.get('/:orderId/property-field-diff', ...readAuth, this.getDiff.bind(this));
  }

  private async getDiff(req: UnifiedAuthRequest, res: Response): Promise<void> {
    const orderId = req.params['orderId'];
    try {
      if (!orderId) {
        res.status(400).json({ error: 'orderId is required' });
        return;
      }
      const tenantId = req.user?.tenantId;
      if (!tenantId) {
        res.status(401).json({ error: 'Authenticated tenant context is required' });
        return;
      }

      const [snapshot, enrichment] = await Promise.all([
        this.snapshotService.getLatestSnapshotByOrderId(orderId, tenantId),
        this.loadLatestEnrichment(orderId, tenantId),
      ]);

      const claim = extractClaim(snapshot?.normalizedData?.canonical);
      const publicRecord = extractPublicRecord(enrichment?.dataResult);

      const report = this.diffService.compute(orderId, claim, publicRecord, {
        publicRecordSource: enrichment?.dataResult?.source ?? null,
        publicRecordFetchedAt: enrichment?.dataResult?.fetchedAt ?? null,
      });

      res.json({
        success: true,
        data: {
          ...report,
          // Distinguish "data not loaded yet" from "data loaded, all missing" —
          // the FE needs this to decide between empty state and informative state.
          snapshotAvailable: snapshot !== null,
          enrichmentAvailable: enrichment !== null && enrichment.dataResult !== null,
        },
      });
    } catch (err) {
      logger.error('getDiff failed', {
        orderId,
        error: err instanceof Error ? err.message : String(err),
      });
      res.status(500).json({ success: false, error: 'Failed to compute property field diff' });
    }
  }

  private async loadLatestEnrichment(
    orderId: string,
    tenantId: string,
  ): Promise<EnrichmentRow | null> {
    const query = `
      SELECT TOP 1 c.orderId, c.tenantId, c.dataResult
      FROM c
      WHERE c.orderId = @orderId
        AND c.tenantId = @tenantId
        AND c.type = 'property-enrichment'
      ORDER BY c.createdAt DESC`;
    const result = await this.dbService.queryItems<EnrichmentRow>(
      PROPERTY_ENRICHMENTS_CONTAINER,
      query,
      [
        { name: '@orderId', value: orderId },
        { name: '@tenantId', value: tenantId },
      ],
    );
    if (!result.success || !result.data || result.data.length === 0) return null;
    return result.data[0] ?? null;
  }
}

/**
 * Pulls the claim-side values out of canonicalData.canonical. The canonical
 * projection is built by AxiomExtractionMapper and stores subject-property
 * fields under `canonical.subject`. Missing / wrong-shape branches return
 * null per-field so the diff service can emit MISSING_CLAIM.
 */
function extractClaim(canonical: Record<string, unknown> | undefined): ClaimInput {
  if (!canonical) return {};
  const subject = (canonical['subject'] ?? null) as Record<string, unknown> | null;
  if (!subject) return {};
  return {
    grossLivingArea: asNumber(subject['grossLivingArea']),
    bedrooms: asNumber(subject['bedrooms']),
    bathsFull: asNumber(subject['bathsFull']),
    bathsHalf: asNumber(subject['bathsHalf']),
    yearBuilt: asNumber(subject['yearBuilt']),
    lotSizeSqFt: asNumber(subject['lotSizeSqFt']),
    stories: asNumber(subject['stories']),
    parcelNumber: asString(subject['parcelNumber']),
  };
}

/**
 * Pulls the public-record-side values out of PropertyDataResult. Bridge /
 * ATTOM nest these under `core` + `publicRecord`. We pull from `core` for
 * physical attributes and `publicRecord` for tax/owner fields.
 */
function extractPublicRecord(
  dataResult: { core?: Record<string, unknown>; publicRecord?: Record<string, unknown> } | null | undefined,
): PublicRecordInput {
  if (!dataResult) return {};
  const core = dataResult.core ?? {};
  return {
    grossLivingArea: asNumber(core['grossLivingArea']),
    bedrooms: asNumber(core['bedrooms']),
    bathsFull: asNumber(core['bathsFull']),
    bathsHalf: asNumber(core['bathsHalf']),
    yearBuilt: asNumber(core['yearBuilt']),
    lotSizeSqFt: asNumber(core['lotSizeSqFt']),
    stories: asNumber(core['stories']),
    parcelNumber: asString(core['parcelNumber']),
  };
}

function asNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim().length > 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asString(v: unknown): string | null {
  if (typeof v === 'string' && v.trim().length > 0) return v.trim();
  return null;
}
