/**
 * Vendor Assignment Service
 * Handles intelligent vendor selection, conflict checking, and assignment management
 */

import { Logger } from '../utils/logger.js';
import { DynamicCodeExecutionService } from './dynamic-code-execution.service';

export interface VendorProfile {
  id: string;
  businessName: string;
  contactPerson: string;
  email: string;
  phone: string;
  state: string;
  serviceTypes: string[];
  averageQCScore: number;
  averageTurnaroundDays: number;
  currentWorkload: number;
  maxConcurrentOrders: number;
  isAvailable: boolean;
  isBusy?: boolean;
  vacationStartDate?: string;
  vacationEndDate?: string;
  excludedClients: string[];
  certifications: string[];
  specialties: string[];
  serviceAreas: {
    states: string[];
    counties: string[];
    maxDistanceMiles?: number;
  };
}

export interface VendorScoringResult {
  vendor: VendorProfile;
  score: number;
  reasons: string[];
  capacityUtilization: number;
  estimatedTurnaround: number;
}

export interface ConflictCheckResult {
  hasConflicts: boolean;
  conflicts: string[];
  warnings: string[];
  canProceed: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface VendorAssignmentRequest {
  orderId: string;
  orderType: string;
  productType: string;
  propertyAddress: string;
  propertyState: string;
  propertyCounty: string;
  clientId: string;
  loanAmount: number;
  priority: 'STANDARD' | 'RUSH' | 'EMERGENCY';
  borrowerName: string;
  dueDate: Date;
  specialRequirements?: string[];
}

export interface VendorAssignmentResult {
  success: boolean;
  assignedVendor?: VendorProfile;
  alternateVendors?: VendorProfile[];
  assignmentReason: string;
  fee?: number;
  estimatedCompletion?: Date;
  error?: string;
}

export class VendorAssignmentService {
  private logger: Logger;
  private codeExecutionService: DynamicCodeExecutionService;

  constructor() {
    this.logger = new Logger('VendorAssignmentService');
    this.codeExecutionService = new DynamicCodeExecutionService();
  }

  /**
   * Find and assign the best vendor for an order
   */
  async assignBestVendor(
    request: VendorAssignmentRequest,
    vendorPool: VendorProfile[],
    customScoringRules?: string
  ): Promise<VendorAssignmentResult> {
    try {
      this.logger.info('Starting vendor assignment process', {
        orderId: request.orderId,
        orderType: request.orderType,
        priority: request.priority,
        propertyState: request.propertyState
      });

      // 1. Filter eligible vendors
      const eligibleVendors = this.filterEligibleVendors(request, vendorPool);

      if (eligibleVendors.length === 0) {
        return {
          success: false,
          assignmentReason: 'No eligible vendors found for this order',
          error: 'No vendors available'
        };
      }

      // 2. Score vendors
      const scoredVendors = await this.scoreVendors(request, eligibleVendors, customScoringRules);

      if (scoredVendors.length === 0) {
        return {
          success: false,
          assignmentReason: 'No vendors received passing scores',
          error: 'No suitable vendors'
        };
      }

      // 3. Check conflicts for top vendor
      const topVendor = scoredVendors[0]!; // We know it exists from length check above
      const conflictCheck = await this.checkConflicts(request, topVendor.vendor);

      if (!conflictCheck.canProceed) {
        // Try next best vendor if conflict exists
        const alternateVendors = scoredVendors.slice(1);
        for (const alternate of alternateVendors) {
          const alternateConflictCheck = await this.checkConflicts(request, alternate.vendor);
          if (alternateConflictCheck.canProceed) {
            return this.createAssignmentResult(request, alternate, alternateVendors);
          }
        }

        return {
          success: false,
          assignmentReason: 'All eligible vendors have conflicts of interest',
          error: 'Conflict of interest'
        };
      }

      // 4. Create successful assignment
      return this.createAssignmentResult(request, topVendor, scoredVendors.slice(1));

    } catch (error) {
      this.logger.error('Vendor assignment failed', { error, orderId: request.orderId });
      return {
        success: false,
        assignmentReason: 'Assignment process encountered an error',
        error: 'Assignment failed'
      };
    }
  }

