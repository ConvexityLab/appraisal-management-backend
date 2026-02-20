/**
 * Vendor Management Service
 * Core vendor management functionality backed by CosmosDbService.
 * Used by order-management.service.ts and enhanced-order.controller.ts
 * for vendor availability checks, matching, and performance tracking.
 */

import { Vendor, AppraisalOrder, VendorStatus, OrderStatus } from '../types/index.js';
import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';

export interface VendorSearchResult {
  vendors: Vendor[];
  total: number;
  page: number;
  limit: number;
}

export class VendorManagementService {
  private logger: Logger;
  private dbService: CosmosDbService;

  constructor(dbService?: CosmosDbService) {
    this.logger = new Logger('VendorManagementService');
    // Accept injected instance or create one (for backward compat with `new VendorManagementService()`)
    this.dbService = dbService || new CosmosDbService();
  }

  /**
   * Find vendors available for an order based on state, product type, and status.
   */
  async findAvailableVendors(order: AppraisalOrder): Promise<Vendor[]> {
    try {
      const result = await this.dbService.findAllVendors();
      if (!result.success || !result.data) {
        this.logger.warn('Failed to fetch vendors from Cosmos', { error: result.error });
        return [];
      }

      const availableVendors = result.data.filter(vendor => {
        if (vendor.status !== VendorStatus.ACTIVE && vendor.status !== ('active' as any)) {
          return false;
        }

        const orderState = order.propertyAddress?.state;
        if (orderState && vendor.serviceAreas && !vendor.serviceAreas.some(area => area.state === orderState)) {
          return false;
        }

        if (order.productType && vendor.productTypes && !vendor.productTypes.includes(order.productType)) {
          return false;
        }

        return true;
      });

      this.logger.info(`Found ${availableVendors.length} available vendors for order ${order.id}`);
      return availableVendors;
    } catch (error) {
      this.logger.error('Error finding available vendors', { error, orderId: order.id });
      return [];
    }
  }

  /**
   * Get vendor by ID from Cosmos.
   */
  async getVendorById(vendorId: string): Promise<{ success: boolean; data?: Vendor | null; error?: any }> {
    try {
      const result = await this.dbService.findVendorById(vendorId);
      return {
        success: result.success,
        ...(result.data !== undefined ? { data: result.data } : {}),
        ...(result.error !== undefined ? { error: result.error } : {})
      };
    } catch (error) {
      this.logger.error('Error getting vendor by ID', { error, vendorId });
      return {
        success: false,
        error: { code: 'RETRIEVAL_ERROR', message: 'Error retrieving vendor' }
      };
    }
  }

