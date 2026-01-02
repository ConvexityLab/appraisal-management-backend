/**
 * Authorization Engine Interface
 * 
 * Abstraction layer for policy engines (Casbin, OPA, etc.)
 * Allows swapping implementations without changing business logic
 */

import { AuthorizationContext, PolicyDecision, QueryFilter } from '../types/authorization.types';

export interface IAuthorizationEngine {
  /**
   * Initialize the policy engine
   */
  initialize(): Promise<void>;
  
  /**
   * Enforce a policy decision
   * @param context Authorization context with user, resource, and action
   * @returns Policy decision with allow/deny and reason
   */
  enforce(context: AuthorizationContext): Promise<PolicyDecision>;
  
  /**
   * Build a query filter for bulk data access
   * Used to filter Cosmos DB queries based on user permissions
   * @param userId User making the request
   * @param role User's role
   * @param accessScope User's access scope attributes
   * @param resourceType Type of resource being queried
   * @param action Action being performed
   * @returns SQL filter clause and parameters for Cosmos DB
   */
  buildQueryFilter(
    userId: string,
    role: string,
    accessScope: any,
    resourceType: string,
    action: string
  ): Promise<QueryFilter>;
  
  /**
   * Add a policy rule dynamically
   * @param policy Policy rule to add
   */
  addPolicy(policy: string[]): Promise<boolean>;
  
  /**
   * Remove a policy rule
   * @param policy Policy rule to remove
   */
  removePolicy(policy: string[]): Promise<boolean>;
  
  /**
   * Get all policies
   */
  getAllPolicies(): Promise<string[][]>;
  
  /**
   * Reload policies from storage
   */
  reloadPolicies(): Promise<void>;
}
