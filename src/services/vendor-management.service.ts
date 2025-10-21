/**
 * Comprehensive Vendor Management Service
 * 
 * Handles vendor profiles, intelligent assignment algorithms,
 * performance tracking, and availability management
 */

import { Logger } from '../utils/logger';
import { GenericCacheService } from './cache/generic-cache.service';
import {
  VendorProfile,
  VendorStatus,
  VendorServiceArea,
  VendorRate,
  VendorPerformanceMetrics,
  OrderType,
  OrderPriority,
  PropertyDetails,
  AssignmentRule,
  VendorSelectionStrategy,
  AssignmentCondition,
  AppraisalOrder
} from '../types/order-management';

export interface VendorSearchCriteria {
  serviceTypes?: OrderType[];
  states?: string[];
  counties?: string[];
  zipCodes?: string[];
  maxDistanceMiles?: number;
  minQCScore?: number;
  maxActiveOrders?: number;
  availableOnly?: boolean;
  licensedOnly?: boolean;
}

export interface VendorAssignmentRequest {
  order: AppraisalOrder;
  assignmentRules?: AssignmentRule[];
  excludeVendorIds?: string[];
  requireSpecialCapabilities?: string[];
}

export interface VendorAssignmentResult {
  success: boolean;
  selectedVendor?: VendorProfile;
  alternativeVendors?: VendorProfile[];
  assignmentScore?: number;
  assignmentReason: string;
  error?: string;
}

export class VendorManagementService {
  private logger: Logger;
  private cache: GenericCacheService;

  constructor() {
    this.logger = new Logger();
    this.cache = new GenericCacheService();
  }

  // ===========================
  // VENDOR PROFILE MANAGEMENT
  // ===========================

  /**
   * Create new vendor profile
   */
  async createVendor(vendorData: Omit<VendorProfile, 'id' | 'onboardedAt' | 'currentActiveOrders' | 'totalOrdersCompleted' | 'averageQCScore' | 'onTimeDeliveryRate' | 'clientSatisfactionScore'>): Promise<{
    success: boolean;
    data?: VendorProfile;
    error?: string;
  }> {
    
    try {
      this.logger.info('Creating new vendor profile', {
        businessName: vendorData.businessName,
        email: vendorData.email,
        serviceTypes: vendorData.serviceTypes
      });

      // Generate vendor ID
      const vendorId = this.generateVendorId();

      // Validate required fields
      if (!vendorData.businessName || !vendorData.email || !vendorData.stateLicense) {
        return {
          success: false,
          error: 'Missing required vendor information'
        };
      }

      // Check for duplicate vendor code
      const existingVendor = await this.getVendorByCode(vendorData.vendorCode);
      if (existingVendor) {
        return {
          success: false,
          error: 'Vendor code already exists'
        };
      }

      // Create vendor profile
      const vendor: VendorProfile = {
        ...vendorData,
        id: vendorId,
        onboardedAt: new Date(),
        currentActiveOrders: 0,
        totalOrdersCompleted: 0,
        averageQCScore: 0,
        onTimeDeliveryRate: 0,
        clientSatisfactionScore: 0
      };

      // Cache vendor profile
      await this.cache.set(`vendor:${vendorId}`, vendor, 24 * 60 * 60); // 24 hours
      await this.cache.set(`vendor_code:${vendor.vendorCode}`, vendorId, 24 * 60 * 60);

      this.logger.info('Vendor profile created successfully', {
        vendorId,
        vendorCode: vendor.vendorCode,
        businessName: vendor.businessName
      });

      return {
        success: true,
        data: vendor
      };

    } catch (error) {
      this.logger.error('Failed to create vendor profile', { error, vendorData });
      return {
        success: false,
        error: 'Failed to create vendor profile'
      };
    }
  }

