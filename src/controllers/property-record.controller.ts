import { Request, Response, Router } from 'express';
import { PropertyRecordService } from '../services/property-record.service.js';
import { listPropertyRecords } from '../services/property-record-listing.service.js';
import { Logger } from '../utils/logger.js';
import { PropertyObservationService } from '../services/property-observation.service.js';
import { PropertyProjectorService } from '../services/property-projector.service.js';
import { materializePropertyRecordHistory } from '../services/property-record-history-materializer.service.js';
import type { PropertyObservationRecord } from '../types/property-observation.types.js';
import type { PermitRecord, PropertyRecord, TaxAssessmentRecord } from '@l1/shared-types';

type PropertyAvm = NonNullable<PropertyRecord['avm']>;

type AuthenticatedRequestLike = Request & {
  user?: {
    id?: string;
    tenantId?: string;
  };
};

function resolveTenantId(req: Request): string | null {
  const authenticatedTenantId = (req as AuthenticatedRequestLike).user?.tenantId;
  const headerTenantId = req.headers['x-tenant-id'];

  if (typeof authenticatedTenantId === 'string' && authenticatedTenantId.trim()) {
    return authenticatedTenantId;
  }

  if (typeof headerTenantId === 'string' && headerTenantId.trim()) {
    return headerTenantId;
  }

  return null;
}

function resolveActorId(req: Request): string | null {
  const authenticatedUserId = (req as AuthenticatedRequestLike).user?.id;
  const headerUserId = req.headers['x-user-id'];

  if (typeof authenticatedUserId === 'string' && authenticatedUserId.trim()) {
    return authenticatedUserId;
  }

  if (typeof headerUserId === 'string' && headerUserId.trim()) {
    return headerUserId;
  }

  return null;
}

function buildPropertyProvenanceSummary(record: PropertyRecord): {
  recordVersion: number;
  latestSnapshotId: string | null;
  latestSnapshotAt: string | null;
  latestVersionCreatedAt: string | null;
  latestVersionCreatedBy: string | null;
  latestVersionReason: string | null;
  latestVersionSource: string | null;
  latestVersionSourceProvider: string | null;
} {
  const latestVersion = [...(record.versionHistory ?? [])]
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];

  return {
    recordVersion: record.recordVersion,
    latestSnapshotId: record.currentCanonical?.lastSnapshotId ?? null,
    latestSnapshotAt: record.currentCanonical?.lastSnapshotAt ?? null,
    latestVersionCreatedAt: latestVersion?.createdAt ?? null,
    latestVersionCreatedBy: latestVersion?.createdBy ?? null,
    latestVersionReason: latestVersion?.reason ?? null,
    latestVersionSource: latestVersion?.source ?? null,
    latestVersionSourceProvider: latestVersion?.sourceProvider ?? null,
  };
}

function toObservationRef(observation: PropertyObservationRecord) {
  return {
    id: observation.id,
    observationType: observation.observationType,
    observedAt: observation.observedAt,
    ingestedAt: observation.ingestedAt,
    sourceSystem: observation.sourceSystem,
    sourceProvider: observation.sourceProvider ?? null,
    sourceRecordId: observation.sourceRecordId ?? null,
    snapshotId: observation.snapshotId ?? null,
    orderId: observation.orderId ?? null,
    engagementId: observation.engagementId ?? null,
    documentId: observation.documentId ?? null,
    sourceArtifactRef: observation.sourceArtifactRef ?? null,
    lineageRefs: observation.lineageRefs ?? [],
    createdBy: observation.createdBy,
  };
}

function buildDerivedPropertyRecord(
  record: PropertyRecord,
  observations: PropertyObservationRecord[],
): PropertyRecord {
  return materializePropertyRecordHistory(record, observations);
}

