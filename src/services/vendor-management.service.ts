import { Vendor, AppraisalOrder, ApiResponse, VendorStatus } from '../types/index.js';
import { DatabaseService } from './database.service.js';

export class VendorManagementService {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
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
}