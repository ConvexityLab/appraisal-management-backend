/**
 * Inspection Service
 * Business logic for property inspection scheduling and management
 */

import { CosmosDbService } from './cosmos-db.service.js';
import { Logger } from '../utils/logger.js';
import type { 
  InspectionAppointment, 
  ScheduleInspectionRequest,
  RescheduleInspectionRequest,
  AppraiserAvailability,
  SchedulingConflict,
  TimeSlot
} from '../types/inspection.types.js';

export class InspectionService {
  private cosmosService: CosmosDbService;
  private logger: Logger;

  constructor(cosmosService: CosmosDbService) {
    this.cosmosService = cosmosService;
    this.logger = new Logger('InspectionService');
  }

  /**
   * Get all inspections for a tenant
   */
  async getAllInspections(tenantId: string, status?: string): Promise<InspectionAppointment[]> {
    const container = this.cosmosService.getContainer('orders');
    
    // Phase B inspection unification: filter by VendorOrder role rather than
    // the legacy `type: 'inspection'` discriminator. Inspections are now
    // VendorOrders with role='INSPECTION'.
    let query = "SELECT * FROM c WHERE c.type = 'vendor-order' AND c.role = 'INSPECTION' AND c.tenantId = @tenantId";
    const parameters: any[] = [
      { name: '@tenantId', value: tenantId }
    ];

    if (status) {
      query += ' AND c.status = @status';
      parameters.push({ name: '@status', value: status });
    }

    query += ' ORDER BY c.scheduledSlot.date DESC, c.scheduledSlot.startTime DESC';

    const { resources } = await container.items.query<InspectionAppointment>({
      query,
      parameters
    }).fetchAll();

    return resources;
  }

