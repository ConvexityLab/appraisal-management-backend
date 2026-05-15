import { describe, expect, it, vi } from 'vitest';
import { PropertyProjectorService } from '../src/services/property-projector.service.js';
import { PROPERTY_CANONICAL_PROJECTOR_VERSION } from '../src/mappers/property-canonical-projection.js';

function makeDb(existing?: any) {
  return {
    getDocument: vi.fn().mockResolvedValue(null),
    createDocument: vi.fn().mockImplementation(async (_c: string, doc: any) => doc),
    queryItems: vi.fn().mockResolvedValue({ success: true, data: existing ? [existing] : [] }),
    queryDocuments: vi.fn().mockResolvedValue([]),
    upsertItem: vi.fn().mockResolvedValue({ success: true }),
  };
}

function makePropertyRecord() {
  return {
    id: 'prop-1',
    tenantId: 'tenant-1',
    address: { street: '1 MAIN', city: 'A', state: 'TX', zip: '1' },
    propertyType: 'single_family_residential',
    building: { gla: 1, yearBuilt: 1, bedrooms: 1, bathrooms: 1 },
    taxAssessments: [],
    permits: [],
    recordVersion: 1,
    versionHistory: [],
    dataSource: 'MANUAL_ENTRY',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    createdBy: 'SYSTEM',
  };
}

