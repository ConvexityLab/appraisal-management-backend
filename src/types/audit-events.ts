/**
 * Canonical audit-event type taxonomy.
 *
 * These strings are written to the `audit-trail` Cosmos container and surfaced
 * to the frontend via `GET /api/orders/:orderId/timeline`. They are also
 * matched by the FE's `OrderActivityTimeline` component, which uses each
 * value to pick a typed icon, color, and label.
 *
 * Conventions
 * ───────────
 *  - UPPERCASE_UNDERSCORE — never `snake.case` or `dot.separated`
 *  - Past-tense verb (`*_CREATED`, `*_UPDATED`) — these describe events that
 *    have already happened by the time they're persisted
 *  - Domain-prefixed when ambiguous (`ORDER_*`, `DOCUMENT_*`, `QC_*`,
 *    `AXIOM_*`, `USER_*`) so the FE can group/filter by domain if needed
 *
 * Single source of truth — DO NOT define audit-event strings inline at the
 * call site. Import from here. The FE keeps a parallel switch keyed by these
 * exact strings; if you add a new value here, also add a case in
 * `src/components/order/OrderActivityTimeline.tsx`.
 */

export const AuditEventType = {
  // ── Order lifecycle ──────────────────────────────────────────────────────
  ORDER_CREATED: 'ORDER_CREATED',
  ORDER_UPDATED: 'ORDER_UPDATED',
  ORDER_DELETED: 'ORDER_DELETED',
  ORDER_DELIVERED: 'ORDER_DELIVERED',
  ORDER_CANCELLED: 'ORDER_CANCELLED',
  STATUS_CHANGED: 'STATUS_CHANGED',
  VENDOR_ASSIGNED: 'VENDOR_ASSIGNED',
  VENDOR_UNASSIGNED: 'VENDOR_UNASSIGNED',
  PAYMENT_UPDATED: 'PAYMENT_UPDATED',
  ATTENTION_ACKNOWLEDGED: 'ATTENTION_ACKNOWLEDGED',
  COMPLIANCE_EVALUATED: 'COMPLIANCE_EVALUATED',

  // ── Document lifecycle ───────────────────────────────────────────────────
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_DELETED: 'DOCUMENT_DELETED',
  DOCUMENT_VIEWED: 'DOCUMENT_VIEWED',
  DOCUMENT_DOWNLOADED: 'DOCUMENT_DOWNLOADED',
  DOCUMENT_REASSOCIATED_TO_ORDER: 'DOCUMENT_REASSOCIATED_TO_ORDER',

  // ── QC ───────────────────────────────────────────────────────────────────
  QC_REVIEW_CREATED: 'QC_REVIEW_CREATED',
  QC_REVIEW_COMPLETED: 'QC_REVIEW_COMPLETED',

  // ── SLA / overdue detection (background jobs) ───────────────────────────
  ORDER_OVERDUE: 'ORDER_OVERDUE',
  SLA_AT_RISK: 'SLA_AT_RISK',
  SLA_BREACHED: 'SLA_BREACHED',

  // ── Axiom / criteria evaluation ──────────────────────────────────────────
  AXIOM_COMPLETED: 'AXIOM_COMPLETED',

  // ── User / authz ─────────────────────────────────────────────────────────
  USER_LOGIN_SUCCESS: 'USER_LOGIN_SUCCESS',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_PERMISSIONS_CHANGED: 'USER_PERMISSIONS_CHANGED',
} as const;

export type AuditEventType = typeof AuditEventType[keyof typeof AuditEventType];
