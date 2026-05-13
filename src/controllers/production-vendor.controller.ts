/**
 * Vendor Management Controller
 * REST API for vendor CRUD operations, assignment, and performance.
 * Uses CosmosDbService directly — the single source of truth for vendor data.
 * 
 * Response format: Returns unwrapped VendorProfile objects to match frontend
 * RTK Query expectations (vendorsApi.ts).
 */

import { Response, Router, Request, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { CosmosDbService } from '../services/cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { UnifiedAuthRequest } from '../middleware/unified-auth.middleware.js';
import type { AuthorizationMiddleware, AuthorizedRequest } from '../middleware/authorization.middleware.js';
import { Vendor, VendorStatus, OrderStatus } from '../types/index.js';
import {
  stripConfidentialVendorFields,
  stripConfidentialFieldsFromVendorList,
} from '../utils/confidential-fields.js';

export class VendorController {
  public router: Router;
  private dbService: CosmosDbService;
  private logger: Logger;

  constructor(dbService: CosmosDbService, authzMiddleware?: AuthorizationMiddleware) {
    this.router = Router();
    this.dbService = dbService;
    this.logger = new Logger('VendorController');
    this.initializeRoutes(authzMiddleware);
  }

  // ---------------------------------------------------------------------------
  // Routes
  // ---------------------------------------------------------------------------

  private initializeRoutes(authzMiddleware?: AuthorizationMiddleware): void {
    // ── Middleware arrays ─────────────────────────────────────────────────────
    // loadUserProfile() followed by action-specific authorize().
    // If authzMiddleware is absent, arrays are empty (auth-only mode).
    const lp = authzMiddleware ? [authzMiddleware.loadUserProfile()] : [];
    const readQuery = authzMiddleware ? [...lp, authzMiddleware.authorizeQuery('vendor', 'read')] : [];
    const readResource = authzMiddleware
      ? [...lp, authzMiddleware.authorizeResource('vendor', 'read', { resourceIdParam: 'vendorId' })]
      : [];
    const create   = authzMiddleware ? [...lp, authzMiddleware.authorize('vendor',    'create')] : [];
    const update = authzMiddleware ? [...lp, authzMiddleware.authorize('vendor', 'update')] : [];
    const updateResource = authzMiddleware
      ? [...lp, authzMiddleware.authorizeResource('vendor', 'update', { resourceIdParam: 'vendorId' })]
      : [];
    const deleteResource = authzMiddleware
      ? [...lp, authzMiddleware.authorizeResource('vendor', 'delete', { resourceIdParam: 'vendorId' })]
      : [];
    const analytics = authzMiddleware ? [...lp, authzMiddleware.authorize('analytics', 'read')]   : [];
    const analyticsForVendor = authzMiddleware ? [...analytics, authzMiddleware.authorizeResource('vendor', 'read', { resourceIdParam: 'vendorId' })] : [];
    const updateOrderResource = authzMiddleware
      ? [...lp, authzMiddleware.authorizeResource('order', 'update', { resourceIdParam: 'orderId' })]
      : [];

    // Order matters: specific paths before parameterized paths
    this.router.get('/performance/:vendorId', ...analyticsForVendor,  ...this.validateVendorIdParam(), this.getVendorPerformance.bind(this));
    this.router.post('/assign/:orderId',       ...updateOrderResource,     ...this.validateOrderIdParam(),  this.assignVendor.bind(this));

    this.router.get('/',                       ...readQuery,    this.getVendors.bind(this));
    this.router.get('/:vendorId',              ...readResource,    ...this.validateVendorIdParam(), this.getVendorById.bind(this));
    this.router.post('/',                      ...create,  ...this.validateVendorCreation(), this.createVendor.bind(this));
    this.router.patch('/:vendorId/availability',         ...updateResource, ...this.validateVendorIdParam(), ...this.validateAvailabilityUpdate(),       this.setVendorAvailability.bind(this));
    this.router.patch('/:vendorId/product-eligibility',  ...updateResource, ...this.validateVendorIdParam(), ...this.validateProductEligibilityUpdate(), this.setProductEligibility.bind(this));
    this.router.put('/:vendorId',                        ...updateResource, ...this.validateVendorIdParam(), ...this.validateVendorUpdate(),               this.updateVendor.bind(this));
    this.router.delete('/:vendorId',           ...deleteResource,     ...this.validateVendorIdParam(), this.deleteVendor.bind(this));
  }

  // ---------------------------------------------------------------------------
  // Validation middleware
  // ---------------------------------------------------------------------------

  private handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors.array()
      });
      return;
    }
    next();
  }

  private validateVendorIdParam() {
    return [
      param('vendorId').notEmpty().withMessage('Vendor ID is required'),
      this.handleValidationErrors.bind(this)
    ];
  }

  private validateOrderIdParam() {
    return [
      param('orderId').notEmpty().withMessage('Order ID is required'),
      this.handleValidationErrors.bind(this)
    ];
  }

  private validateVendorCreation() {
    return [
      body('name').isLength({ min: 2 }).trim().withMessage('Name must be at least 2 characters'),
      body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
      body('phone').optional().isMobilePhone('any').withMessage('Valid phone number required'),
      body('serviceTypes').optional().isArray({ min: 1 }).withMessage('At least one service type required'),
      body('serviceAreas').optional().isArray({ min: 1 }).withMessage('At least one service area required'),
      this.handleValidationErrors.bind(this)
    ];
  }

  private validateVendorUpdate() {
    return [
      body('name').optional().isLength({ min: 2 }).trim(),
      body('email').optional().isEmail().normalizeEmail(),
      body('phone').optional().isMobilePhone('any'),
      body('serviceTypes').optional().isArray({ min: 1 }),
      body('serviceAreas').optional().isArray({ min: 1 }),
      body('status').optional().isIn(Object.values(VendorStatus)),
      this.handleValidationErrors.bind(this)
    ];
  }

  private validateAvailabilityUpdate() {
    return [
      body('isBusy').optional().isBoolean().withMessage('isBusy must be a boolean'),
      body('vacationStartDate').optional().isISO8601().withMessage('vacationStartDate must be a valid ISO date'),
      body('vacationEndDate').optional().isISO8601().withMessage('vacationEndDate must be a valid ISO date'),
      this.handleValidationErrors.bind(this)
    ];
  }

  private validateProductEligibilityUpdate() {
    const VALID_GRADES = ['trainee', 'proficient', 'expert', 'lead'] as const;
    return [
      body('eligibleProductIds')
        .isArray().withMessage('eligibleProductIds must be an array')
        .custom((ids: unknown[]) => {
          if (!ids.every(id => typeof id === 'string' && id.trim().length > 0)) {
            throw new Error('eligibleProductIds must be an array of non-empty strings');
          }
          return true;
        }),
      body('productGrades')
        .isArray().withMessage('productGrades must be an array')
        .custom((grades: unknown[]) => {
          for (const g of grades as Array<Record<string, unknown>>) {
            if (typeof g.productId !== 'string' || !g.productId.trim()) {
              throw new Error('each productGrade must have a non-empty productId string');
            }
            if (!VALID_GRADES.includes(g.grade as typeof VALID_GRADES[number])) {
              throw new Error(`productGrade.grade must be one of: ${VALID_GRADES.join(', ')}`);
            }
          }
          return true;
        }),
      this.handleValidationErrors.bind(this)
    ];
  }

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  /**
   * GET /api/vendors
   * List vendors with optional status/specialty filters.
   * Returns VendorProfile[] (unwrapped array) for frontend compatibility.
   */
  private async getVendors(req: AuthorizedRequest, res: Response): Promise<void> {
    try {
      // Phase 8 / A5: optional full-text search via ?q=X.  When the
      // query param is present and non-trivial, route through the
      // Cosmos CONTAINS-based searchVendors path; otherwise keep the
      // original findAllVendors behaviour so existing callers are
      // unaffected.
      const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
      const authzOptions = req.authorizationFilter
        ? { authorizationFilter: req.authorizationFilter }
        : undefined;
      const result =
        rawQ.length > 0
          ? await this.dbService.searchVendors(rawQ.slice(0, 100), 50, authzOptions)
          : await this.dbService.findAllVendors(authzOptions);

      if (result.success && result.data) {
        const vendorProfiles = result.data.map(v => this.transformVendorToProfile(v));
        // Phase C: strip Doug-and-David-only fields when caller lacks scope.
        const visible = stripConfidentialFieldsFromVendorList(vendorProfiles, req.user);
        res.json(visible);
      } else {
        res.status(500).json({
          error: 'Failed to retrieve vendors',
          code: 'VENDOR_RETRIEVAL_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      this.logger.error('Failed to list vendors', { error });
      res.status(500).json({
        error: 'Failed to retrieve vendors',
        code: 'VENDOR_RETRIEVAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/vendors/:vendorId
   * Returns a single VendorProfile (unwrapped) for frontend compatibility.
   */
  private async getVendorById(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const vendorId = req.params.vendorId!; // validated by middleware
      const result = await this.dbService.findVendorById(vendorId);

      if (result.success && result.data) {
        const vendorProfile = this.transformVendorToProfile(result.data);
        // Phase C: strip Doug-and-David-only fields when caller lacks scope.
        const visible = stripConfidentialVendorFields(vendorProfile, req.user);
        res.json(visible);
      } else if (result.success && !result.data) {
        res.status(404).json({ error: 'Vendor not found', code: 'VENDOR_NOT_FOUND' });
      } else {
        res.status(500).json({
          error: 'Failed to retrieve vendor',
          code: 'VENDOR_RETRIEVAL_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      this.logger.error('Failed to get vendor', { error, vendorId: req.params.vendorId });
      res.status(500).json({
        error: 'Failed to retrieve vendor',
        code: 'VENDOR_RETRIEVAL_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/vendors
   * Create a new vendor. Returns the created VendorProfile (unwrapped).
   */
  private async createVendor(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const vendorData = {
        ...req.body,
        tenantId: req.user?.tenantId,
        createdBy: req.user?.id,
        status: req.body.status || VendorStatus.ACTIVE,
        licenseState: req.body.licenseState || req.body.serviceAreas?.[0] || 'Unknown',
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const result = await this.dbService.createVendor(vendorData);

      if (result.success && result.data) {
        this.logger.info('Vendor created', { vendorId: result.data.id });
        const profile = this.transformVendorToProfile(result.data);
        res.status(201).json(profile);
      } else {
        res.status(500).json({
          error: 'Vendor creation failed',
          code: 'VENDOR_CREATION_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      this.logger.error('Failed to create vendor', { error });
      res.status(500).json({
        error: 'Vendor creation failed',
        code: 'VENDOR_CREATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * PUT /api/vendors/:vendorId
   * Update a vendor. Returns the updated VendorProfile (unwrapped).
   */
  private async updateVendor(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const vendorId = req.params.vendorId!; // validated by middleware
      const updateData = {
        ...req.body,
        updatedBy: req.user?.id,
        updatedAt: new Date()
      };

      const result = await this.dbService.updateVendor(vendorId, updateData);

      if (result.success && result.data) {
        this.logger.info('Vendor updated', { vendorId });
        const profile = this.transformVendorToProfile(result.data);
        // Phase C: strip Doug-and-David-only fields when caller lacks scope.
        const visible = stripConfidentialVendorFields(profile, req.user);
        res.json(visible);
      } else if (result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json({ error: 'Vendor not found', code: 'VENDOR_NOT_FOUND' });
      } else {
        res.status(500).json({
          error: 'Vendor update failed',
          code: 'VENDOR_UPDATE_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      this.logger.error('Failed to update vendor', { error, vendorId: req.params.vendorId });
      res.status(500).json({
        error: 'Vendor update failed',
        code: 'VENDOR_UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * PATCH /api/vendors/:vendorId/availability
   * Set vendor busy status and/or vacation window.
   */
  private async setVendorAvailability(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const vendorId = req.params.vendorId!; // validated by middleware
      const { isBusy, vacationStartDate, vacationEndDate } = req.body as {
        isBusy?: boolean;
        vacationStartDate?: string;
        vacationEndDate?: string;
      };

      const updateData: Record<string, unknown> = {
        updatedBy: req.user?.id,
        updatedAt: new Date()
      };
      if (isBusy !== undefined) updateData.isBusy = isBusy;
      if (vacationStartDate !== undefined) updateData.vacationStartDate = vacationStartDate;
      if (vacationEndDate !== undefined) updateData.vacationEndDate = vacationEndDate;

      const result = await this.dbService.updateVendor(vendorId, updateData as any);

      if (result.success && result.data) {
        this.logger.info('Vendor availability updated', { vendorId, isBusy, vacationStartDate, vacationEndDate });
        const profile = this.transformVendorToProfile(result.data);
        const visible = stripConfidentialVendorFields(profile, req.user);
        res.json(visible);
      } else if (result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json({ error: 'Vendor not found', code: 'VENDOR_NOT_FOUND' });
      } else {
        res.status(500).json({
          error: 'Availability update failed',
          code: 'AVAILABILITY_UPDATE_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      this.logger.error('Failed to update vendor availability', { error, vendorId: req.params.vendorId });
      res.status(500).json({
        error: 'Availability update failed',
        code: 'AVAILABILITY_UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * PATCH /api/vendors/:vendorId/product-eligibility
   * Replace the full eligibleProductIds list and productGrades for a vendor.
   * This is the canonical write path for the matching engine's hard gate and
   * proficiency bonus.  Sends the complete desired state — not a delta.
   */
  private async setProductEligibility(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const vendorId = req.params.vendorId!;
      const { eligibleProductIds, productGrades } = req.body as {
        eligibleProductIds: string[];
        productGrades: import('../types/index.js').ProductGrade[];
      };

      const result = await this.dbService.updateVendor(vendorId, {
        eligibleProductIds,
        productGrades,
        updatedBy: req.user?.id,
        updatedAt: new Date(),
      } as any);

      if (result.success && result.data) {
        this.logger.info('Vendor product eligibility updated', { vendorId, productCount: eligibleProductIds.length });
        const profile = this.transformVendorToProfile(result.data);
        const visible = stripConfidentialVendorFields(profile, req.user);
        res.json(visible);
      } else if (result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json({ error: 'Vendor not found', code: 'VENDOR_NOT_FOUND' });
      } else {
        res.status(500).json({ error: 'Product eligibility update failed', details: result.error });
      }
    } catch (error) {
      this.logger.error('Failed to update vendor product eligibility', { error, vendorId: req.params.vendorId });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * DELETE /api/vendors/:vendorId
   * Soft-delete a vendor by setting status to INACTIVE.
   */
  private async deleteVendor(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const vendorId = req.params.vendorId!; // validated by middleware

      const result = await this.dbService.updateVendor(vendorId, {
        status: VendorStatus.INACTIVE
      } as any);

      if (result.success) {
        res.json({ success: true, message: 'Vendor deactivated successfully' });
      } else if (result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json({ error: 'Vendor not found', code: 'VENDOR_NOT_FOUND' });
      } else {
        res.status(500).json({
          error: 'Vendor deactivation failed',
          code: 'VENDOR_DELETE_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      this.logger.error('Failed to deactivate vendor', { error, vendorId: req.params.vendorId });
      res.status(500).json({
        error: 'Vendor deactivation failed',
        code: 'VENDOR_DELETE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/vendors/assign/:orderId
   * Assign a vendor to an order. If no vendorId in body, picks best available.
   */
  private async assignVendor(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const orderId = req.params.orderId!; // validated by middleware

      const orderResult = await this.dbService.findOrderById(orderId);
      if (!orderResult.success || !orderResult.data) {
        res.status(404).json({ error: 'Order not found', code: 'ORDER_NOT_FOUND' });
        return;
      }

      // If a specific vendorId was provided, use it; otherwise pick first active
      let selectedVendor: Vendor | undefined;
      if (req.body.vendorId) {
        const vendorResult = await this.dbService.findVendorById(req.body.vendorId);
        if (vendorResult.success && vendorResult.data) {
          selectedVendor = vendorResult.data;
        } else {
          res.status(404).json({ error: 'Specified vendor not found', code: 'VENDOR_NOT_FOUND' });
          return;
        }
      } else {
        const vendorsResult = await this.dbService.findAllVendors();
        if (vendorsResult.success && vendorsResult.data && vendorsResult.data.length > 0) {
          // Simple assignment: first active vendor. The auto-assignment controller
          // provides the sophisticated multi-factor scoring.
          selectedVendor = vendorsResult.data.find(v =>
            v.status === VendorStatus.ACTIVE || v.status === ('active' as any)
          ) || vendorsResult.data[0];
        }
      }

      if (!selectedVendor) {
        res.status(404).json({ error: 'No available vendors', code: 'NO_VENDORS_AVAILABLE' });
        return;
      }

      const updateResult = await this.dbService.updateOrder(orderId, {
        vendorId: selectedVendor.id,
        status: OrderStatus.ASSIGNED
      } as any);

      if (updateResult.success) {
        res.json({
          orderId,
          assignedVendor: this.transformVendorToProfile(selectedVendor),
          assignmentScore: 95.5,
          assignedAt: new Date()
        });
      } else {
        res.status(500).json({
          error: 'Failed to assign vendor',
          code: 'VENDOR_ASSIGNMENT_ERROR',
          details: updateResult.error
        });
      }
    } catch (error) {
      this.logger.error('Failed to assign vendor', { error, orderId: req.params.orderId });
      res.status(500).json({
        error: 'Vendor assignment failed',
        code: 'VENDOR_ASSIGNMENT_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/vendors/performance/:vendorId
   * Returns vendor performance data.
   */
  private async getVendorPerformance(req: UnifiedAuthRequest, res: Response): Promise<void> {
    try {
      const vendorId = req.params.vendorId!; // validated by middleware
      const result = await this.dbService.getVendorPerformance(vendorId);

      if (result.success) {
        res.json(result.data);
      } else {
        res.status(500).json({
          error: 'Failed to retrieve vendor performance',
          code: 'VENDOR_PERFORMANCE_ERROR',
          details: result.error
        });
      }
    } catch (error) {
      this.logger.error('Failed to get vendor performance', { error, vendorId: req.params.vendorId });
      res.status(500).json({
        error: 'Failed to retrieve vendor performance',
        code: 'VENDOR_PERFORMANCE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Transform: backend Vendor → frontend VendorProfile
  // ---------------------------------------------------------------------------

  private transformVendorToProfile(vendor: any): any {
    return {
      id: vendor.id,
      vendorCode: vendor.licenseNumber || vendor.id,
      tenantId: vendor.tenantId || 'tenant-001',

      // Business information
      businessName: vendor.businessName || vendor.name,
      businessType: vendor.businessType || 'INDIVIDUAL',
      contactPerson: vendor.contactPerson || vendor.name,
      email: vendor.email,
      phone: vendor.phone,

      // Address
      address: vendor.address || vendor.serviceAreas?.[0]?.state || '',
      city: vendor.city || vendor.serviceAreas?.[0]?.counties?.[0] || '',
      state: vendor.state || vendor.licenseState,
      zipCode: vendor.zipCode || vendor.serviceAreas?.[0]?.zipCodes?.[0] || '',

      // Licensing
      stateLicense: vendor.licenseNumber,
      licenseExpiration: vendor.licenseExpiry,

      // Service capabilities
      serviceTypes: vendor.productTypes || vendor.serviceTypes || [],
      serviceAreas: vendor.serviceAreas || [],
      maxActiveOrders: vendor.preferences?.maxOrdersPerDay || vendor.maxActiveOrders || 10,
      averageTurnaroundDays: vendor.averageTurnaroundDays || Math.round((vendor.performance?.averageTurnTime || 96) / 24),

      // Status and performance
      status: vendor.status?.toUpperCase() || 'ACTIVE',
      onboardedAt: vendor.onboardingDate || vendor.onboardedAt,
      lastActiveAt: vendor.lastActive || vendor.lastActiveAt,
      currentActiveOrders: vendor.currentActiveOrders || 0,

      // Performance metrics
      totalOrdersCompleted: vendor.performance?.totalOrders || vendor.totalOrdersCompleted || 0,
      averageQCScore: vendor.performance?.qualityScore
        ? vendor.performance.qualityScore * 20
        : (vendor.averageQCScore || 0),
      onTimeDeliveryRate: vendor.performance?.onTimeDeliveryRate || vendor.onTimeDeliveryRate || 0,
      revisionRate: vendor.performance?.revisionRate || vendor.revisionRate || 0,
      clientSatisfactionScore: vendor.performance?.clientSatisfactionScore || vendor.clientSatisfactionScore || 0,
      performanceScore: vendor.performance?.qualityScore
        ? vendor.performance.qualityScore * 20
        : (vendor.performanceScore || 0),

      // Financial
      standardFee: vendor.standardFee || 550,
      rushFee: vendor.rushFee || 150,
      paymentTerms: vendor.paymentTerms || (vendor.paymentInfo?.method === 'ach' ? 'Net 30' : 'Net 15'),

      // Metadata
      createdAt: vendor.createdAt || vendor.onboardingDate,
      createdBy: vendor.createdBy || 'system',
      updatedAt: vendor.updatedAt || vendor.lastActive,
      updatedBy: vendor.updatedBy || 'system',

      // Availability
      isBusy: vendor.isBusy ?? false,
      vacationStartDate: vendor.vacationStartDate ?? null,
      vacationEndDate: vendor.vacationEndDate ?? null,

      // Phase 1.5.5 — staff classification
      staffType: vendor.staffType,
      staffRole: vendor.staffRole,
      maxConcurrentOrders: vendor.maxConcurrentOrders,
      activeOrderCount: vendor.activeOrderCount,

      // Increment 1 — workload visibility & intelligent assignment
      workSchedule: vendor.workSchedule,
      geographicCoverage: vendor.geographicCoverage,
      capabilities: vendor.capabilities,
      eligibleProductIds: vendor.eligibleProductIds,
      productGrades: vendor.productGrades
    };
  }
}