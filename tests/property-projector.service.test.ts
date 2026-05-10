import { describe, expect, it, vi } from 'vitest';
import { PropertyProjectorService } from '../src/services/property-projector.service.js';

function makeDb(existing?: any) {
  return {
    getDocument: vi.fn().mockResolvedValue(null),
    createDocument: vi.fn().mockImplementation(async (_c: string, doc: any) => doc),
    queryItems: vi.fn().mockResolvedValue({ success: true, data: existing ? [existing] : [] }),
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
    expect(db.createDocument).toHaveBeenCalledWith(
      'property-observations',
      expect.objectContaining({
        type: 'property-observation',
        observationType: 'canonical-projection',
        propertyId: 'prop-1',
        sourceRecordId: 'run-1',
      }),
    );
  });
});
