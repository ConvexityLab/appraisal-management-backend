import OpenAI from 'openai';
import { AzureOpenAI } from 'openai';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { AiParseResult, AiParseRequest } from '../types/ai-parser.types.js';
import { Logger } from '../utils/logger.js';

const logger = new Logger('AiParserService');

const dynamicSchemaCache = new Map<string, any>();
const dynamicJsonSchemaCache = new Map<string, any>();

// ── Strict Schemas for Output ────────────────────────────────────────────────
const aiPresentationFieldSchema = z.object({
  label: z.string(),
  value: z.string(),
  status: z.enum(['added', 'changed', 'removed', 'unchanged']),
  warning: z.string().nullable(),
  oldValue: z.string().nullable()
});

const INTENT_DEFINITIONS: Record<string, { description: string; payloadShape: string }> = {
  'CREATE_ENGAGEMENT': {
    description: "Use if the user is inputting a portfolio, multiple files, or requesting to start a new overall engagement with a client.",
    payloadShape: "Should include 'poolName', 'clientId', etc."
  },
  'CREATE_ORDER': {
    description: "Create a single VendorOrder against an EXISTING ClientOrder inside an EXISTING Engagement. CRITICAL: a VendorOrder cannot exist on its own — it must be attached to an engagement → property → clientOrder hierarchy. If the user has not yet identified that hierarchy, you MUST first either (a) emit CREATE_ENGAGEMENT to build it, or (b) emit a TOOL_CALL (searchBackendOrders / queryLocalCache) to resolve the engagementId, engagementPropertyId, and clientOrderId. Only emit CREATE_ORDER once all three IDs are known.",
    payloadShape: "Required: 'engagementId' (parent Engagement.id), 'engagementPropertyId' (the EngagementProperty.id this order is for), 'clientOrderId' (the EngagementClientOrder.id this VendorOrder fulfills), 'clientId', 'orderNumber', 'propertyAddress' (streetAddress|street, city, state, zipCode|zip), 'propertyDetails' (propertyType, occupancy, features[]), 'orderType', 'productType', 'dueDate' (ISO 8601), 'rushOrder' (bool), 'borrowerInformation' (firstName, lastName), 'loanInformation' (loanAmount, loanType, loanPurpose), 'contactInformation' (name, role, preferredMethod), 'priority', 'tags' (array), 'metadata' (object)."
  },
  'ASSIGN_VENDOR': {
    description: "Use if the user is assigning an appraiser or vendor.",
    payloadShape: "Should include 'orderIds' (array) and 'vendorId'."
  },
  'UPDATE_FEE_SPLIT': {
    description: "Use if the user is updating an appraiser's fee split, increasing a fee, or modifying payout details.",
    payloadShape: "Should include 'orderId' and 'feeAmount' or 'feeSplit'."
  },
  'RECORD_PAYMENT': {
    description: "Use if the user is recording a payment received, paying an invoice, or batch processing payments.",
    payloadShape: "Should include 'invoiceId' or 'orderId' along with 'amount' and 'paymentMethod'."
  },
  'TRIGGER_AUTO_ASSIGNMENT': {
    description: "Use if the user requests to run the auto-assigner, broadcast bids, or automatically match an order to an appraiser. Examples: 'Run auto-assignment on all open Texas orders', 'Auto assign this file'. CRITICAL: If you don't know the exact orderIds, you MUST use 'TOOL_CALL' first to fetch them. If you need a TOOL_CALL, you CANNOT use this intent yet.",
    payloadShape: "Should include 'orderIds' (array) containing the exact IDs of the orders to auto-assign."
  },
  'BATCH_PROCESS': {
    description: "Use if the user provides a list or CSV of multiple disparate actions or bulk assignments across multiple vendors.",
    payloadShape: "Should include an 'actions' array where each item has an 'intent', 'payload', and 'description'."
  },
  'NAVIGATE_TO_ENTITY': {
    description: "Use if the user wants to view, open, or navigate to a specific entity, dashboard, or page (e.g., 'open order 123', 'go to billing').",
    payloadShape: "Should include 'entityType' (e.g., 'ORDER', 'VENDOR', 'BILLING') and 'entityId' (if applicable)."
  },
  'INFO': {
    description: "Use if the user asks a question, checks a status, or requests information that does not require taking a system action. Use this if you just retrieved data via a TOOL_CALL and need to present it to the user. Do NOT call timeline tools continuously to answer broad status questions.",
    payloadShape: "Payload should be empty/null. The answer should be beautifully formatted inside the 'presentationSchema'."
  },
  'UNKNOWN': {
    description: "Use ONLY if you absolutely cannot understand the user's intent or if the request is completely unrelated to the system. Do NEVER use this if you want to make a TOOL_CALL or answer a question (INFO).",
    payloadShape: "Payload should be empty."
  },
  'TOOL_CALL': {
    description: "CRITICAL: Use this intent EXACTLY if you need to fetch local frontend data or search the backend (like finding available appraisers in Texas) before you can fulfill the user's ultimate action. IF YOU WANT TO CALL A TOOL, YOUR TOP-LEVEL INTENT MUST BE 'TOOL_CALL'. You CANNOT declare the final intent (like TRIGGER_AUTO_ASSIGNMENT) until the tool call has returned.",
    payloadShape: "Should include 'toolName' (the name of the tool), and 'toolArgs' (an object of parameters needed for the tool)."
  }
};

