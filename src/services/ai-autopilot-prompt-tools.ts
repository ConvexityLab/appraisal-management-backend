/**
 * AutopilotPromptTools — the minimal function-calling tool spec the
 * autopilot approval flow hands to AiParserService when a recipe's
 * pendingApproval.intent is `PROMPT_DRIVEN`.
 *
 * Phase 14 v3 follow-up (2026-05-13): closes the canary-surfaced gap
 * where prompt-only recipes parked in the approval queue but couldn't
 * be dispatched (the approve handler's switch had no PROMPT_DRIVEN
 * case).  Now the handler:
 *
 *   1. Calls AiParserService.parseIntent with the stored prompt + this
 *      tools array.
 *   2. The LLM picks one of the 4 synthetic action tools.  The parser
 *      maps `request_*` tool names back to the executable intent
 *      (CREATE_ORDER / CREATE_ENGAGEMENT / ASSIGN_VENDOR /
 *      TRIGGER_AUTO_ASSIGNMENT) via SYNTHETIC_TOOL_PREFIXES in
 *      ai-parser.service.ts.
 *   3. The resolved (intent, actionPayload) feed the existing dispatch
 *      switch as if the recipe had been authored with a deterministic
 *      intent from the start.
 *
 * Schema-light approach: dispatcher handlers (handleCreateOrder,
 * handleAssignVendor, …) already enforce per-field requireds via
 * AiActionDispatchError, so we keep the JSON Schema permissive here
 * (`additionalProperties: true`) and trust the downstream validator to
 * surface a structured 400 if the LLM omits something.  The system
 * prompt in ai-parser.service.ts (INTENT_DEFINITIONS) describes the
 * required payload fields in natural language; the LLM has seen those
 * during its own training on this codebase.
 */

import type { AiParseRequestTool } from '../types/ai-parser.types.js';

export const AUTOPILOT_PROMPT_TOOLS: AiParseRequestTool[] = [
	{
		type: 'function',
		function: {
			name: 'request_create_engagement',
			description:
				"Start a new engagement (umbrella entity owning one or more client orders + properties). Use when the recipe's prompt asks to create / register / onboard a new engagement.",
			parameters: {
				type: 'object',
				additionalProperties: true,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'request_create_order',
			description:
				"Create a single VendorOrder against an EXISTING engagement → property → clientOrder hierarchy. Requires engagementId, engagementPropertyId, clientOrderId in the args.",
			parameters: {
				type: 'object',
				additionalProperties: true,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'request_assign_vendor',
			description:
				"Assign a vendor / appraiser to one or more existing orders. Args: { vendorId: string, orderIds: string[] } (or single orderId).",
			parameters: {
				type: 'object',
				additionalProperties: true,
			},
		},
	},
	{
		type: 'function',
		function: {
			name: 'request_trigger_auto_assignment',
			description:
				"Run the auto-assignment engine against a set of existing orders. Args: { orderIds: string[] }. Use for 'run auto-assignment on …' / 'auto-match these orders' prompts.",
			parameters: {
				type: 'object',
				additionalProperties: true,
			},
		},
	},
];

/** Executable intents the autopilot dispatcher can handle today. */
export const AUTOPILOT_EXECUTABLE_INTENTS = [
	'CREATE_ENGAGEMENT',
	'CREATE_ORDER',
	'ASSIGN_VENDOR',
	'TRIGGER_AUTO_ASSIGNMENT',
] as const;

export type AutopilotExecutableIntent = (typeof AUTOPILOT_EXECUTABLE_INTENTS)[number];

export function isAutopilotExecutableIntent(
	intent: string,
): intent is AutopilotExecutableIntent {
	return (AUTOPILOT_EXECUTABLE_INTENTS as readonly string[]).includes(intent);
}
