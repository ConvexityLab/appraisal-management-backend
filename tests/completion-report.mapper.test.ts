/**
 * CompletionReportMapper — Unit Tests
 *
 * Coverage:
 *  - Happy path: fully-populated valid doc maps to a correct generation context
 *  - Section visibility flags derive correctly from marketValueConditions
 *  - Every required-field validation throws with an actionable message
 *  - Edge cases: supervisory appraiser signature required when supervisor present
 *
 * Run: pnpm vitest run tests/completion-report.mapper.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CompletionReportMapper } from '../src/mappers/completion-report.mapper';
import type { CanonicalCompletionReport } from '@l1/shared-types';
import { COMPLETION_REPORT_SCHEMA_VERSION } from '@l1/shared-types';

// ─── Fixture builder ──────────────────────────────────────────────────────────

function makeValidDoc(
  overrides: Partial<CanonicalCompletionReport> = {},
): CanonicalCompletionReport {
  return {
    id: 'cr-001',
    orderId: 'order-001',
    reportId: 'rep-001',
    originalReportId: 'urar-001',
    reportType: 'CompletionReport',
    schemaVersion: COMPLETION_REPORT_SCHEMA_VERSION,
    createdAt: '2026-03-15T00:00:00Z',
    updatedAt: '2026-03-15T00:00:00Z',

    headerFooterIds: {
      appraiserFileIdentifier: 'AF-001',
    },

    subjectProperty: {
      address: {
        streetAddress: '123 Main St',
        city: 'Springfield',
        state: 'IL',
        postalCode: '62701',
        county: 'Sangamon',
      },
    },

    originalAppraisal: {
      effectiveDate: '2026-01-15',
      appraisedValue: 350000,
      marketValueConditions: ['AsIs'],
      appraiserName: 'Jane Appraiser',
      appraiserReferenceId: 'REF-001',
      originalLenderName: 'First National Bank',
    },

    completionCommentary: null,
    additionalExhibits: [],
    repairItems: [],
    newlyObservedItems: [],
    completionStatus: null,

    assignmentInformation: {
      clientParties: [
        {
          companyName: 'First National Bank',
          primaryRole: 'Client',
        },
      ],
      appraiser: {
        firstName: 'Jane',
        lastName: 'Appraiser',
        licenseId: 'IL-CR-12345',
        licenseState: 'IL',
        licenseExpires: '2027-12-31',
        licenseType: 'Certified Residential',
        personalInspectionPerformed: true,
      },
    },

    certifications: {
      appraiserSignature: {
        executionDate: '2026-03-15',
      },
    },

    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CompletionReportMapper', () => {
  let mapper: CompletionReportMapper;

  beforeEach(() => {
    mapper = new CompletionReportMapper();
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  describe('happy path', () => {
    it('maps a minimal AsIs doc to a valid context', () => {
      const ctx = mapper.map(makeValidDoc());

      expect(ctx.doc.id).toBe('cr-001');
      expect(ctx.finalValueConditionStatement).toBeNull(); // AsIs → no statement
      expect(ctx.repairItems).toHaveLength(0);
      expect(ctx.newlyObservedItems).toHaveLength(0);
      expect(ctx.showSection03).toBe(false);
      expect(ctx.showSection04).toBe(false);
      expect(ctx.showSection05).toBe(false);
      expect(ctx.showSection06).toBe(false);
      expect(ctx.showSection07).toBe(false);
    });

    it('sets showSection03 when SubjectToRepair in conditions', () => {
      const doc = makeValidDoc({
        originalAppraisal: {
          ...makeValidDoc().originalAppraisal,
          marketValueConditions: ['SubjectToRepair'],
        },
        repairItems: [
          {
            isNewlyObserved: false,
            feature: 'Roof',
            description: 'Repair shingles',
            locationType: 'Exterior',
            affectsSoundnessOrStructuralIntegrity: false,
            repairCompleted: true,
            photoUrls: [],
          },
        ],
      });
      const ctx = mapper.map(doc);
      expect(ctx.showSection03).toBe(true);
      expect(ctx.repairItems).toHaveLength(1);
      expect(ctx.repairItems[0].feature).toBe('Roof');
    });

    it('sets showSection04 when newlyObservedItems present', () => {
      const doc = makeValidDoc({
        newlyObservedItems: [
          {
            isNewlyObserved: true,
            feature: 'Foundation crack',
            description: 'New crack observed',
            locationType: 'Interior',
            affectsSoundnessOrStructuralIntegrity: true,
            photoUrls: [],
          },
        ],
      });
      const ctx = mapper.map(doc);
      expect(ctx.showSection04).toBe(true);
      expect(ctx.newlyObservedItems).toHaveLength(1);
    });

    it('sets showSection05 when SubjectToCompletionPerPlans + completionStatus provided', () => {
      const doc = makeValidDoc({
        originalAppraisal: {
          ...makeValidDoc().originalAppraisal,
          marketValueConditions: ['SubjectToCompletionPerPlans'],
        },
        completionStatus: {
          constructionComplete: true,
          completedPerPlans: true,
          completedConstructionPhotoUrls: [],
          inconsistentFeatures: [],
        },
      });
      const ctx = mapper.map(doc);
      expect(ctx.showSection05).toBe(true);
    });

    it('sets showSection06 when completionCommentary provided', () => {
      const doc = makeValidDoc({ completionCommentary: 'All items are complete.' });
      const ctx = mapper.map(doc);
      expect(ctx.showSection06).toBe(true);
    });

    it('sets showSection07 when subject photo provided', () => {
      const doc = makeValidDoc({
        subjectProperty: {
          ...makeValidDoc().subjectProperty,
          subjectPhotoUrl: 'https://blob.example.com/photo.jpg',
        },
      });
      const ctx = mapper.map(doc);
      expect(ctx.showSection07).toBe(true);
    });

    it('derives finalValueConditionStatement when SubjectToRepair', () => {
      const doc = makeValidDoc({
        originalAppraisal: {
          ...makeValidDoc().originalAppraisal,
          marketValueConditions: ['SubjectToRepair'],
        },
        repairItems: [
          {
            isNewlyObserved: false,
            feature: 'Roof',
            description: 'Repair',
            locationType: 'Exterior',
            affectsSoundnessOrStructuralIntegrity: false,
            repairCompleted: true,
            photoUrls: [],
          },
        ],
      });
      const ctx = mapper.map(doc);
      expect(ctx.finalValueConditionStatement).toBeTruthy();
      expect(ctx.finalValueConditionStatement).toContain('subject to');
    });

    it('accepts supervisory appraiser when signature also provided', () => {
      const doc = makeValidDoc({
        assignmentInformation: {
          ...makeValidDoc().assignmentInformation,
          supervisoryAppraiser: {
            firstName: 'Bob',
            lastName: 'Supervisor',
            licenseId: 'IL-CR-99999',
            licenseState: 'IL',
            licenseExpires: '2027-12-31',
            licenseType: 'Certified General',
            personalInspectionPerformed: true,
          },
        },
        certifications: {
          appraiserSignature: { executionDate: '2026-03-15' },
          supervisoryAppraiserSignature: { executionDate: '2026-03-15' },
        },
      });
      expect(() => mapper.map(doc)).not.toThrow();
    });
  });

  // ── Core validation ────────────────────────────────────────────────────────

  describe('core validation', () => {
    it('throws when reportType is not CompletionReport', () => {
      const doc = makeValidDoc({ reportType: 'SomeOtherType' as 'CompletionReport' });
      expect(() => mapper.map(doc)).toThrow("reportType must be 'CompletionReport'");
    });

    it('throws when doc.id is empty', () => {
      const doc = makeValidDoc({ id: '' });
      expect(() => mapper.map(doc)).toThrow('doc.id is required');
    });

    it('throws when orderId is empty', () => {
      const doc = makeValidDoc({ orderId: '' });
      expect(() => mapper.map(doc)).toThrow('doc.orderId is required');
    });

    it('throws when originalReportId is missing', () => {
      const doc = makeValidDoc({ originalReportId: '' });
      expect(() => mapper.map(doc)).toThrow('doc.originalReportId is required');
    });

    it.each(['streetAddress', 'city', 'postalCode', 'state', 'county'] as const)(
      'throws when address.%s is missing',
      (field) => {
        const doc = makeValidDoc({
          subjectProperty: {
            address: { ...makeValidDoc().subjectProperty.address, [field]: '' },
          },
        });
        expect(() => mapper.map(doc)).toThrow(`address.${field} is required`);
      },
    );
  });

  // ── Section 02 validation ──────────────────────────────────────────────────

  describe('Section 02 — originalAppraisal', () => {
    it('throws when effectiveDate is missing', () => {
      const doc = makeValidDoc({
        originalAppraisal: { ...makeValidDoc().originalAppraisal, effectiveDate: '' },
      });
      expect(() => mapper.map(doc)).toThrow('originalAppraisal.effectiveDate is required');
    });

    it('throws when appraisedValue is null', () => {
      const doc = makeValidDoc({
        originalAppraisal: { ...makeValidDoc().originalAppraisal, appraisedValue: null as unknown as number },
      });
      expect(() => mapper.map(doc)).toThrow('originalAppraisal.appraisedValue is required');
    });

    it('throws when marketValueConditions is empty', () => {
      const doc = makeValidDoc({
        originalAppraisal: { ...makeValidDoc().originalAppraisal, marketValueConditions: [] },
      });
      expect(() => mapper.map(doc)).toThrow('marketValueConditions must have at least one entry');
    });

    it('throws when appraiserName is missing', () => {
      const doc = makeValidDoc({
        originalAppraisal: { ...makeValidDoc().originalAppraisal, appraiserName: '' },
      });
      expect(() => mapper.map(doc)).toThrow('originalAppraisal.appraiserName is required');
    });

    it('throws when originalLenderName is missing', () => {
      const doc = makeValidDoc({
        originalAppraisal: { ...makeValidDoc().originalAppraisal, originalLenderName: '' },
      });
      expect(() => mapper.map(doc)).toThrow('originalAppraisal.originalLenderName is required');
    });
  });

  // ── Section 03 validation ──────────────────────────────────────────────────

  describe('Section 03 — repair items', () => {
    it('throws when SubjectToRepair but repairItems is empty', () => {
      const doc = makeValidDoc({
        originalAppraisal: {
          ...makeValidDoc().originalAppraisal,
          marketValueConditions: ['SubjectToRepair'],
        },
        repairItems: [],
      });
      expect(() => mapper.map(doc)).toThrow('Section 03');
    });

    it('throws when repair item is missing feature', () => {
      const doc = makeValidDoc({
        originalAppraisal: {
          ...makeValidDoc().originalAppraisal,
          marketValueConditions: ['SubjectToRepair'],
        },
        repairItems: [
          {
            isNewlyObserved: false,
            feature: '',
            description: 'Some repair',
            locationType: 'Exterior',
            affectsSoundnessOrStructuralIntegrity: false,
            repairCompleted: true,
            photoUrls: [],
          },
        ],
      });
      expect(() => mapper.map(doc)).toThrow('item[0].feature is required');
    });

    it('throws when repair is incomplete but completionComment is absent', () => {
      const doc = makeValidDoc({
        originalAppraisal: {
          ...makeValidDoc().originalAppraisal,
          marketValueConditions: ['SubjectToRepair'],
        },
        repairItems: [
          {
            isNewlyObserved: false,
            feature: 'Roof',
            description: 'Shingles',
            locationType: 'Exterior',
            affectsSoundnessOrStructuralIntegrity: false,
            repairCompleted: false,
            completionComment: undefined,
            photoUrls: [],
          },
        ],
      });
      expect(() => mapper.map(doc)).toThrow('completionComment is missing');
    });
  });

  // ── Section 05 validation ──────────────────────────────────────────────────

  describe('Section 05 — completionStatus', () => {
    const baseWithPlans = () =>
      makeValidDoc({
        originalAppraisal: {
          ...makeValidDoc().originalAppraisal,
          marketValueConditions: ['SubjectToCompletionPerPlans'],
        },
      });

    it('throws when SubjectToCompletionPerPlans but completionStatus is null', () => {
      expect(() => mapper.map(baseWithPlans())).toThrow('completionStatus is required');
    });

    it('throws when completedPerPlans=false but inconsistentFeatures is empty', () => {
      const doc = {
        ...baseWithPlans(),
        completionStatus: {
          constructionComplete: true,
          completedPerPlans: false,
          completedConstructionPhotoUrls: [],
          inconsistentFeatures: [],
        },
      };
      expect(() => mapper.map(doc)).toThrow('inconsistentFeatures must be non-empty');
    });

    it('throws when inconsistentFeature is missing feature text', () => {
      const doc = {
        ...baseWithPlans(),
        completionStatus: {
          constructionComplete: true,
          completedPerPlans: false,
          completedConstructionPhotoUrls: [],
          inconsistentFeatures: [
            { feature: '', location: 'Kitchen', comparisonToPlans: 'Different', comment: 'Cabinet colour differs', photoUrls: [] },
          ],
        },
      };
      expect(() => mapper.map(doc)).toThrow('inconsistentFeatures[0].feature is required');
    });
  });

  // ── Section 08 validation ──────────────────────────────────────────────────

  describe('Section 08 — assignment information', () => {
    it('throws when clientParties is empty', () => {
      const doc = makeValidDoc({
        assignmentInformation: {
          ...makeValidDoc().assignmentInformation,
          clientParties: [],
        },
      });
      expect(() => mapper.map(doc)).toThrow('clientParties must have at least one entry');
    });

    it('throws when appraiser.licenseId is missing', () => {
      const doc = makeValidDoc({
        assignmentInformation: {
          ...makeValidDoc().assignmentInformation,
          appraiser: {
            ...makeValidDoc().assignmentInformation.appraiser,
            licenseId: '',
          },
        },
      });
      expect(() => mapper.map(doc)).toThrow('appraiser.licenseId is required');
    });

    it('throws when personalInspectionPerformed=false and verificationDescription is absent', () => {
      const doc = makeValidDoc({
        assignmentInformation: {
          ...makeValidDoc().assignmentInformation,
          appraiser: {
            ...makeValidDoc().assignmentInformation.appraiser,
            personalInspectionPerformed: false,
            conditionsSatisfiedVerificationDescription: undefined,
          },
        },
      });
      expect(() => mapper.map(doc)).toThrow('conditionsSatisfiedVerificationDescription is required');
    });
  });

  // ── Section 09 validation ──────────────────────────────────────────────────

  describe('Section 09 — certifications', () => {
    it('throws when appraiserSignature.executionDate is missing', () => {
      const doc = makeValidDoc({
        certifications: {
          appraiserSignature: { executionDate: '' },
        },
      });
      expect(() => mapper.map(doc)).toThrow('appraiserSignature.executionDate is required');
    });

    it('throws when supervisory appraiser present but supervisoryAppraiserSignature absent', () => {
      const doc = makeValidDoc({
        assignmentInformation: {
          ...makeValidDoc().assignmentInformation,
          supervisoryAppraiser: {
            firstName: 'Bob',
            lastName: 'Supervisor',
            licenseId: 'IL-CG-555',
            licenseState: 'IL',
            licenseExpires: '2027-12-31',
            licenseType: 'Certified General',
            personalInspectionPerformed: true,
          },
        },
        certifications: {
          appraiserSignature: { executionDate: '2026-03-15' },
          // supervisoryAppraiserSignature intentionally absent
        },
      });
      expect(() => mapper.map(doc)).toThrow('supervisoryAppraiserSignature is required');
    });
  });
});
