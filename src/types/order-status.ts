/**
 * Order Status — Canonical Definition
 *
 * Single source of truth for all order status values, transitions, and metadata.
 *
 * STRUCTURED FOR FUTURE CONFIGURABILITY:
 * The STATUS_CONFIG map below defines transitions, labels, categories, and sort
 * order for every status. To make statuses fully data-driven in the future:
 *   1. Load equivalent config from a Cosmos container or app-configuration store at startup
 *   2. Validate loaded config against the OrderStatus enum
 *   3. Replace the static STATUS_CONFIG with the loaded data
 * All business logic (transition validation, label rendering, category filtering)
 * already reads from STATUS_CONFIG — no switch/case statements to update.
 */

// ─── Canonical Enum ──────────────────────────────────────────────────────────

export enum OrderStatus {
  NEW = 'NEW',
  PENDING_ASSIGNMENT = 'PENDING_ASSIGNMENT',
  ASSIGNED = 'ASSIGNED',
  PENDING_ACCEPTANCE = 'PENDING_ACCEPTANCE',
  ACCEPTED = 'ACCEPTED',
  IN_PROGRESS = 'IN_PROGRESS',
  INSPECTION_SCHEDULED = 'INSPECTION_SCHEDULED',
  INSPECTION_COMPLETED = 'INSPECTION_COMPLETED',
  SUBMITTED = 'SUBMITTED',
  QC_REVIEW = 'QC_REVIEW',
  REVISION_REQUESTED = 'REVISION_REQUESTED',
  COMPLETED = 'COMPLETED',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  ON_HOLD = 'ON_HOLD',
}

// ─── Config Types ────────────────────────────────────────────────────────────

/** Category grouping for display and filtering */
export type OrderStatusCategory = 'intake' | 'assignment' | 'active' | 'review' | 'final';

/** Metadata for a single order status — the building block of the config map */
export interface OrderStatusConfig {
  readonly value: OrderStatus;
  readonly label: string;
  readonly description: string;
  readonly category: OrderStatusCategory;
  readonly isFinal: boolean;
  readonly allowedTransitions: readonly OrderStatus[];
  /** Display/sort order — lower = earlier in lifecycle */
  readonly sortOrder: number;
}

// ─── Status Configuration Map ────────────────────────────────────────────────

/**
 * Authoritative definition of what each status means, where it sits in the
 * lifecycle, and what transitions are valid from it.
 *
 * Every function in this module reads from this map — add a new status here
 * and transition validation, label rendering, and category filtering all
 * pick it up automatically.
 */
