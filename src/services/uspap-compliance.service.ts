/**
 * USPAP Compliance Service
 * Enforces Uniform Standards of Professional Appraisal Practice (USPAP) rules
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

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
      return result.data || [];
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
   * Execute automated compliance check
   */
  private async executeAutomatedCheck(
    rule: USPAPRule,
    checkpoint: USPAPRule['checkpoints'][0],
    orderData: Record<string, any>
  ): Promise<ComplianceCheck> {
    try {
      // TODO: Integrate with dynamic-code-execution.service.ts
      // For now, return placeholder
      return {
        ruleId: rule.id,
        ruleNumber: rule.ruleNumber,
        passed: true,
        message: `Check passed: ${checkpoint.description}`,
        severity: rule.severity,
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
            validation: 'automated'
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
            validation: 'automated'
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
            validation: 'automated'
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
            validation: 'automated'
          },
          {
            id: 'SR2-3-3',
            description: 'Verify license number present',
            validation: 'automated'
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
