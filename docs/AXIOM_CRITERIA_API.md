Two ways to invoke the criteria-only pipeline
1. Auto-load by fileSetId (what we just shipped)

curl -X POST $BASE/api/pipelines \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-client-id: test-client" \
  -H "x-sub-client-id: test-tenant" \
  -H "content-type: application/json" \
  -d '{
    "pipelineId": "criteria-only-evaluation",
    "input": {
      "fileSetId": "<previously-extracted-fileSet>",
      "clientId": "test-client",
      "subClientId": "test-tenant",
      "programId": "FNMA-1004",
      "programVersion": "1.0.0"
    }
  }'
Server reads file-sets/<fileSetId> from Cosmos and reshapes documentTypeCompletions into extractedDocuments[]. Use when extraction has already happened in axiom.

2. Provide JSON directly (no Cosmos lookup)

curl -X POST $BASE/api/pipelines \
  -H "Authorization: Bearer $TOKEN" \
  -H "x-client-id: test-client" \
  -H "x-sub-client-id: test-tenant" \
  -H "content-type: application/json" \
  -d '{
    "pipelineId": "criteria-only-evaluation",
    "input": {
      "fileSetId": "ad-hoc-evaluation-2026-04-27",
      "clientId": "test-client",
      "subClientId": "test-tenant",
      "programId": "FNMA-1004",
      "programVersion": "1.0.0",
      "extractedDocuments": [
        {
          "documentId": "doc-001",
          "documentType": "uniform-residential-appraisal-report",
          "extractedData": {
            "propertyAddress": "123 Main St",
            "salesPrice": 425000,
            "appraisedValue": 430000,
            "appraisalDate": "2026-04-15"
          },
          "consolidatedData": {
            "propertyAddress": "123 Main St",
            "salesPrice": 425000,
            "appraisedValue": 430000,
            "appraisalDate": "2026-04-15"
          },
          "confidence": 0.95,
          "metadata": {}
        }
      ]
    }
  }'
When extractedDocuments is in the body, the auto-loader is skipped entirely — server uses what you sent. No Cosmos lookup. fileSetId here is just an ID for tracking + result storage; doesn't need to map to a real Cosmos record.

Shape per document — src/types/document-acquisition.ts:70

interface ProcessedDocument {
  documentId: string;
  documentType: string;            // matches what your criteria reference
  extractedData?: any;             // your data object — flat key/value structure
  consolidatedData?: any;          // pass same as extractedData unless you have both
  enhancedFields?: Record<...>;    // optional — fields with bounding-box coordinates
  confidence: number;              // 0..1
  metadata: Record<string, any>;
}
The criteria evaluator reads consolidatedData first, falling back to extractedData. So the simplest pattern: put your JSON data into both extractedData and consolidatedData fields with the same content. The criteria's JMESPath/field references will then evaluate against your data object.

When to use which
Use case	Mode
Re-evaluating an existing axiom-extracted fileSet against new criteria	Mode 1 (fileSetId only)
Evaluating data extracted by external systems (Sentinel, third-party LOS, manual entry)	Mode 2 (inline JSON)
What-if analysis with synthetic data	Mode 2 (inline JSON)
Bulk batch evaluations programmatically	Mode 2 (inline JSON)