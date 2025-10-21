/**
 * Clean Vendor Management Service
 * Core vendor management functionality for appraisal orders
 */

import { Vendor, AppraisalOrder, VendorStatus } from '../types/index.js';
import { Logger } from '../utils/logger.js';

export interface VendorSearchResult {
  vendors: Vendor[];
  total: number;
  page: number;
  limit: number;
}

export class VendorManagementService {
  private logger: Logger;
  private vendors: Map<string, Vendor> = new Map();

  constructor() {
    this.logger = new Logger('VendorManagementService');
    this.initializeMockVendors();
  }

  /**
   * Initialize mock vendors for demonstration
   */
  private initializeMockVendors(): void {
    const mockVendors: VendorProfile[] = [
      {
        id: 'vendor-001',
        name: 'John Smith',
        businessName: 'Elite Appraisal Services',
        email: 'john@eliteappraisal.com',
        phone: '555-0101',
        license: 'APR-12345',
        certifications: ['SRA', 'MAI'],
        serviceStates: ['TX', 'OK'],
        specialties: ['Residential', 'Commercial'],
        experience: 15,
        status: VendorStatus.ACTIVE,
        onboardedAt: new Date('2021-01-15'),
        currentActiveOrders: 8,
        totalOrdersCompleted: 245,
        averageQCScore: 94.5,
        onTimeDeliveryRate: 96.2,
        clientSatisfactionScore: 4.7,
        maxAssignmentRadius: 50,
        autoAcceptOrders: true,
        emailNotifications: true,
        smsNotifications: true
      },
      {
        id: 'vendor-002',
        name: 'Sarah Johnson',
        businessName: 'Rapid Valuations LLC',
        email: 'sarah@rapidvaluations.com',
        phone: '555-0102',
        license: 'APR-23456',
        certifications: ['SRA'],
        serviceStates: ['TX', 'LA'],
        specialties: ['Residential'],
        experience: 8,
        status: VendorStatus.ACTIVE,
        onboardedAt: new Date('2022-03-10'),
        currentActiveOrders: 12,
        totalOrdersCompleted: 187,
        averageQCScore: 92.1,
        onTimeDeliveryRate: 94.8,
        clientSatisfactionScore: 4.5,
        maxAssignmentRadius: 40,
        autoAcceptOrders: false,
        emailNotifications: true,
        smsNotifications: false
      },
      {
        id: 'vendor-003',
        name: 'Michael Chen',
        businessName: 'Professional Property Evaluators',
        email: 'mike@propevaluators.com',
        phone: '555-0103',
        license: 'APR-34567',
        certifications: ['SRA', 'AI'],
        serviceStates: ['TX'],
        specialties: ['Residential', 'Commercial', 'Land'],
        experience: 12,
        status: VendorStatus.ACTIVE,
        onboardedAt: new Date('2020-08-22'),
        currentActiveOrders: 6,
        totalOrdersCompleted: 312,
        averageQCScore: 88.7,
        onTimeDeliveryRate: 89.3,
        clientSatisfactionScore: 4.2,
        maxAssignmentRadius: 60,
        autoAcceptOrders: true,
        emailNotifications: true,
        smsNotifications: true
      }
    ];

    // Store vendors in memory
    mockVendors.forEach(vendor => {
      this.vendors.set(vendor.id, vendor);
    });

    this.logger.info(`Initialized ${mockVendors.length} mock vendors`);
  }