function splitManualPatchPayload(
  body: Record<string, unknown>,
): {
  recordChanges: Record<string, unknown>;
  avm: PropertyAvm | null;
  taxAssessments: TaxAssessmentRecord[];
  permits: PermitRecord[];
} {
  const { avm, taxAssessments, permits, ...recordChanges } = body;

  return {
    recordChanges,
    avm: typeof avm === 'object'
      && avm !== null
      && typeof (avm as PropertyAvm).value === 'number'
      && typeof (avm as PropertyAvm).fetchedAt === 'string'
      && typeof (avm as PropertyAvm).source === 'string'
      ? (avm as PropertyAvm)
      : null,
    taxAssessments: Array.isArray(taxAssessments)
      ? taxAssessments.filter(
          (entry): entry is TaxAssessmentRecord =>
            typeof entry === 'object'
            && entry !== null
            && typeof (entry as TaxAssessmentRecord).taxYear === 'number'
            && typeof (entry as TaxAssessmentRecord).totalAssessedValue === 'number',
        )
      : [],
    permits: Array.isArray(permits)
      ? permits.filter(
          (entry): entry is PermitRecord =>
            typeof entry === 'object'
            && entry !== null
            && typeof (entry as PermitRecord).permitNumber === 'string'
            && typeof (entry as PermitRecord).description === 'string'
            && typeof (entry as PermitRecord).type === 'string'
            && typeof (entry as PermitRecord).isMaterialChange === 'boolean',
        )
      : [],
  };
}

function toPropertySummaryResponse(record: PropertyRecord) {
  return {
    id: record.id,
    address: record.address,
    propertyType: record.propertyType,
    building: {
      yearBuilt: record.building?.yearBuilt,
      livingAreaSquareFeet: record.building?.gla,
      bedroomCount: record.building?.bedrooms,
      bathroomCount: record.building?.bathrooms,
      storyCount: record.building?.stories,
      garageParkingSpaceCount: record.building?.garageSpaces,
    },
    owner: {
      fullName: record.currentOwner,
      ownerOccupied: record.ownerOccupied,
    },
    valuation: {
      estimatedValue: record.avm?.value,
      confidenceScore: record.avm?.confidence,
      asOfDate: record.avm?.fetchedAt ?? undefined,
    },
    quickLists: {
      ownerOccupied: record.ownerOccupied,
      vacant: false,
      freeAndClear: false,
      highEquity: false,
      activeForSale: false,
      recentlySold: false,
    },
    lastUpdated: record.updatedAt,
    dataSource: record.lastVerifiedSource ?? record.dataSource,
    provenanceSummary: buildPropertyProvenanceSummary(record),
  };
}

function toPropertyDetailedResponse(record: PropertyRecord, observations: PropertyObservationRecord[]) {
  const summary = toPropertySummaryResponse(record);
  const taxAssessments = record.taxAssessments ?? [];
  const permits = record.permits ?? [];
  const latestTaxAssessment = taxAssessments.at(-1);

  return {
    ...summary,
    ids: {
      apn: record.apn,
      fipsCode: record.fipsCode,
    },
    legal: {
      legalDescription: record.legalDescription,
      subdivisionName: record.subdivision,
    },
    lot: {
      lotSizeAcres: record.lotSizeAcres,
      lotSizeSquareFeet: record.lotSizeSqFt,
      zoningCode: record.zoning,
    },
    assessment: {
      totalAssessedValue: latestTaxAssessment?.totalAssessedValue,
      assessedImprovementValue: latestTaxAssessment?.improvementValue,
      assessedLandValue: latestTaxAssessment?.landValue,
      assessmentYear: latestTaxAssessment?.taxYear,
    },
    general: {
      vacant: false,
      propertyTypeCategory: record.propertyType,
      propertyTypeDetail: record.zoningDescription,
    },
    permit: {
      permitCount: permits.length,
      earliestDate: permits[0]?.issuedDate,
      latestDate: permits.at(-1)?.issuedDate,
      totalJobValue: permits.reduce((sum, permit) => sum + (permit.valuationAmount ?? 0), 0),
    },
    taxAssessments,
    permits,
    currentCanonical: record.currentCanonical ?? null,
    observationRefs: observations.slice(0, 20).map(toObservationRef),
  };
}

function parseOptionalIntegerField(
  value: unknown,
  fieldName: string,
  options: { minimum: number },
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value < options.minimum) {
    throw new Error(`${fieldName} must be an integer greater than or equal to ${options.minimum}`);
  }

  return value;
}

function parseReplayPropertyIds(value: unknown): string[] | null {
  if (value === undefined) {
    return null;
  }

  if (!Array.isArray(value)) {
    throw new Error('propertyIds must be an array of non-empty strings');
  }

  const trimmed = value
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);

  if (trimmed.length === 0) {
    throw new Error('propertyIds must contain at least one non-empty property id');
  }

  return [...new Set(trimmed)];
}

