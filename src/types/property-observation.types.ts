import type {
  CanonicalAddress,
  PermitRecord,
  PropertyCurrentCanonicalView,
  PropertyRecord,
  TaxAssessmentRecord,
} from '@l1/shared-types';

export type PropertyObservationType =
  | 'provider-enrichment'
  | 'public-record-import'
  | 'document-extraction'
  | 'manual-correction'
  | 'permit-update'
  | 'tax-assessment-update'
  | 'avm-update'
  | 'canonical-projection';

export type PropertyObservationSourceSystem =
  | 'bridge-interactive'
  | 'attom-api'
  | 'attom-cache'
  | 'public-records-import'
  | 'document-extraction'
  | 'manual-user'
  | 'canonical-snapshot-service'
  | 'property-enrichment-service'
  | 'legacy-backfill'
  | 'other';

export interface PropertyObservationSourceArtifactRef {
  kind:
    | 'order'
    | 'engagement'
    | 'document'
    | 'snapshot'
    | 'provider-cache'
    | 'bulk-import-job'
    | 'manual-edit'
    | 'other';
  id: string;
  externalId?: string;
  uri?: string;
}

export interface PropertyObservationNormalizedFacts {
  addressPatch?: Partial<CanonicalAddress>;
  propertyPatch?: Record<string, unknown>;
  buildingPatch?: Partial<PropertyRecord['building']>;
  canonicalPatch?: Partial<PropertyCurrentCanonicalView>;
  taxAssessment?: TaxAssessmentRecord;
  permit?: PermitRecord;
  avm?: PropertyRecord['avm'];
}

export interface PropertyObservationRecord {
  id: string;
  type: 'property-observation';
  tenantId: string;
  propertyId: string;
  observationType: PropertyObservationType;
  sourceSystem: PropertyObservationSourceSystem;
  sourceFingerprint: string;
  observedAt: string;
  ingestedAt: string;
  sourceArtifactRef?: PropertyObservationSourceArtifactRef;
  lineageRefs?: PropertyObservationSourceArtifactRef[];
  orderId?: string;
  engagementId?: string;
  documentId?: string;
  snapshotId?: string;
  sourceRecordId?: string;
  sourceProvider?: string;
  confidence?: number;
  normalizedFacts?: PropertyObservationNormalizedFacts;
  rawPayload?: Record<string, unknown> | null;
  createdBy: string;
}

export interface CreatePropertyObservationInput {
  tenantId: string;
  propertyId: string;
  observationType: PropertyObservationType;
  sourceSystem: PropertyObservationSourceSystem;
  observedAt: string;
  ingestedAt?: string;
  sourceArtifactRef?: PropertyObservationSourceArtifactRef;
  lineageRefs?: PropertyObservationSourceArtifactRef[];
  orderId?: string;
  engagementId?: string;
  documentId?: string;
  snapshotId?: string;
  sourceRecordId?: string;
  sourceProvider?: string;
  confidence?: number;
  normalizedFacts?: PropertyObservationNormalizedFacts;
  rawPayload?: Record<string, unknown> | null;
  createdBy?: string;
}
