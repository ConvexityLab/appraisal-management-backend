import { Vendor, AppraisalOrder, ApiResponse, VendorStatus, VendorPerformance } from '../types/index.js';
import { DatabaseService } from './database.service.js';
import { Logger } from '../utils/logger.js';

// Generate UUID replacement
function generateUUID(): string {
  return 'vendor-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

export class VendorManagementService {
  private db: DatabaseService;
  private logger: Logger;

  constructor(db: DatabaseService) {
    this.db = db;
    this.logger = new Logger();
  }

  async checkVendorAvailability(vendorId: string, orderId: string): Promise<ApiResponse<boolean>> {
    try {
      const vendor = await this.db.vendors.findById(vendorId);
      
      if (!vendor) {
        return {
          success: false,
          error: {
            code: 'VENDOR_NOT_FOUND',
            message: 'Vendor not found',
            timestamp: new Date()
          }
        };
      }

      if (vendor.status !== VendorStatus.ACTIVE) {
        return {
          success: false,
          error: {
            code: 'VENDOR_NOT_ACTIVE',
            message: 'Vendor is not active',
            timestamp: new Date()
          }
        };
      }

      return {
        success: true,
        data: true
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'VENDOR_CHECK_FAILED',
          message: 'Failed to check vendor availability',
          timestamp: new Date()
        }
      };
    }
  }

  async findBestVendorForOrder(order: AppraisalOrder): Promise<ApiResponse<Vendor>> {
    try {
      // This is a simplified implementation
      // In reality, this would use complex algorithms to find the best vendor
      const { vendors } = await this.db.vendors.findMany({}, 0, 10);
      
      if (vendors.length === 0) {
        return {
          success: false,
          error: {
            code: 'NO_VENDORS_AVAILABLE',
            message: 'No vendors available',
            timestamp: new Date()
          }
        };
      }

      // For now, return the first active vendor
      const activeVendor = vendors.find(v => v.status === VendorStatus.ACTIVE);
      
      if (!activeVendor) {
        return {
          success: false,
          error: {
            code: 'NO_ACTIVE_VENDORS',
            message: 'No active vendors available',
            timestamp: new Date()
          }
        };
      }

      return {
        success: true,
        data: activeVendor
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'VENDOR_SEARCH_FAILED',
          message: 'Failed to find vendor for order',
          timestamp: new Date()
        }
      };
    }
  }

  async updateVendorPerformance(vendorId: string, order: AppraisalOrder): Promise<void> {
    try {
      const vendor = await this.db.vendors.findById(vendorId);
      if (!vendor) return;

      // Update performance metrics
      const performance = vendor.performance;
      performance.totalOrders += 1;
      performance.completedOrders += 1;
      performance.lastUpdated = new Date();

      // Calculate turn time
      const turnTime = (order.updatedAt.getTime() - order.createdAt.getTime()) / (1000 * 60 * 60); // hours
      performance.averageTurnTime = ((performance.averageTurnTime * (performance.totalOrders - 1)) + turnTime) / performance.totalOrders;

      const updatedVendor = {
        ...vendor,
        performance
      };

      await this.db.vendors.update(vendorId, updatedVendor);
    } catch (error) {
      console.error('Error updating vendor performance:', error);
    }
  }

  /**
   * Create a new vendor
   */
  async createVendor(vendorData: Omit<Vendor, 'id' | 'onboardingDate' | 'lastActive'>): Promise<ApiResponse<Vendor>> {
    try {
      const vendorId = generateUUID();
      const now = new Date();

      const vendor: Vendor = {
        ...vendorData,
        id: vendorId,
        onboardingDate: now,
        lastActive: now,
        status: vendorData.status || VendorStatus.PENDING_APPROVAL,
        performance: vendorData.performance || {
          totalOrders: 0,
          completedOrders: 0,
          averageTurnTime: 0,
          revisionRate: 0,
          onTimeDeliveryRate: 0,
          qualityScore: 0,
          clientSatisfactionScore: 0,
          lastUpdated: now
        }
      };

      // Save to database
      const createdVendor = await this.db.vendors.create(vendor);

      this.logger.info('Vendor created successfully', { vendorId, name: vendor.name });

      return {
        success: true,
        data: createdVendor
      };
    } catch (error) {
      this.logger.error('Error creating vendor', { error, vendorData });
      return {
        success: false,
        error: {
          code: 'VENDOR_CREATION_FAILED',
          message: 'Failed to create vendor',
          details: { error: error instanceof Error ? error.message : String(error) },
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Get vendor by ID
   */
  async getVendorById(vendorId: string): Promise<ApiResponse<Vendor>> {
    try {
      const vendor = await this.db.vendors.findById(vendorId);
      
      if (!vendor) {
        return {
          success: false,
          error: {
            code: 'VENDOR_NOT_FOUND',
            message: 'Vendor not found',
            timestamp: new Date()
          }
        };
      }

      return {
        success: true,
        data: vendor
      };
    } catch (error) {
      this.logger.error('Error fetching vendor', { error, vendorId });
      return {
        success: false,
        error: {
          code: 'VENDOR_FETCH_FAILED',
          message: 'Failed to fetch vendor',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Get vendors with filtering and pagination
   */
  async getVendors(
    filters: any = {},
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<Vendor[]>> {
    try {
      const offset = (page - 1) * limit;
      const result = await this.db.vendors.findMany(filters, offset, limit);

      return {
        success: true,
        data: result.vendors,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
          hasNext: page * limit < result.total,
          hasPrev: page > 1
        }
      };
    } catch (error) {
      this.logger.error('Error fetching vendors', { error, filters });
      return {
        success: false,
        error: {
          code: 'VENDORS_FETCH_FAILED',
          message: 'Failed to fetch vendors',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Update an existing vendor
   */
  async updateVendor(vendorId: string, updateData: Partial<Vendor>, userId: string): Promise<ApiResponse<Vendor>> {
    try {
      const existingVendor = await this.db.vendors.findById(vendorId);
      if (!existingVendor) {
        return {
          success: false,
          error: {
            code: 'VENDOR_NOT_FOUND',
            message: 'Vendor not found',
            timestamp: new Date()
          }
        };
      }

      const updatedVendor = {
        ...existingVendor,
        ...updateData,
        lastActive: new Date()
      };

      await this.db.vendors.update(vendorId, updatedVendor);

      this.logger.info('Vendor updated successfully', { vendorId, changes: Object.keys(updateData) });

      return {
        success: true,
        data: updatedVendor
      };
    } catch (error) {
      this.logger.error('Error updating vendor', { error, vendorId, updateData });
      return {
        success: false,
        error: {
          code: 'VENDOR_UPDATE_FAILED',
          message: 'Failed to update vendor',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Deactivate a vendor
   */
  async deactivateVendor(vendorId: string, reason: string, userId: string): Promise<ApiResponse<Vendor>> {
    try {
      const existingVendor = await this.db.vendors.findById(vendorId);
      if (!existingVendor) {
        return {
          success: false,
          error: {
            code: 'VENDOR_NOT_FOUND',
            message: 'Vendor not found',
            timestamp: new Date()
          }
        };
      }

      const updatedVendor = {
        ...existingVendor,
        status: VendorStatus.INACTIVE,
        lastActive: new Date()
      };

      await this.db.vendors.update(vendorId, updatedVendor);

      this.logger.info('Vendor deactivated', { vendorId, reason, userId });

      return {
        success: true,
        data: updatedVendor
      };
    } catch (error) {
      this.logger.error('Error deactivating vendor', { error, vendorId, reason });
      return {
        success: false,
        error: {
          code: 'VENDOR_DEACTIVATION_FAILED',
          message: 'Failed to deactivate vendor',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Update vendor status
   */
  async updateVendorStatus(vendorId: string, status: VendorStatus, reason: string, userId: string): Promise<ApiResponse<Vendor>> {
    try {
      const existingVendor = await this.db.vendors.findById(vendorId);
      if (!existingVendor) {
        return {
          success: false,
          error: {
            code: 'VENDOR_NOT_FOUND',
            message: 'Vendor not found',
            timestamp: new Date()
          }
        };
      }

      const updatedVendor = {
        ...existingVendor,
        status,
        lastActive: new Date()
      };

      await this.db.vendors.update(vendorId, updatedVendor);

      this.logger.info('Vendor status updated', { vendorId, oldStatus: existingVendor.status, newStatus: status, reason, userId });

      return {
        success: true,
        data: updatedVendor
      };
    } catch (error) {
      this.logger.error('Error updating vendor status', { error, vendorId, status });
      return {
        success: false,
        error: {
          code: 'VENDOR_STATUS_UPDATE_FAILED',
          message: 'Failed to update vendor status',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Get vendor performance metrics
   */
  async getVendorPerformance(vendorId: string, startDate?: Date, endDate?: Date): Promise<ApiResponse<VendorPerformance>> {
    try {
      const vendor = await this.db.vendors.findById(vendorId);
      if (!vendor) {
        return {
          success: false,
          error: {
            code: 'VENDOR_NOT_FOUND',
            message: 'Vendor not found',
            timestamp: new Date()
          }
        };
      }

      // In a real implementation, this would calculate performance metrics
      // based on the date range and order history
      const performance = vendor.performance;

      return {
        success: true,
        data: performance
      };
    } catch (error) {
      this.logger.error('Error fetching vendor performance', { error, vendorId });
      return {
        success: false,
        error: {
          code: 'VENDOR_PERFORMANCE_FETCH_FAILED',
          message: 'Failed to fetch vendor performance',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Update vendor performance metrics
   */
  async updateVendorPerformanceMetrics(vendorId: string, performanceData: Partial<VendorPerformance>, userId: string): Promise<ApiResponse<VendorPerformance>> {
    try {
      const existingVendor = await this.db.vendors.findById(vendorId);
      if (!existingVendor) {
        return {
          success: false,
          error: {
            code: 'VENDOR_NOT_FOUND',
            message: 'Vendor not found',
            timestamp: new Date()
          }
        };
      }

      const updatedPerformance = {
        ...existingVendor.performance,
        ...performanceData,
        lastUpdated: new Date()
      };

      const updatedVendor = {
        ...existingVendor,
        performance: updatedPerformance,
        lastActive: new Date()
      };

      await this.db.vendors.update(vendorId, updatedVendor);

      this.logger.info('Vendor performance updated', { vendorId, changes: Object.keys(performanceData), userId });

      return {
        success: true,
        data: updatedPerformance
      };
    } catch (error) {
      this.logger.error('Error updating vendor performance', { error, vendorId, performanceData });
      return {
        success: false,
        error: {
          code: 'VENDOR_PERFORMANCE_UPDATE_FAILED',
          message: 'Failed to update vendor performance',
          timestamp: new Date()
        }
      };
    }
  }

  /**
   * Search vendors with advanced criteria
   */
  async searchVendors(searchCriteria: any, page: number = 1, limit: number = 20): Promise<ApiResponse<Vendor[]>> {
    try {
      // This would implement advanced search logic in a real database
      // For now, we'll use the basic getVendors method with filters
      return await this.getVendors(searchCriteria, page, limit);
    } catch (error) {
      this.logger.error('Error searching vendors', { error, searchCriteria });
      return {
        success: false,
        error: {
          code: 'VENDOR_SEARCH_FAILED',
          message: 'Failed to search vendors',
          timestamp: new Date()
        }
      };
    }
  }
}