async function listReplayTargetPropertyIds(
  propertyRecordService: PropertyRecordService,
  tenantId: string,
  replayBody: Record<string, unknown>,
): Promise<string[]> {
  const explicitPropertyIds = parseReplayPropertyIds(replayBody.propertyIds);
  if (explicitPropertyIds) {
    return explicitPropertyIds;
  }

  if (replayBody.all !== true) {
    throw new Error('propertyIds or all=true is required for replay requests');
  }

  const baseInput = {
    tenantId,
    ...(typeof replayBody.q === 'string' ? { q: replayBody.q } : {}),
    ...(typeof replayBody.city === 'string' ? { city: replayBody.city } : {}),
    ...(typeof replayBody.state === 'string' ? { state: replayBody.state } : {}),
    ...(typeof replayBody.propertyType === 'string' ? { propertyType: replayBody.propertyType } : {}),
  };

  const pageSize = 100;
  const propertyIds: string[] = [];
  let offset = 0;
  let total = 0;

  do {
    const page = await listPropertyRecords((propertyRecordService as any).cosmosService, {
      ...baseInput,
      limit: pageSize,
      offset,
    });

    total = page.total;
    propertyIds.push(...page.items.map((item) => item.id));
    offset += page.items.length;
  } while (offset < total);

  return propertyIds;
}

