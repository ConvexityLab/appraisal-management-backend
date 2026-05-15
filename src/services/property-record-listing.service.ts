import { CosmosDbService } from './cosmos-db.service.js';
import { PROPERTY_RECORDS_CONTAINER } from './property-record.service.js';
import type { PropertyRecord } from '@l1/shared-types';

export interface ListPropertyRecordsInput {
  tenantId: string;
  q?: string;
  city?: string;
  state?: string;
  propertyType?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'updatedAt' | 'createdAt' | 'address.street' | 'apn' | 'recordVersion';
  sortOrder?: 'asc' | 'desc';
}

export interface ListPropertyRecordsResult {
  items: PropertyRecord[];
  total: number;
  limit: number;
  offset: number;
}

type PropertyRecordListSortField = 'updatedAt' | 'createdAt' | 'address.street' | 'apn' | 'recordVersion';

function normalizePropertyRecordSortValue(
  record: PropertyRecord,
  sortBy: PropertyRecordListSortField,
): string | number {
  switch (sortBy) {
    case 'createdAt':
      return record.createdAt ?? '';
    case 'updatedAt':
      return record.updatedAt ?? '';
    case 'address.street':
      return record.address?.street ?? '';
    case 'apn':
      return record.apn ?? '';
    case 'recordVersion':
      return record.recordVersion ?? 0;
    default:
      return record.updatedAt ?? '';
  }
}

export async function listPropertyRecords(
  cosmosService: Pick<CosmosDbService, 'queryDocuments'>,
  input: ListPropertyRecordsInput,
): Promise<ListPropertyRecordsResult> {
  if (!input.tenantId) {
    throw new Error('PropertyRecordService.list: tenantId is required');
  }

  const limit = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const offset = Math.max(input.offset ?? 0, 0);
  const sortBy: PropertyRecordListSortField = input.sortBy ?? 'updatedAt';
  const sortOrder = input.sortOrder ?? 'desc';

  const records = await cosmosService.queryDocuments<PropertyRecord>(
    PROPERTY_RECORDS_CONTAINER,
    'SELECT * FROM c WHERE c.tenantId = @tenantId',
    [{ name: '@tenantId', value: input.tenantId }],
  );

  const normalizedQuery = input.q?.trim().toLowerCase();
  const normalizedCity = input.city?.trim().toLowerCase();
  const normalizedState = input.state?.trim().toLowerCase();
  const normalizedPropertyType = input.propertyType?.trim().toLowerCase();

  const filtered = records.filter((record) => {
    if (normalizedCity && record.address?.city?.toLowerCase() !== normalizedCity) {
      return false;
    }

    if (normalizedState && record.address?.state?.toLowerCase() !== normalizedState) {
      return false;
    }

    if (normalizedPropertyType && record.propertyType?.toLowerCase() !== normalizedPropertyType) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = [
      record.id,
      record.apn,
      record.address?.street,
      record.address?.city,
      record.address?.state,
      record.address?.zip,
      record.address?.zipPlus4,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });

  filtered.sort((left, right) => {
    const leftValue = normalizePropertyRecordSortValue(left, sortBy);
    const rightValue = normalizePropertyRecordSortValue(right, sortBy);

    if (leftValue < rightValue) {
      return sortOrder === 'asc' ? -1 : 1;
    }
    if (leftValue > rightValue) {
      return sortOrder === 'asc' ? 1 : -1;
    }
    return 0;
  });

  return {
    items: filtered.slice(offset, offset + limit),
    total: filtered.length,
    limit,
    offset,
  };
}
