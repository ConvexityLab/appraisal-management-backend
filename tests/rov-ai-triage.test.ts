/**
 * ROV AI Triage — performAITriage() unit tests
 *
 * Covers:
 *  - Happy path: valid AI JSON → analysis persisted, priority and complianceFlags updated
 *  - complianceRisk 'high' → regulatoryEscalation + legalReview set to true
 *  - complianceRisk 'medium' → only legalReview set to true
 *  - complianceRisk 'none' → existing flags preserved, no new flags set
 *  - AI returns malformed JSON → success: false, no DB write
 *  - AI returns valid JSON missing required field → success: false (schema error)
 *  - AI returns meritScore out of range → success: false
 *  - ROV not found → success: false
 *  - AI call throws → success: false, no DB write
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ROVManagementService } from '../src/services/rov-management.service';
import { CosmosDbService } from '../src/services/cosmos-db.service';
import { UniversalAIService } from '../src/services/universal-ai.service';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeValidTriageJson(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    meritScore: 72,
    recommendedPriority: 'HIGH',
    challengeMerit: 'strong',
    primaryChallengeIssues: ['Comparable selection methodology questionable', 'Square footage adjustment missing'],
    evidenceGaps: ['Recent comparable sales within 0.5 miles', 'Active listing data for the subject block'],
    suggestedComparableSearch: {
      distanceMiles: 0.5,
      saleDateWindowMonths: 6,
      minSquareFeet: 1600,
      maxSquareFeet: 2200,
      requiredFeatures: ['3BR', 'attached garage'],
    },
    complianceRisk: 'none',
    complianceNotes: '',
    triageSummary: 'Borrower has identified two potentially overlooked comparables. Evidence is plausible and warrants full review.',
    ...overrides,
  };
}

function makeROVDoc(complianceFlagsOverrides: Record<string, boolean> = {}) {
  return {
    id: 'rov-001',
    rovNumber: 'ROV-2026-00001',
    orderId: 'order-abc',
    propertyAddress: '123 Main St, Dallas, TX 75201',
    status: 'SUBMITTED',
    challengeReason: 'COMPARABLE_SELECTION',
    challengeDescription: 'The appraiser did not consider the sale at 456 Oak Ave.',
    originalAppraisalValue: 400_000,
    requestedValue: 425_000,
    borrowerName: 'John Smith',
    supportingEvidence: [],
    internalNotes: '',
    priority: 'NORMAL',
    complianceFlags: {
      possibleBias: false,
      discriminationClaim: false,
      regulatoryEscalation: false,
      legalReview: false,
      ...complianceFlagsOverrides,
    },
    timeline: [],
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ROVManagementService.performAITriage', () => {
  let findROVSpy: ReturnType<typeof vi.spyOn>;
  let updateROVSpy: ReturnType<typeof vi.spyOn>;
  let generateCompletionSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    findROVSpy = vi.spyOn(CosmosDbService.prototype, 'findROVRequestById' as any);
    updateROVSpy = vi.spyOn(CosmosDbService.prototype, 'updateROVRequest' as any).mockResolvedValue({ success: true });
    generateCompletionSpy = vi.spyOn(UniversalAIService.prototype, 'generateCompletion' as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('returns analysis and persists priority + internalNotes + timeline entry', async () => {
      const rovDoc = makeROVDoc();
      findROVSpy.mockResolvedValue({ success: true, data: rovDoc });
      generateCompletionSpy.mockResolvedValue({ content: JSON.stringify(makeValidTriageJson()) });

      const svc = new ROVManagementService();
      const result = await svc.performAITriage('rov-001', 'reviewer@example.com');

      expect(result.success).toBe(true);
      expect(result.analysis?.meritScore).toBe(72);
      expect(result.analysis?.recommendedPriority).toBe('HIGH');
      expect(result.analysis?.challengeMerit).toBe('strong');

      expect(updateROVSpy).toHaveBeenCalledOnce();
      const [, updates] = updateROVSpy.mock.calls[0] as [string, Record<string, unknown>];
      expect(updates.priority).toBe('HIGH');
      expect(typeof updates.internalNotes).toBe('string');
      expect((updates.internalNotes as string)).toContain('AI Triage');
      expect((updates.internalNotes as string)).toContain('72/100');
      expect(Array.isArray(updates.timeline)).toBe(true);
      expect((updates.timeline as any[]).at(-1).action).toBe('AI_TRIAGE_COMPLETED');
    });

    it('passes the ROV id as the first argument to updateROVRequest', async () => {
      findROVSpy.mockResolvedValue({ success: true, data: makeROVDoc() });
      generateCompletionSpy.mockResolvedValue({ content: JSON.stringify(makeValidTriageJson()) });

      const svc = new ROVManagementService();
      await svc.performAITriage('rov-001');

      const [rovId] = updateROVSpy.mock.calls[0] as [string, unknown];
      expect(rovId).toBe('rov-001');
    });
  });

  // ── Compliance flag escalation ──────────────────────────────────────────────

  describe('complianceRisk escalation', () => {
    it('sets regulatoryEscalation AND legalReview when complianceRisk is "high"', async () => {
      findROVSpy.mockResolvedValue({ success: true, data: makeROVDoc() });
      generateCompletionSpy.mockResolvedValue({
        content: JSON.stringify(makeValidTriageJson({ complianceRisk: 'high', complianceNotes: 'Possible fair housing concern.' })),
      });

      const svc = new ROVManagementService();
      const result = await svc.performAITriage('rov-001');

      expect(result.success).toBe(true);
      const [, updates] = updateROVSpy.mock.calls[0] as [string, { complianceFlags: Record<string, boolean> }];
      expect(updates.complianceFlags.regulatoryEscalation).toBe(true);
      expect(updates.complianceFlags.legalReview).toBe(true);
    });

    it('sets legalReview but NOT regulatoryEscalation when complianceRisk is "medium"', async () => {
      findROVSpy.mockResolvedValue({ success: true, data: makeROVDoc() });
      generateCompletionSpy.mockResolvedValue({
        content: JSON.stringify(makeValidTriageJson({ complianceRisk: 'medium', complianceNotes: 'Minor concern noted.' })),
      });

      const svc = new ROVManagementService();
      const result = await svc.performAITriage('rov-001');

      expect(result.success).toBe(true);
      const [, updates] = updateROVSpy.mock.calls[0] as [string, { complianceFlags: Record<string, boolean> }];
      expect(updates.complianceFlags.legalReview).toBe(true);
      expect(updates.complianceFlags.regulatoryEscalation).toBe(false);
    });

    it('does NOT set any compliance flags when complianceRisk is "none"', async () => {
      findROVSpy.mockResolvedValue({ success: true, data: makeROVDoc() });
      generateCompletionSpy.mockResolvedValue({
        content: JSON.stringify(makeValidTriageJson({ complianceRisk: 'none' })),
      });

      const svc = new ROVManagementService();
      await svc.performAITriage('rov-001');

      const [, updates] = updateROVSpy.mock.calls[0] as [string, { complianceFlags: Record<string, boolean> }];
      expect(updates.complianceFlags.regulatoryEscalation).toBe(false);
      expect(updates.complianceFlags.legalReview).toBe(false);
    });

    it('does NOT downgrade existing complianceFlags even when risk is "none"', async () => {
      // If a human already flagged regulatoryEscalation, AI triage must not clear it.
      findROVSpy.mockResolvedValue({ success: true, data: makeROVDoc({ regulatoryEscalation: true, legalReview: true }) });
      generateCompletionSpy.mockResolvedValue({
        content: JSON.stringify(makeValidTriageJson({ complianceRisk: 'none' })),
      });

      const svc = new ROVManagementService();
      await svc.performAITriage('rov-001');

      const [, updates] = updateROVSpy.mock.calls[0] as [string, { complianceFlags: Record<string, boolean> }];
      expect(updates.complianceFlags.regulatoryEscalation).toBe(true);
      expect(updates.complianceFlags.legalReview).toBe(true);
    });
  });

  // ── AI schema validation ────────────────────────────────────────────────────

  describe('AI response validation', () => {
    it('returns error and does NOT write to DB when AI returns non-JSON', async () => {
      findROVSpy.mockResolvedValue({ success: true, data: makeROVDoc() });
      generateCompletionSpy.mockResolvedValue({ content: 'Sorry, I cannot help with that.' });

      const svc = new ROVManagementService();
      const result = await svc.performAITriage('rov-001');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/AI triage failed/);
      expect(updateROVSpy).not.toHaveBeenCalled();
    });

    it('returns schema error when required field "triageSummary" is missing', async () => {
      findROVSpy.mockResolvedValue({ success: true, data: makeROVDoc() });
      const invalid = makeValidTriageJson();
      delete (invalid as Record<string, unknown>).triageSummary;
      generateCompletionSpy.mockResolvedValue({ content: JSON.stringify(invalid) });

      const svc = new ROVManagementService();
      const result = await svc.performAITriage('rov-001');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/schema error/);
      expect(updateROVSpy).not.toHaveBeenCalled();
    });

    it('returns schema error when meritScore is out of range (>100)', async () => {
      findROVSpy.mockResolvedValue({ success: true, data: makeROVDoc() });
      generateCompletionSpy.mockResolvedValue({
        content: JSON.stringify(makeValidTriageJson({ meritScore: 150 })),
      });

      const svc = new ROVManagementService();
      const result = await svc.performAITriage('rov-001');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/meritScore/);
      expect(updateROVSpy).not.toHaveBeenCalled();
    });

    it('returns schema error when complianceRisk is an unrecognised value', async () => {
      findROVSpy.mockResolvedValue({ success: true, data: makeROVDoc() });
      generateCompletionSpy.mockResolvedValue({
        content: JSON.stringify(makeValidTriageJson({ complianceRisk: 'extreme' })),
      });

      const svc = new ROVManagementService();
      const result = await svc.performAITriage('rov-001');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/complianceRisk/);
    });

    it('returns schema error when recommendedPriority is invalid', async () => {
      findROVSpy.mockResolvedValue({ success: true, data: makeROVDoc() });
      generateCompletionSpy.mockResolvedValue({
        content: JSON.stringify(makeValidTriageJson({ recommendedPriority: 'CRITICAL' })),
      });

      const svc = new ROVManagementService();
      const result = await svc.performAITriage('rov-001');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/recommendedPriority/);
    });
  });

  // ── Error paths ─────────────────────────────────────────────────────────────

  describe('error paths', () => {
    it('returns error and does NOT call AI when ROV is not found', async () => {
      findROVSpy.mockResolvedValue({ success: false, data: undefined });

      const svc = new ROVManagementService();
      const result = await svc.performAITriage('no-such-rov');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not found/);
      expect(generateCompletionSpy).not.toHaveBeenCalled();
      expect(updateROVSpy).not.toHaveBeenCalled();
    });

    it('returns error and does NOT write to DB when AI call throws', async () => {
      findROVSpy.mockResolvedValue({ success: true, data: makeROVDoc() });
      generateCompletionSpy.mockRejectedValue(new Error('AI provider unavailable'));

      const svc = new ROVManagementService();
      const result = await svc.performAITriage('rov-001');

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/AI triage failed/);
      expect(updateROVSpy).not.toHaveBeenCalled();
    });
  });
});