export function createPropertyRecordRouter(
  propertyRecordService: PropertyRecordService,
  deps?: {
    projectorService?: Pick<PropertyProjectorService, 'replayCurrentCanonicalFromObservations'>;
  },
): Router {
  const router = Router();
  const logger = new Logger('PropertyRecordController');
  const observationService = new PropertyObservationService((propertyRecordService as any).cosmosService);
  const projectorService = deps?.projectorService
    ?? new PropertyProjectorService((propertyRecordService as any).cosmosService);

  /**
   * GET /api/properties/summary
   * GET /api/properties/summary/:propertyId
   * Back-compat summary endpoints, now sourced from canonical PropertyRecord data.
   */
  router.get('/summary', async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId is required' });
      }

      const listInput = {
        tenantId,
        ...(typeof req.query.q === 'string' ? { q: req.query.q } : {}),
        ...(typeof req.query.city === 'string' ? { city: req.query.city } : {}),
        ...(typeof req.query.state === 'string' ? { state: req.query.state } : {}),
        ...(typeof req.query.propertyType === 'string' ? { propertyType: req.query.propertyType } : {}),
        ...(typeof req.query.limit === 'string' ? { limit: Number.parseInt(req.query.limit, 10) } : {}),
        ...(typeof req.query.offset === 'string' ? { offset: Number.parseInt(req.query.offset, 10) } : {}),
      };
      const result = await listPropertyRecords((propertyRecordService as any).cosmosService, listInput);

      const summaryRows = await Promise.all(
        result.items.map(async (item) => {
          const observations = await observationService.listByPropertyId(item.id, tenantId);
          return toPropertySummaryResponse(buildDerivedPropertyRecord(item, observations));
        }),
      );

      return res.status(200).json({
        success: true,
        data: {
          properties: summaryRows,
          total: result.total,
          requestedLevel: 'summary',
        },
        dataLevel: 'summary',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to list property summaries', { error });
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  router.get('/summary/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const tenantId = resolveTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId is required' });
      }
      if (!propertyId) {
        return res.status(400).json({ success: false, error: 'propertyId is required' });
      }

      const record = await propertyRecordService.getById(propertyId, tenantId);
      const observations = await observationService.listByPropertyId(propertyId, tenantId);
      const derivedRecord = buildDerivedPropertyRecord(record, observations);
      return res.status(200).json({
        success: true,
        data: toPropertySummaryResponse(derivedRecord),
        dataLevel: 'summary',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Failed to retrieve property summary ${req.params.propertyId}`, { error });
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('not found') || msg.includes('Not Found')) {
        return res.status(404).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  /**
   * GET /api/properties/detailed
   * GET /api/properties/detailed/:propertyId
   * Back-compat detailed endpoints, now sourced from canonical PropertyRecord + observations.
   */
  router.get('/detailed', async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId is required' });
      }

      const listInput = {
        tenantId,
        ...(typeof req.query.q === 'string' ? { q: req.query.q } : {}),
        ...(typeof req.query.city === 'string' ? { city: req.query.city } : {}),
        ...(typeof req.query.state === 'string' ? { state: req.query.state } : {}),
        ...(typeof req.query.propertyType === 'string' ? { propertyType: req.query.propertyType } : {}),
        ...(typeof req.query.limit === 'string' ? { limit: Number.parseInt(req.query.limit, 10) } : {}),
        ...(typeof req.query.offset === 'string' ? { offset: Number.parseInt(req.query.offset, 10) } : {}),
      };
      const result = await listPropertyRecords((propertyRecordService as any).cosmosService, listInput);

      const detailedRows = await Promise.all(
        result.items.map(async (item) => {
          const observations = await observationService.listByPropertyId(item.id, tenantId);
          return toPropertyDetailedResponse(buildDerivedPropertyRecord(item, observations), observations);
        }),
      );

      return res.status(200).json({
        success: true,
        data: {
          properties: detailedRows,
          total: result.total,
          requestedLevel: 'detailed',
        },
        dataLevel: 'detailed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Failed to list property details', { error });
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  router.get('/detailed/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const tenantId = resolveTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId is required' });
      }
      if (!propertyId) {
        return res.status(400).json({ success: false, error: 'propertyId is required' });
      }

      const record = await propertyRecordService.getById(propertyId, tenantId);
      const observations = await observationService.listByPropertyId(propertyId, tenantId);
      const derivedRecord = buildDerivedPropertyRecord(record, observations);

      return res.status(200).json({
        success: true,
        data: toPropertyDetailedResponse(derivedRecord, observations),
        dataLevel: 'detailed',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error(`Failed to retrieve property details ${req.params.propertyId}`, { error });
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('not found') || msg.includes('Not Found')) {
        return res.status(404).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  /**
   * GET /api/v1/property-records
   * Lists canonical PropertyRecords from the property-records container.
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId is required' });
      }
      const listInput = {
        tenantId,
        ...(typeof req.query.q === 'string' ? { q: req.query.q } : {}),
        ...(typeof req.query.city === 'string' ? { city: req.query.city } : {}),
        ...(typeof req.query.state === 'string' ? { state: req.query.state } : {}),
        ...(typeof req.query.propertyType === 'string' ? { propertyType: req.query.propertyType } : {}),
        ...(typeof req.query.limit === 'string' ? { limit: Number.parseInt(req.query.limit, 10) } : {}),
        ...(typeof req.query.offset === 'string' ? { offset: Number.parseInt(req.query.offset, 10) } : {}),
        ...(typeof req.query.sortBy === 'string' ? { sortBy: req.query.sortBy as 'updatedAt' | 'createdAt' | 'address.street' | 'apn' | 'recordVersion' } : {}),
        ...(typeof req.query.sortOrder === 'string' ? { sortOrder: req.query.sortOrder as 'asc' | 'desc' } : {}),
      };
      const result = await listPropertyRecords(
        (propertyRecordService as any).cosmosService,
        listInput,
      );

      const rows = await Promise.all(
        result.items.map(async (item) => {
          const observations = await observationService.listByPropertyId(item.id, tenantId);
          const derivedRecord = buildDerivedPropertyRecord(item, observations);
          return {
            ...derivedRecord,
            provenanceSummary: buildPropertyProvenanceSummary(derivedRecord),
          };
        }),
      );

      return res.status(200).json({
        data: rows,
        pagination: {
          total: result.total,
          limit: result.limit,
          offset: result.offset,
          hasMore: result.offset + result.items.length < result.total,
        },
      });
    } catch (error) {
      logger.error('Failed to list property records', { error });
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  /**
   * GET /api/properties/:propertyId/events
   * Returns the event stream (version history) for a property.
   * Can optionally filter to returning events that modified specific fields.
   */
  router.get('/:propertyId/events', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const tenantId = resolveTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId is required' });
      }

      if (!propertyId) {
        return res.status(400).json({ success: false, error: 'propertyId is required' });
      }

      const history = await propertyRecordService.getVersionHistory(propertyId, tenantId);

      // Optional field filtering via ?fields=building.bedrooms,building.gla
      const fieldsQuery = req.query.fields as string;
      let filteredHistory = history;

      if (fieldsQuery) {
        const fieldsToFind = fieldsQuery.split(',').map(f => f.trim());
        filteredHistory = history.filter(entry => 
          entry.changedFields.some(changed => fieldsToFind.includes(changed))
        );
      }

      // Format as event stream
      const events = filteredHistory.map(entry => ({
        version: entry.version,
        timestamp: entry.createdAt,
        actor: entry.createdBy,
        actionType: entry.reason,
        source: entry.source,
        sourceProvider: entry.sourceProvider,
        sourceArtifactId: entry.sourceArtifactId,
        changedFields: entry.changedFields,
        previousValues: entry.previousValues,
        newValues: entry.newValues || {}, // Fallback for old versions without newValues
      })).reverse(); // Reverse chronological order for UI feed

      return res.status(200).json({ success: true, events });
    } catch (error) {
      logger.error('Failed to retrieve property event stream', { error });
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('not found')) {
        return res.status(404).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  /**
   * GET /api/v1/property-records/:propertyId/observations
   * GET /api/properties/:propertyId/observations
   * Returns immutable observation refs for the property.
   */
  router.get('/:propertyId/observations', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const tenantId = resolveTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId is required' });
      }

      if (!propertyId) {
        return res.status(400).json({ success: false, error: 'propertyId is required' });
      }

      const observationType = typeof req.query.observationType === 'string'
        ? req.query.observationType
        : undefined;

      const observations = await observationService.listByPropertyId(
        propertyId,
        tenantId,
        observationType as any,
      );

      return res.status(200).json({
        propertyId,
        data: observations.map(toObservationRef),
      });
    } catch (error) {
      logger.error(`Failed to retrieve property observations for ${req.params.propertyId}`, { error });
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  /**
   * POST /api/v1/property-records/replay-current-canonical
   * Replays currentCanonical for many properties from immutable observations.
   */
  router.post('/replay-current-canonical', async (req: Request, res: Response) => {
    try {
      const tenantId = resolveTenantId(req);
      const actor = resolveActorId(req);

      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId is required' });
      }

      if (!actor) {
        return res.status(400).json({ success: false, error: 'actor id is required' });
      }

      const replayBody = (req.body && typeof req.body === 'object' && !Array.isArray(req.body))
        ? req.body as Record<string, unknown>
        : {};

      parseOptionalIntegerField(replayBody.limit, 'limit', { minimum: 1 });
      parseOptionalIntegerField(replayBody.offset, 'offset', { minimum: 0 });

      const propertyIds = await listReplayTargetPropertyIds(propertyRecordService, tenantId, replayBody);

      for (const propertyId of propertyIds) {
        await projectorService.replayCurrentCanonicalFromObservations({
          tenantId,
          propertyId,
          initiatedBy: actor,
        });
      }

      return res.status(200).json({
        success: true,
        data: {
          propertyIds,
          replayedCount: propertyIds.length,
          requestedBy: actor,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to bulk replay property currentCanonical', { error });
      if (message.includes('required') || message.includes('must be')) {
        return res.status(400).json({ success: false, error: message });
      }
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  /**
   * POST /api/v1/property-records/:propertyId/replay-current-canonical
   * Replays currentCanonical for a single property from immutable observations.
   */
  router.post('/:propertyId/replay-current-canonical', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const tenantId = resolveTenantId(req);
      const actor = resolveActorId(req);

      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId is required' });
      }

      if (!actor) {
        return res.status(400).json({ success: false, error: 'actor id is required' });
      }

      if (!propertyId) {
        return res.status(400).json({ success: false, error: 'propertyId is required' });
      }

      await projectorService.replayCurrentCanonicalFromObservations({
        tenantId,
        propertyId,
        initiatedBy: actor,
      });

      return res.status(200).json({
        success: true,
        data: {
          propertyId,
          replayed: true,
          requestedBy: actor,
        },
      });
    } catch (error) {
      logger.error(`Failed to replay property record ${req.params.propertyId}`, { error });
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('required')) {
        return res.status(400).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  /**
   * GET /api/v1/property-records/:propertyId
   * GET /api/properties/:propertyId
   * Returns the canonical property record.
   */
  router.get('/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const tenantId = resolveTenantId(req);

      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId is required' });
      }

      if (!propertyId) {
        return res.status(400).json({ success: false, error: 'propertyId is required' });
      }

      const record = await propertyRecordService.getById(propertyId, tenantId);
      const observations = await observationService.listByPropertyId(propertyId, tenantId);
      const derivedRecord = buildDerivedPropertyRecord(record, observations);

      return res.status(200).json({
        ...derivedRecord,
        provenanceSummary: buildPropertyProvenanceSummary(derivedRecord),
        observationRefs: observations.slice(0, 20).map(toObservationRef),
      });
    } catch (error) {
      logger.error(`Failed to retrieve property record ${req.params.propertyId}`, { error });
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('not found') || msg.includes('Not Found')) {
        return res.status(404).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  /**
   * PATCH /api/v1/property-records/:propertyId
   * PATCH /api/properties/:propertyId
   * Updates fields on the canonical property record.
   */
  router.patch('/:propertyId', async (req: Request, res: Response) => {
    try {
      const { propertyId } = req.params;
      const tenantId = resolveTenantId(req);
      const actor = resolveActorId(req);

      if (!tenantId) {
        return res.status(400).json({ success: false, error: 'tenantId is required' });
      }

      if (!actor) {
        return res.status(400).json({ success: false, error: 'actor id is required' });
      }

      if (!propertyId) {
        return res.status(400).json({ success: false, error: 'propertyId is required' });
      }

      const patchBody = (req.body ?? {}) as Record<string, unknown>;
      const { recordChanges, avm, taxAssessments, permits } = splitManualPatchPayload(patchBody);
      const observedAt = new Date().toISOString();

      const updated = Object.keys(recordChanges).length > 0
        ? await propertyRecordService.createVersion(
            propertyId,
            tenantId,
            recordChanges,
            'manual_update',
            'MANUAL_CORRECTION',
            actor,
            'api'
          )
        : await propertyRecordService.getById(propertyId, tenantId);

      if (Object.keys(recordChanges).length > 0) {
        await observationService.createObservation({
          tenantId,
          propertyId,
          observationType: 'manual-correction',
          sourceSystem: 'manual-user',
          observedAt,
          sourceArtifactRef: { kind: 'manual-edit', id: `property-record:${propertyId}` },
          sourceRecordId: propertyId,
          normalizedFacts: { propertyPatch: recordChanges },
          rawPayload: recordChanges,
          createdBy: actor,
        });
      }

      if (avm) {
        await observationService.createObservation({
          tenantId,
          propertyId,
          observationType: 'avm-update',
          sourceSystem: 'manual-user',
          observedAt: avm.fetchedAt,
          sourceArtifactRef: { kind: 'manual-edit', id: `property-record:${propertyId}` },
          sourceRecordId: propertyId,
          normalizedFacts: { avm },
          rawPayload: avm as unknown as Record<string, unknown>,
          createdBy: actor,
        });
      }

      for (const taxAssessment of taxAssessments) {
        await observationService.createObservation({
          tenantId,
          propertyId,
          observationType: 'tax-assessment-update',
          sourceSystem: 'manual-user',
          observedAt: taxAssessment.assessedAt ?? observedAt,
          sourceArtifactRef: { kind: 'manual-edit', id: `property-record:${propertyId}` },
          sourceRecordId: propertyId,
          normalizedFacts: { taxAssessment },
          rawPayload: taxAssessment as unknown as Record<string, unknown>,
          createdBy: actor,
        });
      }

      for (const permit of permits) {
        await observationService.createObservation({
          tenantId,
          propertyId,
          observationType: 'permit-update',
          sourceSystem: 'manual-user',
          observedAt: permit.issuedDate ?? observedAt,
          sourceArtifactRef: { kind: 'manual-edit', id: `property-record:${propertyId}` },
          sourceRecordId: propertyId,
          normalizedFacts: { permit },
          rawPayload: permit as unknown as Record<string, unknown>,
          createdBy: actor,
        });
      }

      return res.status(200).json(updated);
    } catch (error) {
      logger.error(`Failed to patch property record ${req.params.propertyId}`, { error });
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg.includes('not found')) {
        return res.status(404).json({ success: false, error: msg });
      }
      return res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  });

  return router;
}