export const STATUS_CONFIG: ReadonlyMap<OrderStatus, OrderStatusConfig> = new Map([
  [OrderStatus.NEW, {
    value: OrderStatus.NEW,
    label: 'New',
    description: 'Order just created',
    category: 'intake',
    isFinal: false,
    sortOrder: 10,
    allowedTransitions: [
      OrderStatus.PENDING_ASSIGNMENT,
      OrderStatus.ASSIGNED,
      OrderStatus.CANCELLED,
      OrderStatus.ON_HOLD,
    ],
  }],
  [OrderStatus.PENDING_ASSIGNMENT, {
    value: OrderStatus.PENDING_ASSIGNMENT,
    label: 'Pending Assignment',
    description: 'Awaiting assignment to appraiser',
    category: 'assignment',
    isFinal: false,
    sortOrder: 20,
    allowedTransitions: [
      OrderStatus.ASSIGNED,
      OrderStatus.PENDING_ACCEPTANCE,
      OrderStatus.CANCELLED,
      OrderStatus.ON_HOLD,
    ],
  }],
  [OrderStatus.ASSIGNED, {
    value: OrderStatus.ASSIGNED,
    label: 'Assigned',
    description: 'Assigned to appraiser, awaiting response',
    category: 'assignment',
    isFinal: false,
    sortOrder: 30,
    allowedTransitions: [
      OrderStatus.ACCEPTED,
      OrderStatus.PENDING_ASSIGNMENT,
      OrderStatus.NEW,
      OrderStatus.CANCELLED,
      OrderStatus.ON_HOLD,
    ],
  }],
  [OrderStatus.PENDING_ACCEPTANCE, {
    value: OrderStatus.PENDING_ACCEPTANCE,
    label: 'Pending Acceptance',
    description: 'Broadcast to pool, awaiting bids',
    category: 'assignment',
    isFinal: false,
    sortOrder: 35,
    allowedTransitions: [
      OrderStatus.ACCEPTED,
      OrderStatus.ASSIGNED,
      OrderStatus.CANCELLED,
    ],
  }],
  [OrderStatus.ACCEPTED, {
    value: OrderStatus.ACCEPTED,
    label: 'Accepted',
    description: 'Appraiser accepted, work not started',
    category: 'active',
    isFinal: false,
    sortOrder: 40,
    allowedTransitions: [
      OrderStatus.IN_PROGRESS,
      OrderStatus.INSPECTION_SCHEDULED,
      OrderStatus.CANCELLED,
    ],
  }],
  [OrderStatus.IN_PROGRESS, {
    value: OrderStatus.IN_PROGRESS,
    label: 'In Progress',
    description: 'Appraiser actively working',
    category: 'active',
    isFinal: false,
    sortOrder: 50,
    allowedTransitions: [
      OrderStatus.INSPECTION_SCHEDULED,
      OrderStatus.SUBMITTED,
      OrderStatus.CANCELLED,
      OrderStatus.ON_HOLD,
    ],
  }],
  [OrderStatus.INSPECTION_SCHEDULED, {
    value: OrderStatus.INSPECTION_SCHEDULED,
    label: 'Inspection Scheduled',
    description: 'Inspection date set',
    category: 'active',
    isFinal: false,
    sortOrder: 55,
    allowedTransitions: [
      OrderStatus.INSPECTION_COMPLETED,
      OrderStatus.IN_PROGRESS,
      OrderStatus.CANCELLED,
    ],
  }],
  [OrderStatus.INSPECTION_COMPLETED, {
    value: OrderStatus.INSPECTION_COMPLETED,
    label: 'Inspection Completed',
    description: 'Inspection done, report pending',
    category: 'active',
    isFinal: false,
    sortOrder: 60,
    allowedTransitions: [
      OrderStatus.IN_PROGRESS,
      OrderStatus.SUBMITTED,
      OrderStatus.CANCELLED,
    ],
  }],
  [OrderStatus.SUBMITTED, {
    value: OrderStatus.SUBMITTED,
    label: 'Submitted',
    description: 'Deliverables uploaded, ready for QC',
    category: 'review',
    isFinal: false,
    sortOrder: 70,
    allowedTransitions: [
      OrderStatus.QC_REVIEW,
      OrderStatus.REVISION_REQUESTED,
    ],
  }],
  [OrderStatus.QC_REVIEW, {
    value: OrderStatus.QC_REVIEW,
    label: 'QC Review',
    description: 'Under internal quality review',
    category: 'review',
    isFinal: false,
    sortOrder: 80,
    allowedTransitions: [
      OrderStatus.COMPLETED,
      OrderStatus.REVISION_REQUESTED,
    ],
  }],
  [OrderStatus.REVISION_REQUESTED, {
    value: OrderStatus.REVISION_REQUESTED,
    label: 'Revision Requested',
    description: 'QC found issues, sent back to appraiser',
    category: 'review',
    isFinal: false,
    sortOrder: 85,
    allowedTransitions: [
      OrderStatus.IN_PROGRESS,
      OrderStatus.SUBMITTED,
    ],
  }],
  [OrderStatus.COMPLETED, {
    value: OrderStatus.COMPLETED,
    label: 'Completed',
    description: 'QC approved',
    category: 'final',
    isFinal: false,
    sortOrder: 90,
    allowedTransitions: [OrderStatus.DELIVERED],
  }],
  [OrderStatus.DELIVERED, {
    value: OrderStatus.DELIVERED,
    label: 'Delivered',
    description: 'Delivered to client',
    category: 'final',
    isFinal: true,
    sortOrder: 100,
    allowedTransitions: [],
  }],
  [OrderStatus.CANCELLED, {
    value: OrderStatus.CANCELLED,
    label: 'Cancelled',
    description: 'Cancelled at any point',
    category: 'final',
    isFinal: true,
    sortOrder: 200,
    allowedTransitions: [],
  }],
  [OrderStatus.ON_HOLD, {
    value: OrderStatus.ON_HOLD,
    label: 'On Hold',
    description: 'Paused for any reason',
    category: 'active',
    isFinal: false,
    sortOrder: 150,
    allowedTransitions: [
      OrderStatus.NEW,
      OrderStatus.PENDING_ASSIGNMENT,
      OrderStatus.ASSIGNED,
      OrderStatus.IN_PROGRESS,
    ],
  }],
]);

