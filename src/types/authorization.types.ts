/**
 * Authorization Type Definitions
 * 
 * Core types for attribute-based access control (ABAC)
 */

export interface AccessScope {
  // Organizational hierarchy
  teamIds: string[];
  departmentIds: string[];
  
  // Client/vendor relationships
  managedClientIds?: string[];
  managedVendorIds?: string[];
  
  // User management
  managedUserIds?: string[];
  
  // Geographic scope
  regionIds?: string[];
  statesCovered?: string[];
  
  // Special permissions
  canViewAllOrders?: boolean;
  canViewAllVendors?: boolean;
  canOverrideQC?: boolean;
}

export interface AccessControl {
  // Ownership
  ownerId: string;
  ownerEmail?: string;
  
  // Assignment
  assignedUserIds: string[];
  
  // Organizational
  teamId?: string;
  departmentId?: string;
  
  // Business relationships
  clientId?: string;
  vendorId?: string;
  
  // Visibility
  visibilityScope: 'PUBLIC' | 'TEAM' | 'PRIVATE' | 'ASSIGNED_ONLY';
  
  // Multi-tenancy
  tenantId: string;
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  azureAdObjectId?: string;
  tenantId: string;
  role: string;
  accessScope: AccessScope;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  matchedPolicies?: string[];
  evaluationTime?: number;
}

export interface QueryFilter {
  sql: string;
  parameters: Array<{ name: string; value: any }>;
}

/**
 * Graph-Based Access Control
 * Models relationships as: Entity -> [Actions] -> Object
 */

export interface AccessRelationship {
  id: string;
  
  // Subject (who)
  entityType: 'user' | 'role' | 'group' | 'team';
  entityId: string;
  entityName?: string;
  
  // Object (what)
  objectType: string;
  objectId: string;
  objectName?: string;
  
  // Actions (how)
  actions: string[];
  
  // Metadata
  grantedBy: string;
  grantedByName?: string;
  grantedAt: Date;
  expiresAt?: Date;
  reason?: string;
  
  // Conditions
  conditions?: {
    timeWindow?: {
      startTime?: string; // HH:MM format
      endTime?: string;
    };
    ipRestrictions?: string[];
    requiresMFA?: boolean;
  };
  
  // Multi-tenancy
  tenantId: string;
  
  // Audit
  lastUsed?: Date;
  useCount?: number;
}

export interface AccessGraph {
  entities: AccessEntity[];
  relationships: AccessRelationship[];
}

export interface AccessEntity {
  type: 'user' | 'role' | 'group' | 'team';
  id: string;
  name: string;
  attributes?: Record<string, any>;
}

export interface AccessPath {
  from: AccessEntity;
  to: { type: string; id: string; name?: string };
  via: AccessRelationship[];
  actions: string[];
}

export interface AuthorizationContext {
  user: {
    id: string;
    role: string;
    email: string;
    teamIds: string[];
    departmentIds: string[];
    managedClientIds?: string[];
    canViewAllOrders?: boolean;
  };
  resource: {
    type: string;
    id: string;
    ownerId?: string;
    teamId?: string;
    departmentId?: string;
    clientId?: string;
    assignedUserIds?: string[];
  };
  action: string;
  context?: {
    ipAddress?: string;
    timestamp: Date;
    requestId?: string;
  };
}

export interface AuthorizationAuditLog {
  id: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  userRole: string;
  resourceType: string;
  resourceId: string;
  action: string;
  decision: 'allow' | 'deny';
  reason?: string;
  matchedPolicies?: string[];
  ipAddress?: string;
  timestamp: Date;
}

export type ResourceType = 
  | 'order' 
  | 'vendor' 
  | 'qc_review' 
  | 'qc_queue' 
  | 'revision' 
  | 'escalation' 
  | 'analytics'
  | 'user';

export type Action = 
  | 'read' 
  | 'create' 
  | 'update' 
  | 'delete' 
  | 'execute' 
  | 'approve' 
  | 'reject';
