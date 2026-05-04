export type IntakeSourceKind = 'manual-draft' | 'bulk-item' | 'document-upload' | 'api-order';

export interface IntakeSourceArtifactRef {
  artifactType: 'order-intake-draft' | 'bulk-ingestion-job' | 'bulk-ingestion-item' | 'document' | 'order';
  artifactId: string;
}

export interface IntakeSourceIdentity {
  sourceKind: IntakeSourceKind;
  orderId?: string;
  engagementId?: string;
  loanPropertyContextId?: string;
  intakeDraftId?: string;
  bulkJobId?: string;
  bulkItemId?: string;
  documentId?: string;
  sourceArtifactRefs: IntakeSourceArtifactRef[];
}

function mergeSourceArtifactRefs(
  existing: IntakeSourceArtifactRef[],
  additions: IntakeSourceArtifactRef[],
): IntakeSourceArtifactRef[] {
  const refs = [...existing];

  for (const addition of additions) {
    if (refs.some((ref) => ref.artifactType === addition.artifactType && ref.artifactId === addition.artifactId)) {
      continue;
    }

    refs.push(addition);
  }

  return refs;
}

export function extendIntakeSourceIdentity(
  identity: IntakeSourceIdentity | undefined,
  input: {
    orderId?: string;
    engagementId?: string;
    loanPropertyContextId?: string;
    documentId?: string;
    sourceArtifactRefs?: IntakeSourceArtifactRef[];
  },
): IntakeSourceIdentity | undefined {
  if (!identity) {
    return undefined;
  }

  const artifactRefs = mergeSourceArtifactRefs(
    identity.sourceArtifactRefs,
    [
      ...(input.documentId
        ? [
            {
              artifactType: 'document' as const,
              artifactId: input.documentId,
            },
          ]
        : []),
      ...(input.sourceArtifactRefs ?? []),
    ],
  );

  return {
    ...identity,
    ...(input.orderId ? { orderId: input.orderId } : {}),
    ...(input.engagementId ? { engagementId: input.engagementId } : {}),
    ...(input.loanPropertyContextId ? { loanPropertyContextId: input.loanPropertyContextId } : {}),
    ...(input.documentId ? { documentId: input.documentId } : {}),
    sourceArtifactRefs: artifactRefs,
  };
}

export function buildManualDraftSourceIdentity(input: {
  intakeDraftId: string;
  orderId?: string;
  engagementId?: string;
  loanPropertyContextId?: string;
  documentId?: string;
}): IntakeSourceIdentity {
  return {
    sourceKind: 'manual-draft',
    ...(input.orderId ? { orderId: input.orderId } : {}),
    ...(input.engagementId ? { engagementId: input.engagementId } : {}),
    ...(input.loanPropertyContextId ? { loanPropertyContextId: input.loanPropertyContextId } : {}),
    intakeDraftId: input.intakeDraftId,
    ...(input.documentId ? { documentId: input.documentId } : {}),
    sourceArtifactRefs: [
      {
        artifactType: 'order-intake-draft',
        artifactId: input.intakeDraftId,
      },
      ...(input.documentId
        ? [
            {
              artifactType: 'document' as const,
              artifactId: input.documentId,
            },
          ]
        : []),
    ],
  };
}

export function buildBulkItemSourceIdentity(input: {
  bulkJobId: string;
  bulkItemId?: string;
  orderId?: string;
  engagementId?: string;
  loanPropertyContextId?: string;
  documentId?: string;
}): IntakeSourceIdentity {
  return {
    sourceKind: 'bulk-item',
    ...(input.orderId ? { orderId: input.orderId } : {}),
    ...(input.engagementId ? { engagementId: input.engagementId } : {}),
    ...(input.loanPropertyContextId ? { loanPropertyContextId: input.loanPropertyContextId } : {}),
    bulkJobId: input.bulkJobId,
    ...(input.bulkItemId ? { bulkItemId: input.bulkItemId } : {}),
    ...(input.documentId ? { documentId: input.documentId } : {}),
    sourceArtifactRefs: [
      {
        artifactType: 'bulk-ingestion-job',
        artifactId: input.bulkJobId,
      },
      ...(input.bulkItemId
        ? [
            {
              artifactType: 'bulk-ingestion-item' as const,
              artifactId: input.bulkItemId,
            },
          ]
        : []),
      ...(input.documentId
        ? [
            {
              artifactType: 'document' as const,
              artifactId: input.documentId,
            },
          ]
        : []),
    ],
  };
}

export function buildApiOrderSourceIdentity(input: {
  orderId?: string;
  engagementId?: string;
  loanPropertyContextId?: string;
}): IntakeSourceIdentity {
  return {
    sourceKind: 'api-order',
    ...(input.orderId ? { orderId: input.orderId } : {}),
    ...(input.engagementId ? { engagementId: input.engagementId } : {}),
    ...(input.loanPropertyContextId ? { loanPropertyContextId: input.loanPropertyContextId } : {}),
    sourceArtifactRefs: input.orderId
      ? [
          {
            artifactType: 'order',
            artifactId: input.orderId,
          },
        ]
      : [],
  };
}