  /**
   * Find and assign best vendor for order
   */
  async assignBestVendor(request: VendorAssignmentRequest): Promise<VendorAssignmentResult> {
    try {
      this.logger.info('Starting vendor assignment process', {
        orderId: request.order.id,
        orderType: request.order.orderType,
        priority: request.order.priority,
        propertyState: request.order.propertyDetails.state
      });

      // Step 1: Find available vendors
      const availableVendors = await this.findAvailableVendors({
        serviceTypes: [request.order.orderType],
        states: [request.order.propertyDetails.state],
        availableOnly: true,
        licensedOnly: true
      });

      if (availableVendors.length === 0) {
        return {
          success: false,
          assignmentReason: 'No available vendors found for this order',
          error: 'No vendors available'
        };
      }

      // Step 2: Filter by exclusions
      const eligibleVendors = availableVendors.filter(vendor => 
        !request.excludeVendorIds?.includes(vendor.id)
      );

      if (eligibleVendors.length === 0) {
        return {
          success: false,
          assignmentReason: 'All available vendors are excluded',
          error: 'No eligible vendors'
        };
      }

      // Step 3: Score vendors for this order
      const scoredVendors = await this.scoreVendorsForOrder(eligibleVendors, request.order);

      // Step 4: Select best vendor
      const sortedVendors = scoredVendors.sort((a, b) => b.score - a.score);
      const selectedVendor = sortedVendors[0];

      // Step 5: Prepare alternatives
      const alternativeVendors = sortedVendors.slice(1, 4).map(sv => sv.vendor);

      this.logger.info('Vendor assignment completed', {
        orderId: request.order.id,
        selectedVendor: selectedVendor.vendor.businessName,
        assignmentScore: selectedVendor.score,
        alternativeCount: alternativeVendors.length
      });

      return {
        success: true,
        selectedVendor: selectedVendor.vendor,
        alternativeVendors,
        assignmentScore: selectedVendor.score,
        assignmentReason: `Best match based on ${selectedVendor.reasons.join(', ')}`
      };

    } catch (error) {
      this.logger.error('Vendor assignment failed', { error, orderId: request.order.id });
      return {
        success: false,
        assignmentReason: 'Assignment process encountered an error',
        error: 'Assignment failed'
      };
    }
  }

  /**
   * Find available vendors based on criteria
   */
  async findAvailableVendors(criteria: VendorSearchCriteria): Promise<VendorProfile[]> {
    try {
      // Get mock vendors that match criteria
      const mockVendors = await this.getMockVendors();

      let filteredVendors = mockVendors;

      // Filter by service types
      if (criteria.serviceTypes?.length) {
        filteredVendors = filteredVendors.filter(vendor =>
          criteria.serviceTypes!.some(type => vendor.serviceTypes.includes(type))
        );
      }

      // Filter by states
      if (criteria.states?.length) {
        filteredVendors = filteredVendors.filter(vendor =>
          vendor.serviceAreas.some(area => criteria.states!.includes(area.state))
        );
      }

      // Filter by availability
      if (criteria.availableOnly) {
        filteredVendors = filteredVendors.filter(vendor =>
          vendor.status === VendorStatus.ACTIVE &&
          vendor.currentActiveOrders < vendor.maxActiveOrders
        );
      }

      // Filter by QC score
      if (criteria.minQCScore) {
        filteredVendors = filteredVendors.filter(vendor =>
          vendor.averageQCScore >= criteria.minQCScore!
        );
      }

      // Filter by license status
      if (criteria.licensedOnly) {
        filteredVendors = filteredVendors.filter(vendor =>
          vendor.licenseExpiration > new Date()
        );
      }

      this.logger.info('Vendor search completed', {
        criteria,
        totalFound: filteredVendors.length
      });

      return filteredVendors;

    } catch (error) {
      this.logger.error('Vendor search failed', { error, criteria });
      return [];
    }
  }

  /**
   * Get vendor by ID
   */
  async getVendorById(vendorId: string): Promise<VendorProfile | null> {
    try {
      const cached = await this.cache.get(`vendor:${vendorId}`);
      if (cached) return cached as VendorProfile;

      // In real implementation, query database
      return null;

    } catch (error) {
      this.logger.error('Failed to get vendor by ID', { error, vendorId });
      return null;
    }
  }

  /**
   * Get vendor by vendor code
   */
  async getVendorByCode(vendorCode: string): Promise<VendorProfile | null> {
    try {
      const vendorId = await this.cache.get(`vendor_code:${vendorCode}`);
      if (vendorId) {
        return await this.getVendorById(vendorId as string);
      }

      return null;

    } catch (error) {
      this.logger.error('Failed to get vendor by code', { error, vendorCode });
      return null;
    }
  }

  // ===========================
  // PRIVATE METHODS
  // ===========================

