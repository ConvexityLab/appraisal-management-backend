import express, { Request, Response, NextFunction } from 'express';
import { VendorManagementService } from '../services/vendor-management.service.js';
import { DatabaseService } from '../services/database.service.js';
import { AuditService } from '../services/audit.service.js';
import { Logger } from '../utils/logger.js';
import { 
  Vendor, 
  VendorStatus, 
  ProductType, 
  ApiResponse,
  VendorPerformance,
  ServiceArea,
  Certification,
  Specialty
} from '../types/index.js';

/**
 * Vendor Management API Controller
 * Provides comprehensive CRUD operations for vendor management
 */
export class VendorController {
  private vendorService: VendorManagementService;
  private logger: Logger;

  constructor() {
    // Initialize service dependencies
    const db = new DatabaseService();
    const auditService = new AuditService();
    this.logger = new Logger();

    // Initialize vendor management service
    this.vendorService = new VendorManagementService();

    // Bind methods to preserve 'this' context
    this.createVendor = this.createVendor.bind(this);
    this.getVendor = this.getVendor.bind(this);
    this.updateVendor = this.updateVendor.bind(this);
    this.deleteVendor = this.deleteVendor.bind(this);
    this.getVendors = this.getVendors.bind(this);
    this.updateVendorStatus = this.updateVendorStatus.bind(this);
    this.getVendorPerformance = this.getVendorPerformance.bind(this);
    this.updateVendorPerformance = this.updateVendorPerformance.bind(this);
    this.searchVendors = this.searchVendors.bind(this);
  }

  /**
   * POST /api/vendors - Create a new vendor
   */
  async createVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      this.logger.info('Creating new vendor', { 
        name: req.body.name,
        email: req.body.email 
      });

