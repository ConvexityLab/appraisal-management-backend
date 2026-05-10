import { Request, Response, Router } from 'express';
import { PropertyRecordService } from '../services/property-record.service.js';
import { listPropertyRecords } from '../services/property-record-listing.service.js';
import { Logger } from '../utils/logger.js';
import { PropertyObservationService } from '../services/property-observation.service.js';
import type { PropertyObservationRecord } from '../types/property-observation.types.js';
import type { PropertyRecord } from '../types/property-record.types.js';

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
      totalAssessedValue: record.taxAssessments.at(-1)?.totalAssessedValue,
      assessedImprovementValue: record.taxAssessments.at(-1)?.improvementValue,
      assessedLandValue: record.taxAssessments.at(-1)?.landValue,
      assessmentYear: record.taxAssessments.at(-1)?.taxYear,
    },
    general: {
      vacant: false,
      propertyTypeCategory: record.propertyType,
      propertyTypeDetail: record.zoningDescription,
    },
    permit: {
      permitCount: record.permits.length,
      earliestDate: record.permits[0]?.issuedDate,
      latestDate: record.permits.at(-1)?.issuedDate,
      totalJobValue: record.permits.reduce((sum, permit) => sum + (permit.valuationAmount ?? 0), 0),
    },
    taxAssessments: record.taxAssessments,
    permits: record.permits,
    currentCanonical: record.currentCanonical ?? null,
    observationRefs: observations.slice(0, 20).map(toObservationRef),
  };
}

export function createPropertyRecordRouter(propertyRecordService: PropertyRecordService): Router {
  const router = Router();
  const logger = new Logger('PropertyRecordController');
  const observationService = new PropertyObservationService((propertyRecordService as any).cosmosService);

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

      return res.status(200).json({
        success: true,
        data: {
          properties: result.items.map(toPropertySummaryResponse),
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
      return res.status(200).json({
        success: true,
        data: toPropertySummaryResponse(record),
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
          return toPropertyDetailedResponse(item, observations);
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

      return res.status(200).json({
        success: true,
        data: toPropertyDetailedResponse(record, observations),
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

      return res.status(200).json({
        data: result.items.map((item) => ({
          ...item,
          provenanceSummary: buildPropertyProvenanceSummary(item),
        })),
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

      return res.status(200).json({
        ...record,
        provenanceSummary: buildPropertyProvenanceSummary(record),
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

      // This uses createVersion which saves a new record version in Cosmos.
      const updated = await propertyRecordService.createVersion(
        propertyId,
        tenantId,
        req.body,
        'manual_update',
        'MANUAL_CORRECTION',
        actor,
        'api'
      );

      await observationService.createObservation({
        tenantId,
        propertyId,
        observationType: 'manual-correction',
        sourceSystem: 'manual-user',
        observedAt: new Date().toISOString(),
        sourceArtifactRef: { kind: 'manual-edit', id: `property-record:${propertyId}` },
        sourceRecordId: propertyId,
        normalizedFacts: { propertyPatch: req.body },
        rawPayload: req.body,
        createdBy: actor,
      });

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
