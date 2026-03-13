/**
 * USPAP Compliance Service
 * Enforces Uniform Standards of Professional Appraisal Practice (USPAP) rules
 *
 * Phase 0.4 — De-stubbed 2026-03-11:
 *   - Replaced always-pass executeAutomatedCheck stub with real evaluators
 *   - Added CHECKPOINT_EVALUATORS map with 11 named evaluator functions
 *   - Added automationScript names to previously-uncovered checkpoints
 *   - Added REQUIRED_CERTIFICATION_ELEMENTS for SR2-3 23-point check
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

// ═══════════════════════════════════════════════════════════════════════════════
// Evaluator types and registry
// ═══════════════════════════════════════════════════════════════════════════════

export interface CheckpointEvaluatorResult {
  passed: boolean;
  message: string;
  details?: Record<string, any>;
}

export type CheckpointEvaluator = (orderData: Record<string, any>) => CheckpointEvaluatorResult;

/**
 * USPAP 2024-2025 Edition — 23 required certification elements.
 * Used by check23PointCertification to verify completeness.
 */
export const REQUIRED_CERTIFICATION_ELEMENTS: readonly string[] = [
  'statements_of_fact_true',
  'analysis_opinions_conclusions_limited_by_assumptions',
  'no_present_or_prospective_interest',
  'no_personal_interest_or_bias',
  'compensation_not_contingent_on_value',
  'compensation_not_contingent_on_predetermined_value',
  'analysis_conformity_with_uspap',
  'personal_inspection_disclosure',
  'no_significant_assistance_or_disclosure',
  'appraiser_license_certification',
  'education_experience_requirements',
  'effective_date_of_appraisal',
  'property_appraised_identified',
  'intended_use_stated',
  'intended_users_stated',
  'type_and_definition_of_value',
  'extraordinary_assumptions_disclosed',
  'hypothetical_conditions_disclosed',
  'scope_of_work_disclosure',
  'prior_services_disclosure',
  'subject_property_sales_history',
  'current_agreement_of_sale',
  'reconciliation_support',
] as const;

// ─── Placeholder-detection patterns for checkMisleadingStatements ────────────

const MISLEADING_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\[INSERT[^\]]*\]/i, label: 'placeholder bracket' },
  { pattern: /\bTBD\b/i, label: 'TBD marker' },
  { pattern: /\bXXX+\b/i, label: 'XXX placeholder' },
  { pattern: /\bN\/A\b/i, label: 'N/A marker' },
  { pattern: /lorem\s+ipsum/i, label: 'lorem ipsum' },
  { pattern: /\bSAMPLE\b/i, label: 'SAMPLE marker' },
  { pattern: /\bDRAFT\b/i, label: 'DRAFT marker' },
  { pattern: /\bTODO\b/i, label: 'TODO marker' },
  { pattern: /\bFIXME\b/i, label: 'FIXME marker' },
  { pattern: /_{3,}/i, label: 'blank-fill underscores' },
];

// ─── Helper: check string is non-empty after trimming ─────────────────────────

function isNonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Checkpoint evaluator implementations
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Exported evaluator registry. Keys correspond to automationScript names
 * on USPAPRule checkpoints. Each function is pure: (orderData) => result.
 */
