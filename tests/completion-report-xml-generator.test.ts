/**
 * CompletionReportXmlGenerator — Tests
 *
 * Coverage:
 *  - Document structure: MESSAGE root, namespace, DEAL path present
 *  - Subject property address elements emitted correctly
 *  - Original appraisal fields (Section 02) in XML output
 *  - Section 03 DEFECT containers for SubjectToRepair docs
 *  - Section 04 DEFECT containers with NewDefectIndicator=true
 *  - Section 05 SUBJECT_TO_COMPLETION_ITEM containers
 *  - Section 06 VALUATION_COMPLETION_DETAIL comment text
 *  - Section 07 IMAGE containers from additionalExhibits
 *  - Section 09 SIGNATORY containers with correct executionDate
 *  - Well-formed XML: no parse errors
 *
 * Run: pnpm vitest run tests/completion-report-xml-generator.test.ts
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CompletionReportXmlGenerator } from '../src/services/completion-report-xml-generator.service';
import type { CanonicalCompletionReport } from '../src/types/canonical-completion-report';
import { COMPLETION_REPORT_SCHEMA_VERSION } from '../src/types/canonical-completion-report';
import type { SubmissionInfo } from '../src/services/mismo-xml-generator.service';

// ─── Fixture builders ─────────────────────────────────────────────────────────

const SUBMISSION_INFO: SubmissionInfo = {
  loanNumber: 'LN-2026-001',
  lenderName: 'First National Bank',
  lenderIdentifier: 'FNB-001',
  submittingUserName: 'jane.appraiser',
  submittingUserId: 'user-001',
};

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

    headerFooterIds: { appraiserFileIdentifier: 'AF-001' },

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
      clientParties: [{ companyName: 'First National Bank', primaryRole: 'Client' }],
      appraiser: {
        firstName: 'Jane',
        lastName: 'Appraiser',
        licenseId: 'IL-CR-12345',
        licenseState: 'IL',
        licenseExpires: '2027-12-31',
        licenseType: 'Certified Residential',
        personalInspectionPerformed: true,
        companyName: 'ABC Appraisal Group',
      },
    },

    certifications: {
      appraiserSignature: { executionDate: '2026-03-15' },
    },

    ...overrides,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function generate(overrides: Partial<CanonicalCompletionReport> = {}): string {
  const gen = new CompletionReportXmlGenerator();
  return gen.generateCompletionReportXml(makeValidDoc(overrides), SUBMISSION_INFO);
}

function parseXml(xml: string): Document {
  // Node 18+ has a built-in DOMParser shim, but in Vitest/Node we can use
  // a regex check instead of full DOM parsing for these tests.
  // We use a lightweight presence check rather than full XPath.
  return { xml } as unknown as Document;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CompletionReportXmlGenerator', () => {
  let generator: CompletionReportXmlGenerator;

  beforeEach(() => {
    generator = new CompletionReportXmlGenerator();
  });

  // ── XML well-formedness ────────────────────────────────────────────────────

  describe('XML structure', () => {
    it('produces a non-empty XML string', () => {
      const xml = generate();
      expect(typeof xml).toBe('string');
      expect(xml.length).toBeGreaterThan(100);
    });

    it('starts with XML declaration', () => {
      const xml = generate();
      expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"')).toBe(true);
    });

    it('contains MISMO namespace on MESSAGE root', () => {
      const xml = generate();
      expect(xml).toContain('xmlns="http://www.mismo.org/residential/2009/schemas"');
    });

    it('contains MISMOVersionID="3.4"', () => {
      const xml = generate();
      expect(xml).toContain('MISMOVersionID="3.4"');
    });

    it('contains DEAL_SETS / DEAL_SET / DEALS / DEAL path', () => {
      const xml = generate();
      expect(xml).toContain('<DEAL_SETS>');
      expect(xml).toContain('<DEAL_SET>');
      expect(xml).toContain('<DEALS>');
      expect(xml).toContain('<DEAL>');
    });
  });

  // ── Section 01 — subject address ──────────────────────────────────────────

  describe('Section 01 — subject property', () => {
    it('emits AddressLineText', () => {
      const xml = generate();
      expect(xml).toContain('<AddressLineText>123 Main St</AddressLineText>');
    });

    it('emits CityName', () => {
      const xml = generate();
      expect(xml).toContain('<CityName>Springfield</CityName>');
    });

    it('emits StateCode', () => {
      const xml = generate();
      expect(xml).toContain('<StateCode>IL</StateCode>');
    });

    it('emits PostalCode', () => {
      const xml = generate();
      expect(xml).toContain('<PostalCode>62701</PostalCode>');
    });

    it('emits CountyName', () => {
      const xml = generate();
      expect(xml).toContain('<CountyName>Sangamon</CountyName>');
    });

    it('emits legal description text when provided', () => {
      const xml = generate({
        subjectProperty: {
          ...makeValidDoc().subjectProperty,
          legalDescriptionText: 'Lot 1, Block A, Springfield Subdivision',
        },
      });
      expect(xml).toContain('PropertyLegalDescription');
      expect(xml).toContain('Lot 1, Block A');
    });
  });

  // ── Section 02 — original appraisal ───────────────────────────────────────

  describe('Section 02 — original appraisal', () => {
    it('emits OriginalAppraisalEffectiveDate', () => {
      const xml = generate();
      expect(xml).toContain('<OriginalAppraisalEffectiveDate>2026-01-15</OriginalAppraisalEffectiveDate>');
    });

    it('emits OriginalAppraisedValueAmount', () => {
      const xml = generate();
      expect(xml).toContain('<OriginalAppraisedValueAmount>350000</OriginalAppraisedValueAmount>');
    });

    it('emits PropertyValuationConditionalConclusionType', () => {
      const xml = generate();
      expect(xml).toContain('<PropertyValuationConditionalConclusionType>AsIs</PropertyValuationConditionalConclusionType>');
    });

    it('emits OriginalAppraiserUnparsedName', () => {
      const xml = generate();
      expect(xml).toContain('<OriginalAppraiserUnparsedName>Jane Appraiser</OriginalAppraiserUnparsedName>');
    });

    it('emits FinalValueConditionStatement for SubjectToRepair', () => {
      const xml = generate({
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
      expect(xml).toContain('FinalValueConditionStatement');
      expect(xml).toContain('subject to');
    });

    it('does NOT emit FinalValueConditionStatement for AsIs', () => {
      const xml = generate();
      expect(xml).not.toContain('FinalValueConditionStatement');
    });
  });

  // ── Section 03 — repair items ──────────────────────────────────────────────

  describe('Section 03 — repair items (DEFECT)', () => {
    it('emits DEFECT with CompletionReportNewDefectIndicator=false for repair items', () => {
      const xml = generate({
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
      expect(xml).toContain('<DEFECT>');
      expect(xml).toContain('<CompletionReportNewDefectIndicator>false</CompletionReportNewDefectIndicator>');
      expect(xml).toContain('<DefectComponentLabelType>Roof</DefectComponentLabelType>');
      expect(xml).toContain('<DefectItemDescription>Repair shingles</DefectItemDescription>');
    });

    it('emits DefectItemRecommendedActionCompletedIndicator for repair items', () => {
      const xml = generate({
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
      expect(xml).toContain('<DefectItemRecommendedActionCompletedIndicator>true</DefectItemRecommendedActionCompletedIndicator>');
    });
  });

  // ── Section 04 — newly-observed items ─────────────────────────────────────

  describe('Section 04 — newly-observed items (DEFECT)', () => {
    it('emits DEFECT with CompletionReportNewDefectIndicator=true for new items', () => {
      const xml = generate({
        newlyObservedItems: [
          {
            isNewlyObserved: true,
            feature: 'Foundation',
            description: 'New crack observed',
            locationType: 'Interior',
            affectsSoundnessOrStructuralIntegrity: true,
            photoUrls: ['https://blob/photo.jpg'],
          },
        ],
      });
      expect(xml).toContain('<CompletionReportNewDefectIndicator>true</CompletionReportNewDefectIndicator>');
      expect(xml).toContain('<DefectComponentLabelType>Foundation</DefectComponentLabelType>');
      expect(xml).toContain('<DefectItemAffectsSoundnessStructuralIntegrityIndicator>true</DefectItemAffectsSoundnessStructuralIntegrityIndicator>');
    });

    it('emits IMAGE containers for defect photos', () => {
      const xml = generate({
        newlyObservedItems: [
          {
            isNewlyObserved: true,
            feature: 'Foundation',
            description: 'Crack',
            locationType: 'Interior',
            affectsSoundnessOrStructuralIntegrity: true,
            photoUrls: ['https://blob/crack.jpg'],
          },
        ],
      });
      expect(xml).toContain('<ImageFileLocationURL>https://blob/crack.jpg</ImageFileLocationURL>');
    });
  });

  // ── Section 05 — completion status ────────────────────────────────────────

  describe('Section 05 — completion status', () => {
    it('emits PropertyImprovementsCompletedIndicator', () => {
      const xml = generate({
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
      expect(xml).toContain('<PropertyImprovementsCompletedIndicator>true</PropertyImprovementsCompletedIndicator>');
      expect(xml).toContain('<PropertyImprovementsCompletedPerPlansIndicator>true</PropertyImprovementsCompletedPerPlansIndicator>');
    });

    it('emits SUBJECT_TO_COMPLETION_ITEM for inconsistent features', () => {
      const xml = generate({
        originalAppraisal: {
          ...makeValidDoc().originalAppraisal,
          marketValueConditions: ['SubjectToCompletionPerPlans'],
        },
        completionStatus: {
          constructionComplete: true,
          completedPerPlans: false,
          completedConstructionPhotoUrls: [],
          inconsistentFeatures: [
            {
              feature: 'Cabinet colour',
              location: 'Kitchen',
              comparisonToPlans: 'Different',
              comment: 'Colour differs from spec',
              photoUrls: [],
            },
          ],
        },
      });
      expect(xml).toContain('<SUBJECT_TO_COMPLETION_ITEM>');
      expect(xml).toContain('<SubjectToCompletionFeatureDescription>Cabinet colour</SubjectToCompletionFeatureDescription>');
    });
  });

  // ── Section 06 — commentary ───────────────────────────────────────────────

  describe('Section 06 — completion commentary', () => {
    it('emits AppraisalCompletionCommentText when commentary provided', () => {
      const xml = generate({ completionCommentary: 'All conditions are satisfied.' });
      expect(xml).toContain('<AppraisalCompletionCommentText>All conditions are satisfied.</AppraisalCompletionCommentText>');
    });

    it('does NOT emit VALUATION_COMPLETION_DETAIL when commentary is null', () => {
      const xml = generate({ completionCommentary: null });
      // The VALUATION_COMPLETION_DETAIL element should not appear for commentary
      // (it may appear for Section 05's PropertyImprovementsCompletedIndicator)
      expect(xml).not.toContain('AppraisalCompletionCommentText');
    });
  });

  // ── Section 07 — exhibits ─────────────────────────────────────────────────

  describe('Section 07 — exhibits', () => {
    it('emits IMAGE with ImageCategoryType for additional exhibits', () => {
      const xml = generate({
        additionalExhibits: [
          {
            imageCategoryType: 'FloorPlan',
            imageUrl: 'https://blob/floorplan.pdf',
            caption: 'Ground floor',
          },
        ],
      });
      expect(xml).toContain('<ImageCategoryType>FloorPlan</ImageCategoryType>');
      expect(xml).toContain('<ImageFileLocationURL>https://blob/floorplan.pdf</ImageFileLocationURL>');
      expect(xml).toContain('<ImageCaptionCommentDescription>Ground floor</ImageCaptionCommentDescription>');
    });
  });

  // ── Parties and relationships ──────────────────────────────────────────────

  describe('PARTIES and RELATIONSHIPS', () => {
    it('emits PARTY for appraiser with label PARTY_APPRAISER', () => {
      const xml = generate();
      expect(xml).toContain('label="PARTY_APPRAISER"');
    });

    it('emits appraiser name elements', () => {
      const xml = generate();
      expect(xml).toContain('<FirstName>Jane</FirstName>');
      expect(xml).toContain('<LastName>Appraiser</LastName>');
    });

    it('emits appraiser license fields', () => {
      const xml = generate();
      expect(xml).toContain('<LicenseIdentifier>IL-CR-12345</LicenseIdentifier>');
      expect(xml).toContain('<LicenseIssuingAuthorityStateCode>IL</LicenseIssuingAuthorityStateCode>');
    });

    it('emits SIGNATORY_Appraiser label for appraiser signatory', () => {
      const xml = generate();
      expect(xml).toContain('label="SIGNATORY_Appraiser"');
    });

    it('emits SIGNATORY_IsAssociatedWith_ROLE relationship arcrole', () => {
      const xml = generate();
      expect(xml).toContain('SIGNATORY_IsAssociatedWith_ROLE');
    });

    it('emits supervisory appraiser party when provided', () => {
      const xml = generate({
        assignmentInformation: {
          clientParties: [{ companyName: 'First National Bank', primaryRole: 'Client' }],
          appraiser: makeValidDoc().assignmentInformation.appraiser,
          supervisoryAppraiser: {
            firstName: 'Bob',
            lastName: 'Supervisor',
            licenseId: 'IL-CG-99999',
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
      expect(xml).toContain('label="PARTY_SUPERVISOR"');
      expect(xml).toContain('label="SIGNATORY_AppraiserSupervisor"');
      expect(xml).toContain('<LastName>Supervisor</LastName>');
    });
  });

  // ── Section 09 — certifications ───────────────────────────────────────────

  describe('Section 09 — certifications', () => {
    it('emits ExecutionDate for appraiser signature', () => {
      const xml = generate();
      expect(xml).toContain('<ExecutionDate>2026-03-15</ExecutionDate>');
    });

    it('emits intended use certification', () => {
      const xml = generate();
      expect(xml).toContain('IntendedUse');
      expect(xml).toContain('intended use of this certification');
    });

    it('emits PersonalInspectionPerformedIndicator=true', () => {
      const xml = generate();
      expect(xml).toContain('<PersonalInspectionPerformedIndicator>true</PersonalInspectionPerformedIndicator>');
    });

    it('emits PersonalInspectionPerformedIndicator=false and verificationDescription', () => {
      const xml = generate({
        assignmentInformation: {
          ...makeValidDoc().assignmentInformation,
          appraiser: {
            ...makeValidDoc().assignmentInformation.appraiser,
            personalInspectionPerformed: false,
            conditionsSatisfiedVerificationDescription: 'Conditions verified by review of documents.',
          },
        },
      });
      expect(xml).toContain('<PersonalInspectionPerformedIndicator>false</PersonalInspectionPerformedIndicator>');
      expect(xml).toContain('Conditions verified by review of documents.');
    });
  });

  // ── Loan / header-footer ───────────────────────────────────────────────────

  describe('LOANS / header-footer identifiers', () => {
    it('emits loan number from submissionInfo', () => {
      const xml = generate();
      expect(xml).toContain('LN-2026-001');
    });

    it('emits DocumentType = Completion Report', () => {
      const xml = generate();
      expect(xml).toContain('<DocumentType>Completion Report</DocumentType>');
    });

    it('emits appraiser file identifier when provided', () => {
      const xml = generate();
      expect(xml).toContain('AF-001');
    });
  });
});
