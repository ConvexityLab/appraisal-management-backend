"use strict";

/**
 * bpo-pipeline-config.js
 *
 * Single source of truth for the BPO Axiom extraction pipeline definition.
 * Required by both handleStatebridgeBpoDocument.js (primary path) and
 * retryStalledBpoOrders.js (retry path) to guarantee they submit identical
 * pipeline specs to Axiom.
 *
 * If the Axiom pipeline name, version, actor, stage structure, or timeout ever
 * changes, update it here once — both consumers pick it up automatically.
 */

const BPO_EXTRACTION_PIPELINE = {
  name: "document-extraction",
  version: "1.0.0",
  stages: [
    {
      name: "extract",
      actor: "DocumentProcessor",
      mode: "single",
      input: {
        documents:    { path: "trigger.documents" },
        tenantId:     { path: "trigger.tenantId" },
        clientId:     { path: "trigger.clientId" },
        documentType: { path: "trigger.documentType" },
      },
      // 3 minutes — matches SSE_TIMEOUT_MS in the primary handler; the Axiom-side
      // timeout and the client-side SSE wait should be in sync.
      timeout: 180000,
    },
  ],
};

module.exports = { BPO_EXTRACTION_PIPELINE };