  /**
   * Filter vendors based on basic eligibility criteria
   */
  private filterEligibleVendors(
    request: VendorAssignmentRequest,
    vendorPool: VendorProfile[]
  ): VendorProfile[] {
    return vendorPool.filter(vendor => {
      // Must be available
      if (!vendor.isAvailable) return false;

      // Must not be explicitly marked busy
      if (vendor.isBusy) return false;

      // Must not be on vacation right now
      if (vendor.vacationStartDate && vendor.vacationEndDate) {
        const now = new Date();
        const start = new Date(vendor.vacationStartDate);
        const end = new Date(vendor.vacationEndDate);
        if (now >= start && now <= end) return false;
      }

      // Must support the order type
      if (!vendor.serviceTypes.includes(request.orderType)) return false;

      // Must not be excluded by client
      if (vendor.excludedClients.includes(request.clientId)) return false;

      // Must have capacity
      if (vendor.currentWorkload >= vendor.maxConcurrentOrders) return false;

      // Must serve the geographic area
      if (!vendor.serviceAreas.states.includes(request.propertyState)) return false;

      return true;
    });
  }

  /**
   * Score vendors based on various criteria
   */
  private async scoreVendors(
    request: VendorAssignmentRequest,
    vendors: VendorProfile[],
    customScoringRules?: string
  ): Promise<VendorScoringResult[]> {
    const scoredVendors: VendorScoringResult[] = [];

    for (const vendor of vendors) {
      let score = 0;
      const reasons: string[] = [];

      // Quality Score (40% weight)
      if (vendor.averageQCScore >= 95) {
        score += 40;
        reasons.push('Excellent QC score (95%+)');
      } else if (vendor.averageQCScore >= 90) {
        score += 35;
        reasons.push('Very good QC score (90%+)');
      } else if (vendor.averageQCScore >= 85) {
        score += 30;
        reasons.push('Good QC score (85%+)');
      } else {
        score += 20;
        reasons.push('Acceptable QC score');
      }

      // Turnaround Time (30% weight)
      const turnaroundScore = this.calculateTurnaroundScore(vendor, request.priority);
      score += turnaroundScore.score;
      reasons.push(turnaroundScore.reason);

      // Capacity (20% weight)
      const capacityUtilization = vendor.currentWorkload / vendor.maxConcurrentOrders;
      if (capacityUtilization < 0.5) {
        score += 20;
        reasons.push('Low workload - high availability');
      } else if (capacityUtilization < 0.7) {
        score += 15;
        reasons.push('Moderate workload - good availability');
      } else {
        score += 10;
        reasons.push('High workload - limited availability');
      }

      // Geographic Expertise (10% weight)
      if (vendor.serviceAreas.counties.includes(request.propertyCounty)) {
        score += 10;
        reasons.push('Local county expertise');
      } else if (vendor.serviceAreas.states.includes(request.propertyState)) {
        score += 7;
        reasons.push('State coverage');
      }

      // High-value loan expertise
      if (request.loanAmount > 1000000 && vendor.averageQCScore >= 92) {
        score += 5;
        reasons.push('Qualified for high-value loans');
      }

      const estimatedTurnaround = this.calculateEstimatedTurnaround(vendor, request.priority);

      scoredVendors.push({
        vendor,
        score: Math.round(score),
        reasons,
        capacityUtilization: Math.round(capacityUtilization * 100),
        estimatedTurnaround
      });
    }

    // Apply custom scoring rules if provided
    if (customScoringRules) {
      try {
        const customResult = await this.codeExecutionService.executeCode(customScoringRules, {
          event: { data: { request, vendors: scoredVendors } },
          context: { userId: 'vendor-assignment', role: 'assignment' },
          rule: { name: 'custom-vendor-scoring' },
          timestamp: new Date(),
          utils: {
            date: Date,
            math: Math,
            json: JSON,
            regex: RegExp,
            console: { log: this.logger.info.bind(this.logger), warn: this.logger.warn.bind(this.logger), error: this.logger.error.bind(this.logger) }
          }
        });

        if (customResult.success && customResult.result) {
          // Apply custom scoring adjustments
          return customResult.result;
        }
      } catch (error) {
        this.logger.warn('Custom scoring rules failed, using default scoring', { error });
      }
    }

    return scoredVendors.sort((a, b) => b.score - a.score);
  }