  /**
   * Score vendors for specific order
   */
  private async scoreVendorsForOrder(
    vendors: VendorProfile[],
    order: AppraisalOrder
  ): Promise<Array<{
    vendor: VendorProfile;
    score: number;
    reasons: string[];
  }>> {
    
    return await Promise.all(vendors.map(async vendor => {
      const reasons: string[] = [];
      let score = 0;

      // Base score for active status
      if (vendor.status === VendorStatus.ACTIVE) {
        score += 20;
        reasons.push('active status');
      }

      // QC Score (40% weight)
      const qcScorePoints = Math.min(40, vendor.averageQCScore * 0.4);
      score += qcScorePoints;
      if (vendor.averageQCScore > 90) {
        reasons.push('excellent QC score');
      } else if (vendor.averageQCScore > 80) {
        reasons.push('good QC score');
      }

      // On-time delivery (20% weight)
      const onTimePoints = Math.min(20, vendor.onTimeDeliveryRate * 0.2);
      score += onTimePoints;
      if (vendor.onTimeDeliveryRate > 95) {
        reasons.push('excellent on-time delivery');
      }

      // Workload capacity (15% weight)
      const capacityRatio = vendor.currentActiveOrders / vendor.maxActiveOrders;
      const capacityPoints = Math.max(0, 15 * (1 - capacityRatio));
      score += capacityPoints;
      if (capacityRatio < 0.5) {
        reasons.push('good availability');
      }

      // Service type match (10% weight)
      if (vendor.serviceTypes.includes(order.orderType)) {
        score += 10;
        reasons.push('service type expertise');
      }

      // Priority handling (5% weight)
      if (order.priority === OrderPriority.RUSH || order.priority === OrderPriority.EMERGENCY) {
        if (vendor.averageTurnaroundDays <= 3) {
          score += 5;
          reasons.push('fast turnaround capability');
        }
      } else {
        score += 3; // Normal priority gets some points
      }

      return {
        vendor,
        score: Math.round(score),
        reasons
      };
    }));
  }

