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
  // value accepts string|number|boolean|null because models occasionally
  // emit a bare number for a "count" or "fee" field; coercing to string
  // upstream would lose the type signal the UI uses to right-align.
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
  status: z.enum(['added', 'changed', 'removed', 'unchanged']),
  // Both warning and oldValue accept the same union plus undefined; the
  // model has been observed to omit them rather than emit null.
  warning: z.union([z.string(), z.null()]).optional(),
  oldValue: z.union([z.string(), z.number(), z.boolean(), z.null()]).optional()
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

      // Server-side validation Zod schema — must accept the same
      // looser shape we ask Azure OpenAI to produce (see comment block
      // on `dynamicJsonSchemaForAiParseResult` below).  actionPayload
      // is a passthrough object: per-intent payload validation lives
      // in src/validators/ai-intent-payloads.validator.ts and the
      // matching frontend Zod, both of which fire at execute time.
      const dynamicParseResultSchema = z.object({
        intent: z.enum(knownEnums),
        confidence: z.number().min(0).max(1),
        actionPayload: z.record(z.string(), z.unknown()).nullable(),
        presentationSchema: z.object({
          title: z.string(),
          summary: z.string(),
          fields: z.array(aiPresentationFieldSchema),
          actionButtonText: z.string()
        }).passthrough()
      });

      // Loose JSON-schema response_format — the model is told the
      // OUTER shape (intent / confidence / actionPayload /
      // presentationSchema) but actionPayload + toolArgs are
      // free-form objects.  We DELIBERATELY do NOT use `strict:true`
      // and DO NOT lock down property whitelists on actionPayload /
      // toolArgs because:
      //
      //   1. Strict mode + `additionalProperties:false` requires every
      //      listed property to be in `required` AND forbids extras.
      //      The previous schema whitelisted 8 toolArgs keys
      //      (textQuery, status, state, searchTerm, entityType,
      //      stateFilter, vendorId, orderId) and 10 actionPayload
      //      keys.  Every new tool we add (searchEngagements,
      //      countEngagementsByStatus, askAxiom, navigate, …) plus
      //      every action intent's payload (CREATE_ORDER needs
      //      engagementId / engagementPropertyId / clientOrderId /
      //      etc.) needs keys NOT in those whitelists.  Azure OpenAI
      //      then rejects the response and the controller emits 500
      //      — which is what staging hit on 2026-05-10.
      //
      //   2. Per-tool / per-intent argument validation lives in the
      //      Zod schemas at:
      //        backend  src/validators/ai-intent-payloads.validator.ts
      //        frontend src/store/api/schemas/aiSchemas.ts
      //      Both already validate the shape of each intent's payload
      //      before dispatch.  Layering OpenAI's response_format on
      //      top of those was duplicative and brittle.
      //
      //   3. Strict mode was originally added when the registry had
      //      6 tools and a handful of intents; the surface has since
      //      grown to 14 tools + 10 intents.  Maintaining a flat
      //      whitelist of every possible argument key is no longer
      //      tractable.
      const dynamicJsonSchemaForAiParseResult = {
        name: "ai_parse_result",
        schema: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: knownEnums
            },
            confidence: { type: "number" },
            // actionPayload is intentionally free-form.  TOOL_CALL
            // responses set { toolName, toolArgs }; action intents
            // set whatever the per-intent Zod schema expects (e.g.
            // CREATE_ORDER's full engagement-linkage payload).
            actionPayload: {
              type: ["object", "null"],
              additionalProperties: true,
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
                      value: { type: ["string", "number", "boolean", "null"] },
                      status: { type: "string", enum: ['added', 'changed', 'removed', 'unchanged'] },
                      warning: { type: ["string", "null"] },
                      oldValue: { type: ["string", "number", "boolean", "null"] }
                    },
                    required: ["label", "value", "status"],
                    additionalProperties: true
                  }
                },
                actionButtonText: { type: "string" }
              },
              required: ["title", "summary", "fields", "actionButtonText"],
              additionalProperties: true
            }
          },
          required: ["intent", "confidence", "actionPayload", "presentationSchema"],
          additionalProperties: false
        }
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
- searchEngagements: Search ENGAGEMENTS (NOT orders — engagements are the umbrella entity that owns one or more client orders). Filters: status[] (RECEIVED|ACCEPTED|IN_PROGRESS|QC|REVISION|DELIVERED|CANCELLED|ON_HOLD), clientId, propertyState, propertyZipCode, searchText. PREFER this over searchBackendOrders when the user asks about engagements. Args: { "toolName": "searchEngagements", "toolArgs": { "status"?: string[], "clientId"?: string, "propertyState"?: string, "propertyZipCode"?: string, "searchText"?: string, "pageSize"?: number } }
- countEngagementsByStatus: Returns {totalCount, byStatus:{STATUS:count}} for engagements. Pass openOnly:true to restrict to non-terminal statuses (RECEIVED, ACCEPTED, IN_PROGRESS, QC, REVISION, ON_HOLD) — this is "open engagements". USE THIS for any "how many engagements" question. Args: { "toolName": "countEngagementsByStatus", "toolArgs": { "openOnly"?: boolean, "clientId"?: string } }

