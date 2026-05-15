import type { Role } from '../types/authorization.types.js';

export type LegacyRoleAlias = 'qc_analyst';
export type LegacyPrivilegedRoleAlias = 'system' | 'onelend_admin' | 'api';

export const CANONICAL_ROLES: readonly Role[] = [
  'admin',
  'manager',
  'supervisor',
  'analyst',
  'appraiser',
  'reviewer',
];

export const CANONICAL_ROLE_PERMISSION_BUNDLES: Record<Role, string[]> = {
  admin: ['*'],
  manager: [
    'order:read',
    'order:create',
    'order:update',
    'order:approve',
    'order:reject',
    'vendor:read',
    'vendor:update',
    'vendor:approve',
    'vendor:reject',
    'analytics:read',
    'qc_queue:read',
    'qc_review:read',
    'qc_review:approve',
    'qc_review:reject',
  ],
  supervisor: [
    'order:read',
    'order:approve',
    'order:reject',
    'analytics:read',
    'qc_queue:read',
    'qc_review:read',
    'qc_review:approve',
    'qc_review:reject',
  ],
  analyst: [
    'order:read',
    'order:update',
    'qc_queue:read',
    'qc_review:read',
    'qc_review:create',
    'qc_review:update',
    'qc_review:execute',
    'qc_review:approve',
    'qc_review:reject',
    'revision:create',
    'escalation:create',
  ],
  appraiser: [
    'order:read',
    'order:update',
    'revision:create',
    'escalation:create',
  ],
  reviewer: ['order:read', 'qc_review:read'],
};

export function isCanonicalRole(role: string): role is Role {
  return (CANONICAL_ROLES as readonly string[]).includes(role);
}

export function normalizeRoleAlias(role: string | undefined): Role | null {
  if (!role) {
    return null;
  }

  if (role === 'qc_analyst') {
    return 'analyst';
  }

  return isCanonicalRole(role) ? role : null;
}

export function normalizePrivilegedRoleAlias(role: string | undefined): Role | null {
  const normalizedRole = normalizeRoleAlias(role);
  if (normalizedRole) {
    return normalizedRole;
  }

  switch (role) {
    case 'system':
    case 'onelend_admin':
    case 'api':
      return 'admin';
    default:
      return null;
  }
}

export function normalizeRoleAliasOrThrow(role: string | undefined, context: string): Role {
  const normalizedRole = normalizeRoleAlias(role);

  if (!normalizedRole) {
    throw new Error(
      `Unsupported ${context} role "${role ?? '(missing)'}". Expected one of: ${CANONICAL_ROLES.join(', ')} or legacy alias qc_analyst.`,
    );
  }

  return normalizedRole;
}

export function normalizePrivilegedRoleAliasOrThrow(role: string | undefined, context: string): Role {
  const normalizedRole = normalizePrivilegedRoleAlias(role);

  if (!normalizedRole) {
    throw new Error(
      `Unsupported ${context} role "${role ?? '(missing)'}". Expected one of: ${CANONICAL_ROLES.join(', ')} or a supported legacy alias.`,
    );
  }

  return normalizedRole;
}