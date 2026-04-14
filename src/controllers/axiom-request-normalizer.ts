export interface NormalizedAxiomPropertyRequest {
  orderId?: string;
  propertyInfo?: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Accept both request shapes for Axiom enrich/complexity endpoints:
 *
 * Canonical (preferred):
 *   { orderId, propertyInfo: { ... } }
 *
 * Legacy (frontend flat payload):
 *   { orderId, address|propertyAddress, propertyType, estimatedValue, loanAmount, ... }
 */
export function normalizeAxiomPropertyRequestBody(body: unknown): NormalizedAxiomPropertyRequest {
  if (!isRecord(body)) {
    return {};
  }

  const orderIdRaw = body['orderId'];
  const orderId = typeof orderIdRaw === 'string' && orderIdRaw.trim().length > 0
    ? orderIdRaw.trim()
    : undefined;

  const withOrderId = <T extends Record<string, unknown>>(value: T): T & Partial<Pick<NormalizedAxiomPropertyRequest, 'orderId'>> => {
    if (!orderId) {
      return value;
    }
    return { ...value, orderId };
  };

  const propertyInfoRaw = body['propertyInfo'];
  if (isRecord(propertyInfoRaw)) {
    return withOrderId({ propertyInfo: propertyInfoRaw });
  }

  const legacyKeys = [
    'address',
    'propertyAddress',
    'propertyCity',
    'propertyState',
    'propertyZip',
    'propertyType',
    'estimatedValue',
    'loanAmount',
    'productType',
    'dueDate',
  ] as const;

  const legacyPayload: Record<string, unknown> = {};
  for (const key of legacyKeys) {
    const value = body[key];
    if (value !== undefined) {
      legacyPayload[key] = value;
    }
  }

  if (Object.keys(legacyPayload).length === 0) {
    return withOrderId({});
  }

  return withOrderId({ propertyInfo: legacyPayload });
}
