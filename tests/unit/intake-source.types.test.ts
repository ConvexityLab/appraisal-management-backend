import { describe, expect, it } from 'vitest';
import {
  buildApiOrderSourceIdentity,
  buildBulkItemSourceIdentity,
  buildManualDraftSourceIdentity,
} from '../../src/types/intake-source.types.js';

describe('intake source identity helpers', () => {
  it('builds manual draft source identity references', () => {
    expect(
      buildManualDraftSourceIdentity({
        intakeDraftId: 'draft-123',
        engagementId: 'eng-1',
        documentId: 'doc-1',
      }),
    ).toEqual({
      sourceKind: 'manual-draft',
      orderId: undefined,
      engagementId: 'eng-1',
      loanPropertyContextId: undefined,
      intakeDraftId: 'draft-123',
      documentId: 'doc-1',
      sourceArtifactRefs: [
        { artifactType: 'order-intake-draft', artifactId: 'draft-123' },
        { artifactType: 'document', artifactId: 'doc-1' },
      ],
    });
  });

  it('builds bulk item source identity references', () => {
    expect(
      buildBulkItemSourceIdentity({
        bulkJobId: 'job-1',
        bulkItemId: 'item-4',
        engagementId: 'eng-1',
      }),
    ).toEqual({
      sourceKind: 'bulk-item',
      orderId: undefined,
      engagementId: 'eng-1',
      loanPropertyContextId: undefined,
      bulkJobId: 'job-1',
      bulkItemId: 'item-4',
      documentId: undefined,
      sourceArtifactRefs: [
        { artifactType: 'bulk-ingestion-job', artifactId: 'job-1' },
        { artifactType: 'bulk-ingestion-item', artifactId: 'item-4' },
      ],
    });
  });

  it('builds api order source identity references', () => {
    expect(
      buildApiOrderSourceIdentity({
        orderId: 'order-9',
        engagementId: 'eng-1',
      }),
    ).toEqual({
      sourceKind: 'api-order',
      orderId: 'order-9',
      engagementId: 'eng-1',
      loanPropertyContextId: undefined,
      sourceArtifactRefs: [{ artifactType: 'order', artifactId: 'order-9' }],
    });
  });
});
