/**
 * Appraiser Service
 * Manages appraiser profiles, licenses, assignments, and conflict checking
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { Appraiser, AppraiserAssignment, ConflictCheckResult, License } from '../types/appraiser.types.js';

export class AppraiserService {
  private cosmosService: CosmosDbService;
  private logger: Logger;

  constructor(cosmosService?: CosmosDbService) {
    this.cosmosService = cosmosService || new CosmosDbService();
    this.logger = new Logger('AppraiserService');
  }

  /**
   * Get all appraisers
   */
  async getAllAppraisers(tenantId: string): Promise<Appraiser[]> {
    const container = this.cosmosService.getContainer('orders'); // Using orders container
    const query = {
      query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId',
      parameters: [
        { name: '@type', value: 'appraiser' },
        { name: '@tenantId', value: tenantId }
      ]
    };

    const { resources } = await container.items.query<Appraiser>(query).fetchAll();
    return resources;
  }

  /**
   * Get appraiser by ID
   */
  async getAppraiserById(appraiserId: string, tenantId: string): Promise<Appraiser | null> {
    try {
      const container = this.cosmosService.getContainer('orders');
      // Orders container uses 'status' as partition key, appraisers have status='active'
      const { resource } = await container.item(appraiserId, 'active').read<Appraiser>();
      
      // Verify tenant matches
      if (resource && resource.tenantId !== tenantId) {
        this.logger.warn('Appraiser tenant mismatch', { appraiserId, expectedTenant: tenantId, actualTenant: resource.tenantId });
        return null;
      }
      
      return resource || null;
    } catch (error: any) {
      if (error.code === 404) {
        this.logger.info('Appraiser not found', { appraiserId, tenantId });
        return null;
      }
      this.logger.error('Error getting appraiser', { 
        appraiserId, 
        tenantId,
        error: error.message,
        code: error.code,
        stack: error.stack
      });
      return null;
    }
  }

  /**
   * Create new appraiser
   */
  async createAppraiser(appraiser: Omit<Appraiser, 'id' | 'createdAt' | 'updatedAt'>): Promise<Appraiser> {
    const container = this.cosmosService.getContainer('orders');
    
    const newAppraiser: Appraiser = {
      ...appraiser,
      id: `appraiser-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { resource } = await container.items.create(newAppraiser);
    this.logger.info('Appraiser created', { appraiserId: resource?.id });
    return resource as Appraiser;
  }

  /**
   * Update appraiser
   */
  async updateAppraiser(appraiserId: string, tenantId: string, updates: Partial<Appraiser>): Promise<Appraiser> {
    const container = this.cosmosService.getContainer('orders');
    const existing = await this.getAppraiserById(appraiserId, tenantId);
    
    if (!existing) {
      throw new Error(`Appraiser not found: ${appraiserId}`);
    }

    const updated: Appraiser = {
      ...existing,
      ...updates,
      id: appraiserId,
      updatedAt: new Date().toISOString()
    };

    const { resource } = await container.item(appraiserId, tenantId).replace(updated);
    this.logger.info('Appraiser updated', { appraiserId });
    return resource as Appraiser;
  }

  /**
   * Check for license expiration
   */
  async checkLicenseExpiration(appraiserId: string, tenantId: string): Promise<License[]> {
    const appraiser = await this.getAppraiserById(appraiserId, tenantId);
    if (!appraiser) {
      throw new Error(`Appraiser not found: ${appraiserId}`);
    }

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const expiringLicenses = appraiser.licenses.filter(license => {
      const expiration = new Date(license.expirationDate);
      return expiration <= thirtyDaysFromNow && expiration >= now;
    });

    return expiringLicenses;
  }

  /**
   * Check for conflict of interest
   */
  async checkConflict(appraiserId: string, tenantId: string, propertyAddress: string, propertyLat?: number, propertyLng?: number): Promise<ConflictCheckResult> {
    const appraiser = await this.getAppraiserById(appraiserId, tenantId);
    if (!appraiser) {
      throw new Error(`Appraiser not found: ${appraiserId}`);
    }

    const conflicts: ConflictCheckResult['conflicts'] = [];

    // Check conflict properties
    for (const conflictProp of appraiser.conflictProperties) {
      if (conflictProp.address.toLowerCase().includes(propertyAddress.toLowerCase()) ||
          propertyAddress.toLowerCase().includes(conflictProp.address.toLowerCase())) {
        conflicts.push({
          type: 'property_conflict',
          reason: `Conflict: ${conflictProp.reason}`,
          conflictProperty: conflictProp
        });
      }
    }

    // If coordinates provided, check distance (10-mile radius)
    if (propertyLat && propertyLng && appraiser.serviceArea.centerPoint) {
      const distance = this.calculateDistance(
        propertyLat, 
        propertyLng,
        appraiser.serviceArea.centerPoint.lat,
        appraiser.serviceArea.centerPoint.lng
      );

      // Check if within appraiser's typical conflict radius (10 miles)
      for (const conflictProp of appraiser.conflictProperties) {
        if (distance <= conflictProp.radiusMiles) {
          conflicts.push({
            type: 'distance',
            reason: `Property within ${conflictProp.radiusMiles} miles of conflict property`,
            distance
          });
        }
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  /**
   * Assign appraiser to order
   */
  async assignAppraiser(orderId: string, appraiserId: string, assignedBy: string, tenantId: string, propertyAddress: string): Promise<AppraiserAssignment> {
    // Check for conflicts
    const conflictCheck = await this.checkConflict(appraiserId, tenantId, propertyAddress);
    if (conflictCheck.hasConflict) {
      throw new Error(`Cannot assign appraiser due to conflict: ${conflictCheck.conflicts.map(c => c.reason).join(', ')}`);
    }

    const container = this.cosmosService.getContainer('orders');
    
    const assignment: AppraiserAssignment = {
      id: `assignment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'appraiser_assignment',
      tenantId,
      orderId,
      orderNumber: `ORD-${orderId}`,
      appraiserId,
      assignedAt: new Date().toISOString(),
      assignedBy,
      status: 'pending',
      propertyAddress,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const { resource } = await container.items.create(assignment);
    
    // Update appraiser workload
    const appraiser = await this.getAppraiserById(appraiserId, tenantId);
    if (appraiser) {
      await this.updateAppraiser(appraiserId, tenantId, {
        currentWorkload: appraiser.currentWorkload + 1,
        lastAssignmentAt: new Date().toISOString()
      });
    }

    this.logger.info('Appraiser assigned', { orderId, appraiserId, assignmentId: resource?.id });
    return resource as AppraiserAssignment;
  }

  /**
   * Get available appraisers (capacity check)
   */
  async getAvailableAppraisers(tenantId: string, specialty?: string): Promise<Appraiser[]> {
    const allAppraisers = await this.getAllAppraisers(tenantId);
    
    return allAppraisers.filter(appraiser => {
      // Must be active and available
      if (appraiser.status !== 'active' || appraiser.availability === 'on_leave') {
        return false;
      }

      // Must have capacity
      if (appraiser.currentWorkload >= appraiser.maxCapacity) {
        return false;
      }

      // Check specialty if specified
      if (specialty && !appraiser.specialties.includes(specialty as any)) {
        return false;
      }

      // Check for expired licenses
      const hasValidLicense = appraiser.licenses.some(license => {
        const expiration = new Date(license.expirationDate);
        return license.status === 'active' && expiration > new Date();
      });

      return hasValidLicense;
    });
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959; // Earth's radius in miles
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
