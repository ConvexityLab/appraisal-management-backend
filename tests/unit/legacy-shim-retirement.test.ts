/**
 * Legacy-shim retirement — slice 8j tests
 *
 * Asserts the migration steps slice 8j shipped:
 *
 *   1. CriteriaStepInputService now exposes `canonical` as a top-level
 *      payload field (the canonical view); the legacy `subjectProperty`
 *      and `providerData` shims are still populated for back-compat but
 *      consumers should prefer `canonical`.
 *
 *   2. PreparedDispatchPayloadAssemblyService recognises `canonical.X`
 *      path prefixes alongside the legacy `subjectProperty.X`,
 *      `extraction.X`, `providerData.X` prefixes.
 *
 *   3. Type-level @deprecated markers are now in place on the shim fields.
 */

import { describe, expect, it } from 'vitest';
import { CriteriaStepInputService } from '../../src/services/criteria-step-input.service.js';
import type { CanonicalSnapshotRecord } from '../../src/types/run-ledger.types.js';

function makeSnapshot(normalized: Record<string, unknown>): CanonicalSnapshotRecord {
  return {
    id: 'snap-test',
    type: 'canonical-snapshot',
    tenantId: 'tenant-test',
    createdAt: '2026-05-05T00:00:00.000Z',
    createdBy: 'tester',
    status: 'ready',
    sourceRefs: [],
    normalizedDataRef: 'canonical://tenant/run/normalized',
    createdByRunIds: ['run-1'],
    normalizedData: normalized,
  } as CanonicalSnapshotRecord;
}

describe('CriteriaStepInputService default payload — slice 8j', () => {
  it('exposes `canonical` as the canonical payload field', () => {
    const svc = new CriteriaStepInputService({} as any);
    const snapshot = makeSnapshot({
      canonical: { subject: { address: { streetAddress: '17 David Dr' } } },
      subjectProperty: { gla: 1850 },           // legacy shim — still populated
      providerData: { source: 'BatchData' },    // legacy shim — still populated
      extraction: { propertyAddress: { street: 'raw' } },
      provenance: { runId: 'run-1' },
    });

    const payload = (svc as any).buildPayloadForStep(snapshot, 'comparable-selection');

    expect(payload.canonical).toEqual({
      subject: { address: { streetAddress: '17 David Dr' } },
    });
    // Back-compat: legacy shims still populated until slice 8k removes them.
    expect(payload.subjectProperty).toEqual({ gla: 1850 });
    expect(payload.providerData).toEqual({ source: 'BatchData' });
  });

  it('emits empty objects for missing canonical when normalizedData is absent', () => {
    const svc = new CriteriaStepInputService({} as any);
    const snapshot = makeSnapshot({}); // empty normalizedData

    const payload = (svc as any).buildPayloadForStep(snapshot, 'comparable-selection');

    expect(payload.canonical).toEqual({});
    expect(payload.subjectProperty).toEqual({});
    expect(payload.providerData).toEqual({});
  });
});

// ─── PreparedDispatchPayloadAssembly path prefixes ──────────────────────────

describe('PreparedDispatchPayloadAssembly path prefixes — slice 8j', () => {
  it('canonical.X reads from normalizedData.canonical', async () => {
    const { PreparedDispatchPayloadAssemblyService } = await import(
      '../../src/services/prepared-dispatch-payload-assembly.service.js'
    );
    const svc = new PreparedDispatchPayloadAssemblyService();

    const context = {
      order: { id: 'o-1' },
      canonicalData: {
        canonical: { subject: { address: { streetAddress: '17 David Dr', zipCode: '02919' } } },
        subjectProperty: { gla: 1850 },
      },
    };

    // Read via the new canonical prefix
    const streetCanonical = (svc as any).getResolvedValue(context, 'canonical.subject.address.streetAddress');
    expect(streetCanonical).toBe('17 David Dr');
    const zipCanonical = (svc as any).getResolvedValue(context, 'canonical.subject.address.zipCode');
    expect(zipCanonical).toBe('02919');

    // Legacy prefix continues to work for back-compat
    const glaLegacy = (svc as any).getResolvedValue(context, 'subjectProperty.gla');
    expect(glaLegacy).toBe(1850);
  });
});