  /**
   * Get inspection by ID
   */
  async getInspectionById(inspectionId: string): Promise<InspectionAppointment | null> {
    try {
      const container = this.cosmosService.getContainer('orders');
      // Cross-partition query — orders container is partitioned by /tenantId
      const { resources } = await container.items.query<InspectionAppointment>({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: inspectionId }],
      }).fetchAll();
      return resources[0] ?? null;
    } catch (error: any) {
      if (error.code === 404) {
        return null;
      }
      this.logger.error('Error getting inspection', { inspectionId, error: error.message });
      throw error;
    }
  }

  /**
   * Get inspections for a specific order
   */
  async getInspectionsByOrderId(orderId: string, tenantId: string = 'test-tenant-123'): Promise<InspectionAppointment[]> {
    const container = this.cosmosService.getContainer('orders');
    
    const { resources } = await container.items.query<InspectionAppointment>({
      // Phase B inspection unification: filter by VendorOrder role.
      query: "SELECT * FROM c WHERE c.type = 'vendor-order' AND c.role = 'INSPECTION' AND c.orderId = @orderId AND c.tenantId = @tenantId ORDER BY c.createdAt DESC",
      parameters: [
        { name: '@orderId', value: orderId },
        { name: '@tenantId', value: tenantId }
      ]
    }).fetchAll();

    return resources;
  }

  /**
   * Get inspections for a specific appraiser
   */
  async getInspectionsByAppraiserId(appraiserId: string, tenantId: string = 'test-tenant-123', status?: string): Promise<InspectionAppointment[]> {
    const container = this.cosmosService.getContainer('orders');
    
    // Phase B inspection unification: filter by VendorOrder role.
    let query = "SELECT * FROM c WHERE c.type = 'vendor-order' AND c.role = 'INSPECTION' AND c.appraiserId = @appraiserId AND c.tenantId = @tenantId";
    const parameters: any[] = [
      { name: '@appraiserId', value: appraiserId },
      { name: '@tenantId', value: tenantId }
    ];

    if (status) {
      query += ' AND c.status = @status';
      parameters.push({ name: '@status', value: status });
    }

    query += ' ORDER BY c.scheduledSlot.date ASC, c.scheduledSlot.startTime ASC';

    const { resources } = await container.items.query<InspectionAppointment>({
      query,
      parameters
    }).fetchAll();

    return resources;
  }

  /**
   * Schedule a new inspection
   */
  async scheduleInspection(request: ScheduleInspectionRequest, tenantId: string = 'test-tenant-123', userId: string = 'test-user'): Promise<InspectionAppointment> {
    // Check for scheduling conflicts
    const conflict = await this.checkSchedulingConflict(request.appraiserId, request.scheduledSlot, tenantId);
    if (conflict.hasConflict) {
      throw new Error(`Scheduling conflict: ${conflict.message}`);
    }

    // Get order details
    const ordersContainer = this.cosmosService.getContainer('orders');
    const { resource: order } = await ordersContainer.item(request.orderId, 'assigned').read();
    if (!order) {
      throw new Error('Order not found');
    }

    // Get appraiser details
    const { resource: appraiser } = await ordersContainer.item(request.appraiserId, 'active').read();
    if (!appraiser) {
      throw new Error('Appraiser not found');
    }

    // Phase B step 9: inherit engagement linkage from the parent VendorOrder
    // and validate before write. The Inspection appointment shares the
    // `orders` container with VendorOrders but uses its own discriminator
    // (`type: 'inspection'`); a follow-up should unify under
    // VendorOrder(role='INSPECTION') per ORDER-DOMAIN-REDESIGN.md §2.1.
    // For now, stamping the linkage prevents orphan creation through this
    // path — same gap class fixed by the SFTP linkage guard (step 8).
    const parentOrder = order as { engagementId?: string; engagementPropertyId?: string; engagementClientOrderId?: string; orderNumber?: string; propertyAddress?: unknown; propertyType?: string };
    const linkageErrors: string[] = [];
    if (!parentOrder.engagementId) linkageErrors.push('missing engagementId');
    if (!parentOrder.engagementPropertyId) linkageErrors.push('missing engagementPropertyId');
    if (!parentOrder.engagementClientOrderId) linkageErrors.push('missing engagementClientOrderId');
    if (linkageErrors.length > 0) {
      throw new Error(
        `Engagement-primacy: cannot schedule inspection — parent order ${request.orderId} ${linkageErrors.join(', ')}`,
      );
    }

    const now = new Date().toISOString();
    // Phase B inspection unification (partial): write the InspectionAppointment
    // as a VendorOrder with `role: 'INSPECTION'` per ORDER-DOMAIN-REDESIGN.md
    // §2.1. The inspection-specific scheduling fields (scheduledSlot,
    // alternateSlots, propertyAccess, etc.) ride along on the same doc since
    // VendorOrder is `Order & VendorOrderLinkage` and accepts extra fields.
    //
    // Type discriminator and role:
    //   - type: 'vendor-order' (was 'inspection')
    //   - role: 'INSPECTION'  (new field on VendorOrderLinkage)
    //
    // Read-path query update (this file lines 32, 81, 98) must filter
    // `c.type = 'vendor-order' AND c.role = 'INSPECTION'` instead of
    // `c.type = 'inspection'`. Done in lockstep below.
    const inspection: InspectionAppointment & { role?: string } = {
      id: `inspection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'vendor-order' as never,
      role: 'INSPECTION',
      appointmentType: request.appointmentType ?? 'property_inspection',
      tenantId,
      orderId: request.orderId,
      orderNumber: order.orderNumber,
      // Engagement linkage (inherited from parent VendorOrder)
      engagementId: parentOrder.engagementId!,
      engagementPropertyId: parentOrder.engagementPropertyId!,
      engagementClientOrderId: parentOrder.engagementClientOrderId!,
      appraiserId: request.appraiserId,
      appraiserName: `${appraiser.firstName} ${appraiser.lastName}`,
      appraiserPhone: appraiser.phone,
      propertyAddress: order.propertyAddress,
      propertyType: order.propertyType,
      propertyAccess: request.propertyAccess,
      status: 'scheduled',
      scheduledSlot: request.scheduledSlot,
      requestedBy: request.requestedBy,
      requestedAt: now,
      inspectionNotes: request.inspectionNotes ?? '',
      createdAt: now,
      updatedAt: now,
      createdBy: userId
    } as InspectionAppointment;

    await ordersContainer.items.create(inspection);
    this.logger.info('Inspection scheduled', { inspectionId: inspection.id, orderId: request.orderId });

    return inspection;
  }

  /**
   * Reschedule an existing inspection
   */
  async rescheduleInspection(
    inspectionId: string, 
    request: RescheduleInspectionRequest, 
    tenantId: string = 'test-tenant-123',
    userId: string = 'test-user'
  ): Promise<InspectionAppointment> {
    const container = this.cosmosService.getContainer('orders');
    const { resource: inspection } = await container.item(inspectionId, 'scheduled').read<InspectionAppointment>();
    
    if (!inspection) {
      throw new Error('Inspection not found');
    }

    if (inspection.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    // Check for conflicts with new slot
    const conflict = await this.checkSchedulingConflict(inspection.appraiserId, request.newSlot, tenantId, inspectionId);
    if (conflict.hasConflict) {
      throw new Error(`Scheduling conflict: ${conflict.message}`);
    }

    const updatedInspection: InspectionAppointment = {
      ...inspection,
      status: 'rescheduled',
      rescheduledFrom: inspection.scheduledSlot,
      scheduledSlot: request.newSlot,
      alternateSlots: request.alternateSlots ?? [],
      rescheduledReason: request.reason,
      updatedAt: new Date().toISOString()
    };

    await container.items.upsert(updatedInspection);
    this.logger.info('Inspection rescheduled', { inspectionId, reason: request.reason });

    return updatedInspection;
  }

  /**
   * Confirm an inspection appointment
   */
  async confirmInspection(inspectionId: string, tenantId: string = 'test-tenant-123', userId: string = 'test-user'): Promise<InspectionAppointment> {
    const container = this.cosmosService.getContainer('orders');
    const { resource: inspection } = await container.item(inspectionId, 'scheduled').read<InspectionAppointment>();
    
    if (!inspection) {
      throw new Error('Inspection not found');
    }

    if (inspection.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    const updatedInspection: InspectionAppointment = {
      ...inspection,
      status: 'confirmed',
      confirmedAt: new Date().toISOString(),
      confirmedBy: userId,
      updatedAt: new Date().toISOString()
    };

    await container.items.upsert(updatedInspection);
    this.logger.info('Inspection confirmed', { inspectionId });

    return updatedInspection;
  }

  /**
   * Mark inspection as started
   */
  async startInspection(inspectionId: string, tenantId: string = 'test-tenant-123'): Promise<InspectionAppointment> {
    const container = this.cosmosService.getContainer('orders');
    const { resource: inspection } = await container.item(inspectionId, 'confirmed').read<InspectionAppointment>();
    
    if (!inspection) {
      throw new Error('Inspection not found or not confirmed');
    }

    if (inspection.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    const updatedInspection: InspectionAppointment = {
      ...inspection,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await container.items.upsert(updatedInspection);
    this.logger.info('Inspection started', { inspectionId });

    return updatedInspection;
  }

  /**
   * Complete an inspection
   */
  async completeInspection(
    inspectionId: string, 
    tenantId: string = 'test-tenant-123',
    notes?: string,
    photoCount?: number
  ): Promise<InspectionAppointment> {
    const container = this.cosmosService.getContainer('orders');
    const { resource: inspection } = await container.item(inspectionId, 'in_progress').read<InspectionAppointment>();
    
    if (!inspection) {
      throw new Error('Inspection not found or not in progress');
    }

    if (inspection.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    const completedAt = new Date();
    const durationMinutes = inspection.startedAt 
      ? Math.round((completedAt.getTime() - new Date(inspection.startedAt).getTime()) / 60000)
      : 0;

    const updatedInspection: InspectionAppointment = {
      ...inspection,
      status: 'completed',
      completedAt: completedAt.toISOString(),
      durationMinutes,
      inspectionNotes: notes ?? inspection.inspectionNotes ?? '',
      photoCount: photoCount ?? 0,
      updatedAt: completedAt.toISOString()
    };

    await container.items.upsert(updatedInspection);
    this.logger.info('Inspection completed', { inspectionId, durationMinutes });

    return updatedInspection;
  }

  /**
   * Cancel an inspection
   */
  async cancelInspection(
    inspectionId: string, 
    tenantId: string = 'test-tenant-123',
    reason: string,
    userId: string = 'test-user'
  ): Promise<InspectionAppointment> {
    const container = this.cosmosService.getContainer('orders');
    const { resource: inspection } = await container.item(inspectionId, 'scheduled').read<InspectionAppointment>();
    
    if (!inspection) {
      throw new Error('Inspection not found');
    }

    if (inspection.tenantId !== tenantId) {
      throw new Error('Unauthorized');
    }

    const updatedInspection: InspectionAppointment = {
      ...inspection,
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancellationReason: reason,
      cancelledBy: userId,
      updatedAt: new Date().toISOString()
    };

    await container.items.upsert(updatedInspection);
    this.logger.info('Inspection cancelled', { inspectionId, reason });

    return updatedInspection;
  }

  /**
   * Check for scheduling conflicts
   */
  async checkSchedulingConflict(
    appraiserId: string, 
    slot: TimeSlot, 
    tenantId: string,
    excludeInspectionId?: string
  ): Promise<SchedulingConflict> {
    const existingInspections = await this.getInspectionsByAppraiserId(appraiserId, tenantId, 'scheduled');
    
    for (const existing of existingInspections) {
      if (excludeInspectionId && existing.id === excludeInspectionId) {
        continue;
      }

      // Check if slots overlap
      if (existing.scheduledSlot.date === slot.date) {
        const existingStart = this.timeToMinutes(existing.scheduledSlot.startTime);
        const existingEnd = this.timeToMinutes(existing.scheduledSlot.endTime);
        const newStart = this.timeToMinutes(slot.startTime);
        const newEnd = this.timeToMinutes(slot.endTime);

        if ((newStart >= existingStart && newStart < existingEnd) ||
            (newEnd > existingStart && newEnd <= existingEnd) ||
            (newStart <= existingStart && newEnd >= existingEnd)) {
          return {
            hasConflict: true,
            conflictType: 'double_booked',
            conflictingAppointment: {
              inspectionId: existing.id,
              orderId: existing.orderId,
              scheduledSlot: existing.scheduledSlot
            },
            message: `Appraiser already has an inspection scheduled at ${existing.scheduledSlot.startTime}-${existing.scheduledSlot.endTime}`
          };
        }
      }
    }

    return { hasConflict: false };
  }

  /**
   * Convert time string to minutes since midnight
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return (hours ?? 0) * 60 + (minutes ?? 0);
  }
}
