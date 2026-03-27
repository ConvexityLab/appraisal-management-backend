export interface AiParseResult {
  intent: string;                  // e.g., 'CREATE_ORDER', 'ASSIGN_VENDOR'
  confidence: number;              // 0.0 - 1.0
  actionPayload: any;              // The structured data ready for the actual API call
  presentationSchema: AiPresentationSchema;
}

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

export interface AiParseRequest {
  text: string;
  context?: Record<string, any>; // Optional context (e.g. current order ID, current user ID)
  history?: Array<{ role: 'user' | 'assistant' | 'system', content: string }>;
}