  /**
   * Find vendors available for an order
   */
  async findAvailableVendors(order: AppraisalOrder): Promise<VendorProfile[]> {
    try {
      const availableVendors = Array.from(this.vendors.values()).filter(vendor => {
        // Check if vendor is active
        if (vendor.status !== VendorStatus.ACTIVE) {
          return false;
        }

        // Check if vendor serves the state
        const orderState = order.propertyAddress?.state;
        if (orderState && !vendor.serviceStates.includes(orderState)) {
          return false;
        }

        // Check if vendor handles the property type
        if (order.productType && !vendor.specialties.includes(order.productType)) {
          return false;
        }

        // Check capacity (simple check)
        if (vendor.currentActiveOrders >= 20) {
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
   * Get vendor by ID
   */
  async getVendorById(vendorId: string): Promise<VendorProfile | null> {
    try {
      const vendor = this.vendors.get(vendorId);
      if (!vendor) {
        this.logger.warn(`Vendor not found: ${vendorId}`);
        return null;
      }
      return vendor;
    } catch (error) {
      this.logger.error('Error getting vendor by ID', { error, vendorId });
      return null;
    }
  }

  /**
   * Get all vendors with optional filtering
   */
  async getVendors(filters: any = {}): Promise<VendorSearchResult> {
    try {
      let vendorList = Array.from(this.vendors.values());

      // Apply filters
      if (filters.status) {
        vendorList = vendorList.filter(v => v.status === filters.status);
      }

      if (filters.state) {
        vendorList = vendorList.filter(v => v.serviceStates.includes(filters.state));
      }

      if (filters.specialty) {
        vendorList = vendorList.filter(v => v.specialties.includes(filters.specialty));
      }

      // Sort by QC score by default
      vendorList.sort((a, b) => b.averageQCScore - a.averageQCScore);

      return {
        vendors: vendorList,
        total: vendorList.length,
        page: 1,
        limit: vendorList.length
      };

    } catch (error) {
      this.logger.error('Error getting vendors', { error, filters });
      return {
        vendors: [],
        total: 0,
        page: 1,
        limit: 0
      };
    }
  }

  /**
   * Update vendor performance metrics after order completion
   */
  async updateVendorPerformance(vendorId: string, orderOutcome: {
    completedOnTime: boolean;
    qcScore?: number;
    clientRating?: number;
  }): Promise<boolean> {
    try {
      const vendor = this.vendors.get(vendorId);
      if (!vendor) {
        this.logger.warn(`Cannot update performance for non-existent vendor: ${vendorId}`);
        return false;
      }

      // Update completion count
      vendor.totalOrdersCompleted += 1;
      vendor.currentActiveOrders = Math.max(0, vendor.currentActiveOrders - 1);

      // Update on-time delivery rate
      const totalOrders = vendor.totalOrdersCompleted;
      const previousOnTimeOrders = Math.round((vendor.onTimeDeliveryRate / 100) * (totalOrders - 1));
      const newOnTimeOrders = previousOnTimeOrders + (orderOutcome.completedOnTime ? 1 : 0);
      vendor.onTimeDeliveryRate = (newOnTimeOrders / totalOrders) * 100;

      // Update QC score if provided
      if (orderOutcome.qcScore !== undefined) {
        vendor.averageQCScore = ((vendor.averageQCScore * (totalOrders - 1)) + orderOutcome.qcScore) / totalOrders;
      }

      // Update client satisfaction if provided
      if (orderOutcome.clientRating !== undefined) {
        vendor.clientSatisfactionScore = ((vendor.clientSatisfactionScore * (totalOrders - 1)) + orderOutcome.clientRating) / totalOrders;
      }

      this.logger.info(`Updated performance for vendor ${vendorId}`, {
        totalOrders,
        onTimeRate: vendor.onTimeDeliveryRate,
        qcScore: vendor.averageQCScore,
        satisfaction: vendor.clientSatisfactionScore
      });

      return true;

    } catch (error) {
      this.logger.error('Error updating vendor performance', { error, vendorId });
      return false;
    }
  }

  /**
   * Assign order to vendor
   */
  async assignOrderToVendor(vendorId: string, orderId: string): Promise<boolean> {
    try {
      const vendor = this.vendors.get(vendorId);
      if (!vendor) {
        this.logger.warn(`Cannot assign order to non-existent vendor: ${vendorId}`);
        return false;
      }

      if (vendor.status !== VendorStatus.ACTIVE) {
        this.logger.warn(`Cannot assign order to inactive vendor: ${vendorId}`);
        return false;
      }

      // Increment active orders
      vendor.currentActiveOrders += 1;

      this.logger.info(`Assigned order ${orderId} to vendor ${vendorId}`, {
        vendorName: vendor.businessName,
        activeOrders: vendor.currentActiveOrders
      });

      return true;

    } catch (error) {
      this.logger.error('Error assigning order to vendor', { error, vendorId, orderId });
      return false;
    }
  }

  /**
   * Get vendor statistics
   */
  async getVendorStats(): Promise<{
    totalVendors: number;
    activeVendors: number;
    averageQCScore: number;
    averageOnTimeRate: number;
    totalActiveOrders: number;
  }> {
    try {
      const allVendors = Array.from(this.vendors.values());
      const activeVendors = allVendors.filter(v => v.status === VendorStatus.ACTIVE);

      const averageQCScore = activeVendors.reduce((sum, v) => sum + v.averageQCScore, 0) / activeVendors.length;
      const averageOnTimeRate = activeVendors.reduce((sum, v) => sum + v.onTimeDeliveryRate, 0) / activeVendors.length;
      const totalActiveOrders = activeVendors.reduce((sum, v) => sum + v.currentActiveOrders, 0);

      return {
        totalVendors: allVendors.length,
        activeVendors: activeVendors.length,
        averageQCScore: Math.round(averageQCScore * 10) / 10,
        averageOnTimeRate: Math.round(averageOnTimeRate * 10) / 10,
        totalActiveOrders
      };

    } catch (error) {
      this.logger.error('Error getting vendor statistics', { error });
      return {
        totalVendors: 0,
        activeVendors: 0,
        averageQCScore: 0,
        averageOnTimeRate: 0,
        totalActiveOrders: 0
      };
    }
  }
}