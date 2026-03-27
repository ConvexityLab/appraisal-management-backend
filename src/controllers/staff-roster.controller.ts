/**
 * Staff Roster Controller
 * Provides supervisory visibility into vendor/staff workloads, schedules,
 * geographic coverage, capabilities, and product competencies.
 *
 * Route:  GET /api/staff/roster
 * Query params:
 *   tenantId        — required — tenant scope
 *   staffType       — optional — 'internal' | 'external' | 'all' (default 'all')
 *   role            — optional — StaffRole value filter
 *   state           — optional — only vendors licensed/servicing this state
 *   productId       — optional — only vendors eligible for this product
 *   availableNow    — optional — 'true' to include only vendors available right now
 */

import { Response, Router, Request, NextFunction } from 'express';
import { query, param, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { WorkScheduleBlock } from '../types/index.js';

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export interface ScheduleToday {
  isWorkday: boolean;
  startTime?: string;
  endTime?: string;
  timezone?: string;
}

export interface StaffRosterEntry {
  id: string;
  vendorCode: string;
  displayName: string;
  email: string;
  phone?: string;

  // Staff classification (Phase 1.5.5)
  staffType: string;
  staffRole?: string;

  // Workload
  activeOrderCount: number;
  maxConcurrentOrders: number;
  /** 0-100 — percentage of capacity currently used */
  workloadPct: number;

  // Schedule
  scheduleToday: ScheduleToday;
  availableNow: boolean;

  // Capabilities & product eligibility (Increment 1)
  capabilities: string[];
  eligibleProductIds: string[];
  productGrades: Array<{ productId: string; grade: string; effectiveDate?: string }>;
  geographicCoverageSummary: {
    licensedStates: string[];
    preferredStates: string[];
    excludedStates: string[];
  };

  // Performance
  tier?: string;
  overallScore?: number;
  averageTurnaroundDays?: number;
  status: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Given a vendor's workSchedule array and an optional timezone override,
 * returns info about today's block.
 */
function getScheduleToday(
  workSchedule: WorkScheduleBlock[] | undefined
): ScheduleToday {
  if (!workSchedule?.length) {
    return { isWorkday: false };
  }

  const todayDow = new Date().getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const block = workSchedule.find(b => b.dayOfWeek === todayDow);

  if (!block) {
    return { isWorkday: false };
  }

  return {
    isWorkday: true,
    startTime: block.startTime,
    endTime: block.endTime,
    // exactOptionalPropertyTypes: spread only when value is present
    ...(block.timezone !== undefined ? { timezone: block.timezone } : {})
  };
}

/**
 * Returns true if the current local time (in the vendor's declared timezone)
 * falls within the vendor's today schedule block AND the vendor has capacity.
 */
function isAvailableNow(vendor: any): boolean {
  // Vacation check
  if (vendor.isBusy) return false;
  const now = new Date();
  if (vendor.vacationStartDate && vendor.vacationEndDate) {
    const start = new Date(vendor.vacationStartDate);
    const end = new Date(vendor.vacationEndDate);
    if (now >= start && now <= end) return false;
  }

  // Capacity check
  const active = vendor.activeOrderCount ?? vendor.currentActiveOrders ?? 0;
  const max = vendor.maxConcurrentOrders ?? vendor.maxActiveOrders ?? 10;
  if (active >= max) return false;

  // Schedule check
  const workSchedule: WorkScheduleBlock[] | undefined = vendor.workSchedule;
  if (!workSchedule?.length) {
    // No schedule configured — treat as always available during business hours
    return true;
  }

  const todayDow = now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const block = workSchedule.find(b => b.dayOfWeek === todayDow);
  if (!block) return false;

  // Convert current time to vendor's timezone for HH:mm comparison
  const tz = block.timezone || 'UTC';
  let currentHHmm: string;
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(now);
    const h = parts.find(p => p.type === 'hour')?.value ?? '00';
    const m = parts.find(p => p.type === 'minute')?.value ?? '00';
    currentHHmm = `${h}:${m}`;
  } catch {
    // Unknown timezone — fall back to UTC
    const h = String(now.getUTCHours()).padStart(2, '0');
    const m = String(now.getUTCMinutes()).padStart(2, '0');
    currentHHmm = `${h}:${m}`;
  }

  return currentHHmm >= block.startTime && currentHHmm < block.endTime;
}

/** Map a raw Cosmos vendor document to a StaffRosterEntry. */
function toRosterEntry(vendor: any): StaffRosterEntry {
  const active = vendor.activeOrderCount ?? vendor.currentActiveOrders ?? 0;
  const max = vendor.maxConcurrentOrders ?? vendor.maxActiveOrders ?? 10;

  const geo = vendor.geographicCoverage ?? {};

  return {
    id: vendor.id,
    vendorCode: vendor.licenseNumber || vendor.vendorCode || vendor.id,
    displayName: vendor.businessName || vendor.name || vendor.displayName || 'Unknown',
    email: vendor.email,
    phone: vendor.phone,

    staffType: vendor.staffType ?? 'external',
    staffRole: vendor.staffRole,

    activeOrderCount: active,
    maxConcurrentOrders: max,
    workloadPct: max > 0 ? Math.round((active / max) * 100) : 0,

    scheduleToday: getScheduleToday(vendor.workSchedule),
    availableNow: isAvailableNow(vendor),

    capabilities: vendor.capabilities ?? [],
    eligibleProductIds: vendor.eligibleProductIds ?? [],
    productGrades: vendor.productGrades ?? [],
    geographicCoverageSummary: {
      licensedStates: geo.licensed?.states ?? [],
      preferredStates: geo.preferred?.states ?? [],
      excludedStates: geo.excluded?.states ?? []
    },

    tier: vendor.performance?.tier ?? vendor.tier,
    overallScore: vendor.performance?.overallScore ?? vendor.performanceScore,
    averageTurnaroundDays:
      vendor.averageTurnaroundDays ??
      (vendor.performance?.averageTurnTime
        ? Math.round(vendor.performance.averageTurnTime / 24)
        : undefined),

    status: (vendor.status ?? 'ACTIVE').toUpperCase()
  };
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

export class StaffRosterController {
  public router: Router;
  private dbService: CosmosDbService;
  private logger: Logger;

  constructor(dbService: CosmosDbService) {
    this.router = Router();
    this.dbService = dbService;
    this.logger = new Logger('StaffRosterController');
    this.initializeRoutes();
  }

  private initializeRoutes(): void {
    this.router.get(
      '/roster',
      ...this.validateRosterQuery(),
      this.getRoster.bind(this)
    );

    this.router.get(
      '/roster/:vendorId/orders',
      [param('vendorId').notEmpty().withMessage('vendorId is required')],
      this.handleValidationErrors.bind(this),
      this.getVendorActiveOrders.bind(this)
    );
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  private validateRosterQuery() {
    return [
      query('staffType')
        .optional()
        .isIn(['internal', 'external', 'all'])
        .withMessage("staffType must be 'internal', 'external', or 'all'"),
      query('availableNow')
        .optional()
        .isIn(['true', 'false'])
        .withMessage("availableNow must be 'true' or 'false'"),
      this.handleValidationErrors.bind(this)
    ];
  }

  private handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }
    next();
  }

  // ---------------------------------------------------------------------------
  // Handler
  // ---------------------------------------------------------------------------

  /**
   * GET /api/staff/roster
   *
   * Returns all vendors for the tenant enriched with schedule, workload,
   * capabilities, product grades, and geographic coverage summary.
   * Supervisors can filter by staffType, role, state, productId, and
   * availability right now.
   */
  private async getRoster(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const {
        staffType,
        role,
        state,
        productId,
        availableNow
      } = req.query as Record<string, string | undefined>;

      // Fetch all vendors for this tenant
      const result = await this.dbService.findAllVendors();

      if (!result.success || !result.data) {
        res.status(500).json({
          error: 'Failed to retrieve vendor roster',
          code: 'ROSTER_RETRIEVAL_ERROR',
          details: result.error
        });
        return;
      }

      let vendors: any[] = result.data;

      // --- Filtering ---

      // staffType filter
      // External vendors often have no staffType field in Cosmos (it defaults to
      // 'external' in transformVendorToProfile), so treat undefined/null as 'external'.
      if (staffType && staffType !== 'all') {
        vendors = vendors.filter((v: any) => {
          const effective = v.staffType ?? 'external';
          return effective === staffType;
        });
      }

      // role filter (StaffRole — e.g. 'supervisor', 'appraiser', 'reviewer')
      if (role) {
        vendors = vendors.filter((v: any) => v.staffRole === role);
      }

      // state filter — match licensed or service areas
      if (state) {
        const upperState = state.toUpperCase();
        vendors = vendors.filter((v: any) => {
          const licensed: string[] = v.geographicCoverage?.licensed?.states ?? [];
          const preferred: string[] = v.geographicCoverage?.preferred?.states ?? [];
          const serviceAreas: Array<{ state: string }> = v.serviceAreas ?? [];
          return (
            licensed.includes(upperState) ||
            preferred.includes(upperState) ||
            serviceAreas.some((a) => a.state?.toUpperCase() === upperState)
          );
        });
      }

      // productId filter — vendor's eligibleProductIds must include it (if they have an explicit list)
      if (productId) {
        vendors = vendors.filter((v: any) =>
          !v.eligibleProductIds?.length || v.eligibleProductIds.includes(productId)
        );
      }

      // availableNow filter
      if (availableNow === 'true') {
        vendors = vendors.filter((v: any) => isAvailableNow(v));
      }

      // --- Transform ---
      const entries: StaffRosterEntry[] = vendors.map(toRosterEntry);

      this.logger.info('Staff roster returned', {
        total: entries.length,
        filters: { staffType, role, state, productId, availableNow }
      });

      res.json(entries);
    } catch (error) {
      this.logger.error('Failed to build staff roster', { error });
      res.status(500).json({
        error: 'Failed to build staff roster',
        code: 'ROSTER_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ---------------------------------------------------------------------------
  // GET /roster/:vendorId/orders
  // Returns active (non-terminal) orders currently assigned to a vendor or staff
  // member so supervisors can drill into workload detail.
  // ---------------------------------------------------------------------------

  private async getVendorActiveOrders(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const { vendorId } = req.params as { vendorId: string };

      // Terminal statuses — exclude from the active set
      const terminalStatuses = ['CANCELLED', 'DELIVERED', 'COMPLETED', 'ARCHIVED'];
      const placeholders = terminalStatuses.map((_, i) => `@s${i}`).join(', ');
      const parameters = [
        { name: '@vendorId', value: vendorId },
        ...terminalStatuses.map((s, i) => ({ name: `@s${i}`, value: s })),
      ];

      const sql =
        `SELECT c.id, c.orderNumber, c.status, c.priority, c.productType, ` +
        `c.propertyAddress, c.dueDate, c.assignedAt, c.clientId, c.fee ` +
        `FROM c ` +
        `WHERE (c.assignedVendorId = @vendorId OR c.vendorId = @vendorId) ` +
        `AND NOT ARRAY_CONTAINS([${placeholders}], c.status) ` +
        `ORDER BY c.dueDate ASC`;

      const orders = await this.dbService.queryDocuments<Record<string, unknown>>('orders', sql, parameters);

      // Slim down property address to a readable string
      const result = orders.map((o) => {
        const addr = o['propertyAddress'];
        let addressStr = '';
        if (typeof addr === 'string') {
          addressStr = addr;
        } else if (addr && typeof addr === 'object') {
          const a = addr as Record<string, string>;
          addressStr = [a['streetAddress'] ?? a['street'] ?? '', a['city'] ?? '', a['state'] ?? '', a['zipCode'] ?? '']
            .filter(Boolean)
            .join(', ');
        }
        return {
          id: o['id'],
          orderNumber: o['orderNumber'],
          status: o['status'],
          priority: o['priority'],
          productType: o['productType'],
          propertyAddress: addressStr,
          dueDate: o['dueDate'],
          assignedAt: o['assignedAt'],
          clientId: o['clientId'],
          fee: o['fee'],
        };
      });

      this.logger.info('Vendor active orders returned', { vendorId, count: result.length });
      res.json({ vendorId, orders: result, count: result.length });
    } catch (error) {
      this.logger.error('Failed to get vendor active orders', { error });
      res.status(500).json({
        error: 'Failed to retrieve vendor active orders',
        code: 'VENDOR_ORDERS_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}
