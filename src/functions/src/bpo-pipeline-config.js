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
 *
 * Pipeline: two-stage sequential extraction
 *
 *   Stage 1 "extract_text"       PdfTextExtractor        (single)
 *     ↓ fullText
 *   Stage 2 "extract_bpo_fields" SchemaBasedExtraction   (single)
 *     ↓ ProcessedDocument.extractedData → { county, propertyCondition, asIsValue, repairedValue }
 *
 * Trigger fields consumed from the runtime input (see handlers):
 *   blobUrl      — SAS URL to the BPO report PDF
 *   fileName     — original filename (e.g. "bpo-report.pdf")
 *   documentId   — use orderId as a stable correlation scope
 *   fileSetId    — use orderId as the FileSet scope
 *   documentType — "BPO_REPORT"
 *   tenantId     — Statebridge tenant
 *   clientId     — Statebridge client
 *
 * Result location after GET /api/pipelines/:jobId/results:
 *   resp.data.results.extract_bpo_fields[0].extractedData
 */

const BPO_EXTRACTION_PIPELINE = {
  name: "bpo-report-extraction",
  version: "2.0.0",
  stages: [
    // ── Stage 1: Download the BPO PDF and extract all text ────────────────────
    {
      name: "extract_text",
      actor: "PdfTextExtractor",
      mode: "single",
      input: {
        documentId: { path: "trigger.documentId" },
        fileSetId:  { path: "trigger.fileSetId" },
        blobUrl:    { path: "trigger.blobUrl" },
        fileName:   { path: "trigger.fileName" },
      },
      // 60 s is generous for a single PDF download + text extraction
      timeout: 60000,
    },

    // ── Stage 2: Extract structured BPO fields from the raw text ─────────────
    {
      name: "extract_bpo_fields",
      actor: "SchemaBasedExtraction",
      mode: "single",
      input: {
        documentId:   { path: "trigger.documentId" },
        documentType: { path: "trigger.documentType" },
        // fullText is the concatenated page text returned by PdfTextExtractor
        documentText: { path: "stages.extract_text[0].fullText" },
        tenantId:     { path: "trigger.tenantId" },
        clientId:     { path: "trigger.clientId" },
        // Inline schema — no Cosmos schema record required for BPO extraction
        schema: {
          id: "bpo-report-extraction",
          documentType: "BPO_REPORT",
          version: "1.0.0",
          fields: [
            {
              name: "county",
              type: "string",
              required: false,
              description: "County where the subject property is located",
              aiHints: {
                aliases: ["county", "location county", "property county", "subject county"],
                context: "The county name from the property address or form header section",
              },
            },
            {
              name: "propertyCondition",
              type: "string",
              required: false,
              description: "Overall condition rating of the subject property",
              aiHints: {
                aliases: [
                  "condition", "property condition", "subject condition",
                  "overall condition", "condition of property",
                ],
                context: "Typically rated as: Good, Average, Fair, or Poor",
              },
            },
            {
              name: "asIsValue",
              type: "number",
              required: false,
              description: "As-is market value estimate in USD — return as a plain number, no currency symbols",
              aiHints: {
                aliases: [
                  "as-is value", "as is value", "market value",
                  "value as is", "as-is market value", "current value", "BPO value",
                ],
                context: "The appraiser's estimate of the property's current market value as a plain number",
                format: "Plain integer or decimal, no '$' or commas (e.g. 450000)",
              },
            },
            {
              name: "repairedValue",
              type: "number",
              required: false,
              description: "After-repair value estimate in USD — return as a plain number, no currency symbols",
              aiHints: {
                aliases: [
                  "repaired value", "after repair value", "ARV",
                  "improved value", "as-repaired value", "value after repairs",
                ],
                context: "The market value after all repairs are completed, as a plain number",
                format: "Plain integer or decimal, no '$' or commas (e.g. 500000)",
              },
            },
          ],
        },
      },
      // SchemaBasedExtraction calls an LLM; 2 minutes is conservative and appropriate
      timeout: 120000,
    },
  ],
};

module.exports = { BPO_EXTRACTION_PIPELINE };