describe('PropertyProjectorService', () => {
  it('projects currentCanonical and records a canonical-projection observation', async () => {
    const db = makeDb(makePropertyRecord());
    const service = new PropertyProjectorService(db as any);

    await service.projectCurrentCanonicalFromSnapshot({
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      orderId: 'order-1',
      sourceRunId: 'run-1',
      snapshotId: 'snap-1',
      snapshotAt: '2026-05-10T00:00:00.000Z',
      initiatedBy: 'user-1',
      canonical: {
        subject: { grossLivingArea: 2000 } as any,
      },
    });

    expect(db.upsertItem).toHaveBeenCalledOnce();
    expect(db.upsertItem).toHaveBeenCalledWith(
      'property-records',
      expect.objectContaining({
        projectedAt: '2026-05-10T00:00:00.000Z',
        projectionVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
        latestSnapshotId: 'snap-1',
        latestObservationAt: '2026-05-10T00:00:00.000Z',
      }),
    );
    expect(db.createDocument).toHaveBeenCalledWith(
      'property-observations',
      expect.objectContaining({
        type: 'property-observation',
        observationType: 'canonical-projection',
        propertyId: 'prop-1',
        sourceRecordId: 'run-1',
        rawPayload: expect.objectContaining({
          projectorVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
          projectionSource: expect.objectContaining({
            snapshotId: 'snap-1',
            sourceRunId: 'run-1',
          }),
        }),
      }),
    );
    expect(db.createDocument).toHaveBeenCalledWith(
      'property-event-outbox',
      expect.objectContaining({
        type: 'property-event-outbox',
        eventType: 'property.currentCanonical.updated',
        aggregateId: 'prop-1',
      }),
    );
  });

  it('skips duplicate snapshot reprocessing when the projected canonical view is unchanged', async () => {
    const existing = {
      ...makePropertyRecord(),
      currentCanonical: {
        subject: {
          grossLivingArea: 2000,
        },
        lastSnapshotId: 'snap-1',
        lastSnapshotAt: '2026-05-10T00:00:00.000Z',
      },
      projectedAt: '2026-05-10T00:00:00.000Z',
      projectionVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
      latestSnapshotId: 'snap-1',
      latestObservationAt: '2026-05-10T00:00:00.000Z',
    };

    const db = makeDb(existing);
    const service = new PropertyProjectorService(db as any);

    await service.projectCurrentCanonicalFromSnapshot({
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      orderId: 'order-1',
      sourceRunId: 'run-1',
      snapshotId: 'snap-1',
      snapshotAt: '2026-05-10T00:00:00.000Z',
      initiatedBy: 'user-1',
      canonical: {
        subject: { grossLivingArea: 2000 } as any,
      },
    });

    expect(db.upsertItem).not.toHaveBeenCalled();
    expect(db.createDocument).not.toHaveBeenCalled();
  });

  it('deep-merges subject fields from a newer snapshot without dropping existing nested data', async () => {
    const existing = {
      ...makePropertyRecord(),
      currentCanonical: {
        subject: {
          grossLivingArea: 1800,
          bedrooms: 3,
          address: {
            streetAddress: '1 Main St',
            city: 'Austin',
            state: 'TX',
            zipCode: '78701',
            county: 'Travis',
          },
          utilities: {
            electricity: 'Public',
            gas: 'Public',
            water: 'Public',
            sanitarySewer: 'Public',
          },
          neighborhood: {
            neighborhoodName: 'Old Name',
            propertyValuesTrend: 'Stable',
            demandSupply: 'Balanced',
            marketingTime: 'Normal',
          },
        },
        lastSnapshotId: 'snap-old',
        lastSnapshotAt: '2026-05-09T00:00:00.000Z',
      },
    };

    const db = makeDb(existing);
    const service = new PropertyProjectorService(db as any);

    await service.projectCurrentCanonicalFromSnapshot({
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      orderId: 'order-1',
      sourceRunId: 'run-2',
      snapshotId: 'snap-new',
      snapshotAt: '2026-05-10T00:00:00.000Z',
      initiatedBy: 'user-1',
      canonical: {
        subject: {
          grossLivingArea: 2000,
          address: {
            streetAddress: '',
            city: 'Dallas',
          },
          neighborhood: {
            neighborhoodName: 'Updated Name',
          },
        } as any,
      },
    });

    expect(db.upsertItem).toHaveBeenCalledOnce();
    expect(db.upsertItem).toHaveBeenCalledWith(
      'property-records',
      expect.objectContaining({
        projectedAt: '2026-05-10T00:00:00.000Z',
        projectionVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
        latestSnapshotId: 'snap-new',
        latestObservationAt: '2026-05-10T00:00:00.000Z',
        currentCanonical: expect.objectContaining({
          lastSnapshotId: 'snap-new',
          lastSnapshotAt: '2026-05-10T00:00:00.000Z',
          subject: expect.objectContaining({
            grossLivingArea: 2000,
            bedrooms: 3,
            address: expect.objectContaining({
              streetAddress: '1 Main St',
              city: 'Dallas',
              county: 'Travis',
            }),
            utilities: expect.objectContaining({
              electricity: 'Public',
              gas: 'Public',
            }),
            neighborhood: expect.objectContaining({
              neighborhoodName: 'Updated Name',
              propertyValuesTrend: 'Stable',
            }),
          }),
        }),
      }),
    );
  });

  it('does not let an older snapshot clobber newer canonical values, but still accumulates prior transfers', async () => {
    const existing = {
      ...makePropertyRecord(),
      currentCanonical: {
        subject: {
          grossLivingArea: 2200,
          bedrooms: 4,
        },
        transactionHistory: {
          subjectPriorTransfers: [
            {
              transactionDate: '2025-01-01',
              salePrice: 450000,
              propertyRole: 'subject',
            },
          ],
          priorSalePrice24m: 450000,
          priorSaleDate24m: '2025-01-01',
          appreciation24mPercent: 5,
          priorSalePrice36m: 430000,
          priorSaleDate36m: '2024-01-01',
          appreciation36mPercent: 7,
        },
        avmCrossCheck: {
          avmValue: 500000,
          avmLowerBound: 480000,
          avmUpperBound: 520000,
          avmConfidenceScore: 80,
          avmProvider: 'Provider B',
          avmModelVersion: 'v2',
          avmGapPercent: 1,
          avmAsOfDate: '2026-05-10',
        },
        riskFlags: {
          chainOfTitleRedFlags: false,
          ucdpSsrScore: '1.0',
          collateralRiskRating: 'low',
          appraiserGeoCompetency: true,
          highRiskGeography: false,
          unusualAppreciation: false,
          dscrBelowMinimum: false,
          nonPublicCompsFlag: false,
          notes: 'newer snapshot',
        },
        lastSnapshotId: 'snap-newer',
        lastSnapshotAt: '2026-05-11T00:00:00.000Z',
      },
      projectedAt: '2026-05-11T00:00:00.000Z',
      projectionVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
      latestSnapshotId: 'snap-newer',
      latestObservationAt: '2026-05-11T00:00:00.000Z',
    };

    const db = makeDb(existing);
    const service = new PropertyProjectorService(db as any);

    await service.projectCurrentCanonicalFromSnapshot({
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      orderId: 'order-1',
      sourceRunId: 'run-old',
      snapshotId: 'snap-old',
      snapshotAt: '2026-05-01T00:00:00.000Z',
      initiatedBy: 'user-1',
      canonical: {
        subject: {
          grossLivingArea: 1500,
          bedrooms: 2,
        } as any,
        transactionHistory: {
          subjectPriorTransfers: [
            {
              transactionDate: '2023-01-01',
              salePrice: 390000,
              propertyRole: 'subject',
            },
            {
              transactionDate: '2025-01-01',
              salePrice: 450000,
              propertyRole: 'subject',
            },
          ],
          priorSalePrice24m: 390000,
          priorSaleDate24m: '2023-01-01',
          appreciation24mPercent: 3,
          priorSalePrice36m: 390000,
          priorSaleDate36m: '2023-01-01',
          appreciation36mPercent: 3,
        } as any,
        avmCrossCheck: {
          avmValue: 470000,
          avmLowerBound: 450000,
          avmUpperBound: 490000,
          avmConfidenceScore: 60,
          avmProvider: 'Provider A',
          avmModelVersion: 'v1',
          avmGapPercent: 6,
          avmAsOfDate: '2026-05-01',
        } as any,
        riskFlags: {
          chainOfTitleRedFlags: true,
          notes: 'older snapshot',
        } as any,
      },
    });

    expect(db.upsertItem).toHaveBeenCalledOnce();
    expect(db.upsertItem).toHaveBeenCalledWith(
      'property-records',
      expect.objectContaining({
        projectedAt: '2026-05-11T00:00:00.000Z',
        projectionVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
        latestSnapshotId: 'snap-newer',
        latestObservationAt: '2026-05-11T00:00:00.000Z',
        currentCanonical: expect.objectContaining({
          lastSnapshotId: 'snap-newer',
          lastSnapshotAt: '2026-05-11T00:00:00.000Z',
          subject: expect.objectContaining({
            grossLivingArea: 2200,
            bedrooms: 4,
          }),
          avmCrossCheck: expect.objectContaining({
            avmValue: 500000,
            avmProvider: 'Provider B',
          }),
          riskFlags: expect.objectContaining({
            chainOfTitleRedFlags: false,
            notes: 'newer snapshot',
          }),
          transactionHistory: expect.objectContaining({
            subjectPriorTransfers: [
              expect.objectContaining({ transactionDate: '2025-01-01', salePrice: 450000 }),
              expect.objectContaining({ transactionDate: '2023-01-01', salePrice: 390000 }),
            ],
            priorSalePrice24m: 450000,
          }),
        }),
      }),
    );
  });

  it('replays currentCanonical from immutable canonical-projection observations and restores top-level lineage', async () => {
    const observations = [
      {
        id: 'obs-newer',
        type: 'property-observation',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        observationType: 'canonical-projection',
        sourceSystem: 'canonical-snapshot-service',
        sourceFingerprint: 'fp-newer',
        observedAt: '2026-05-11T00:00:00.000Z',
        ingestedAt: '2026-05-11T00:01:00.000Z',
        snapshotId: 'snap-2',
        normalizedFacts: {
          canonicalPatch: {
            subject: { grossLivingArea: 2100, bedrooms: 4 },
            lastSnapshotId: 'snap-2',
            lastSnapshotAt: '2026-05-11T00:00:00.000Z',
          },
        },
        rawPayload: {
          projectorVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
          projectionSource: { snapshotId: 'snap-2' },
        },
        createdBy: 'SYSTEM',
      },
      {
        id: 'obs-older',
        type: 'property-observation',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        observationType: 'canonical-projection',
        sourceSystem: 'canonical-snapshot-service',
        sourceFingerprint: 'fp-older',
        observedAt: '2026-05-10T00:00:00.000Z',
        ingestedAt: '2026-05-10T00:01:00.000Z',
        snapshotId: 'snap-1',
        normalizedFacts: {
          canonicalPatch: {
            transactionHistory: {
              subjectPriorTransfers: [
                {
                  transactionDate: '2024-01-01',
                  salePrice: 400000,
                  propertyRole: 'subject',
                },
              ],
            },
            lastSnapshotId: 'snap-1',
            lastSnapshotAt: '2026-05-10T00:00:00.000Z',
          },
        },
        rawPayload: {
          projectorVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
          projectionSource: { snapshotId: 'snap-1' },
        },
        createdBy: 'SYSTEM',
      },
    ];

    const db = makeDb(makePropertyRecord());
    db.queryDocuments.mockResolvedValue(observations);
    const service = new PropertyProjectorService(db as any);

    await service.replayCurrentCanonicalFromObservations({
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      initiatedBy: 'user-1',
    });

    expect(db.upsertItem).toHaveBeenCalledWith(
      'property-records',
      expect.objectContaining({
        projectedAt: '2026-05-11T00:00:00.000Z',
        projectionVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
        latestSnapshotId: 'snap-2',
        latestObservationAt: '2026-05-11T00:00:00.000Z',
        currentCanonical: expect.objectContaining({
          lastSnapshotId: 'snap-2',
          lastSnapshotAt: '2026-05-11T00:00:00.000Z',
          subject: expect.objectContaining({ grossLivingArea: 2100, bedrooms: 4 }),
          transactionHistory: expect.objectContaining({
            subjectPriorTransfers: [
              expect.objectContaining({ transactionDate: '2024-01-01', salePrice: 400000 }),
            ],
          }),
        }),
      }),
    );
  });

  it('replay is idempotent when PropertyRecord already matches the observation log materialization', async () => {
    const existing = {
      ...makePropertyRecord(),
      currentCanonical: {
        subject: { grossLivingArea: 2100, bedrooms: 4 },
        lastSnapshotId: 'snap-2',
        lastSnapshotAt: '2026-05-11T00:00:00.000Z',
      },
      projectedAt: '2026-05-11T00:00:00.000Z',
      projectionVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
      latestSnapshotId: 'snap-2',
      latestObservationAt: '2026-05-11T00:00:00.000Z',
    };
    const observations = [
      {
        id: 'obs-newer',
        type: 'property-observation',
        tenantId: 'tenant-1',
        propertyId: 'prop-1',
        observationType: 'canonical-projection',
        sourceSystem: 'canonical-snapshot-service',
        sourceFingerprint: 'fp-newer',
        observedAt: '2026-05-11T00:00:00.000Z',
        ingestedAt: '2026-05-11T00:01:00.000Z',
        snapshotId: 'snap-2',
        normalizedFacts: {
          canonicalPatch: {
            subject: { grossLivingArea: 2100, bedrooms: 4 },
            lastSnapshotId: 'snap-2',
            lastSnapshotAt: '2026-05-11T00:00:00.000Z',
          },
        },
        rawPayload: {
          projectorVersion: PROPERTY_CANONICAL_PROJECTOR_VERSION,
          projectionSource: { snapshotId: 'snap-2' },
        },
        createdBy: 'SYSTEM',
      },
    ];
    const db = makeDb(existing);
    db.queryDocuments.mockResolvedValue(observations);
    const service = new PropertyProjectorService(db as any);

    await service.replayCurrentCanonicalFromObservations({
      tenantId: 'tenant-1',
      propertyId: 'prop-1',
      initiatedBy: 'user-1',
    });

    expect(db.upsertItem).not.toHaveBeenCalled();
  });
});
