/**
 * Access Control Helper Service
 * 
 * Utilities for managing access control metadata on documents
 */

import { Logger } from '../utils/logger';
import { AccessControl } from '../types/authorization.types';

export interface AddAccessControlOptions {
  ownerId: string;
  ownerEmail?: string;
  assignedUserIds?: string[];
  teamId?: string;
  departmentId?: string;
  clientId?: string;
  vendorId?: string;
  visibilityScope?: 'PUBLIC' | 'TEAM' | 'PRIVATE' | 'ASSIGNED_ONLY';
  tenantId: string;
}

export class AccessControlHelper {
  private logger: Logger;

  constructor() {
    this.logger = new Logger();
  }

  /**
   * Create access control metadata for a new document
   */
  createAccessControl(options: AddAccessControlOptions): AccessControl {
    return {
      ownerId: options.ownerId,
      ...(options.ownerEmail ? { ownerEmail: options.ownerEmail } : {}),
      assignedUserIds: options.assignedUserIds || [],
      ...(options.teamId ? { teamId: options.teamId } : {}),
      ...(options.departmentId ? { departmentId: options.departmentId } : {}),
      ...(options.clientId ? { clientId: options.clientId } : {}),
      ...(options.vendorId ? { vendorId: options.vendorId } : {}),
      visibilityScope: options.visibilityScope || 'PRIVATE',
      tenantId: options.tenantId
    };
  }

  /**
   * Add access control to an existing document
   */
  addAccessControl<T extends Record<string, any>>(
    document: T,
    options: AddAccessControlOptions
  ): T & { accessControl: AccessControl } {
    return {
      ...document,
      accessControl: this.createAccessControl(options)
    };
  }

  /**
   * Update access control metadata
   */
  updateAccessControl(
    existing: AccessControl,
    updates: Partial<AccessControl>
  ): AccessControl {
    return {
      ...existing,
      ...updates
    };
  }

  /**
   * Add user to assigned users list
   */
  assignUser(accessControl: AccessControl, userId: string): AccessControl {
    if (!accessControl.assignedUserIds.includes(userId)) {
      return {
        ...accessControl,
        assignedUserIds: [...accessControl.assignedUserIds, userId]
      };
    }
    return accessControl;
  }

  /**
   * Remove user from assigned users list
   */
  unassignUser(accessControl: AccessControl, userId: string): AccessControl {
    return {
      ...accessControl,
      assignedUserIds: accessControl.assignedUserIds.filter(id => id !== userId)
    };
  }

  /**
   * Transfer ownership
   */
  transferOwnership(
    accessControl: AccessControl,
    newOwnerId: string,
    newOwnerEmail?: string
  ): AccessControl {
    this.logger.info('Transferring ownership', {
      from: accessControl.ownerId,
      to: newOwnerId
    });

    return {
      ...accessControl,
      ownerId: newOwnerId,
      ...(newOwnerEmail ? { ownerEmail: newOwnerEmail } : (accessControl.ownerEmail ? { ownerEmail: accessControl.ownerEmail } : {}))
    };
  }

  /**
   * Change visibility scope
   */
  setVisibility(
    accessControl: AccessControl,
    scope: 'PUBLIC' | 'TEAM' | 'PRIVATE' | 'ASSIGNED_ONLY'
  ): AccessControl {
    return {
      ...accessControl,
      visibilityScope: scope
    };
  }

  /**
   * Check if user owns the resource
   */
  isOwner(accessControl: AccessControl, userId: string): boolean {
    return accessControl.ownerId === userId;
  }

  /**
   * Check if user is assigned to the resource
   */
  isAssigned(accessControl: AccessControl, userId: string): boolean {
    return accessControl.assignedUserIds.includes(userId);
  }

  /**
   * Check if user is owner or assigned
   */
  hasDirectAccess(accessControl: AccessControl, userId: string): boolean {
    return this.isOwner(accessControl, userId) || this.isAssigned(accessControl, userId);
  }

  /**
   * Get all users with direct access
   */
  getDirectAccessUsers(accessControl: AccessControl): string[] {
    return [accessControl.ownerId, ...accessControl.assignedUserIds];
  }

  /**
   * Bulk assign users
   */
  assignUsers(accessControl: AccessControl, userIds: string[]): AccessControl {
    const newAssignments = userIds.filter(
      id => !accessControl.assignedUserIds.includes(id)
    );

    return {
      ...accessControl,
      assignedUserIds: [...accessControl.assignedUserIds, ...newAssignments]
    };
  }

  /**
   * Bulk unassign users
   */
  unassignUsers(accessControl: AccessControl, userIds: string[]): AccessControl {
    return {
      ...accessControl,
      assignedUserIds: accessControl.assignedUserIds.filter(
        id => !userIds.includes(id)
      )
    };
  }

  /**
   * Replace all assignments
   */
  setAssignments(accessControl: AccessControl, userIds: string[]): AccessControl {
    return {
      ...accessControl,
      assignedUserIds: userIds
    };
  }

  /**
   * Create access control for an order
   */
  createOrderAccessControl(
    ownerId: string,
    ownerEmail: string,
    clientId: string,
    tenantId: string,
    options?: {
      teamId?: string;
      departmentId?: string;
      assignedUserIds?: string[];
    }
  ): AccessControl {
    return this.createAccessControl({
      ownerId,
      ownerEmail,
      clientId,
      tenantId,
      ...(options?.teamId ? { teamId: options.teamId } : {}),
      ...(options?.departmentId ? { departmentId: options.departmentId } : {}),
      assignedUserIds: options?.assignedUserIds || [],
      visibilityScope: 'TEAM'
    });
  }

  /**
   * Create access control for a QC review
   */
  createQCAccessControl(
    assignedAnalystId: string,
    orderId: string,
    teamId: string,
    tenantId: string
  ): AccessControl {
    return this.createAccessControl({
      ownerId: assignedAnalystId,
      assignedUserIds: [assignedAnalystId],
      teamId,
      tenantId,
      visibilityScope: 'ASSIGNED_ONLY'
    });
  }

  /**
   * Create access control for a vendor
   */
  createVendorAccessControl(
    managerId: string,
    managerEmail: string,
    vendorId: string,
    tenantId: string,
    options?: {
      teamId?: string;
      departmentId?: string;
    }
  ): AccessControl {
    return this.createAccessControl({
      ownerId: managerId,
      ownerEmail: managerEmail,
      vendorId,
      tenantId,
      ...(options?.teamId ? { teamId: options.teamId } : {}),
      ...(options?.departmentId ? { departmentId: options.departmentId } : {}),
      visibilityScope: 'TEAM'
    });
  }

  /**
   * Validate access control structure
   */
  validate(accessControl: AccessControl): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!accessControl.ownerId) {
      errors.push('ownerId is required');
    }

    if (!accessControl.tenantId) {
      errors.push('tenantId is required');
    }

    if (!Array.isArray(accessControl.assignedUserIds)) {
      errors.push('assignedUserIds must be an array');
    }

    if (!['PUBLIC', 'TEAM', 'PRIVATE', 'ASSIGNED_ONLY'].includes(accessControl.visibilityScope)) {
      errors.push('visibilityScope must be PUBLIC, TEAM, PRIVATE, or ASSIGNED_ONLY');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}