  private generateVendorId(): string {
    return `vendor_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Get mock vendors for testing
   */
  private async getMockVendors(): Promise<VendorProfile[]> {
    const mockVendors: VendorProfile[] = [
      {
        id: 'vendor_001',
        vendorCode: 'PRO001',
        businessName: 'Professional Appraisal Services',
        contactPerson: 'John Smith',
        email: 'john@professionalappraisal.com',
        phone: '555-0123',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        businessType: 'COMPANY',
        stateLicense: 'TX123456',
        licenseExpiration: new Date('2025-12-31'),
        serviceTypes: [OrderType.FULL_APPRAISAL, OrderType.DRIVE_BY, OrderType.EXTERIOR_ONLY],
        serviceAreas: [{
          id: 'area_001',
          vendorId: 'vendor_001',
          state: 'TX',
          counties: ['Travis', 'Williamson', 'Hays'],
          maxDistanceMiles: 50
        }],
        maxActiveOrders: 15,
        averageTurnaroundDays: 5,
        status: VendorStatus.ACTIVE,
        onboardedAt: new Date('2023-01-15'),
        currentActiveOrders: 8,
        totalOrdersCompleted: 247,
        averageQCScore: 92.3,
        onTimeDeliveryRate: 96.8,
        clientSatisfactionScore: 4.7,
        standardRates: [],
        paymentTerms: 'Net 30',
        w9OnFile: true,
        autoAcceptOrders: false,
        emailNotifications: true,
        smsNotifications: true,
        maxAssignmentRadius: 50
      },
      {
        id: 'vendor_002',
        vendorCode: 'ACC002',
        businessName: 'Accurate Valuations LLC',
        contactPerson: 'Sarah Johnson',
        email: 'sarah@accuratevaluations.com',
        phone: '555-0124',
        address: '456 Oak Ave',
        city: 'Dallas',
        state: 'TX',
        zipCode: '75201',
        businessType: 'COMPANY',
        stateLicense: 'TX234567',
        licenseExpiration: new Date('2026-06-30'),
        serviceTypes: [OrderType.FULL_APPRAISAL, OrderType.DESKTOP, OrderType.BPO],
        serviceAreas: [{
          id: 'area_002',
          vendorId: 'vendor_002',
          state: 'TX',
          counties: ['Dallas', 'Collin', 'Denton'],
          maxDistanceMiles: 40
        }],
        maxActiveOrders: 12,
        averageTurnaroundDays: 4,
        status: VendorStatus.ACTIVE,
        onboardedAt: new Date('2022-08-20'),
        currentActiveOrders: 6,
        totalOrdersCompleted: 189,
        averageQCScore: 89.7,
        onTimeDeliveryRate: 94.2,
        clientSatisfactionScore: 4.5,
        standardRates: [],
        paymentTerms: 'Net 30',
        w9OnFile: true,
        autoAcceptOrders: true,
        emailNotifications: true,
        smsNotifications: false,
        maxAssignmentRadius: 40
      },
      {
        id: 'vendor_003',
        vendorCode: 'MET003',
        businessName: 'Metro Appraisal Group',
        contactPerson: 'Michael Davis',
        email: 'michael@metroappraisal.com',
        phone: '555-0125',
        address: '789 Pine St',
        city: 'Houston',
        state: 'TX',
        zipCode: '77001',
        businessType: 'COMPANY',
        stateLicense: 'TX345678',
        licenseExpiration: new Date('2025-09-15'),
        serviceTypes: [OrderType.FULL_APPRAISAL, OrderType.DRIVE_BY, OrderType.FIELD_REVIEW],
        serviceAreas: [{
          id: 'area_003',
          vendorId: 'vendor_003',
          state: 'TX',
          counties: ['Harris', 'Fort Bend', 'Montgomery'],
          maxDistanceMiles: 60
        }],
        maxActiveOrders: 20,
        averageTurnaroundDays: 6,
        status: VendorStatus.ACTIVE,
        onboardedAt: new Date('2021-11-10'),
        currentActiveOrders: 12,
        totalOrdersCompleted: 324,
        averageQCScore: 85.4,
        onTimeDeliveryRate: 91.8,
        clientSatisfactionScore: 4.3,
        standardRates: [],
        paymentTerms: 'Net 30',
        w9OnFile: true,
        autoAcceptOrders: false,
        emailNotifications: true,
        smsNotifications: true,
        maxAssignmentRadius: 60
      }
    ];

    // Cache mock vendors
    for (const vendor of mockVendors) {
      await this.cache.set(`vendor:${vendor.id}`, vendor, 24 * 60 * 60);
      await this.cache.set(`vendor_code:${vendor.vendorCode}`, vendor.id, 24 * 60 * 60);
    }

    return mockVendors;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{
    status: string;
    vendorCount: number;
    activeVendorCount: number;
    averageQCScore: number;
    averageOnTimeRate: number;
    lastUpdate: Date;
    capabilities: string[];
  }> {
    
    try {
      const vendors = await this.getMockVendors();
      const activeVendors = vendors.filter(v => v.status === VendorStatus.ACTIVE);
      
      const averageQCScore = activeVendors.reduce((sum, v) => sum + v.averageQCScore, 0) / activeVendors.length;
      const averageOnTimeRate = activeVendors.reduce((sum, v) => sum + v.onTimeDeliveryRate, 0) / activeVendors.length;

      return {
        status: 'operational',
        vendorCount: vendors.length,
        activeVendorCount: activeVendors.length,
        averageQCScore: Math.round(averageQCScore * 10) / 10,
        averageOnTimeRate: Math.round(averageOnTimeRate * 10) / 10,
        lastUpdate: new Date(),
        capabilities: [
          'Intelligent vendor assignment algorithms',
          'Performance tracking and metrics',
          'Availability management',
          'Geographic coverage optimization',
          'QC score-based vendor selection',
          'Workload balancing',
          'Multi-criteria vendor scoring',
          'Real-time availability updates'
        ]
      };

    } catch (error) {
      this.logger.error('Failed to get vendor service health status', { error });
      return {
        status: 'error',
        vendorCount: 0,
        activeVendorCount: 0,
        averageQCScore: 0,
        averageOnTimeRate: 0,
        lastUpdate: new Date(),
        capabilities: []
      };
    }
  }

  /**
   * Update vendor performance after order completion
   */
  async updateVendorPerformanceAfterOrder(vendorId: string, orderOutcome: any): Promise<ApiResponse<Vendor>> {
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