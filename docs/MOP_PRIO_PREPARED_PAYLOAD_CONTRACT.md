# MOP/Prio Prepared Payload Contract

**Date:** April 29, 2026  
**Status:** Locked for backend-prepared dispatch integration  
**Contract version:** `1.0`

## Purpose

This document freezes the payload shape produced by appraisal-management-backend before any MOP/Prio engine adapter changes consume it.

The current backend implementation persists this contract inside prepared-context artifacts and links the resulting payload reference to run-ledger criteria runs.

## Contract identity

- `contractType`: `mop-prio-review-dispatch`
- `contractVersion`: `1.0`
- Dispatch mode: `prepared-context`

## Canonical payload shape

```ts
interface MopPrioPreparedPayload {
  contractType: 'mop-prio-review-dispatch';
  contractVersion: '1.0';
  preparedContextId: string;
  preparedContextVersion: string;
  orderId: string;
  engagementId?: string;
  tenantId: string;
  reviewProgramId: string;
  reviewProgramVersion: string;
  engineProgramId: string;
  engineProgramVersion: string;
  snapshotId?: string;
  programKey?: {
    clientId: string;
    subClientId: string;
    programId: string;
    version: string;
  };
  dispatchMode: 'prepared-context';
  criteria: Array<{
    criterionId: string;
    criterionTitle: string;
    readiness: string;
    resolvedDataBindings: Array<{
      requirementPath: string;
      resolvedPath: string;
      sourceType: 'order' | 'subjectProperty' | 'extraction' | 'providerData' | 'provenance';
    }>;
    missingDataPaths: string[];
    missingDocumentTypes: string[];
    warnings: string[];
  }>;
  documentInventory: Array<{
    documentId: string;
    name?: string;
    documentType?: string;
    category?: string;
    extractionStatus?: string;
  }>;
  evidenceRefs: Array<{
    sourceType: string;
    sourceId: string;
    fieldPath?: string;
    sourceRunId?: string;
  }>;
}
```

## Rules

1. No silent fallback to a weaker MOP payload is allowed.
2. `preparedContextId` and `preparedContextVersion` are mandatory for auditability.
3. `programKey` is only present when client and sub-client configuration were resolved during preparation.
4. `criteria` must reflect the requirement-resolution output used to allow or block dispatch.
5. `documentInventory` and `evidenceRefs` are included so MOP/Prio can evolve away from snapshot-only assumptions without changing this contract version.

## Current usage

As of this slice:

- the backend persists this contract inside prepared-context artifacts,
- the backend stores `preparedPayloadRef`, `preparedPayloadContractType`, and `preparedPayloadContractVersion` on run-ledger criteria runs,
- the runtime MOP/Prio adapter is not yet consuming the full payload directly,
- dispatch still flows through the existing engine submission path while preserving linkage to the prepared artifact.

## Next adapter step

When engine-dispatch refactoring begins, the MOP/Prio adapter must read this contract from the prepared-context artifact rather than reconstructing its own ad hoc request from `snapshotId` alone.
