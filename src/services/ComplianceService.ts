import { MopMapperService } from './mop/MopMapperService';
import { MopApiClient, MopComplianceViolation } from './mop/MopApiClient';
import { CanonicalReportDocument } from '../types/canonical-schema';
import { CosmosDbService } from './cosmos-db.service';
import { AppraisalOrder } from '../types/order-management';
import { AppraisalDraft, DraftStatus } from '../types/appraisal-draft.types';
import { Logger } from '../utils/logger';

export interface ComplianceResult {
  code: string;
  reason: string;
  severity: 'WARNING' | 'STOP';
}

export class ComplianceService {
  private mapper: MopMapperService;
  private apiClient: MopApiClient;
  private logger = new Logger('ComplianceService');

  constructor(private dbService: CosmosDbService) {
    this.mapper = new MopMapperService();
    this.apiClient = new MopApiClient('http://localhost:8090');
  }

  /**
   * Evaluate an order's compliance by checking its latest draft
   */
  public async evaluateOrderCompliance(orderId: string): Promise<ComplianceResult[]> {
    this.logger.info(`Evaluating compliance for order ${orderId}`);
    
    // 1. Get Order
    const ordersContainer = this.dbService.getContainer('orders');
    const { resources: orders } = await ordersContainer.items
      .query<AppraisalOrder>({
        query: 'SELECT * FROM c WHERE c.type = "order" AND c.id = @id',
        parameters: [{ name: '@id', value: orderId }]
      })
      .fetchAll();

    if (!orders || orders.length === 0 || !orders[0]) {
      throw new Error(`Order ${orderId} not found`);
    }
    const order = orders[0]!;

    // 2. Get the latest Draft or Report
    const draftsContainer = this.dbService.getContainer('appraisal-drafts');
    const { resources: drafts } = await draftsContainer.items
      .query<AppraisalDraft>({
        query: 'SELECT * FROM c WHERE c.orderId = @orderId ORDER BY c.updatedAt DESC',
        parameters: [{ name: '@orderId', value: orderId }]
      })
      .fetchAll();

    if (!drafts || drafts.length === 0) {
      throw new Error(`No appraisal draft found for order ${orderId}`);
    }
    
    // Pick first draft (latest)
    const activeDraft = drafts[0];

    if (!activeDraft) {
      throw new Error(`Draft ${orderId} missing `);
    }

    // 3. Evaluate Compliance
    const results = await this.evaluateAppraisalCompliance(activeDraft.reportDocument);

    // 4. Update Order
    const hasStop = results.some(r => r.severity === 'STOP');
    const hasWarning = results.some(r => r.severity === 'WARNING');
    
    order.complianceStatus = hasStop ? 'HARD_STOP' : (hasWarning ? 'WARNINGS' : 'PASSED');
    order.complianceViolations = results;
    order.lastUpdated = new Date();

    await ordersContainer.item(order.id, (order as any).tenantId || orderId).replace(order);
    this.logger.info(`Compliance eval complete for order ${orderId}. Status: ${order.complianceStatus}`);

    return results;
  }

  /**
   * Evaluate appraisal data against external MOP rules engine
   */
  public async evaluateAppraisalCompliance(appraisal: CanonicalReportDocument): Promise<ComplianceResult[]> {
    // 1. Map to facts
    const facts = this.mapper.mapAppraisalToMopFacts(appraisal);

    // 2. Invoke rules engine via REST
    const violations = await this.apiClient.evaluateCompliance(facts);

    // 3. Process violations into domain results
    return violations.map(v => ({
      code: v.violation_code,
      reason: v.reason,
      // Map severe violations as STOPs e.g., missing data or commercial zoning.
      severity: this.mapSeverity(v.violation_code)
    }));
  }

  private mapSeverity(violationCode: string): 'WARNING' | 'STOP' {
    const stops = [
      'ZONING_COMMERCIAL',
      'CONDITION_C6_UNACCEPTABLE',
      'MISSING_EFFECTIVE_DATE',
      'MISSING_LICENSE_NUMBER'
    ];
    return stops.includes(violationCode) ? 'STOP' : 'WARNING';
  }
}

