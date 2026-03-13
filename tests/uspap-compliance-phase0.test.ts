/**
 * USPAP Compliance Service — Phase 0.4 De-stub Tests
 *
 * Tests the real evaluator functions that replace the always-pass stub.
 * Each evaluator is a pure function: (orderData) => { passed, message, details? }
 *
 * Run: pnpm vitest run tests/uspap-compliance-phase0.test.ts
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  CHECKPOINT_EVALUATORS,
  REQUIRED_CERTIFICATION_ELEMENTS,
  type CheckpointEvaluatorResult,
} from '../src/services/uspap-compliance.service';

// ═══════════════════════════════════════════════════════════════════════════════
// Helpers — build a valid "fully passing" orderData object
// ═══════════════════════════════════════════════════════════════════════════════

function makeCompleteOrderData(): Record<string, any> {
  return {
    orderId: 'ORD-2026-001',
    propertyState: 'TX',

    propertyDetails: {
      address: '123 Main St',
      city: 'Dallas',
      state: 'TX',
      zipCode: '75201',
      county: 'Dallas',
      parcelNumber: 'R-000-12345',
      propertyType: 'SINGLE_FAMILY',
    },

    appraiser: {
      name: 'Jane Appraiser',
      licenseNumber: 'TX-98765',
      licenseState: 'TX',
      licenseType: 'Certified Residential',
      licenseExpiration: '2027-12-31',
      propertyTypes: ['SINGLE_FAMILY', 'CONDO', 'TOWNHOME'],
      serviceStates: ['TX', 'OK'],
    },

    intendedUse: 'Mortgage lending decision by the lender',
    intendedUsers: 'First National Bank and its successors and assigns',
    effectiveDate: '2026-03-01',

    certification: {
      signaturePresent: true,
      signatureDate: '2026-03-10',
      licenseNumber: 'TX-98765',
      competencyDisclosure:
        'The appraiser has competency for this property type and geographic area.',
      elements: [...REQUIRED_CERTIFICATION_ELEMENTS],
    },

    workfile: {
      retentionEnabled: true,
      retentionDate: '2031-03-01',
      createdAt: '2026-03-01',
    },

    reportSections: {
      scopeOfWork: 'Complete appraisal performed with interior and exterior inspection.',
      neighborhoodDescription: 'Suburban residential neighborhood with stable values.',
      siteDescription: 'Level lot with public utilities available.',
      improvementDescription: 'Single family residence in average condition.',
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. checkPropertyIdentification
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkPropertyIdentification', () => {
  const evaluate = CHECKPOINT_EVALUATORS.checkPropertyIdentification;

  it('passes when property details are complete', () => {
    const result = evaluate(makeCompleteOrderData());
    expect(result.passed).toBe(true);
  });

  it('fails when propertyDetails is missing entirely', () => {
    const data = makeCompleteOrderData();
    delete data.propertyDetails;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/property/i);
  });

  it('fails when address is missing', () => {
    const data = makeCompleteOrderData();
    delete data.propertyDetails.address;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.details?.missingFields).toContain('address');
  });

  it('fails when address is empty string', () => {
    const data = makeCompleteOrderData();
    data.propertyDetails.address = '';
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.details?.missingFields).toContain('address');
  });

  it('fails when city is missing', () => {
    const data = makeCompleteOrderData();
    delete data.propertyDetails.city;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.details?.missingFields).toContain('city');
  });

  it('fails when state is missing', () => {
    const data = makeCompleteOrderData();
    delete data.propertyDetails.state;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.details?.missingFields).toContain('state');
  });

  it('fails when zipCode is missing', () => {
    const data = makeCompleteOrderData();
    delete data.propertyDetails.zipCode;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.details?.missingFields).toContain('zipCode');
  });

  it('reports multiple missing fields at once', () => {
    const data = makeCompleteOrderData();
    delete data.propertyDetails.address;
    delete data.propertyDetails.zipCode;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.details?.missingFields).toEqual(expect.arrayContaining(['address', 'zipCode']));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. checkIntendedUse
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkIntendedUse', () => {
  const evaluate = CHECKPOINT_EVALUATORS.checkIntendedUse;

  it('passes when intendedUse is present', () => {
    const result = evaluate(makeCompleteOrderData());
    expect(result.passed).toBe(true);
  });

  it('fails when intendedUse is missing', () => {
    const data = makeCompleteOrderData();
    delete data.intendedUse;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/intended use/i);
  });

  it('fails when intendedUse is empty', () => {
    const data = makeCompleteOrderData();
    data.intendedUse = '  ';
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. checkIntendedUsers
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkIntendedUsers', () => {
  const evaluate = CHECKPOINT_EVALUATORS.checkIntendedUsers;

  it('passes when intendedUsers is a non-empty string', () => {
    const result = evaluate(makeCompleteOrderData());
    expect(result.passed).toBe(true);
  });

  it('passes when intendedUsers is a non-empty array', () => {
    const data = makeCompleteOrderData();
    data.intendedUsers = ['First National Bank', 'HUD'];
    const result = evaluate(data);
    expect(result.passed).toBe(true);
  });

  it('fails when intendedUsers is missing', () => {
    const data = makeCompleteOrderData();
    delete data.intendedUsers;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/intended user/i);
  });

  it('fails when intendedUsers is an empty array', () => {
    const data = makeCompleteOrderData();
    data.intendedUsers = [];
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });

  it('fails when intendedUsers is an empty string', () => {
    const data = makeCompleteOrderData();
    data.intendedUsers = '';
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. checkEffectiveDate
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkEffectiveDate', () => {
  const evaluate = CHECKPOINT_EVALUATORS.checkEffectiveDate;

  it('passes when effectiveDate is present as string', () => {
    const result = evaluate(makeCompleteOrderData());
    expect(result.passed).toBe(true);
  });

  it('passes when effectiveDate is a Date object', () => {
    const data = makeCompleteOrderData();
    data.effectiveDate = new Date('2026-03-01');
    const result = evaluate(data);
    expect(result.passed).toBe(true);
  });

  it('fails when effectiveDate is missing', () => {
    const data = makeCompleteOrderData();
    delete data.effectiveDate;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/effective date/i);
  });

  it('fails when effectiveDate is empty', () => {
    const data = makeCompleteOrderData();
    data.effectiveDate = '';
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. checkAppraiserCompetency
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkAppraiserCompetency', () => {
  const evaluate = CHECKPOINT_EVALUATORS.checkAppraiserCompetency;

  it('passes with valid license in matching state', () => {
    const result = evaluate(makeCompleteOrderData());
    expect(result.passed).toBe(true);
  });

  it('fails when appraiser block is missing', () => {
    const data = makeCompleteOrderData();
    delete data.appraiser;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/appraiser/i);
  });

  it('fails when license number is missing', () => {
    const data = makeCompleteOrderData();
    delete data.appraiser.licenseNumber;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.details?.reason).toMatch(/license number/i);
  });

  it('fails when license is expired', () => {
    const data = makeCompleteOrderData();
    data.appraiser.licenseExpiration = '2020-01-01';
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.details?.reason).toMatch(/expired/i);
  });

  it('fails when license state does not cover property state', () => {
    const data = makeCompleteOrderData();
    data.appraiser.licenseState = 'CA';
    data.appraiser.serviceStates = ['CA', 'NV'];
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.details?.reason).toMatch(/state/i);
  });

  it('passes when licenseState matches propertyState even without serviceStates', () => {
    const data = makeCompleteOrderData();
    delete data.appraiser.serviceStates;
    // licenseState = 'TX', propertyState = 'TX'
    const result = evaluate(data);
    expect(result.passed).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. checkCompetencyDisclosure
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkCompetencyDisclosure', () => {
  const evaluate = CHECKPOINT_EVALUATORS.checkCompetencyDisclosure;

  it('passes when competency disclosure is present', () => {
    const result = evaluate(makeCompleteOrderData());
    expect(result.passed).toBe(true);
  });

  it('fails when certification block is missing', () => {
    const data = makeCompleteOrderData();
    delete data.certification;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });

  it('fails when competencyDisclosure is missing', () => {
    const data = makeCompleteOrderData();
    delete data.certification.competencyDisclosure;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/competency disclosure/i);
  });

  it('fails when competencyDisclosure is empty', () => {
    const data = makeCompleteOrderData();
    data.certification.competencyDisclosure = '';
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. checkAppraiserSignature
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkAppraiserSignature', () => {
  const evaluate = CHECKPOINT_EVALUATORS.checkAppraiserSignature;

  it('passes when signature is present', () => {
    const result = evaluate(makeCompleteOrderData());
    expect(result.passed).toBe(true);
  });

  it('fails when certification block is missing', () => {
    const data = makeCompleteOrderData();
    delete data.certification;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });

  it('fails when signaturePresent is false', () => {
    const data = makeCompleteOrderData();
    data.certification.signaturePresent = false;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/signature/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. checkLicenseNumber (in certification)
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkLicenseNumber', () => {
  const evaluate = CHECKPOINT_EVALUATORS.checkLicenseNumber;

  it('passes when license number is in certification', () => {
    const result = evaluate(makeCompleteOrderData());
    expect(result.passed).toBe(true);
  });

  it('fails when certification block is missing', () => {
    const data = makeCompleteOrderData();
    delete data.certification;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });

  it('fails when licenseNumber is missing from certification', () => {
    const data = makeCompleteOrderData();
    delete data.certification.licenseNumber;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/license/i);
  });

  it('fails when licenseNumber is empty', () => {
    const data = makeCompleteOrderData();
    data.certification.licenseNumber = '';
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. check23PointCertification
// ═══════════════════════════════════════════════════════════════════════════════

describe('check23PointCertification', () => {
  const evaluate = CHECKPOINT_EVALUATORS.check23PointCertification;

  it('passes when all certification elements are present', () => {
    const result = evaluate(makeCompleteOrderData());
    expect(result.passed).toBe(true);
  });

  it('fails when certification block is missing', () => {
    const data = makeCompleteOrderData();
    delete data.certification;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });

  it('fails when elements array is missing', () => {
    const data = makeCompleteOrderData();
    delete data.certification.elements;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.details?.missingCount).toBeGreaterThan(0);
  });

  it('fails when some elements are missing and reports them', () => {
    const data = makeCompleteOrderData();
    // Remove first 3 elements
    data.certification.elements = data.certification.elements.slice(3);
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.details?.missingElements).toHaveLength(3);
    expect(result.details?.missingCount).toBe(3);
  });

  it('REQUIRED_CERTIFICATION_ELEMENTS has exactly 23 elements', () => {
    expect(REQUIRED_CERTIFICATION_ELEMENTS).toHaveLength(23);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. checkRetentionTracking
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkRetentionTracking', () => {
  const evaluate = CHECKPOINT_EVALUATORS.checkRetentionTracking;

  it('passes when retention tracking is enabled', () => {
    const result = evaluate(makeCompleteOrderData());
    expect(result.passed).toBe(true);
  });

  it('fails when workfile block is missing', () => {
    const data = makeCompleteOrderData();
    delete data.workfile;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.message).toMatch(/workfile|retention/i);
  });

  it('fails when retentionEnabled is false', () => {
    const data = makeCompleteOrderData();
    data.workfile.retentionEnabled = false;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });

  it('fails when retentionDate is missing', () => {
    const data = makeCompleteOrderData();
    delete data.workfile.retentionDate;
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. checkMisleadingStatements
// ═══════════════════════════════════════════════════════════════════════════════

describe('checkMisleadingStatements', () => {
  const evaluate = CHECKPOINT_EVALUATORS.checkMisleadingStatements;

  it('passes when report sections contain no red flags', () => {
    const result = evaluate(makeCompleteOrderData());
    expect(result.passed).toBe(true);
  });

  it('fails when placeholder text is found', () => {
    const data = makeCompleteOrderData();
    data.reportSections.scopeOfWork = 'The scope of work is [INSERT VALUE HERE].';
    const result = evaluate(data);
    expect(result.passed).toBe(false);
    expect(result.details?.flaggedPatterns).toBeDefined();
    expect(result.details?.flaggedPatterns.length).toBeGreaterThan(0);
  });

  it('fails when TBD markers are found', () => {
    const data = makeCompleteOrderData();
    data.reportSections.siteDescription = 'The site is TBD pending inspection.';
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });

  it('fails when "lorem ipsum" is found', () => {
    const data = makeCompleteOrderData();
    data.reportSections.neighborhoodDescription = 'Lorem ipsum dolor sit amet.';
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });

  it('fails when "SAMPLE" or "DRAFT" markers appear', () => {
    const data = makeCompleteOrderData();
    data.reportSections.improvementDescription = 'SAMPLE REPORT - not for production use.';
    const result = evaluate(data);
    expect(result.passed).toBe(false);
  });

  it('passes when reportSections is missing (nothing to check)', () => {
    const data = makeCompleteOrderData();
    delete data.reportSections;
    const result = evaluate(data);
    expect(result.passed).toBe(true);
    expect(result.message).toMatch(/no report sections/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 12. Evaluator registry completeness
// ═══════════════════════════════════════════════════════════════════════════════

describe('CHECKPOINT_EVALUATORS registry', () => {
  const expectedNames = [
    'checkPropertyIdentification',
    'checkIntendedUse',
    'checkIntendedUsers',
    'checkEffectiveDate',
    'checkAppraiserCompetency',
    'checkCompetencyDisclosure',
    'checkAppraiserSignature',
    'checkLicenseNumber',
    'check23PointCertification',
    'checkRetentionTracking',
    'checkMisleadingStatements',
  ];

  it('contains all expected evaluators', () => {
    for (const name of expectedNames) {
      expect(CHECKPOINT_EVALUATORS).toHaveProperty(name);
      expect(typeof CHECKPOINT_EVALUATORS[name]).toBe('function');
    }
  });

  it('every evaluator returns a valid result shape', () => {
    const data = makeCompleteOrderData();
    for (const [name, evaluator] of Object.entries(CHECKPOINT_EVALUATORS)) {
      const result = evaluator(data);
      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('message');
      expect(typeof result.passed).toBe('boolean');
      expect(typeof result.message).toBe('string');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 13. Integration: performComplianceCheck uses real evaluators
// ═══════════════════════════════════════════════════════════════════════════════

describe('performComplianceCheck integration', () => {
  // Mock DB + Logger so we can instantiate the service
  vi.mock('../src/services/cosmos-db.service.js', () => ({
    CosmosDbService: vi.fn().mockImplementation(() => ({
      queryDocuments: vi.fn().mockResolvedValue([]),
      upsertDocument: vi.fn().mockResolvedValue(undefined),
    })),
  }));

  vi.mock('../src/utils/logger.js', () => ({
    Logger: vi.fn().mockImplementation(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  }));

  // Dynamic import so mocks are active first
  let USPAPComplianceService: any;
  let CosmosDbService: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    const serviceModule = await import('../src/services/uspap-compliance.service');
    USPAPComplianceService = serviceModule.USPAPComplianceService;
    const cosmosModule = await import('../src/services/cosmos-db.service.js');
    CosmosDbService = cosmosModule.CosmosDbService;
  });

  function getStandardTestRules() {
    // Minimal set: one critical rule (SR2-1: property identification)
    // and one high rule (record keeping)
    return [
      {
        id: 'SR2-1',
        ruleNumber: 'SR2-1',
        category: 'reporting',
        title: 'Appraisal Report',
        description: 'Each written real property appraisal report must identify the property.',
        requirements: ['Must clearly identify real estate appraised'],
        severity: 'critical',
        effectiveDate: new Date('2024-01-01'),
        checkpoints: [
          {
            id: 'SR2-1-1',
            description: 'Verify property is clearly identified',
            validation: 'automated',
            automationScript: 'checkPropertyIdentification',
          },
          {
            id: 'SR2-1-2',
            description: 'Verify effective date is stated',
            validation: 'automated',
            automationScript: 'checkEffectiveDate',
          },
        ],
      },
      {
        id: 'RECORD-KEEPING',
        ruleNumber: 'RECORD-KEEPING',
        category: 'record_keeping',
        title: 'Record Keeping Rule',
        description: 'Retain workfile for at least 5 years.',
        requirements: ['Must prepare workfile'],
        severity: 'high',
        effectiveDate: new Date('2024-01-01'),
        checkpoints: [
          {
            id: 'RECORD-1',
            description: 'Verify retention period tracking enabled',
            validation: 'automated',
            automationScript: 'checkRetentionTracking',
          },
        ],
      },
    ];
  }

  it('returns compliant when all checks pass', async () => {
    const service = new USPAPComplianceService();
    const dbInstance = (CosmosDbService as any).mock.results[0].value;
    dbInstance.queryDocuments.mockResolvedValue(getStandardTestRules());

    const report = await service.performComplianceCheck(makeCompleteOrderData());

    expect(report.overallCompliance).toBe('compliant');
    expect(report.criticalIssues).toBe(0);
    expect(report.highIssues).toBe(0);
    expect(report.checks.length).toBe(3);
    expect(report.checks.every((c: any) => c.passed)).toBe(true);
  });

  it('returns non_compliant when a critical check fails', async () => {
    const service = new USPAPComplianceService();
    const dbInstance = (CosmosDbService as any).mock.results[0].value;
    dbInstance.queryDocuments.mockResolvedValue(getStandardTestRules());

    const data = makeCompleteOrderData();
    delete data.propertyDetails; // breaks checkPropertyIdentification (critical rule)

    const report = await service.performComplianceCheck(data);

    expect(report.overallCompliance).toBe('non_compliant');
    expect(report.criticalIssues).toBeGreaterThan(0);
  });

  it('returns non_compliant when a high check fails', async () => {
    const service = new USPAPComplianceService();
    const dbInstance = (CosmosDbService as any).mock.results[0].value;
    dbInstance.queryDocuments.mockResolvedValue(getStandardTestRules());

    const data = makeCompleteOrderData();
    delete data.workfile; // breaks checkRetentionTracking (high rule)

    const report = await service.performComplianceCheck(data);

    expect(report.overallCompliance).toBe('non_compliant');
    expect(report.highIssues).toBeGreaterThan(0);
  });

  it('includes orderId in report', async () => {
    const service = new USPAPComplianceService();
    const dbInstance = (CosmosDbService as any).mock.results[0].value;
    dbInstance.queryDocuments.mockResolvedValue([]);

    const data = makeCompleteOrderData();
    const report = await service.performComplianceCheck(data);

    expect(report.orderId).toBe('ORD-2026-001');
  });

  it('handles unknown automationScript gracefully', async () => {
    const service = new USPAPComplianceService();
    const dbInstance = (CosmosDbService as any).mock.results[0].value;
    dbInstance.queryDocuments.mockResolvedValue([
      {
        id: 'TEST-RULE',
        ruleNumber: 'TEST',
        category: 'reporting',
        title: 'Test',
        description: 'Test',
        requirements: [],
        severity: 'medium',
        effectiveDate: new Date('2024-01-01'),
        checkpoints: [
          {
            id: 'TEST-1',
            description: 'Unknown check',
            validation: 'automated',
            automationScript: 'nonExistentEvaluator',
          },
        ],
      },
    ]);

    const report = await service.performComplianceCheck(makeCompleteOrderData());

    expect(report.checks).toHaveLength(1);
    expect(report.checks[0].passed).toBe(false);
    expect(report.checks[0].message).toMatch(/no evaluator/i);
  });
});
