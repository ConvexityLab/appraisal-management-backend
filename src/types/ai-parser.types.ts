export interface AiParseResult {
  intent: string;                  // e.g., 'CREATE_ORDER', 'ASSIGN_VENDOR'
  confidence: number;              // 0.0 - 1.0
  actionPayload: any;              // The structured data ready for the actual API call
  presentationSchema: AiPresentationSchema;
}

export const AI_EXECUTABLE_INTENTS = [
  'CREATE_ORDER',
  'CREATE_ENGAGEMENT',
  'ASSIGN_VENDOR',
  'TRIGGER_AUTO_ASSIGNMENT',
] as const;

export type AiExecutableIntent = (typeof AI_EXECUTABLE_INTENTS)[number];

export interface AiPresentationSchema {
  title: string;                 // e.g., "Create New Engagement"
  summary: string;               // e.g., "Extracted 1 new engagement from CSV..."
  fields: AiPresentationField[];
  actionButtonText: string;      // e.g., "Confirm Engagement"
}

export interface AiPresentationField {
  label: string;               // e.g., "Property Address"
  value: string | number;      // e.g., "123 Main St"
  status: 'added' | 'changed' | 'removed' | 'unchanged';
  warning?: string;            // E.g., "Client 'Bank X' mapped to ID 1092"
}

/**
 * Function-calling tool descriptor — the OpenAI-compatible shape the
 * FE serializes its AiToolRegistry into and sends in the parse-intent
 * request body.  Phase 11-B (2026-05-10) of AI-UNIVERSAL-SURFACE-PLAN.md.
 *
 * When `tools` is present and non-empty in an AiParseRequest, the
 * backend takes the function-calling code path (tools + tool_choice)
 * instead of the legacy structured-output (response_format) path.
 * Empty / missing `tools` keeps the legacy behaviour, so legacy clients
 * that haven't been updated yet keep working.
 */
export interface AiParseRequestTool {
  type: 'function';
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface AiParseRequest {
  text: string;
  context?: Record<string, any>; // Optional context (e.g. current order ID, current user ID)
  history?: Array<{ role: 'user' | 'assistant' | 'system', content: string }>;
  /**
   * Function-calling tool descriptors.  Optional — when present the
   * backend uses Azure OpenAI's tools API instead of structured-output
   * JSON Schema, getting per-tool argument validation natively.
   * Phase 11-B (2026-05-10).
   */
  tools?: AiParseRequestTool[];
}
