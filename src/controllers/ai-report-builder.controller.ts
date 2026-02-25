/**
 * AI Report Builder Controller
 *
 * POST /api/ai/report-builder/generate
 *
 * Accepts a natural-language prompt from the user and returns a @json-render
 * component tree that the frontend `AiReportBuilder` component can render
 * directly via its `<Renderer>`.
 *
 * The AI is given a structured catalog of available components (matching the
 * frontend `PropertyCatalog.ts`) as the system prompt so it generates trees
 * that reference only real, known component types.
 *
 * Constraints:
 *  - Uses UniversalAIService (respects AZURE_OPENAI_ENDPOINT / AZURE_OPENAI_API_KEY)
 *  - NO infrastructure creation
 *  - Input validated before calling AI (fails fast on missing prompt)
 *  - JSON parse failures return 422 Unprocessable Entity, not 500
 */

import { Router, Request, Response } from 'express';
import { Logger } from '../utils/logger.js';
import { UniversalAIService } from '../services/universal-ai.service.js';

const logger = new Logger('AiReportBuilderController');

// ---------------------------------------------------------------------------
// Component catalog — kept in sync with frontend PropertyCatalog.ts
// The AI uses this to know which component types are legal and what props each
// component accepts. Keep it terse enough to fit in ~1 000 tokens.
// ---------------------------------------------------------------------------

const COMPONENT_CATALOG_PROMPT = `
You are an AI assistant that generates JSON component trees for a property appraisal report viewer.

## Available component types

### Layout
- **Section** — titled container that groups children
  props: { title: string, subtitle?: string, collapsible?: boolean }
  hasChildren: true

- **Grid** — n-column responsive grid
  props: { columns: 1|2|3|4, gap?: number }
  hasChildren: true

- **ConditionalSection** — renders children only when a data condition is met
  props: { title: string, condition: { path: string, operator: 'exists'|'equals'|'gt'|'lt', value?: any } }
  hasChildren: true

### Data display
- **PropertyInfo** — property address block
  props: { addressPath?: string (default "/property/address") }

- **PropertyMetric** — single KPI card
  props: { label: string, valuePath: string, format?: 'currency'|'percent'|'number'|'text'|'date', icon?: string }

- **ValuationSummary** — estimated value range + confidence
  props: { valuePath?: string (default "/report/valuation"), showConfidence?: boolean, showRange?: boolean }

- **CompTable** — comparable-sales table
  props: { compsPath?: string (default "/report/comps"), showAdjustments?: boolean, highlightSelected?: boolean, maxRows?: number }

- **AvmResults** — AVM output breakdown
  props: { resultsPath?: string (default "/avm/results"), showBreakdown?: boolean }

- **CensusData** — census demographics block
  props: { dataPath?: string (default "/census"), sections?: ('demographics'|'economics'|'housing')[] }

- **RiskIndicators** — risk flag list
  props: { risksPath?: string (default "/risks"), severity?: 'all'|'high'|'medium' }

### Charts
- **Chart** — generic chart
  props: { type: 'line'|'bar'|'pie'|'area', title: string, dataPath: string, xField: string, yField: string }

- **TrendChart** — time-series line chart
  props: { title: string, dataPath: string, timeField?: string, valueField?: string }

### Interactive
- **Button** — action button
  props: { label: string, variant?: 'contained'|'outlined'|'text', color?: 'primary'|'secondary'|'success'|'error', action: { name: string, params?: object } }

- **Alert** — informational banner
  props: { message: string, severity?: 'info'|'warning'|'error'|'success', dismissible?: boolean }

## Available actions (use in Button.action.name)
export_pdf, export_excel, run_avm, refresh_comps, save_report, email_report, add_note

## Data paths
All valuePath / dataPath props use JSON-pointer style paths into the runtime data context:
  /property/...   → property details (address, sqft, yearBuilt, bedrooms, bathrooms, etc.)
  /report/...     → report data (valuation, comps, notes, etc.)
  /avm/...        → AVM results
  /census/...     → census data

## Output format
Return ONLY a valid JSON object with this exact structure — no markdown, no explanation:
{
  "type": "root",
  "children": [ /* array of component nodes */ ]
}

Each node: { "type": "<ComponentType>", "props": { ... }, "children"?: [ ... ] }
`.trim();

// ---------------------------------------------------------------------------
// Request / Response shape
// ---------------------------------------------------------------------------

interface GenerateReportTreeRequest {
	prompt: string;
	propertyData?: unknown;
	reportData?: unknown;
	avmData?: unknown;
	censusData?: unknown;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAiReportBuilderRouter(): Router {
	const router = Router();
	const ai = new UniversalAIService();

	/**
	 * POST /api/ai/report-builder/generate
	 *
	 * Body: { prompt, propertyData?, reportData?, avmData?, censusData? }
	 * Response: { tree: <json-render tree> }
	 */
	router.post('/generate', async (req: Request, res: Response) => {
		const body = req.body as GenerateReportTreeRequest;
		const { prompt, propertyData, reportData, avmData, censusData } = body;

		if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
			res.status(400).json({ error: 'prompt is required and must be a non-empty string' });
			return;
		}

		if (prompt.length > 2_000) {
			res.status(400).json({ error: 'prompt must be 2 000 characters or fewer' });
			return;
		}

		// Build the user message — include any available data context so the AI
		// can tailor field paths to the actual available data.
		let userMessage = `User request: "${prompt.trim()}"`;
		const contextParts: string[] = [];
		if (propertyData) contextParts.push(`propertyData keys: ${Object.keys(propertyData as object).join(', ')}`);
		if (reportData)   contextParts.push(`reportData keys: ${Object.keys(reportData as object).join(', ')}`);
		if (avmData)      contextParts.push(`avmData available: yes`);
		if (censusData)   contextParts.push(`censusData available: yes`);
		if (contextParts.length > 0) {
			userMessage += `\n\nAvailable data context:\n${contextParts.join('\n')}`;
		}

		try {
			const aiResponse = await ai.generateCompletion({
				messages: [
					{ role: 'system', content: COMPONENT_CATALOG_PROMPT },
					{ role: 'user', content: userMessage }
				],
				responseFormat: 'json',
				temperature: 0.3,        // low temperature for deterministic structure
				maxTokens: 2_000,
				provider: 'auto'
			});

			// Validate the AI returned something parseable
			let tree: unknown;
			try {
				tree = JSON.parse(aiResponse.content);
			} catch {
				logger.error('AI returned non-JSON content', {
					contentSnippet: aiResponse.content.slice(0, 200)
				});
				res.status(422).json({
					error: 'AI returned content that could not be parsed as JSON. Please rephrase your prompt.',
					provider: aiResponse.provider
				});
				return;
			}

			// Minimal structural check — must have type: 'root'
			if (
				typeof tree !== 'object' ||
				tree === null ||
				(tree as Record<string, unknown>)['type'] !== 'root'
			) {
				logger.warn('AI returned JSON but not a valid root tree', { tree });
				res.status(422).json({
					error: 'AI returned JSON but the structure was not a valid component tree. Please rephrase your prompt.',
					provider: aiResponse.provider
				});
				return;
			}

			logger.info('AI report tree generated', {
				provider: aiResponse.provider,
				tokensUsed: aiResponse.tokensUsed
			});

			res.json({
				tree,
				meta: {
					provider: aiResponse.provider,
					tokensUsed: aiResponse.tokensUsed
				}
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			logger.error('AI report-builder generation failed', { error: message });
			res.status(500).json({ error: `AI generation failed: ${message}` });
		}
	});

	return router;
}
