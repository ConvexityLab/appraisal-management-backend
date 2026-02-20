/**
 * Appraiser Service
 * Manages appraiser profiles, licenses, assignments, and conflict checking
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { AzureCommunicationService } from './azure-communication.service.js';
import { SLATrackingService } from './sla-tracking.service.js';
import { OrderEventService } from './order-event.service.js';
import { AuditTrailService } from './audit-trail.service.js';
import { Logger } from '../utils/logger.js';
import { OrderStatus, normalizeOrderStatus } from '../types/order-status.js';
import type { Appraiser, AppraiserAssignment, ConflictCheckResult, License } from '../types/appraiser.types.js';

export class AppraiserService {
  private cosmosService: CosmosDbService;
  private communicationService: AzureCommunicationService;
  private eventService: OrderEventService;
  private auditService: AuditTrailService;
  private logger: Logger;

  constructor(cosmosService?: CosmosDbService) {
    this.cosmosService = cosmosService || new CosmosDbService();
    this.communicationService = new AzureCommunicationService();
    this.eventService = new OrderEventService();
    this.auditService = new AuditTrailService();
    this.logger = new Logger('AppraiserService');
  }

  /**
   * Get all appraisers
   */
  async getAllAppraisers(tenantId: string): Promise<Appraiser[]> {
    this.logger.info('getAllAppraisers called', { tenantId });
    const container = this.cosmosService.getContainer('vendors'); // Appraisers are vendors
    const query = {
      query: 'SELECT * FROM c WHERE c.type = @type AND c.tenantId = @tenantId',
      parameters: [
        { name: '@type', value: 'appraiser' },
        { name: '@tenantId', value: tenantId }
      ]
    };

    this.logger.info('Executing appraiser query', { query: query.query, parameters: query.parameters });
    const { resources } = await container.items.query<Appraiser>(query).fetchAll();
    this.logger.info('Query results', { count: resources.length, ids: resources.map(r => r.id) });
    return resources;
  }

  /**
   * Get appraiser by ID
   */
  async getAppraiserById(appraiserId: string, tenantId: string): Promise<Appraiser | null> {
    try {
      const container = this.cosmosService.getContainer('vendors');
      // Vendors container uses 'licenseState' as partition key
      // We need to query by id since we don't know the license state
      const query = {
        query: 'SELECT * FROM c WHERE c.id = @id AND c.type = @type AND c.tenantId = @tenantId',
        parameters: [
          { name: '@id', value: appraiserId },
          { name: '@type', value: 'appraiser' },
          { name: '@tenantId', value: tenantId }
        ]
      };
      
      const { resources } = await container.items.query<Appraiser>(query, { maxItemCount: 1 }).fetchAll();
      
      if (resources.length === 0) {
        this.logger.info('Appraiser not found', { appraiserId, tenantId });
        return null;
      }
      
      return resources[0] || null;
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
    const container = this.cosmosService.getContainer('vendors');
    
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
    const container = this.cosmosService.getContainer('vendors');
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

    // Use licenseState partition key (exists in runtime data, not in type definition)
    const partitionKey = (existing as any).licenseState || tenantId;
    const { resource } = await container.item(appraiserId, partitionKey).replace(updated);
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
      
      // Send notification to appraiser about new assignment
      try {
        const subject = `New Appraisal Assignment - ${propertyAddress}`;
        const body = `Hello ${appraiser.firstName},

You have been assigned to a new appraisal order.

Order Number: ${assignment.orderNumber}
Property Address: ${propertyAddress}
Assignment ID: ${resource?.id}

Please log in to the platform to review and accept this assignment.

Thank you,
Appraisal Management Team`.trim();
        
        // Send email notification
        if (appraiser.email) {
          const emailClient = this.communicationService.getEmailClient();
          const emailMessage = {
            senderAddress: this.communicationService.getEmailSenderAddress(),
            content: {
              subject,
              plainText: body,
              html: body.replace(/\n/g, '<br>')
            },
            recipients: {
              to: [{ address: appraiser.email }]
            }
          };
          
          const poller = await emailClient.beginSend(emailMessage);
          await poller.pollUntilDone();
          
          this.logger.info('Assignment notification email sent', { 
            appraiserId, 
            email: appraiser.email,
            assignmentId: resource?.id 
          });
        }
        
        // Send SMS notification
        if (appraiser.phone && this.communicationService.isSmsConfigured()) {
          const smsClient = this.communicationService.getSmsClient();
          const smsBody = `New appraisal assignment at ${propertyAddress}. Order: ${assignment.orderNumber}. Please log in to accept.`;
          
          await smsClient.send({
            from: this.communicationService.getSmsSenderNumber(),
            to: [appraiser.phone],
            message: smsBody
          });
          
          this.logger.info('Assignment notification SMS sent', { 
            appraiserId, 
            phone: appraiser.phone,
            assignmentId: resource?.id 
          });
        }
      } catch (notificationError) {
        this.logger.error('Failed to send assignment notification', { 
          error: notificationError,
          appraiserId,
          assignmentId: resource?.id
        });
        // Don't fail the assignment if notification fails
      }
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

  /**
   * Get pending assignments for appraiser
   */
  async getPendingAssignments(appraiserId: string, tenantId: string): Promise<AppraiserAssignment[]> {
    const container = this.cosmosService.getContainer('orders');
    
    const query = {
      query: `SELECT * FROM c 
              WHERE c.type = @type 
              AND c.appraiserId = @appraiserId 
              AND c.tenantId = @tenantId 
              AND c.status = @status
              ORDER BY c.assignedAt DESC`,
      parameters: [
        { name: '@type', value: 'appraiser_assignment' },
        { name: '@appraiserId', value: appraiserId },
        { name: '@tenantId', value: tenantId },
        { name: '@status', value: 'pending' }
      ]
    };

    const { resources } = await container.items.query<AppraiserAssignment>(query).fetchAll();
    return resources;
  }

  /**
   * Accept an assignment
   */
  async acceptAssignment(
    assignmentId: string,
    appraiserId: string,
    tenantId: string,
    notes?: string
  ): Promise<AppraiserAssignment> {
    const container = this.cosmosService.getContainer('orders');
    
    // Get the assignment
    const { resource: assignment } = await container.item(assignmentId, tenantId).read<AppraiserAssignment>();
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }
    
    if (assignment.appraiserId !== appraiserId) {
      throw new Error('Assignment does not belong to this appraiser');
    }
    
    if (assignment.status !== 'pending') {
      throw new Error(`Assignment already ${assignment.status}`);
    }
    
    // Update assignment status
    const updatedAssignment: AppraiserAssignment = {
      ...assignment,
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const { resource } = await container.item(assignmentId, tenantId).replace(updatedAssignment);
    
    this.logger.info('Assignment accepted', { 
      assignmentId, 
      appraiserId, 
      orderId: assignment.orderId 
    });

    // Update parent order status to ACCEPTED (unified with negotiation flow)
    try {
      const ordersContainer = this.cosmosService.getContainer('orders');
      const { resource: order } = await ordersContainer.item(assignment.orderId, tenantId).read();
      if (order) {
        await ordersContainer.item(assignment.orderId, tenantId).replace({
          ...order,
          status: 'ACCEPTED',
          acceptedAt: new Date().toISOString(),
          acceptedBy: appraiserId,
          updatedAt: new Date().toISOString()
        });
        this.logger.info('Parent order status updated to ACCEPTED', { orderId: assignment.orderId });

        // Fire event bus + audit trail (unified with OrderController behavior)
        let previousStatus: OrderStatus;
        try {
          previousStatus = normalizeOrderStatus(order.status);
        } catch {
          previousStatus = OrderStatus.ASSIGNED;
        }
        this.eventService.publishOrderStatusChanged(
          assignment.orderId, previousStatus, OrderStatus.ACCEPTED, appraiserId,
        ).catch((err) =>
          this.logger.error('Failed to publish ORDER_STATUS_CHANGED event', { orderId: assignment.orderId, error: err }),
        );
        this.auditService.log({
          actor: { userId: appraiserId, role: 'appraiser' },
          action: 'order.status_changed',
          resource: { type: 'order', id: assignment.orderId },
          before: { status: previousStatus },
          after: { status: 'ACCEPTED' },
          metadata: { source: 'appraiser-assignment-accept', assignmentId, notes },
        }).catch((err) =>
          this.logger.error('Failed to write audit log for assignment acceptance', { orderId: assignment.orderId, error: err }),
        );

        // Create negotiation audit record for consistency
        try {
          const negotiationsContainer = this.cosmosService.getContainer('negotiations');
          await negotiationsContainer.items.create({
            id: `negotiation-${assignment.orderId}-${Date.now()}`,
            orderId: assignment.orderId,
            vendorId: appraiserId,
            clientId: order.clientId,
            tenantId,
            status: 'ACCEPTED',
            originalTerms: {
              fee: order.fee || 0,
              dueDate: order.dueDate ? new Date(order.dueDate) : new Date(),
              rushFee: order.urgency === 'RUSH',
              specialInstructions: order.specialInstructions || ''
            },
            currentTerms: {
              fee: order.fee || 0,
              dueDate: order.dueDate ? new Date(order.dueDate) : new Date(),
              additionalConditions: []
            },
            rounds: [{
              roundNumber: 1,
              timestamp: new Date(),
              actor: 'VENDOR',
              action: 'ACCEPT',
              proposedTerms: {
                fee: order.fee || 0,
                dueDate: order.dueDate ? new Date(order.dueDate) : new Date(),
                notes: notes || 'Assignment accepted via appraiser portal'
              }
            }],
            maxRounds: 3,
            expirationTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
            createdAt: new Date(),
            updatedAt: new Date(),
            decidedAt: new Date(),
            decidedBy: appraiserId
          });
          this.logger.info('Negotiation audit record created', { orderId: assignment.orderId });
        } catch (auditError) {
          this.logger.error('Failed to create negotiation audit record (non-fatal)', {
            orderId: assignment.orderId,
            error: auditError instanceof Error ? auditError.message : String(auditError)
          });
        }

        // Start SLA tracking for the accepted order
        try {
          const slaService = new SLATrackingService();
          await slaService.startSLATracking(
            'APPRAISAL',
            assignment.orderId,
            assignment.orderId,
            order.orderNumber || assignment.orderId,
            order.urgency || order.priority || 'ROUTINE',
            order.clientId
          );
          this.logger.info('SLA tracking started for accepted assignment', { orderId: assignment.orderId });
        } catch (slaError) {
          this.logger.error('Failed to start SLA tracking (non-fatal)', {
            orderId: assignment.orderId,
            error: slaError instanceof Error ? slaError.message : String(slaError)
          });
        }
      }
    } catch (orderUpdateError) {
      this.logger.error('Failed to update parent order status (non-fatal)', {
        orderId: assignment.orderId,
        error: orderUpdateError instanceof Error ? orderUpdateError.message : String(orderUpdateError)
      });
      // Don't fail the acceptance if the parent order update fails
    }
    
    // Send notification to vendor/AMC about acceptance
    try {
      const appraiser = await this.getAppraiserById(appraiserId, tenantId);
      
      if (appraiser) {
        // Get order details to find vendor
        const ordersContainer = this.cosmosService.getContainer('orders');
        const { resource: order } = await ordersContainer.item(assignment.orderId, tenantId).read();
        
        if (order && order.assignedVendorId) {
          // Get vendor details
          const vendorsContainer = this.cosmosService.getContainer('vendors');
          const vendorQuery = {
            query: 'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId',
            parameters: [
              { name: '@id', value: order.assignedVendorId },
              { name: '@tenantId', value: tenantId }
            ]
          };
          const { resources: vendors } = await vendorsContainer.items.query(vendorQuery).fetchAll();
          const vendor = vendors[0];
          
          if (vendor && vendor.email) {
            const subject = `Appraiser Accepted Assignment - ${assignment.propertyAddress}`;
            const body = `The appraiser ${appraiser.firstName} ${appraiser.lastName} has accepted the assignment for:

Order Number: ${assignment.orderNumber}
Property Address: ${assignment.propertyAddress}
Accepted At: ${new Date().toLocaleString()}

The appraisal work can now proceed.

Thank you,
Appraisal Management Team`.trim();
            
            const emailClient = this.communicationService.getEmailClient();
            const emailMessage = {
              senderAddress: this.communicationService.getEmailSenderAddress(),
              content: {
                subject,
                plainText: body,
                html: body.replace(/\n/g, '<br>')
              },
              recipients: {
                to: [{ address: vendor.email }]
              }
            };
            
            const poller = await emailClient.beginSend(emailMessage);
            await poller.pollUntilDone();
            
            this.logger.info('Acceptance notification sent to vendor', { 
              vendorId: vendor.id, 
              email: vendor.email,
              assignmentId 
            });
          }
        }
      }
    } catch (notificationError) {
      this.logger.error('Failed to send acceptance notification', { 
        error: notificationError,
        assignmentId
      });
      // Don't fail the acceptance if notification fails
    }
    
    return resource as AppraiserAssignment;
  }

  /**
   * Reject an assignment
   */
  async rejectAssignment(
    assignmentId: string,
    appraiserId: string,
    tenantId: string,
    reason: string
  ): Promise<AppraiserAssignment> {
    const container = this.cosmosService.getContainer('orders');
    
    // Get the assignment
    const { resource: assignment } = await container.item(assignmentId, tenantId).read<AppraiserAssignment>();
    
    if (!assignment) {
      throw new Error('Assignment not found');
    }
    
    if (assignment.appraiserId !== appraiserId) {
      throw new Error('Assignment does not belong to this appraiser');
    }
    
    if (assignment.status !== 'pending') {
      throw new Error(`Assignment already ${assignment.status}`);
    }
    
    // Update assignment status
    const updatedAssignment: AppraiserAssignment = {
      ...assignment,
      status: 'declined',
      declinedAt: new Date().toISOString(),
      declineReason: reason,
      updatedAt: new Date().toISOString()
    };
    
    const { resource } = await container.item(assignmentId, tenantId).replace(updatedAssignment);
    
    // Decrement appraiser workload
    const appraiser = await this.getAppraiserById(appraiserId, tenantId);
    if (appraiser && appraiser.currentWorkload > 0) {
      await this.updateAppraiser(appraiserId, tenantId, {
        currentWorkload: appraiser.currentWorkload - 1
      });
    }
    
    this.logger.info('Assignment rejected', { 
      assignmentId, 
      appraiserId, 
      orderId: assignment.orderId,
      reason 
    });

    // Update parent order status to PENDING_ASSIGNMENT (needs reassignment)
    try {
      const ordersContainer = this.cosmosService.getContainer('orders');
      const { resource: order } = await ordersContainer.item(assignment.orderId, tenantId).read();
      if (order) {
        await ordersContainer.item(assignment.orderId, tenantId).replace({
          ...order,
          status: 'PENDING_ASSIGNMENT',
          assignedVendorId: null,
          assignedVendorName: null,
          updatedAt: new Date().toISOString()
        });
        this.logger.info('Parent order status updated to PENDING_ASSIGNMENT', { orderId: assignment.orderId });

        // Create negotiation audit record for consistency
        try {
          const negotiationsContainer = this.cosmosService.getContainer('negotiations');
          await negotiationsContainer.items.create({
            id: `negotiation-${assignment.orderId}-${Date.now()}`,
            orderId: assignment.orderId,
            vendorId: appraiserId,
            clientId: order.clientId,
            tenantId,
            status: 'REJECTED',
            originalTerms: {
              fee: order.fee || 0,
              dueDate: order.dueDate ? new Date(order.dueDate) : new Date(),
              rushFee: order.urgency === 'RUSH',
              specialInstructions: order.specialInstructions || ''
            },
            currentTerms: {
              fee: order.fee || 0,
              dueDate: order.dueDate ? new Date(order.dueDate) : new Date(),
              additionalConditions: []
            },
            rounds: [{
              roundNumber: 1,
              timestamp: new Date(),
              actor: 'VENDOR',
              action: 'REJECT',
              proposedTerms: {
                fee: order.fee || 0,
                dueDate: order.dueDate ? new Date(order.dueDate) : new Date(),
                notes: `Assignment declined: ${reason}`
              },
              reason
            }],
            maxRounds: 3,
            expirationTime: new Date(Date.now() + 4 * 60 * 60 * 1000),
            createdAt: new Date(),
            updatedAt: new Date(),
            decidedAt: new Date(),
            decidedBy: appraiserId
          });
          this.logger.info('Negotiation audit record created for rejection', { orderId: assignment.orderId });
        } catch (auditError) {
          this.logger.error('Failed to create negotiation audit record (non-fatal)', {
            orderId: assignment.orderId,
            error: auditError instanceof Error ? auditError.message : String(auditError)
          });
        }
      }
    } catch (orderUpdateError) {
      this.logger.error('Failed to update parent order status (non-fatal)', {
        orderId: assignment.orderId,
        error: orderUpdateError instanceof Error ? orderUpdateError.message : String(orderUpdateError)
      });
    }
    
    // Send notification to vendor/AMC about rejection (needs reassignment)
    try {
      if (appraiser) {
        // Get order details to find vendor
        const ordersContainer = this.cosmosService.getContainer('orders');
        const { resource: order } = await ordersContainer.item(assignment.orderId, tenantId).read();
        
        if (order && order.assignedVendorId) {
          // Get vendor details
          const vendorsContainer = this.cosmosService.getContainer('vendors');
          const vendorQuery = {
            query: 'SELECT * FROM c WHERE c.id = @id AND c.tenantId = @tenantId',
            parameters: [
              { name: '@id', value: order.assignedVendorId },
              { name: '@tenantId', value: tenantId }
            ]
          };
          const { resources: vendors } = await vendorsContainer.items.query(vendorQuery).fetchAll();
          const vendor = vendors[0];
          
          if (vendor && vendor.email) {
            const subject = `Appraiser Declined Assignment - ${assignment.propertyAddress}`;
            const body = `The appraiser ${appraiser.firstName} ${appraiser.lastName} has declined the assignment for:

Order Number: ${assignment.orderNumber}
Property Address: ${assignment.propertyAddress}
Declined At: ${new Date().toLocaleString()}
Reason: ${reason}

A different appraiser needs to be assigned to this order.

Thank you,
Appraisal Management Team`.trim();
            
            const emailClient = this.communicationService.getEmailClient();
            const emailMessage = {
              senderAddress: this.communicationService.getEmailSenderAddress(),
              content: {
                subject,
                plainText: body,
                html: body.replace(/\n/g, '<br>')
              },
              recipients: {
                to: [{ address: vendor.email }]
              }
            };
            
            const poller = await emailClient.beginSend(emailMessage);
            await poller.pollUntilDone();
            
            this.logger.info('Rejection notification sent to vendor', { 
              vendorId: vendor.id, 
              email: vendor.email,
              assignmentId 
            });
          }
        }
      }
    } catch (notificationError) {
      this.logger.error('Failed to send rejection notification', { 
        error: notificationError,
        assignmentId
      });
      // Don't fail the rejection if notification fails
    }
    
    return resource as AppraiserAssignment;
  }
}
