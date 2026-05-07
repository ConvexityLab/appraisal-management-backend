/**
 * Authorization Engine Interface
 * 
 * Abstraction layer for policy engines (Casbin, OPA, etc.)
 * Allows swapping implementations without changing business logic
 */

import { AuthorizationContext, PolicyDecision } from '../types/authorization.types.js';

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
