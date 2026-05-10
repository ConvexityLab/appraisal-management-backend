/**
 * Authorization Type Definitions
 * 
 * Core types for attribute-based access control (ABAC).
 * Identity model: role × portalDomain + attributes (see AUTH_IDENTITY_MODEL_FINAL.md)
 */

/** Capability category — what kind of work a person does. Domain-independent. */
export type Role = 'admin' | 'manager' | 'supervisor' | 'analyst' | 'appraiser' | 'reviewer';

/**
 * Trust boundary — which portal controls this user's session and which resource
 * containers are reachable. Set at provisioning; immutable by the user.
 */
export type PortalDomain = 'platform' | 'vendor' | 'client';

/** Semantic operator for PolicyCondition evaluation. */
export type PolicyOperator =
  | 'eq'              // docField === staticValue
  | 'in'              // docField IN user[userField]  (user has an array; doc has scalar)
  | 'contains'        // user[userField] IN docField  (doc has an array; user has scalar)
  | 'is_owner'        // doc.accessControl.ownerId === user.id
  | 'is_assigned'     // user.id IN doc.accessControl.assignedUserIds
  | 'bound_entity_in' // doc.accessControl.[field] IN user.boundEntityIds (array membership)
  | 'is_internal'     // user.isInternal === true
  | 'any';            // unconditional (always true)

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
  
  // Assignment (appraiser/reviewer userIds working this order)
  assignedUserIds: string[];
  appraiserId?: string;     // shortcut for the primary assigned appraiser (mirrors assignedUserIds[0])
  
  // Organizational
  teamId?: string;
  departmentId?: string;
  
  // Business relationships — REQUIRED on VendorOrder; see assertHasAccessControl()
  clientId?: string;
  vendorId?: string;          // REQUIRED on VendorOrder
  engagementId?: string;
  clientOrderId?: string;     // REQUIRED on VendorOrder
  
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
  clientId?: string;
  subClientId?: string;

  // ── Identity axes ─────────────────────────────────────────────────────────
  /** Capability category. Small stable set — see Role type. */
  role: Role;

  /**
   * Trust boundary. Determines which resource containers and policy rules apply.
   * Set at provisioning; immutable by user.
   */
  portalDomain: PortalDomain;

  /**
   * Organization binding for external non-platform domain users.
   * Array because a single appraiser may be affiliated with multiple vendor firms.
   *
   *   vendor domain, external  → vendorId(s) of the firm(s) this user works for
   *   client domain            → clientId(s) of the lender(s) this user belongs to
   *   platform domain          → [] (scope via accessScope.managedClientIds instead)
   *   vendor domain, internal  → [] (internal staff: scope via isInternal + teamIds)
   */
  boundEntityIds: string[];

  /**
   * For appraiser and reviewer roles: true = internal platform staff.
   * Internal staff bypass the bid loop and get expanded read access per policy.
   * false / absent = external fee-panel contractor or hired reviewer firm.
   */
  isInternal?: boolean;

  // ── Data scope within the domain ─────────────────────────────────────────
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
    role: Role;
    portalDomain: PortalDomain;
    boundEntityIds: string[];   // [] for platform domain and internal staff
    isInternal?: boolean;
    email: string;
    clientId?: string;
    subClientId?: string;
    teamIds: string[];
    departmentIds: string[];
    managedClientIds?: string[];
    statesCovered?: string[];
    canViewAllOrders?: boolean;
  };
  resource: {
    type: ResourceType;
    id: string;
    // AccessControl fields denormalized for policy evaluation:
    ownerId?: string;
    teamId?: string;
    clientId?: string;
    vendorId?: string;
    assignedUserIds?: string[];
    visibilityScope?: string;
  };
  action: Action;
  context?: {
    ipAddress?: string;
    timestamp: Date;
    requestId?: string;
  };
}

export interface AuthorizationAuditLog {
  id: string;
  orderId: string;
  tenantId: string;
  userId: string;
  userEmail: string;
  userRole: Role;
  userPortalDomain: PortalDomain;
  resourceType: ResourceType;
  resourceId: string;
  action: Action;
  decision: 'allow' | 'deny';
  reason?: string;
  matchedPolicies?: string[];
  ipAddress?: string;
  timestamp: Date;
}

export type ResourceType = 
  | 'order' 
  | 'client_order'
  | 'vendor_order'
  | 'vendor' 
  | 'access_graph'
  | 'admin_panel'
  | 'ai'
  | 'code'
  | 'qc_review' 
  | 'qc_queue' 
  | 'revision' 
  | 'escalation' 
  | 'analytics'
  | 'user'
  | 'rov_request'
  | 'arv_analysis'
  | 'document'
  | 'engagement'
  | 'appraiser'
  | 'inspection'
  | 'client'
  | 'negotiation'
  | 'esignature'
  | 'policy';

export type Action =
  | 'read'
  | 'create'
  | 'update'
  | 'delete'
  | 'execute'
  | 'approve'
  | 'reject'
  /**
   * Coarse admin-only action used for resources where every CRUD verb is
   * gated behind the same admin-level guard (e.g. ABAC policy management,
   * Entra group → role mappings). 'manage' satisfies authorize() for any
   * single sub-action; the matching admin policy in default-policy-rules.ts
   * grants 'manage' on these resource types.
   */
  | 'manage';