export const CHECKPOINT_EVALUATORS: Readonly<Record<string, CheckpointEvaluator>> = {

  /**
   * SR2-1-1: Verify the subject property is clearly identified.
   * Checks: propertyDetails.{address, city, state, zipCode}
   */
  checkPropertyIdentification(orderData: Record<string, any>): CheckpointEvaluatorResult {
    const pd = orderData.propertyDetails;
    if (!pd || typeof pd !== 'object') {
      return { passed: false, message: 'Property details are missing entirely.', details: { missingFields: ['propertyDetails'] } };
    }
    const required = ['address', 'city', 'state', 'zipCode'] as const;
    const missing = required.filter(f => !isNonEmpty(pd[f]));
    if (missing.length > 0) {
      return {
        passed: false,
        message: `Property identification incomplete — missing: ${missing.join(', ')}.`,
        details: { missingFields: [...missing] },
      };
    }
    return { passed: true, message: 'Property is clearly identified.' };
  },

  /**
   * SR1-1-1: Verify intended use is identified.
   */
  checkIntendedUse(orderData: Record<string, any>): CheckpointEvaluatorResult {
    if (!isNonEmpty(orderData.intendedUse)) {
      return { passed: false, message: 'Intended use is not identified.' };
    }
    return { passed: true, message: 'Intended use is identified.' };
  },

  /**
   * SR1-1-2: Verify intended users are identified.
   */
  checkIntendedUsers(orderData: Record<string, any>): CheckpointEvaluatorResult {
    const users = orderData.intendedUsers;
    if (Array.isArray(users)) {
      if (users.length === 0) {
        return { passed: false, message: 'Intended users list is empty.' };
      }
      return { passed: true, message: 'Intended users are identified.' };
    }
    if (!isNonEmpty(users)) {
      return { passed: false, message: 'Intended users are not identified.' };
    }
    return { passed: true, message: 'Intended users are identified.' };
  },

  /**
   * SR2-1-2: Verify effective date of appraisal is stated.
   */
  checkEffectiveDate(orderData: Record<string, any>): CheckpointEvaluatorResult {
    const ed = orderData.effectiveDate;
    if (ed === undefined || ed === null || ed === '') {
      return { passed: false, message: 'Effective date of appraisal is not stated.' };
    }
    return { passed: true, message: 'Effective date is stated.' };
  },

  /**
   * COMP-1: Verify appraiser competency for property type and geographic area.
   * Checks: appraiser.{licenseNumber, licenseExpiration, licenseState/serviceStates vs propertyState}
   */
  checkAppraiserCompetency(orderData: Record<string, any>): CheckpointEvaluatorResult {
    const appraiser = orderData.appraiser;
    if (!appraiser || typeof appraiser !== 'object') {
      return { passed: false, message: 'Appraiser information is missing.', details: { reason: 'No appraiser data provided' } };
    }
    if (!isNonEmpty(appraiser.licenseNumber)) {
      return { passed: false, message: 'Appraiser license number is missing.', details: { reason: 'Missing license number' } };
    }
    // Check license expiration
    if (isNonEmpty(appraiser.licenseExpiration)) {
      const expDate = new Date(appraiser.licenseExpiration);
      if (!isNaN(expDate.getTime()) && expDate < new Date()) {
        return {
          passed: false,
          message: `Appraiser license expired on ${appraiser.licenseExpiration}.`,
          details: { reason: 'License expired', expirationDate: appraiser.licenseExpiration },
        };
      }
    }
    // Check geographic coverage
    const propState = orderData.propertyState ?? orderData.propertyDetails?.state;
    if (isNonEmpty(propState)) {
      const serviceStates: string[] | undefined = appraiser.serviceStates;
      const licenseState: string | undefined = appraiser.licenseState;
      const coveredStates = serviceStates ?? (licenseState ? [licenseState] : []);
      if (coveredStates.length > 0 && !coveredStates.includes(propState)) {
        return {
          passed: false,
          message: `Appraiser not licensed/competent in property state ${propState}.`,
          details: { reason: `License state mismatch — appraiser covers [${coveredStates.join(', ')}], property in ${propState}` },
        };
      }
    }
    return { passed: true, message: 'Appraiser competency verified.' };
  },

  /**
   * COMP-2: Check for competency disclosure in certification.
   */
  checkCompetencyDisclosure(orderData: Record<string, any>): CheckpointEvaluatorResult {
    const cert = orderData.certification;
    if (!cert || typeof cert !== 'object') {
      return { passed: false, message: 'Certification block is missing — cannot verify competency disclosure.' };
    }
    if (!isNonEmpty(cert.competencyDisclosure)) {
      return { passed: false, message: 'Competency disclosure is missing from certification.' };
    }
    return { passed: true, message: 'Competency disclosure is present.' };
  },

  /**
   * SR2-3-2: Verify appraiser signature present.
   */
  checkAppraiserSignature(orderData: Record<string, any>): CheckpointEvaluatorResult {
    const cert = orderData.certification;
    if (!cert || typeof cert !== 'object') {
      return { passed: false, message: 'Certification block is missing — cannot verify signature.' };
    }
    if (!cert.signaturePresent) {
      return { passed: false, message: 'Appraiser signature is not present in certification.' };
    }
    return { passed: true, message: 'Appraiser signature is present.' };
  },

  /**
   * SR2-3-3: Verify license number is present in certification.
   */
  checkLicenseNumber(orderData: Record<string, any>): CheckpointEvaluatorResult {
    const cert = orderData.certification;
    if (!cert || typeof cert !== 'object') {
      return { passed: false, message: 'Certification block is missing — cannot verify license number.' };
    }
    if (!isNonEmpty(cert.licenseNumber)) {
      return { passed: false, message: 'License number is missing from certification.' };
    }
    return { passed: true, message: 'License number is present in certification.' };
  },

  /**
   * SR2-3-1: Verify all 23 required USPAP certification elements are present.
   */
  check23PointCertification(orderData: Record<string, any>): CheckpointEvaluatorResult {
    const cert = orderData.certification;
    if (!cert || typeof cert !== 'object') {
      return {
        passed: false,
        message: 'Certification block is missing.',
        details: { missingCount: REQUIRED_CERTIFICATION_ELEMENTS.length, missingElements: [...REQUIRED_CERTIFICATION_ELEMENTS] },
      };
    }
    const elements: string[] = Array.isArray(cert.elements) ? cert.elements : [];
    const missing = REQUIRED_CERTIFICATION_ELEMENTS.filter(el => !elements.includes(el));
    if (missing.length > 0) {
      return {
        passed: false,
        message: `${missing.length} of 23 required certification elements are missing.`,
        details: { missingCount: missing.length, missingElements: missing },
      };
    }
    return { passed: true, message: 'All 23 certification elements are present.' };
  },

  /**
   * RECORD-1: Verify workfile retention period tracking is enabled.
   * USPAP requires retention for at least 5 years (or 2 years after final disposition).
   */
  checkRetentionTracking(orderData: Record<string, any>): CheckpointEvaluatorResult {
    const wf = orderData.workfile;
    if (!wf || typeof wf !== 'object') {
      return { passed: false, message: 'Workfile/retention tracking information is missing.' };
    }
    if (!wf.retentionEnabled) {
      return { passed: false, message: 'Retention tracking is not enabled on the workfile.' };
    }
    if (!wf.retentionDate) {
      return { passed: false, message: 'Retention date is not set on the workfile.' };
    }
    return { passed: true, message: 'Retention tracking is enabled with a retention date.' };
  },

  /**
   * ETHICS-MGMT-1: Scan report text sections for placeholder, sample, or
   * obviously-unfinished content that could indicate a misleading report.
   */
  checkMisleadingStatements(orderData: Record<string, any>): CheckpointEvaluatorResult {
    const sections = orderData.reportSections;
    if (!sections || typeof sections !== 'object' || Object.keys(sections).length === 0) {
      return { passed: true, message: 'No report sections provided to scan — skipping misleading-statement check.' };
    }
    const flagged: Array<{ section: string; pattern: string; snippet: string }> = [];
    for (const [sectionName, text] of Object.entries(sections)) {
      if (typeof text !== 'string') continue;
      for (const { pattern, label } of MISLEADING_PATTERNS) {
        const match = pattern.exec(text);
        if (match) {
          const start = Math.max(0, match.index - 20);
          const end = Math.min(text.length, match.index + match[0].length + 20);
          flagged.push({ section: sectionName, pattern: label, snippet: text.slice(start, end) });
        }
      }
    }
    if (flagged.length > 0) {
      return {
        passed: false,
        message: `Found ${flagged.length} suspicious pattern(s) in report text.`,
        details: { flaggedPatterns: flagged },
      };
    }
    return { passed: true, message: 'No misleading statements detected.' };
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// Service interfaces
// ═══════════════════════════════════════════════════════════════════════════════

export interface USPAPRule {
  id: string;
  ruleNumber: string; // e.g., "SR1-1", "SR2-3", "ETHICS-1"
  category: 'ethics' | 'competency' | 'scope' | 'development' | 'reporting' | 'record_keeping' | 'jurisdictional';
  title: string;
  description: string;
  requirements: string[];
  severity: 'critical' | 'high' | 'medium' | 'low';
  applicableStates?: string[]; // Empty = all states
  effectiveDate: Date;
  expirationDate?: Date;
  checkpoints: Array<{
    id: string;
    description: string;
    validation: 'manual' | 'automated';
    automationScript?: string; // For dynamic code execution
  }>;
}

export interface ComplianceCheck {
  ruleId: string;
  ruleNumber: string;
  passed: boolean;
  message: string;
  severity: string;
  details?: Record<string, any>;
}

export interface ComplianceReport {
  orderId: string;
  reportDate: Date;
  overallCompliance: 'compliant' | 'non_compliant' | 'warnings';
  checks: ComplianceCheck[];
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  lowIssues: number;
}

export class USPAPComplianceService {
  private logger: Logger;
  private dbService: CosmosDbService;
  private readonly containerName = 'uspap-rules';

  constructor() {
    this.logger = new Logger();
    this.dbService = new CosmosDbService();
  }

  /**
   * Initialize USPAP rules database
   */
  async initializeRules(): Promise<void> {
    try {
      this.logger.info('Initializing USPAP rules database');

      const rules = this.getStandardRules();
      
      for (const rule of rules) {
        await this.dbService.upsertDocument(this.containerName, rule);
      }

      this.logger.info(`Initialized ${rules.length} USPAP rules`);
    } catch (error) {
      this.logger.error('Failed to initialize USPAP rules', { error });
      throw error;
    }
  }

  /**
   * Get all USPAP rules
   */
  async getRules(category?: string, state?: string): Promise<USPAPRule[]> {
    try {
      let query = 'SELECT * FROM c WHERE 1=1';
      const parameters: Array<{ name: string; value: any }> = [];

      if (category) {
        query += ' AND c.category = @category';
        parameters.push({ name: '@category', value: category });
      }

      if (state) {
        query += ' AND (NOT IS_DEFINED(c.applicableStates) OR ARRAY_CONTAINS(c.applicableStates, @state))';
        parameters.push({ name: '@state', value: state });
      }

      const result = await this.dbService.queryDocuments(this.containerName, query, parameters);
      return Array.isArray(result) ? result as USPAPRule[] : [];
    } catch (error) {
      this.logger.error('Failed to get USPAP rules', { error });
      return [];
    }
  }

  /**
   * Perform compliance check on an order
   */
  async performComplianceCheck(orderData: Record<string, any>): Promise<ComplianceReport> {
    const checks: ComplianceCheck[] = [];
    
    // Get applicable rules
    const rules = await this.getRules(undefined, orderData.propertyState);

    for (const rule of rules) {
      for (const checkpoint of rule.checkpoints) {
        if (checkpoint.validation === 'automated' && checkpoint.automationScript) {
          // TODO: Use dynamic code execution service
          const check = await this.executeAutomatedCheck(rule, checkpoint, orderData);
          checks.push(check);
        }
      }
    }

    // Calculate summary
    const criticalIssues = checks.filter(c => !c.passed && c.severity === 'critical').length;
    const highIssues = checks.filter(c => !c.passed && c.severity === 'high').length;
    const mediumIssues = checks.filter(c => !c.passed && c.severity === 'medium').length;
    const lowIssues = checks.filter(c => !c.passed && c.severity === 'low').length;

    let overallCompliance: 'compliant' | 'non_compliant' | 'warnings';
    if (criticalIssues > 0 || highIssues > 0) {
      overallCompliance = 'non_compliant';
    } else if (mediumIssues > 0 || lowIssues > 0) {
      overallCompliance = 'warnings';
    } else {
      overallCompliance = 'compliant';
    }

    return {
      orderId: orderData.orderId || orderData.id,
      reportDate: new Date(),
      overallCompliance,
      checks,
      criticalIssues,
      highIssues,
      mediumIssues,
      lowIssues,
    };
  }

  /**
   * Execute automated compliance check by dispatching to the evaluator registry.
   */
  private async executeAutomatedCheck(
    rule: USPAPRule,
    checkpoint: USPAPRule['checkpoints'][0],
    orderData: Record<string, any>
  ): Promise<ComplianceCheck> {
    try {
      const scriptName = checkpoint.automationScript;
      if (!scriptName) {
        return {
          ruleId: rule.id,
          ruleNumber: rule.ruleNumber,
          passed: false,
          message: `Checkpoint ${checkpoint.id} has no automationScript defined.`,
          severity: rule.severity,
        };
      }

      const evaluator = CHECKPOINT_EVALUATORS[scriptName];
      if (!evaluator) {
        return {
          ruleId: rule.id,
          ruleNumber: rule.ruleNumber,
          passed: false,
          message: `No evaluator found for checkpoint script: ${scriptName}`,
          severity: rule.severity,
        };
      }

      const result = evaluator(orderData);
      return {
        ruleId: rule.id,
        ruleNumber: rule.ruleNumber,
        passed: result.passed,
        message: result.message,
        severity: rule.severity,
        ...(result.details !== undefined && { details: result.details }),
      };
    } catch (error) {
      return {
        ruleId: rule.id,
        ruleNumber: rule.ruleNumber,
        passed: false,
        message: `Check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        severity: rule.severity,
      };
    }
  }

  /**
   * Get standard USPAP rules (2024-2025 edition)
   */
  private getStandardRules(): USPAPRule[] {
    return [
      // ETHICS RULE
      {
        id: 'ETHICS-CONDUCT',
        ruleNumber: 'ETHICS-CONDUCT',
        category: 'ethics',
        title: 'Conduct',
        description: 'An appraiser must perform assignments with impartiality, objectivity, and independence, and without accommodation of personal interests.',
        requirements: [
          'Must not perform an assignment with bias',
          'Must not advocate the cause or interest of any party',
          'Must not perform an assignment with partiality',
          'Must not accept an assignment involving bias or lack of impartiality'
        ],
        severity: 'critical',
        effectiveDate: new Date('2024-01-01'),
        checkpoints: [
          {
            id: 'ETHICS-CONDUCT-1',
            description: 'Verify no conflict of interest disclosed',
            validation: 'manual'
          }
        ]
      },
      {
        id: 'ETHICS-MANAGEMENT',
        ruleNumber: 'ETHICS-MANAGEMENT',
        category: 'ethics',
        title: 'Management',
        description: 'An appraiser must not use or communicate a misleading or fraudulent report or knowingly permit an employee or other person to do so.',
        requirements: [
          'Must not misrepresent any facts',
          'Must not knowingly permit an employee to misrepresent facts',
          'Must not use or rely on unsupported conclusions',
          'Must correct errors or omissions when discovered'
        ],
        severity: 'critical',
        effectiveDate: new Date('2024-01-01'),
        checkpoints: [
          {
            id: 'ETHICS-MGMT-1',
            description: 'Verify no misleading statements in report',
            validation: 'automated',
            automationScript: 'checkMisleadingStatements'
          }
        ]
      },
      
      // COMPETENCY RULE
      {
        id: 'COMPETENCY-RULE',
        ruleNumber: 'COMPETENCY',
        category: 'competency',
        title: 'Competency Rule',
        description: 'An appraiser must be competent to perform the assignment or must disclose lack of knowledge/experience before accepting.',
        requirements: [
          'Must have knowledge and experience to complete assignment',
          'Must disclose lack of knowledge/experience prior to accepting',
          'Must take reasonable steps to complete assignment competently',
          'Must describe lack of knowledge/experience in certification'
        ],
        severity: 'critical',
        effectiveDate: new Date('2024-01-01'),
        checkpoints: [
          {
            id: 'COMP-1',
            description: 'Verify appraiser competency for property type and geographic area',
            validation: 'automated',
            automationScript: 'checkAppraiserCompetency'
          },
          {
            id: 'COMP-2',
            description: 'Check for competency disclosure in certification',
            validation: 'automated',
            automationScript: 'checkCompetencyDisclosure'
          }
        ]
      },

      // STANDARDS RULE 1-1: Development (Scope of Work)
      {
        id: 'SR1-1',
        ruleNumber: 'SR1-1',
        category: 'scope',
        title: 'Scope of Work Rule',
        description: 'An appraiser must determine the scope of work necessary to produce credible assignment results.',
        requirements: [
          'Must identify problem to be solved',
          'Must determine scope of work necessary',
          'Must disclose scope of work in report',
          'Must identify intended use and intended users',
          'Must identify characteristics of property relevant to assignment',
          'Must identify assignment conditions that may affect credibility'
        ],
        severity: 'critical',
        effectiveDate: new Date('2024-01-01'),
        checkpoints: [
          {
            id: 'SR1-1-1',
            description: 'Verify intended use is identified',
            validation: 'automated',
            automationScript: 'checkIntendedUse'
          },
          {
            id: 'SR1-1-2',
            description: 'Verify intended users are identified',
            validation: 'automated',
            automationScript: 'checkIntendedUsers'
          },
          {
            id: 'SR1-1-3',
            description: 'Verify scope of work is documented',
            validation: 'manual'
          }
        ]
      },

      // STANDARDS RULE 2-1: Reporting
      {
        id: 'SR2-1',
        ruleNumber: 'SR2-1',
        category: 'reporting',
        title: 'Appraisal Report',
        description: 'Each written real property appraisal report must be prepared under one of the reporting options and prominently state which option is used.',
        requirements: [
          'Must clearly and accurately set forth appraisal in manner not misleading',
          'Must contain sufficient information to enable intended users to understand report',
          'Must clearly identify real estate appraised',
          'Must clearly identify property rights appraised',
          'Must state effective date of appraisal and date of report',
          'Must state all assumptions and limiting conditions',
          'Must include certification per Standards Rule 2-3'
        ],
        severity: 'critical',
        effectiveDate: new Date('2024-01-01'),
        checkpoints: [
          {
            id: 'SR2-1-1',
            description: 'Verify property is clearly identified',
            validation: 'automated',
            automationScript: 'checkPropertyIdentification'
          },
          {
            id: 'SR2-1-2',
            description: 'Verify effective date is stated',
            validation: 'automated',
            automationScript: 'checkEffectiveDate'
          },
          {
            id: 'SR2-1-3',
            description: 'Verify assumptions are disclosed',
            validation: 'manual'
          }
        ]
      },

      // STANDARDS RULE 2-3: Certification
      {
        id: 'SR2-3',
        ruleNumber: 'SR2-3',
        category: 'reporting',
        title: 'Certification',
        description: 'Each written real property appraisal report must contain a certification.',
        requirements: [
          'Must include all 23 required certification elements',
          'Must be signed by appraiser(s)',
          'Must include license/certification number(s)',
          'Must include date of signature and report',
          'Must identify property appraised',
          'Must state effective date of appraisal'
        ],
        severity: 'critical',
        effectiveDate: new Date('2024-01-01'),
        checkpoints: [
          {
            id: 'SR2-3-1',
            description: 'Verify all 23 certification elements present',
            validation: 'automated',
            automationScript: 'check23PointCertification'
          },
          {
            id: 'SR2-3-2',
            description: 'Verify appraiser signature present',
            validation: 'automated',
            automationScript: 'checkAppraiserSignature'
          },
          {
            id: 'SR2-3-3',
            description: 'Verify license number present',
            validation: 'automated',
            automationScript: 'checkLicenseNumber'
          }
        ]
      },

      // RECORD KEEPING RULE
      {
        id: 'RECORD-KEEPING',
        ruleNumber: 'RECORD-KEEPING',
        category: 'record_keeping',
        title: 'Record Keeping Rule',
        description: 'An appraiser must prepare a workfile for each appraisal, appraisal review, or appraisal consulting assignment and retain for at least 5 years.',
        requirements: [
          'Must prepare workfile for each assignment',
          'Must retain workfile for at least 5 years after preparation or 2 years after final disposition',
          'Must include name of client and identity of others providing significant assistance',
          'Must include true copy of any written report',
          'Must include all other data, information, and documentation necessary to support conclusions'
        ],
        severity: 'high',
        effectiveDate: new Date('2024-01-01'),
        checkpoints: [
          {
            id: 'RECORD-1',
            description: 'Verify retention period tracking enabled',
            validation: 'automated',
            automationScript: 'checkRetentionTracking'
          }
        ]
      }
    ];
  }
}