  /**
   * Check for conflicts of interest
   */
  private async checkConflicts(
    request: VendorAssignmentRequest,
    vendor: VendorProfile
  ): Promise<ConflictCheckResult> {
    const conflicts: string[] = [];
    const warnings: string[] = [];

    // Client exclusion check
    if (vendor.excludedClients.includes(request.clientId)) {
      conflicts.push('Vendor excluded by client policy');
    }

    // Geographic concentration check
    if (vendor.state !== request.propertyState) {
      warnings.push('Out-of-state vendor assignment');
    }

    // Workload concentration warning
    if (vendor.currentWorkload >= vendor.maxConcurrentOrders * 0.9) {
      warnings.push('Vendor approaching capacity limit');
    }

    // Emergency priority check
    if (request.priority === 'EMERGENCY' && vendor.averageTurnaroundDays > 3) {
      warnings.push('Vendor may not meet emergency timeline requirements');
    }

    const hasConflicts = conflicts.length > 0;
    const riskLevel = hasConflicts ? 'HIGH' : warnings.length > 0 ? 'MEDIUM' : 'LOW';

    return {
      hasConflicts,
      conflicts,
      warnings,
      canProceed: !hasConflicts,
      riskLevel
    };
  }

  /**
   * Create assignment result
   */
  private createAssignmentResult(
    request: VendorAssignmentRequest,
    selectedVendor: VendorScoringResult,
    alternateVendors: VendorScoringResult[]
  ): VendorAssignmentResult {
    const fee = this.calculateVendorFee(request, selectedVendor.vendor);
    const estimatedCompletion = new Date(
      Date.now() + selectedVendor.estimatedTurnaround * 24 * 60 * 60 * 1000
    );

    return {
      success: true,
      assignedVendor: selectedVendor.vendor,
      alternateVendors: alternateVendors.slice(0, 3).map(v => v.vendor), // Top 3 alternates
      assignmentReason: `Best match: ${selectedVendor.reasons.join(', ')}`,
      fee,
      estimatedCompletion
    };
  }

  private calculateTurnaroundScore(vendor: VendorProfile, priority: string): { score: number; reason: string } {
    const turnaround = vendor.averageTurnaroundDays;

    switch (priority) {
      case 'EMERGENCY':
        if (turnaround <= 1) {
          return { score: 30, reason: 'Same-day capability for emergency orders' };
        } else if (turnaround <= 2) {
          return { score: 25, reason: '2-day capability for emergency orders' };
        } else {
          return { score: 10, reason: 'May not meet emergency timeline' };
        }

      case 'RUSH':
        if (turnaround <= 3) {
          return { score: 30, reason: 'Fast turnaround for rush orders' };
        } else if (turnaround <= 5) {
          return { score: 25, reason: 'Good turnaround for rush orders' };
        } else {
          return { score: 15, reason: 'Standard turnaround time' };
        }

      default:
        if (turnaround <= 5) {
          return { score: 25, reason: 'Excellent standard turnaround' };
        } else if (turnaround <= 7) {
          return { score: 20, reason: 'Good standard turnaround' };
        } else {
          return { score: 15, reason: 'Acceptable turnaround time' };
        }
    }
  }

  private calculateEstimatedTurnaround(vendor: VendorProfile, priority: string): number {
    let baseDays = vendor.averageTurnaroundDays;

    // Adjust for priority
    switch (priority) {
      case 'EMERGENCY':
        baseDays = Math.min(baseDays, 2);
        break;
      case 'RUSH':
        baseDays = Math.min(baseDays, 4);
        break;
    }

    // Adjust for workload
    const capacityUtilization = vendor.currentWorkload / vendor.maxConcurrentOrders;
    if (capacityUtilization > 0.8) {
      baseDays += 1; // Add a day for high utilization
    }

    return baseDays;
  }

  private calculateVendorFee(request: VendorAssignmentRequest, vendor: VendorProfile): number {
    // Base fees by order type (these would come from vendor rate tables in real implementation)
    const baseFees = {
      FULL_APPRAISAL: 550,
      DRIVE_BY: 350,
      EXTERIOR_ONLY: 275,
      DESK_REVIEW: 200
    };

    let fee = baseFees[request.orderType as keyof typeof baseFees] || 500;

    // Priority adjustments
    switch (request.priority) {
      case 'RUSH':
        fee *= 1.5;
        break;
      case 'EMERGENCY':
        fee *= 2.0;
        break;
    }

    // High-value loan adjustment
    if (request.loanAmount > 1000000) {
      fee *= 1.25;
    }

    return Math.round(fee);
  }
}