export class AiParserService {
  private openai: OpenAI;

  constructor() {
    if (process.env.AZURE_OPENAI_API_KEY && process.env.AZURE_OPENAI_ENDPOINT) {
      this.openai = new AzureOpenAI({
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-04-01-preview',
        deployment: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini',
      });
    } else {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("Either AZURE_OPENAI_API_KEY/ENDPOINT or OPENAI_API_KEY environment variables are required.");
      }
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Parses natural language or CSV text and returns a structured AI Parse Result
   */
  async parseIntent(request: AiParseRequest): Promise<AiParseResult> {
    try {
      let allowedIntents = request.context?.allowedIntents || Object.keys(INTENT_DEFINITIONS);
      if (!allowedIntents.includes('TOOL_CALL')) {
         allowedIntents.push('TOOL_CALL');
      }
      if (!allowedIntents.includes('INFO')) {
         allowedIntents.push('INFO');
      }
      if (!allowedIntents.includes('UNKNOWN')) {
         allowedIntents.push('UNKNOWN');
      }
      const currentPage = request.context?.currentPage || 'Unknown Context';
      const knownEnums = Array.from(new Set([...allowedIntents, 'UNKNOWN', 'INFO'])) as [string, ...string[]];

      // Dynamically generate the exact schema to match the requested intents
      const dynamicParseResultSchema = z.object({
        intent: z.enum(knownEnums),
        confidence: z.number().min(0).max(1),
        actionPayload: z.object({
          toolName: z.string().nullable(),
          toolArgs: z.object({
            textQuery: z.string().nullable(),
            status: z.array(z.string()).nullable(),
            state: z.string().nullable(),
            searchTerm: z.string().nullable(),
            entityType: z.string().nullable(),
            stateFilter: z.string().nullable(),
            vendorId: z.string().nullable(),
            orderId: z.string().nullable()
          }).nullable(),
          orderIds: z.array(z.string()).nullable(),
          orderId: z.string().nullable(),
          vendorId: z.string().nullable(),
          appraiserId: z.string().nullable(),
          status: z.string().nullable(),
          priority: z.string().nullable(),
          filterValue: z.string().nullable(),
          view: z.string().nullable()
        }),
        presentationSchema: z.object({
          title: z.string(),
          summary: z.string(),
          fields: z.array(aiPresentationFieldSchema),
          actionButtonText: z.string()
        })
      });

      const dynamicJsonSchemaForAiParseResult = {
        name: "ai_parse_result",
        schema: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: knownEnums
            },
            confidence: {
              type: "number"
            },
            actionPayload: {
              type: "object",
              properties: {
                toolName: { type: ["string", "null"] },
                toolArgs: {
                  type: ["object", "null"],
                  properties: {
                    textQuery: { type: ["string", "null"] },
                    status: {
                       type: ["array", "null"],
                       items: { type: "string" }
                    },
                    state: { type: ["string", "null"] },
                    searchTerm: { type: ["string", "null"] },
                    entityType: { type: ["string", "null"] },
                    stateFilter: { type: ["string", "null"] },
                    vendorId: { type: ["string", "null"] },
                    orderId: { type: ["string", "null"] }
                  },
                  required: ["textQuery", "status", "state", "searchTerm", "entityType", "stateFilter", "vendorId", "orderId"],
                  additionalProperties: false
                },
                orderIds: { 
                  type: ["array", "null"],
                   items: { type: "string" }
                },
                orderId: { type: ["string", "null"] },
                vendorId: { type: ["string", "null"] },
                appraiserId: { type: ["string", "null"] },
                status: { type: ["string", "null"] },
                priority: { type: ["string", "null"] },
                filterValue: { type: ["string", "null"] },
                view: { type: ["string", "null"] }
              },
              required: ["toolName", "toolArgs", "orderIds", "orderId", "vendorId", "appraiserId", "status", "priority", "filterValue", "view"],
              additionalProperties: false
            },
            presentationSchema: {
              type: "object",
              properties: {
                title: { type: "string" },
                summary: { type: "string" },
                fields: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      label: { type: "string" },
                      value: { type: "string" },
                      status: { type: "string", enum: ['added', 'changed', 'removed', 'unchanged'] },
                      warning: { type: ["string", "null"] },
                      oldValue: { type: ["string", "null"] }
                    },
                    required: ["label", "value", "status", "warning", "oldValue"],
                    additionalProperties: false
                  }
                },
                actionButtonText: { type: "string" }
              },
              required: ["title", "summary", "fields", "actionButtonText"],
              additionalProperties: false
            }
          },
          required: ["intent", "confidence", "actionPayload", "presentationSchema"],
          additionalProperties: false
        },
        strict: true
      };

      let systemPrompt = `You are an expert AI parser for the L1 Valuation Platform.
The user is currently executing an action from the context: "${currentPage}".

CRITICAL ID MAPPING RULES:
If the user provides screen context containing entities (e.g., vendors, orders, invoices), you MUST use their EXACT backend ID from the context mapping below. Do NOT guess IDs. If a name matches an entity in context, use that exact ID for actionPayload properties (like appraiserId, vendorId, orderId).`;

      if (request.context?.entityMap) {
        // Cap to prevent context bloat
        const mappedIds = Object.entries(request.context.entityMap).slice(0, 15).reduce((acc, [key, val]: any) => { acc[key] = { id: val?.id, name: val?.name || val?.title }; return acc; }, {} as any);
        systemPrompt += `\n\nCURRENT SCREEN CONTEXT (Entity ID Mappings):\n${JSON.stringify(mappedIds, null, 2)}\n`;
      }

      systemPrompt += `\nYour job is to read unstructured text or CSV drops from users, understand what action they intend to take, and format a strict JSON response.
You MUST map the input into one of these SPECIFIC allowed intents: ${knownEnums.map(i => `'${i}'`).join(', ')}.

Allowed Intent Definitions:
`;
      for (const intent of allowedIntents) {
        if (INTENT_DEFINITIONS[intent]) {
          systemPrompt += `- '${intent}': ${INTENT_DEFINITIONS[intent].description}\n`;
          systemPrompt += `  -> Payload instructions: ${INTENT_DEFINITIONS[intent].payloadShape}\n`;
        }
      }

      systemPrompt += `\nAvailable Tools for TOOL_CALL:
- queryLocalCache: Searches on-screen data (entityMap pre-loaded from the active page). Args: { "toolName": "queryLocalCache", "toolArgs": { "entityType": string, "searchTerm": string } }
- searchBackendOrders: Searches the orders database. Use status=['UNASSIGNED'] + state='TX' to find open orders in Texas. Use textQuery for free-text matches (order numbers like 'SEED-CO-00102', client-order IDs, addresses). PREFER this when the user names an order by number/ID — getOrderTimeline expects a VendorOrder UUID and will 404 on client-order numbers. Args: { "toolName": "searchBackendOrders", "toolArgs": { "textQuery"?: string, "status"?: string[], "state"?: string, "vendorId"?: string, "clientId"?: string, "dateFrom"?: string, "dateTo"?: string } }
- searchBackendVendors: Searches for appraisers/vendors. Args: { "toolName": "searchBackendVendors", "toolArgs": { "searchTerm"?: string, "state"?: string, "status"?: string[], "minPerformanceScore"?: number } }
- searchBackendClients: Searches for clients (lenders/AMCs). Args: { "toolName": "searchBackendClients", "toolArgs": { "searchTerm": string } }
- getVendorPerformance: Workload + performance stats for a vendor. Args: { "toolName": "getVendorPerformance", "toolArgs": { "vendorId": string } }
- getOrderTimeline: Chronological history + current status of a VendorOrder. orderId MUST be a VendorOrder UUID (resolve via searchBackendOrders first if the user gave a client-order number like 'SEED-CO-*' — those are NOT VendorOrder IDs). Args: { "toolName": "getOrderTimeline", "toolArgs": { "orderId": string } }
- lookupEntities: Batch-fetch entities by id (orders, vendors, clients). Caps at 50 ids. Args: { "toolName": "lookupEntities", "toolArgs": { "entityType": "order"|"vendor"|"client", "ids": string[] } }
- searchDocuments: List documents linked to an order/entity. Args: { "toolName": "searchDocuments", "toolArgs": { "orderId"?: string, "entityType"?: string, "entityId"?: string, "category"?: string, "q"?: string, "limit"?: number } }
- getDocumentExcerpt: First N chars of an already-loaded document's extracted text. Args: { "toolName": "getDocumentExcerpt", "toolArgs": { "documentId": string, "maxChars"?: number } }
- askAxiom: Ask the Axiom agent a question (RAG over the order's documents). Args: { "toolName": "askAxiom", "toolArgs": { "question": string, "orderId"?: string, "maxIterations"?: number } }
- getProgramCriteria: Fetch compiled criteria nodes for a review-program version. Args: { "toolName": "getProgramCriteria", "toolArgs": { "programId": string, "programVersion": string } }
- navigate: Navigate the user to a page. Args: { "toolName": "navigate", "toolArgs": { "routeKey": "ORDER"|"VENDOR"|"ENGAGEMENT"|"ORDERS_DASHBOARD"|"VENDORS_DIRECTORY"|"BILLING"|"ENGAGEMENTS", "entityId"?: string } }

CRITICAL: only call tools listed above.  Calling an unregistered tool name (e.g. 'findUnassignedOrders' which used to exist) will return an error and waste a tool-call round; the loop hard-caps at 5 rounds.
`;

      systemPrompt += `
Map the parsed details into 'actionPayload' according to the intent.
Generate a 'presentationSchema' that represents a clean, readable summary of what you are about to do, so the human user can confidently approve it. Use clear labels and flag any warnings (e.g. if you altered or guessed a value).

TOOL-CALL TERMINATION RULES (MANDATORY):
- If the most recent assistant message in history starts with "Tool <name> returned: ..." you have ALREADY received tool output. On THIS turn you MUST respond with INFO (or another action intent), presenting the data in presentationSchema. You MUST NOT call the same tool again — that loops forever.
- Never emit two consecutive TOOL_CALL responses to the same tool with the same arguments. If the previous turn was TOOL_CALL ${'$'}{tool} and the user has not refined since, this turn is INFO.
- TOOL_CALL responses must NOT contain the answer in presentationSchema. presentationSchema for TOOL_CALL should describe what you are about to look up ("Searching for open orders…"). The actual answer goes in the FOLLOWING INFO turn.

DECISION ORDER (MANDATORY — do NOT shortcut to UNKNOWN):
1. Does the request mention finding, listing, searching, summarizing, counting, or filtering ANY entity (orders, vendors, clients, appraisals, engagements)?
   → Pick TOOL_CALL with the most-specific tool. If unsure between findUnassignedOrders and searchBackendOrders, pick searchBackendOrders.
2. Is the user asking a question that could be answered by data (e.g. "how many...", "what is the status of...", "who is assigned to...")?
   → Pick TOOL_CALL first to fetch the data, then INFO on the next turn to present it.
3. Did the user say something vague like "yes", "ok", "do it", "that's right" AS A REFINEMENT?
   → Re-issue the previous user-action TOOL_CALL or action intent. NEVER answer "yes" with UNKNOWN.
4. Only after ruling out all of the above → use UNKNOWN.

EXAMPLES:
- "Find all overdue appraisals" → TOOL_CALL with searchBackendOrders {status:["OVERDUE"]} (or status:["IN_PROGRESS"] if OVERDUE isn't a real status, then INFO with the result).
- "How many orders do we have?" → TOOL_CALL with searchBackendOrders {status:[]} (empty-status search returns all), then INFO with the count next turn.
- "Summarize status of all open orders" → TOOL_CALL with searchBackendOrders {status:["UNASSIGNED","ASSIGNED","IN_PROGRESS"]}.
- "Open order 12345" → NAVIGATE_TO_ENTITY {entityType:"ORDER", entityId:"12345"}.
- "Show me Texas vendors" → TOOL_CALL with searchBackendVendors {searchTerm:"Texas"}.
- "Who is the appraiser for order ABC-123?" → TOOL_CALL with getOrderTimeline {orderId:"ABC-123"}, then INFO.
- Vague refinement "yes that is correct" → re-issue the previous TOOL_CALL / action intent; NEVER UNKNOWN.

Reserve UNKNOWN strictly for: requests entirely unrelated to the platform ("what's the weather"), nonsense ("asdfgh"), or single-word non-actions ("hello", "thanks") where you have already presented a greeting and have no follow-up to perform.`;

      const messages = [
        {
          role: 'system',
          content: systemPrompt
        },
        ...(request.history || []).map(msg => ({ role: msg.role, content: msg.content })),
        {
          role: 'user',
          content: request.text
        }
      ] as any[];

      logger.info('Sending request to Azure OpenAI', {
        intentContext: knownEnums,
        messageCount: messages.length,
        messages: JSON.stringify(messages, null, 2)
      });

      const response = await this.openai.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini',
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: dynamicJsonSchemaForAiParseResult as any
        }
      });

      const messageContent = response.choices[0]?.message?.content;
      if (!messageContent) {
        throw new Error("Received empty response from OpenAI.");
      }

      logger.info('Received response from Azure OpenAI', {
        content: messageContent
      });

      const parsedJson = JSON.parse(messageContent);

      // Zod validation step to guarantee structure using dynamic schema
      const parsedResult = dynamicParseResultSchema.parse(parsedJson);

      return parsedResult as AiParseResult;

    } catch (error) {
      logger.error('Failed to parse AI intent', { error, text: request.text });
      throw new Error(`Failed to process AI Intent: ${error instanceof Error ? error.message : 'Unknown Error'}`);
    }
  }
}