      // Validate required fields
      const validation = this.validateVendorData(req.body);
      if (!validation.isValid) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid vendor data provided',
            details: validation.errors,
            timestamp: new Date()
          }
        });
        return;
      }

      // Create vendor through service
      const result = await this.vendorService.createVendor(req.body);

      if (result.success && result.data) {
        this.logger.info('Vendor created successfully', { vendorId: result.data.id });
        res.status(201).json(result);
      } else {
        this.logger.error('Failed to create vendor', { error: result.error });
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in createVendor endpoint', { error });
      next(error);
    }
  }

  /**
   * GET /api/vendors/:id - Get vendor by ID
   */
  async getVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.id;
      
      if (!vendorId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Vendor ID is required',
            timestamp: new Date()
          }
        });
        return;
      }
      
      this.logger.info('Retrieving vendor', { vendorId });

      const result = await this.vendorService.getVendorById(vendorId);

      if (result.success && result.data) {
        res.json(result);
      } else if (result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in getVendor endpoint', { error, vendorId: req.params.id });
      next(error);
    }
  }

  /**
   * PUT /api/vendors/:id - Update an existing vendor
   */
  async updateVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.id;
      const userId = req.headers['x-user-id'] as string || 'api-user';
      
      if (!vendorId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Vendor ID is required',
            timestamp: new Date()
          }
        });
        return;
      }
      
      this.logger.info('Updating vendor', { vendorId, userId });

      const result = await this.vendorService.updateVendor(vendorId, req.body, userId);

      if (result.success && result.data) {
        res.json(result);
      } else if (result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in updateVendor endpoint', { error, vendorId: req.params.id });
      next(error);
    }
  }

  /**
   * DELETE /api/vendors/:id - Delete/deactivate a vendor
   */
  async deleteVendor(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.id;
      const userId = req.headers['x-user-id'] as string || 'api-user';
      const reason = req.body.reason || 'Vendor deactivated via API';
      
      if (!vendorId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Vendor ID is required',
            timestamp: new Date()
          }
        });
        return;
      }
      
      this.logger.info('Deactivating vendor', { vendorId, userId, reason });

      const result = await this.vendorService.deactivateVendor(vendorId, reason, userId);

      if (result.success && result.data) {
        res.json(result);
      } else if (result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in deleteVendor endpoint', { error, vendorId: req.params.id });
      next(error);
    }
  }

  /**
   * GET /api/vendors - Get vendors with filtering and pagination
   */
  async getVendors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      // Build filters from query parameters
      const filters: any = {};
      if (req.query.status) filters.status = req.query.status;
      if (req.query.state) filters.state = req.query.state;
      if (req.query.productType) filters.productType = req.query.productType;
      if (req.query.specialty) filters.specialty = req.query.specialty;
      if (req.query.minQualityScore) filters.minQualityScore = parseFloat(req.query.minQualityScore as string);
      
      this.logger.info('Retrieving vendors with filters', { filters, page, limit });

      const result = await this.vendorService.getVendors(filters, page, limit);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in getVendors endpoint', { error });
      next(error);
    }
  }

  /**
   * PATCH /api/vendors/:id/status - Update vendor status
   */
  async updateVendorStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.id;
      const { status, reason } = req.body;
      const userId = req.headers['x-user-id'] as string || 'api-user';
      
      if (!vendorId || !status) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Vendor ID and status are required',
            timestamp: new Date()
          }
        });
        return;
      }
      
      this.logger.info('Updating vendor status', { vendorId, status, reason, userId });

      const result = await this.vendorService.updateVendorStatus(vendorId, status, reason, userId);

      if (result.success && result.data) {
        res.json(result);
      } else if (result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in updateVendorStatus endpoint', { error, vendorId: req.params.id });
      next(error);
    }
  }

  /**
   * GET /api/vendors/:id/performance - Get vendor performance metrics
   */
  async getVendorPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.id;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      if (!vendorId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Vendor ID is required',
            timestamp: new Date()
          }
        });
        return;
      }
      
      this.logger.info('Retrieving vendor performance', { vendorId, startDate, endDate });

      const result = await this.vendorService.getVendorPerformance(vendorId, startDate, endDate);

      if (result.success && result.data) {
        res.json(result);
      } else if (result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in getVendorPerformance endpoint', { error, vendorId: req.params.id });
      next(error);
    }
  }

  /**
   * PUT /api/vendors/:id/performance - Update vendor performance metrics
   */
  async updateVendorPerformance(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const vendorId = req.params.id;
      const performanceData = req.body;
      const userId = req.headers['x-user-id'] as string || 'api-user';
      
      if (!vendorId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Vendor ID is required',
            timestamp: new Date()
          }
        });
        return;
      }
      
      this.logger.info('Updating vendor performance', { vendorId, userId });

      const result = await this.vendorService.updateVendorPerformanceMetrics(vendorId, performanceData, userId);

      if (result.success && result.data) {
        res.json(result);
      } else if (result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in updateVendorPerformance endpoint', { error, vendorId: req.params.id });
      next(error);
    }
  }

  /**
   * GET /api/vendors/search - Advanced vendor search
   */
  async searchVendors(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const searchCriteria = {
        name: req.query.name as string,
        email: req.query.email as string,
        licenseNumber: req.query.licenseNumber as string,
        state: req.query.state as string,
        city: req.query.city as string,
        productTypes: req.query.productTypes ? (req.query.productTypes as string).split(',') : undefined,
        specialties: req.query.specialties ? (req.query.specialties as string).split(',') : undefined,
        minQualityScore: req.query.minQualityScore ? parseFloat(req.query.minQualityScore as string) : undefined,
        maxDistance: req.query.maxDistance ? parseInt(req.query.maxDistance as string) : undefined,
        availableOnly: req.query.availableOnly === 'true'
      };

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      this.logger.info('Searching vendors', { searchCriteria, page, limit });

      const result = await this.vendorService.searchVendors(searchCriteria, page, limit);

      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (error) {
      this.logger.error('Error in searchVendors endpoint', { error });
      next(error);
    }
  }

  /**
   * Validate vendor data before creation/update
   */
  private validateVendorData(data: any): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Required fields validation
    if (!data.name || typeof data.name !== 'string') {
      errors.push('Vendor name is required and must be a string');
    }

    if (!data.email || typeof data.email !== 'string') {
      errors.push('Vendor email is required and must be a string');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      errors.push('Vendor email must be a valid email address');
    }

    if (!data.phone || typeof data.phone !== 'string') {
      errors.push('Vendor phone is required and must be a string');
    }

    if (!data.licenseNumber || typeof data.licenseNumber !== 'string') {
      errors.push('License number is required and must be a string');
    }

    if (!data.licenseState || typeof data.licenseState !== 'string') {
      errors.push('License state is required and must be a string');
    }

    if (!data.licenseExpiry) {
      errors.push('License expiry date is required');
    } else {
      const expiryDate = new Date(data.licenseExpiry);
      if (isNaN(expiryDate.getTime())) {
        errors.push('License expiry must be a valid date');
      } else if (expiryDate <= new Date()) {
        errors.push('License expiry date must be in the future');
      }
    }

    // Optional field validation
    if (data.serviceAreas && !Array.isArray(data.serviceAreas)) {
      errors.push('Service areas must be an array');
    }

    if (data.productTypes && !Array.isArray(data.productTypes)) {
      errors.push('Product types must be an array');
    }

    if (data.specialties && !Array.isArray(data.specialties)) {
      errors.push('Specialties must be an array');
    }

    if (data.certifications && !Array.isArray(data.certifications)) {
      errors.push('Certifications must be an array');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Create Express router with vendor management endpoints
 */
export function createVendorRouter(): express.Router {
  const router = express.Router();
  const controller = new VendorController();

  // Vendor CRUD operations
  router.post('/', controller.createVendor);
  router.get('/search', controller.searchVendors); // Must come before /:id route
  router.get('/', controller.getVendors);
  router.get('/:id', controller.getVendor);
  router.put('/:id', controller.updateVendor);
  router.delete('/:id', controller.deleteVendor);

  // Vendor-specific operations
  router.patch('/:id/status', controller.updateVendorStatus);
  router.get('/:id/performance', controller.getVendorPerformance);
  router.put('/:id/performance', controller.updateVendorPerformance);

  return router;
}

export default VendorController;