UNIVERSAL-SURFACE META-TOOLS (use these for ANY question the curated tools above don't directly cover):
- discoverEndpoints: Search the platform's endpoint catalog by free text and/or domain category. Returns ranked endpoint matches with method, path, scopes, and schema hints. ALWAYS use this BEFORE callEndpoint when no curated tool fits. Args: { "toolName": "discoverEndpoints", "toolArgs": { "query": string, "category"?: "orders"|"engagements"|"vendors"|"clients"|"documents"|"properties"|"qc"|"review-programs"|"criteria"|"axiom"|"decision-engine"|"communications"|"auto-assignment"|"analytics"|"ops", "limit"?: number } }
- callEndpoint: Invoke a catalog-listed read endpoint by path + method (substitute path params via pathParams; pass query/body per the catalog schema). REFUSES write endpoints — those still go through action intents with human approval. Args: { "toolName": "callEndpoint", "toolArgs": { "path": string, "method": "GET"|"POST", "pathParams"?: {[name]: string}, "queryParams"?: object, "body"?: object } }

- searchDocuments: List documents linked to an order/entity. Args: { "toolName": "searchDocuments", "toolArgs": { "orderId"?: string, "entityType"?: string, "entityId"?: string, "category"?: string, "q"?: string, "limit"?: number } }
- getDocumentExcerpt: First N chars of an already-loaded document's extracted text. Args: { "toolName": "getDocumentExcerpt", "toolArgs": { "documentId": string, "maxChars"?: number } }
- getProgramCriteria: Fetch compiled criteria nodes for a review-program version. Args: { "toolName": "getProgramCriteria", "toolArgs": { "programId": string, "programVersion": string } }
- navigate: Navigate the user to a page. Args: { "toolName": "navigate", "toolArgs": { "routeKey": "ORDER"|"VENDOR"|"ENGAGEMENT"|"ORDERS_DASHBOARD"|"VENDORS_DIRECTORY"|"BILLING"|"ENGAGEMENTS", "entityId"?: string } }

MOP / VENDOR-MATCHING TOOLS (use these for "why didn't vendor X get this order?" / "which vendors match this order?" questions):
- evaluateVendorMatching: Runs MOP's RETE rules engine against an order to produce ranked vendor matches + per-vendor denyReasons[]. Use for any vendor-eligibility question. Args: { "toolName": "evaluateVendorMatching", "toolArgs": { "propertyAddress": string, "propertyType": string, "orderId"?: string, "dueDate"?: string, "urgency"?: "STANDARD"|"RUSH"|"SUPER_RUSH", "budget"?: number, "topN"?: number, "requiredCapabilities"?: string[] } }

AXIOM AGENT TOOLS (REASONING-HEAVY questions go HERE — Axiom is purpose-built for our mortgage / appraisal domain and runs its own multi-step agent loop over our document corpus + criteria + scoping):
- askAxiom: Send a natural-language question to the Axiom autonomous agent. Axiom owns a ReAct loop over loan documents (PageIndex), criteria evaluation, and platform actors (40+). Use for ANY of: "What does this appraisal say about X?", "Why did criterion Y fail?", "Summarize the comps in this report", "What changed between v1 and v2?", "Are there fraud signals in this package?", multi-step reasoning, anything that needs document context. Args: { "toolName": "askAxiom", "toolArgs": { "question": string, "orderId"?: string, "maxIterations"?: number } }
- axiomGetScopeResults: Latest criteria-evaluation verdicts for a review scope. Faster + cheaper than asking the agent. Use for "what's the pass/fail breakdown for order X under program Y?" Args: { "toolName": "axiomGetScopeResults", "toolArgs": { "scopeId": string, "programId"?: string } }
- axiomGetCriterionHistory: Run-by-run verdict history for one criterion. Use for "why did this criterion flip pass→fail last week?" Args: { "toolName": "axiomGetCriterionHistory", "toolArgs": { "scopeId": string, "criterionId": string } }
- axiomGetComplexityScore: Axiom-computed complexity / risk score for one order. Args: { "toolName": "axiomGetComplexityScore", "toolArgs": { "orderId": string } }
- axiomCompareDocuments: Document-level diff between two file sets (e.g. v1 vs v2 of an appraisal). Use for "what changed between these revisions?" Args: { "toolName": "axiomCompareDocuments", "toolArgs": { "baseFileSetId": string, "compareFileSetId": string } }

DECISION ORDER when picking tools (in priority order):
  1. CURATED tools (queryLocalCache, searchBackendOrders, …, countEngagementsByStatus, navigate) — fastest path for common structured questions and CRUD-shaped intents. Sub-second latency. PREFER these when they cover the question.
  2. AXIOM TOOLS (askAxiom + axiomGet*/axiomCompare*) — for ANY reasoning-heavy or document-aware question. Axiom runs a multi-step agent loop, has RAG over our document corpus, knows our criteria + programs + scopes. Slower (3-15s) but smarter. PREFER over discoverEndpoints/callEndpoint whenever the question is about appraisal content, criteria, scoring, fraud signals, or anything requiring domain reasoning.
  3. discoverEndpoints + callEndpoint — for the LONG TAIL of structured fetches that the curated tools don't cover (engagement audit log, property record by id, decision-engine rule packs, QC queue stats, etc.). Two-step: discover, then call.
  4. UNKNOWN / INFO fallback — only if NONE of the above can help.

CRITICAL: only call tools listed above.  Calling an unregistered tool name (e.g. 'findUnassignedOrders' which used to exist) will return an error and waste a tool-call round; the loop hard-caps at 5 rounds.
`;

      systemPrompt += `
Map the parsed details into 'actionPayload' according to the intent.
Generate a 'presentationSchema' that represents a clean, readable summary of what you are about to do, so the human user can confidently approve it. Use clear labels and flag any warnings (e.g. if you altered or guessed a value).

TOOL-CALL TERMINATION RULES (MANDATORY):
- If the most recent assistant message in history starts with "Tool <name> returned: ..." you have ALREADY received tool output. On THIS turn you MUST respond with INFO (or another action intent), presenting the data in presentationSchema. You MUST NOT call the same tool again — that loops forever.
- Never emit two consecutive TOOL_CALL responses to the same tool with the same arguments. If the previous turn was TOOL_CALL ${'$'}{tool} and the user has not refined since, this turn is INFO.
- TOOL_CALL responses must NOT contain the answer in presentationSchema. presentationSchema for TOOL_CALL should describe what you are about to look up ("Searching for open orders…"). The actual answer goes in the FOLLOWING INFO turn.

ANTI-HALLUCINATION RULE (MANDATORY — non-negotiable):
- For ANY quantitative question ("how many X", "count of X", "total X", "what is the X count") you MUST emit a TOOL_CALL first.  You may NEVER answer with a number in presentationSchema.summary unless the immediately-preceding turn was "Tool <name> returned: ..." with the number in it.
- If no registered tool can answer the question, your INFO reply must say so explicitly — e.g. "I don't have a tool that can count X.  Want me to look at the closest available metric instead?"  Do NOT invent a number.  Do NOT round.  Do NOT estimate.
- The user has zero tolerance for fabricated counts.  A wrong number is worse than "I don't know" because the user may act on it.

DECISION ORDER (MANDATORY — do NOT shortcut to UNKNOWN):
1. Does the request mention finding, listing, searching, summarizing, counting, or filtering ANY entity (orders, vendors, clients, appraisals, engagements)?
   → Pick TOOL_CALL with the most-specific tool. For engagements use searchEngagements / countEngagementsByStatus (NOT searchBackendOrders — orders and engagements are different entities).
2. Is the user asking a question that could be answered by data (e.g. "how many...", "what is the status of...", "who is assigned to...")?
   → Pick TOOL_CALL first to fetch the data, then INFO on the next turn to present it.  The ANTI-HALLUCINATION RULE above is the hard floor.
3. Did the user say something vague like "yes", "ok", "do it", "that's right" AS A REFINEMENT?
   → Re-issue the previous user-action TOOL_CALL or action intent. NEVER answer "yes" with UNKNOWN.
4. Only after ruling out all of the above → use UNKNOWN.

EXAMPLES:
- "Find all overdue appraisals" → TOOL_CALL with searchBackendOrders {status:["OVERDUE"]} (or status:["IN_PROGRESS"] if OVERDUE isn't a real status, then INFO with the result).
- "How many orders do we have?" → TOOL_CALL with searchBackendOrders {status:[]} (empty-status search returns all), then INFO with the count next turn.
- "Summarize status of all open orders" → TOOL_CALL with searchBackendOrders {status:["UNASSIGNED","ASSIGNED","IN_PROGRESS"]}.
- "How many open engagements do we have?" → TOOL_CALL with countEngagementsByStatus {openOnly:true} → INFO next turn with the totalCount value from the result (NEVER invent a number — see ANTI-HALLUCINATION RULE).
- "How many engagements are in QC?" → TOOL_CALL with countEngagementsByStatus {} (no filter) → INFO citing byStatus.QC from the result.
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

      // Phase 11-B (2026-05-10): function-calling path when the FE
      // supplies a `tools` array.  The model picks one of the supplied
      // tools (a real tool like `searchEngagements` OR a synthetic
      // "terminal" tool like `present_info_response` / `request_action`)
      // and emits a structured `tool_calls[]` with per-tool-validated
      // args.  We then convert that back into the AiParseResult shape
      // the FE expects so the FE useAiToolLoop hook is unchanged.
      const wantsFunctionCalling = Array.isArray(request.tools) && request.tools.length > 0;

      if (wantsFunctionCalling) {
        logger.info('Sending request to Azure OpenAI (function-calling)', {
          intentContext: knownEnums,
          toolCount: request.tools!.length,
          messageCount: messages.length,
        });

        const fcResponse = await this.openai.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini',
          messages,
          tools: request.tools as any,
          tool_choice: 'auto',
        });

        const msg = fcResponse.choices[0]?.message;
        if (!msg) throw new Error('Received empty response from OpenAI.');

        // The model chose a tool — adapt the tool_call shape to the
        // AiParseResult envelope.
        const toolCalls = (msg as any).tool_calls as
          | Array<{ function: { name: string; arguments: string } }>
          | undefined;
        if (toolCalls && toolCalls.length > 0) {
          const call = toolCalls[0]!;
          const toolName = call.function.name;
          let parsedArgs: unknown = {};
          try {
            parsedArgs = JSON.parse(call.function.arguments || '{}');
          } catch {
            parsedArgs = {};
          }

          // Synthetic intent tools — name follows convention
          // `present_<intent>_response` for INFO/UNKNOWN/NAVIGATE
          // terminals and `request_<INTENT>` for action intents.
          // Anything else is a real tool → emit TOOL_CALL.
          const synth = parseSyntheticToolName(toolName);
          if (synth) {
            return {
              intent: synth.intent,
              confidence: 0.9,
              actionPayload: synth.intent === 'NAVIGATE_TO_ENTITY' || synth.intent.startsWith('CREATE_') || synth.intent.startsWith('ASSIGN_') || synth.intent.startsWith('TRIGGER_') || synth.intent.startsWith('SEND_') || synth.intent === 'UPDATE_FEE_SPLIT' || synth.intent === 'RECORD_PAYMENT' || synth.intent === 'BATCH_PROCESS'
                ? parsedArgs
                : null,
              presentationSchema: extractPresentation(parsedArgs, synth.intent),
            } as AiParseResult;
          }

          // Real tool call.
          return {
            intent: 'TOOL_CALL',
            confidence: 0.95,
            actionPayload: { toolName, toolArgs: parsedArgs },
            presentationSchema: {
              title: `Calling ${toolName}`,
              summary: `Retrieving data via ${toolName}…`,
              fields: [],
              actionButtonText: 'Continue',
            },
          } as AiParseResult;
        }

        // No tool call → use the message content as INFO.
        const textOnly = (msg as any).content as string | undefined;
        return {
          intent: 'INFO',
          confidence: 0.7,
          actionPayload: null,
          presentationSchema: {
            title: 'Response',
            summary: textOnly ?? '(empty response)',
            fields: [],
            actionButtonText: 'OK',
          },
        } as AiParseResult;
      }

      // ── Legacy structured-output path (no tools[] supplied) ─────────
      // Kept for backward compatibility with any caller that hasn't
      // migrated to sending the tools array.  The FE's parse-intent
      // mutation always sends tools post-Phase-11-B, but tests and any
      // future automated caller may still use this path.
      logger.info('Sending request to Azure OpenAI (structured-output legacy)', {
        intentContext: knownEnums,
        messageCount: messages.length,
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

// ── Phase 11-B helpers — function-calling response adaptation ────────────
//
// The FE serializes its AiToolRegistry plus a small set of "synthetic"
// intent tools as the `tools` array.  When the LLM picks one, we map
// the tool name back to either:
//   - TOOL_CALL (with toolName + toolArgs) for real tools
//   - The named intent (INFO / UNKNOWN / NAVIGATE / CREATE_ORDER / …)
//     for synthetic terminal tools

const SYNTHETIC_TOOL_PREFIXES: Record<string, string> = {
	present_info_response: 'INFO',
	present_unknown_response: 'UNKNOWN',
	request_navigate: 'NAVIGATE_TO_ENTITY',
	request_create_order: 'CREATE_ORDER',
	request_create_engagement: 'CREATE_ENGAGEMENT',
	request_assign_vendor: 'ASSIGN_VENDOR',
	request_trigger_auto_assignment: 'TRIGGER_AUTO_ASSIGNMENT',
	request_update_fee_split: 'UPDATE_FEE_SPLIT',
	request_record_payment: 'RECORD_PAYMENT',
	request_batch_process: 'BATCH_PROCESS',
	request_send_email: 'SEND_EMAIL',
	request_send_sms: 'SEND_SMS',
	request_send_teams_message: 'SEND_TEAMS_MESSAGE',
};

function parseSyntheticToolName(name: string): { intent: string } | null {
	const intent = SYNTHETIC_TOOL_PREFIXES[name];
	return intent ? { intent } : null;
}

interface PresentationCarrier {
	title?: string;
	summary?: string;
	fields?: Array<{ label: string; value: unknown; status?: string; warning?: string | null; oldValue?: unknown }>;
	actionButtonText?: string;
}

/**
 * Pull a presentationSchema out of a synthetic tool's argument blob.
 * The synthetic tools all expose the schema fields at the top level OR
 * nested under `presentation` — accept both, fall back to a minimal
 * schema if neither shape is present.
 */
function extractPresentation(args: unknown, intent: string): {
	title: string;
	summary: string;
	fields: Array<{ label: string; value: string | number | boolean | null; status: 'added' | 'changed' | 'removed' | 'unchanged'; warning?: string | null; oldValue?: string | number | boolean | null }>;
	actionButtonText: string;
} {
	const carrier = (args as { presentation?: PresentationCarrier } & PresentationCarrier) ?? {};
	const src = (carrier.presentation ?? carrier) as PresentationCarrier;
	const fields = Array.isArray(src.fields)
		? src.fields.map((f) => ({
				label: String(f.label ?? ''),
				value: f.value as string | number | boolean | null,
				status: (f.status ?? 'unchanged') as 'added' | 'changed' | 'removed' | 'unchanged',
				...(f.warning !== undefined ? { warning: f.warning } : {}),
				...(f.oldValue !== undefined ? { oldValue: f.oldValue as string | number | boolean | null } : {}),
			}))
		: [];
	return {
		title: src.title ?? intent,
		summary: src.summary ?? '',
		fields,
		actionButtonText: src.actionButtonText ?? 'OK',
	};
}