  /**
   * Check if a vendor is available to take an order.
   */
  async checkVendorAvailability(vendorId: string, orderId: string): Promise<boolean> {
    try {
      const result = await this.dbService.findVendorById(vendorId);
      if (!result.success || !result.data) {
        this.logger.warn(`Vendor not found for availability check: ${vendorId}`);
        return false;
      }

      const vendor = result.data;
      const isActive = vendor.status === VendorStatus.ACTIVE || vendor.status === ('active' as any);
      if (!isActive) {
        this.logger.info(`Vendor ${vendorId} is not active`, { status: vendor.status });
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error('Error checking vendor availability', { error, vendorId, orderId });
      return false;
    }
  }

  /**
   * Find the best vendor for an order (simple scoring: active + matching state).
   * For sophisticated multi-factor scoring, use VendorMatchingService via auto-assignment routes.
   */
  async findBestVendorForOrder(order: AppraisalOrder): Promise<Vendor | null> {
    try {
      const available = await this.findAvailableVendors(order);
      if (available.length === 0) {
        return null;
      }

      // Simple scoring: prefer vendors with higher quality scores
      const sorted = available.sort((a, b) => {
        const scoreA = a.performance?.qualityScore || 0;
        const scoreB = b.performance?.qualityScore || 0;
        return scoreB - scoreA;
      });

      return sorted[0] ?? null;
    } catch (error) {
      this.logger.error('Error finding best vendor for order', { error, orderId: order.id });
      return null;
    }
  }

  /**
   * Assign an order to a vendor. Updates the order record in Cosmos.
   */
  async assignOrderToVendor(vendorId: string, orderId: string): Promise<boolean> {
    try {
      const vendorResult = await this.dbService.findVendorById(vendorId);
      if (!vendorResult.success || !vendorResult.data) {
        this.logger.warn(`Cannot assign order to non-existent vendor: ${vendorId}`);
        return false;
      }

      if (vendorResult.data.status !== VendorStatus.ACTIVE && vendorResult.data.status !== ('active' as any)) {
        this.logger.warn(`Cannot assign order to inactive vendor: ${vendorId}`);
        return false;
      }

      const updateResult = await this.dbService.updateOrder(orderId, {
        assignedVendorId: vendorId,
        status: OrderStatus.ASSIGNED
      } as any);

      if (updateResult.success) {
        this.logger.info(`Assigned order ${orderId} to vendor ${vendorId}`);
        return true;
      }

      this.logger.error(`Failed to update order for assignment`, { orderId, vendorId, error: updateResult.error });
      return false;
    } catch (error) {
      this.logger.error('Error assigning order to vendor', { error, vendorId, orderId });
      return false;
    }
  }

  /**
   * Update vendor performance metrics after an order is completed.
   */
  async updateVendorPerformance(vendorId: string, order: AppraisalOrder): Promise<void> {
    try {
      const vendorResult = await this.dbService.findVendorById(vendorId);
      if (!vendorResult.success || !vendorResult.data) {
        this.logger.warn(`Cannot update performance for non-existent vendor: ${vendorId}`);
        return;
      }

      const vendor = vendorResult.data;
      const currentPerformance = vendor.performance || {
        totalOrders: 0,
        completedOrders: 0,
        qualityScore: 0,
        onTimeDeliveryRate: 0,
        revisionRate: 0,
        clientSatisfactionScore: 0,
        averageTurnTime: 0
      };

      // Increment completed orders
      const updatedPerformance = {
        ...currentPerformance,
        completedOrders: (currentPerformance.completedOrders || 0) + 1
      };

      await this.dbService.updateVendor(vendorId, {
        performance: updatedPerformance,
        lastActive: new Date()
      });

      this.logger.info(`Updated vendor ${vendorId} performance`, {
        completedOrders: updatedPerformance.completedOrders
      });
    } catch (error) {
      this.logger.error('Error updating vendor performance', { error, vendorId, orderId: order.id });
    }
  }

  /**
   * Get vendor statistics across all vendors.
   */
  async getVendorStats(): Promise<{
    totalVendors: number;
    activeVendors: number;
    averageQCScore: number;
    averageOnTimeRate: number;
    totalActiveOrders: number;
  }> {
    try {
      const result = await this.dbService.findAllVendors();
      if (!result.success || !result.data) {
        return { totalVendors: 0, activeVendors: 0, averageQCScore: 0, averageOnTimeRate: 0, totalActiveOrders: 0 };
      }

      const allVendors = result.data;
      const activeVendors = allVendors.filter(v =>
        v.status === VendorStatus.ACTIVE || v.status === ('active' as any)
      );

      const averageQCScore = activeVendors.length > 0
        ? activeVendors.reduce((sum, v) => sum + (v.performance?.qualityScore || 0), 0) / activeVendors.length
        : 0;
      const averageOnTimeRate = activeVendors.length > 0
        ? activeVendors.reduce((sum, v) => sum + (v.performance?.onTimeDeliveryRate || 0), 0) / activeVendors.length
        : 0;
      const totalActiveOrders = activeVendors.reduce(
        (sum, v) => sum + ((v.performance?.totalOrders || 0) - (v.performance?.completedOrders || 0)),
        0
      );

      return {
        totalVendors: allVendors.length,
        activeVendors: activeVendors.length,
        averageQCScore: Math.round(averageQCScore * 10) / 10,
        averageOnTimeRate: Math.round(averageOnTimeRate * 10) / 10,
        totalActiveOrders
      };
    } catch (error) {
      this.logger.error('Error getting vendor statistics', { error });
      return { totalVendors: 0, activeVendors: 0, averageQCScore: 0, averageOnTimeRate: 0, totalActiveOrders: 0 };
    }
  }

  /**
   * Create a new vendor in Cosmos.
   */
  async createVendor(vendorData: any): Promise<{ success: boolean; data?: Vendor; error?: any }> {
    try {
      return await this.dbService.createVendor({
        ...vendorData,
        createdAt: new Date(),
        updatedAt: new Date(),
        status: vendorData.status || VendorStatus.ACTIVE
      });
    } catch (error) {
      this.logger.error('Error creating vendor', { error });
      return { success: false, error: { code: 'CREATE_ERROR', message: 'Vendor creation failed' } };
    }
  }

  /**
   * Update a vendor in Cosmos.
   */
  async updateVendor(vendorId: string, updateData: any, userId?: string): Promise<{ success: boolean; data?: Vendor; error?: any }> {
    try {
      return await this.dbService.updateVendor(vendorId, {
        ...updateData,
        updatedAt: new Date(),
        updatedBy: userId
      });
    } catch (error) {
      this.logger.error('Error updating vendor', { error, vendorId });
      return { success: false, error: { code: 'UPDATE_ERROR', message: 'Vendor update failed' } };
    }
  }

  /**
   * Deactivate a vendor (soft delete).
   */
  async deactivateVendor(vendorId: string, reason: string, userId?: string): Promise<{ success: boolean; data?: Vendor; error?: any }> {
    try {
      return await this.dbService.updateVendor(vendorId, {
        status: VendorStatus.INACTIVE
      } as any);
    } catch (error) {
      this.logger.error('Error deactivating vendor', { error, vendorId });
      return { success: false, error: { code: 'DEACTIVATE_ERROR', message: 'Vendor deactivation failed' } };
    }
  }

  /**
   * Get vendors with optional filters.
   */
  async getVendors(filters: any, page: number = 1, limit: number = 50): Promise<{ success: boolean; data?: any; error?: any }> {
    try {
      const result = await this.dbService.findAllVendors();
      if (!result.success || !result.data) {
        return { success: false, error: result.error || { code: 'RETRIEVAL_ERROR', message: 'Failed to get vendors' } };
      }

      let vendors = result.data;

      // Apply filters
      if (filters?.status) {
        vendors = vendors.filter(v => v.status === filters.status);
      }
      if (filters?.licenseState) {
        vendors = vendors.filter(v => v.licenseState === filters.licenseState);
      }

      // Paginate
      const start = (page - 1) * limit;
      const paginated = vendors.slice(start, start + limit);

      return {
        success: true,
        data: {
          vendors: paginated,
          total: vendors.length,
          page,
          limit
        }
      };
    } catch (error) {
      this.logger.error('Error getting vendors', { error, filters });
      return { success: false, error: { code: 'RETRIEVAL_ERROR', message: 'Failed to get vendors' } };
    }
  }

  /**
   * Update vendor status.
   */
  async updateVendorStatus(vendorId: string, status: any, reason: string, userId?: string): Promise<{ success: boolean; data?: Vendor; error?: any }> {
    try {
      return await this.dbService.updateVendor(vendorId, {
        status
      } as any);
    } catch (error) {
      this.logger.error('Error updating vendor status', { error, vendorId });
      return { success: false, error: { code: 'STATUS_UPDATE_ERROR', message: 'Vendor status update failed' } };
    }
  }

  /**
   * Get vendor performance from Cosmos.
   */
  async getVendorPerformance(vendorId: string, startDate?: Date, endDate?: Date): Promise<{ success: boolean; data?: any; error?: any }> {
    try {
      return await this.dbService.getVendorPerformance(vendorId);
    } catch (error) {
      this.logger.error('Error getting vendor performance', { error, vendorId });
      return { success: false, error: { code: 'PERFORMANCE_ERROR', message: 'Failed to get performance' } };
    }
  }

  /**
   * Update vendor performance metrics.
   */
  async updateVendorPerformanceMetrics(vendorId: string, performanceData: any, userId?: string): Promise<{ success: boolean; data?: any; error?: any }> {
    try {
      return await this.dbService.updateVendor(vendorId, {
        performance: performanceData
      } as any);
    } catch (error) {
      this.logger.error('Error updating vendor performance metrics', { error, vendorId });
      return { success: false, error: { code: 'PERFORMANCE_UPDATE_ERROR', message: 'Performance update failed' } };
    }
  }

  /**
   * Search vendors by criteria.
   */
  async searchVendors(searchCriteria: any, page: number = 1, limit: number = 50): Promise<{ success: boolean; data?: any; error?: any }> {
    // Delegate to getVendors with the search criteria as filters
    return this.getVendors(searchCriteria, page, limit);
  }
}