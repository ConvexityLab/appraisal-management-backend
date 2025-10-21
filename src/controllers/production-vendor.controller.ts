/**
 * Production Vendor Management Controller
 * Streamlined controller using the proven CosmosDbService for vendor CRUD operations
 */

import { Request, Response } from 'express';
import { CosmosDbService } from '../services/cosmos-db.service';
import { Logger } from '../utils/logger';
import { 
  Vendor, 
  VendorStatus,
  VendorPerformance 
} from '../types/index';

export class ProductionVendorController {
  private dbService: CosmosDbService;
  private logger: Logger;

  constructor(dbService: CosmosDbService) {
    this.dbService = dbService;
    this.logger = new Logger();
  }

  /**
   * POST /api/vendors - Create a new vendor
   */
  createVendor = async (req: Request, res: Response): Promise<void> => {
    try {
      const vendorData = {
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: req.body.status || VendorStatus.ACTIVE
      };

      this.logger.info('Creating new vendor', { vendorData: { id: vendorData.id, companyName: vendorData.companyName } });

      const result = await this.dbService.createVendor(vendorData);

      if (result.success && result.data) {
        res.status(201).json({
          success: true,
          data: result.data,
          message: 'Vendor created successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Vendor creation failed'
        });
      }
    } catch (error) {
      this.logger.error('Failed to create vendor', { error });
      res.status(500).json({
        success: false,
        error: 'Vendor creation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * GET /api/vendors/:id - Get vendor by ID
   */
  getVendor = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Vendor ID is required'
        });
        return;
      }

      this.logger.info('Retrieving vendor', { vendorId: id });

      const result = await this.dbService.findVendorById(id);

      if (result.success && result.data) {
        res.json({
          success: true,
          data: result.data
        });
      } else if (result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: 'Vendor not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to retrieve vendor'
        });
      }
    } catch (error) {
      this.logger.error('Failed to retrieve vendor', { error, vendorId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve vendor',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * PUT /api/vendors/:id - Update vendor
   */
  updateVendor = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Vendor ID is required'
        });
        return;
      }

      const updateData = {
        ...req.body,
        updatedAt: new Date()
      };

      this.logger.info('Updating vendor', { vendorId: id, updates: Object.keys(updateData) });

      const result = await this.dbService.updateVendor(id, updateData);

      if (result.success && result.data) {
        res.json({
          success: true,
          data: result.data,
          message: 'Vendor updated successfully'
        });
      } else if (result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: 'Vendor not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Vendor update failed'
        });
      }
    } catch (error) {
      this.logger.error('Failed to update vendor', { error, vendorId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Vendor update failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * DELETE /api/vendors/:id - Delete vendor (soft delete by updating status)
   */
  deleteVendor = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Vendor ID is required'
        });
        return;
      }

      this.logger.info('Deactivating vendor', { vendorId: id });

      // Soft delete by setting status to inactive
      const result = await this.dbService.updateVendor(id, { 
        status: VendorStatus.INACTIVE
      });

      if (result.success) {
        res.json({
          success: true,
          message: 'Vendor deactivated successfully'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Vendor deactivation failed'
        });
      }
    } catch (error) {
      this.logger.error('Failed to deactivate vendor', { error, vendorId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Vendor deactivation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * GET /api/vendors - List vendors with optional filters
   */
  getVendors = async (req: Request, res: Response): Promise<void> => {
    try {
      const { status, licenseState, specialty, offset = 0, limit = 50 } = req.query;

      const filters: any = {};
      if (status) filters.status = status;
      if (licenseState) filters.licenseState = licenseState;
      if (specialty) filters.specialties = Array.isArray(specialty) ? specialty : [specialty];

      this.logger.info('Listing vendors', { filters, offset, limit });

      const result = await this.dbService.findAllVendors();

      if (result.success) {
        res.json({
          success: true,
          data: result.data || [],
          metadata: {
            total: result.data?.length || 0,
            offset: Number(offset),
            limit: Number(limit)
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to retrieve vendors'
        });
      }
    } catch (error) {
      this.logger.error('Failed to list vendors', { error });
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve vendors',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  /**
   * GET /api/vendors/:id/performance - Get vendor performance metrics
   */
  getVendorPerformance = async (req: Request, res: Response): Promise<void> => {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Vendor ID is required'
        });
        return;
      }

      this.logger.info('Getting vendor performance', { vendorId: id });

      const result = await this.dbService.getVendorPerformance(id);

      if (result.success && result.data) {
        res.json({
          success: true,
          data: result.data
        });
      } else if (result.error?.code === 'VENDOR_NOT_FOUND') {
        res.status(404).json({
          success: false,
          error: 'Vendor not found'
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error || 'Failed to get performance data'
        });
      }
    } catch (error) {
      this.logger.error('Failed to get vendor performance', { error, vendorId: req.params.id });
      res.status(500).json({
        success: false,
        error: 'Failed to get performance data',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
}