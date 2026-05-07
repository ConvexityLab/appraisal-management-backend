/**
 * assertHasAccessControl
 *
 * Throws if a document is missing the two fields that are required for every
 * owned Cosmos document: accessControl.ownerId and accessControl.tenantId.
 * Use this as a pre-persist guard anywhere an owned document is written.
 */
export function assertHasAccessControl(doc: Record<string, unknown>, label?: string): void {
  const prefix = label ? `[${label}] ` : '';
  const ac = doc['accessControl'] as Record<string, unknown> | undefined;

  if (!ac) {
    throw new Error(
      `${prefix}Document is missing required 'accessControl' block. ` +
        `Ensure AccessControlHelper.createAccessControl() is called before persisting.`,
    );
  }

  if (!ac['ownerId'] || typeof ac['ownerId'] !== 'string') {
    throw new Error(
      `${prefix}accessControl.ownerId is required but was '${String(ac['ownerId'])}'.`,
    );
  }

  if (!ac['tenantId'] || typeof ac['tenantId'] !== 'string') {
    throw new Error(
      `${prefix}accessControl.tenantId is required but was '${String(ac['tenantId'])}'.`,
    );
  }
}
