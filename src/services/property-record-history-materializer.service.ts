import type { PropertyObservationRecord } from '../types/property-observation.types.js';
import type { PermitRecord, PropertyRecord, TaxAssessmentRecord } from '@l1/shared-types';

type PropertyAvm = NonNullable<PropertyRecord['avm']>;

function compareTaxAssessments(left: TaxAssessmentRecord, right: TaxAssessmentRecord): number {
  if (left.taxYear !== right.taxYear) {
    return left.taxYear - right.taxYear;
  }

  return (left.assessedAt ?? '').localeCompare(right.assessedAt ?? '');
}

function toObservedTaxAssessment(
  observation: PropertyObservationRecord,
): TaxAssessmentRecord | null {
  const taxAssessment = observation.normalizedFacts?.taxAssessment;
  if (!taxAssessment || typeof taxAssessment.taxYear !== 'number') {
    return null;
  }

  return {
    ...taxAssessment,
    ...(taxAssessment.assessedAt ? {} : { assessedAt: observation.observedAt }),
  };
}

function getPropertyTaxAssessments(
  record: PropertyRecord,
  observations: PropertyObservationRecord[],
): TaxAssessmentRecord[] {
  const byYear = new Map<number, TaxAssessmentRecord>();

  for (const observation of observations) {
    const taxAssessment = toObservedTaxAssessment(observation);
    if (!taxAssessment) {
      continue;
    }

    const existing = byYear.get(taxAssessment.taxYear);
    if (!existing || compareTaxAssessments(existing, taxAssessment) <= 0) {
      byYear.set(taxAssessment.taxYear, taxAssessment);
    }
  }

  if (byYear.size === 0) {
    return [...(record.taxAssessments ?? [])].sort(compareTaxAssessments);
  }

  return [...byYear.values()].sort(compareTaxAssessments);
}

function comparePermits(left: PermitRecord, right: PermitRecord): number {
  const issuedComparison = (left.issuedDate ?? '').localeCompare(right.issuedDate ?? '');
  if (issuedComparison !== 0) {
    return issuedComparison;
  }

  const closedComparison = (left.closedDate ?? '').localeCompare(right.closedDate ?? '');
  if (closedComparison !== 0) {
    return closedComparison;
  }

  return left.permitNumber.localeCompare(right.permitNumber);
}

function toObservedPermit(observation: PropertyObservationRecord): PermitRecord | null {
  const permit = observation.normalizedFacts?.permit;
  if (!permit || typeof permit.permitNumber !== 'string' || !permit.permitNumber.trim()) {
    return null;
  }

  return permit;
}

function getPermitIdentity(permit: PermitRecord): string {
  return [
    permit.permitNumber.trim().toUpperCase(),
    permit.type,
    permit.issuedDate ?? '',
    permit.description.trim().toUpperCase(),
  ].join('|');
}

function getPropertyPermits(
  record: PropertyRecord,
  observations: PropertyObservationRecord[],
): PermitRecord[] {
  const byIdentity = new Map<string, PermitRecord>();

  for (const observation of observations) {
    const permit = toObservedPermit(observation);
    if (!permit) {
      continue;
    }

    const identity = getPermitIdentity(permit);
    const existing = byIdentity.get(identity);
    if (!existing || comparePermits(existing, permit) <= 0) {
      byIdentity.set(identity, permit);
    }
  }

  if (byIdentity.size === 0) {
    return [...(record.permits ?? [])].sort(comparePermits);
  }

  return [...byIdentity.values()].sort(comparePermits);
}

function compareAvm(left: PropertyAvm, right: PropertyAvm): number {
  return left.fetchedAt.localeCompare(right.fetchedAt);
}

function toObservedAvm(observation: PropertyObservationRecord): PropertyAvm | null {
  const avm = observation.normalizedFacts?.avm;
  if (!avm || typeof avm.value !== 'number' || !avm.fetchedAt) {
    return null;
  }

  return avm;
}

function getPropertyAvm(
  record: PropertyRecord,
  observations: PropertyObservationRecord[],
): PropertyAvm | undefined {
  let latestAvm: PropertyAvm | undefined;

  for (const observation of observations) {
    const avm = toObservedAvm(observation);
    if (!avm) {
      continue;
    }

    if (!latestAvm || compareAvm(latestAvm, avm) <= 0) {
      latestAvm = avm;
    }
  }

  return latestAvm ?? record.avm;
}

export function materializePropertyRecordHistory(
  record: PropertyRecord,
  observations: PropertyObservationRecord[],
): PropertyRecord {
  const avm = getPropertyAvm(record, observations);

  return {
    ...record,
    ...(avm ? { avm } : {}),
    taxAssessments: getPropertyTaxAssessments(record, observations),
    permits: getPropertyPermits(record, observations),
  };
}