// ─── Config-Driven Helpers ───────────────────────────────────────────────────

/** Check if a status transition is valid according to STATUS_CONFIG. */
export function isValidStatusTransition(from: OrderStatus, to: OrderStatus): boolean {
  const config = STATUS_CONFIG.get(from);
  return config?.allowedTransitions.includes(to) ?? false;
}

/** Get all statuses in a given category, sorted by lifecycle order. */
export function getStatusesByCategory(category: OrderStatusCategory): OrderStatus[] {
  return [...STATUS_CONFIG.values()]
    .filter(c => c.category === category)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(c => c.value);
}

/** Get the display label for a status. */
export function getStatusLabel(status: OrderStatus): string {
  return STATUS_CONFIG.get(status)?.label ?? status;
}

/** Get all non-final statuses (active orders). */
export function getActiveStatuses(): OrderStatus[] {
  return [...STATUS_CONFIG.values()]
    .filter(c => !c.isFinal)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(c => c.value);
}

/** Get all final (terminal) statuses. */
export function getFinalStatuses(): OrderStatus[] {
  return [...STATUS_CONFIG.values()]
    .filter(c => c.isFinal)
    .map(c => c.value);
}

// ─── Legacy Normalization ────────────────────────────────────────────────────

/**
 * Mapping from legacy Cosmos values (lowercase originals + old duplicates)
 * to the canonical UPPER_CASE enum. Used at read boundaries only.
 */
const LEGACY_STATUS_MAP: Record<string, OrderStatus> = {
  // Original lowercase values from the old OrderStatus enum in types/index.ts
  'new': OrderStatus.NEW,
  'assigned': OrderStatus.ASSIGNED,
  'accepted': OrderStatus.ACCEPTED,
  'scheduled': OrderStatus.INSPECTION_SCHEDULED,
  'inspected': OrderStatus.INSPECTION_COMPLETED,
  'in_progress': OrderStatus.IN_PROGRESS,
  'submitted': OrderStatus.SUBMITTED,
  'in_qc': OrderStatus.QC_REVIEW,
  'revision_requested': OrderStatus.REVISION_REQUESTED,
  'completed': OrderStatus.COMPLETED,
  'delivered': OrderStatus.DELIVERED,
  'cancelled': OrderStatus.CANCELLED,
  'on_hold': OrderStatus.ON_HOLD,
  // Aliases from deleted duplicate definitions
  'DRAFT': OrderStatus.NEW,
  'PENDING': OrderStatus.PENDING_ASSIGNMENT,
  'QC_PASSED': OrderStatus.COMPLETED,
  'QC_FAILED': OrderStatus.REVISION_REQUESTED,
  'EXPIRED': OrderStatus.CANCELLED,
  'APPROVED': OrderStatus.COMPLETED,
  'INSPECTION_COMPLETE': OrderStatus.INSPECTION_COMPLETED,
  'REVISIONS_REQUESTED': OrderStatus.REVISION_REQUESTED,
  'DRAFT_SUBMITTED': OrderStatus.SUBMITTED,
  'DRAFT_UNDER_REVIEW': OrderStatus.QC_REVIEW,
  'FINAL_SUBMITTED': OrderStatus.SUBMITTED,
  'FINAL_UNDER_REVIEW': OrderStatus.QC_REVIEW,
  'REPORT_IN_PROGRESS': OrderStatus.IN_PROGRESS,
  'IN_QC_REVIEW': OrderStatus.QC_REVIEW,
};

/**
 * Normalize a status value from Cosmos or external sources into the canonical enum.
 * Throws with an actionable message if the value is unrecognized.
 *
 * Use at read boundaries: loading orders from DB, processing webhook payloads, etc.
 */
export function normalizeOrderStatus(raw: string): OrderStatus {
  // Already a valid canonical value?
  if (Object.values(OrderStatus).includes(raw as OrderStatus)) {
    return raw as OrderStatus;
  }
  const mapped = LEGACY_STATUS_MAP[raw];
  if (mapped) return mapped;

  throw new Error(
    `Unrecognized order status: "${raw}". ` +
    `Expected one of: ${Object.values(OrderStatus).join(', ')}`
  );
}
