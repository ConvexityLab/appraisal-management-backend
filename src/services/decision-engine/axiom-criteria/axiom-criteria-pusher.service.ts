/**
 * AxiomCriteriaPusher — Phase L3 of
 * `appraisal-management-backend/docs/DECISION_ENGINE_RULES_SURFACE.md` /
 * `services/decision-engine/axiom-criteria/AXIOM_INTEGRATION_SURVEY.md`.
 *
 * Best-effort pusher that publishes AMS-authored criteria packs to Axiom
 * so the criteria set has a canonical `(programId, programVersion)` handle
 * on the Axiom side. Wired into the AxiomCriteriaCategory `push` hook.
 *
 * Lifecycle:
 *   1. CategoryRegistry calls push(pack) after the AMS-side storage write.
 *   2. Pusher serializes the pack's rules array into Axiom's
 *      `POST /api/criteria-sets` body (criterion id + title +
 *      description + expected answer + weight).
 *   3. On 2xx: returns the `(programId, programVersion)` Axiom assigned.
 *      Caller may stamp these back onto the pack doc for downstream lookup.
 *   4. On 404 (endpoint not yet shipped) / network failure / disabled:
 *      logs a warning, returns `null`. AMS-side pack remains authoritative;
 *      Axiom evaluator simply has no reference to the new pack yet.
 *
 * "Fail open" by design — Axiom's `register criteria set` endpoint is a
 * Phase L2 deliverable owned by the Axiom team. Until it lands, AMS
 * operators can still author + version criteria; the pusher logs the
 * "pending Axiom endpoint" state so it's visible in observability without
 * blocking AMS writes.
 */

import axios, { type AxiosInstance } from 'axios';
import { Logger } from '../../../utils/logger.js';
import type { RulePackDocument } from '../../../types/decision-rule-pack.types.js';

/** Per-criterion shape POSTed to Axiom. Mirrors AxiomCriteriaEditor wire shape. */
interface AxiomCriterionPayload {
	id: string;
	title: string;
	description: string;
	expectedAnswer?: string;
	rubric?: string;
	weight?: number;
}

interface RegisterCriteriaSetResponse {
	programId: string;
	programVersion: string;
}

export interface PushResult {
	programId: string;
	programVersion: string;
}

export class AxiomCriteriaPusher {
	private readonly logger = new Logger('AxiomCriteriaPusher');
	private readonly client: AxiosInstance | null;
	private readonly enabled: boolean;

	constructor(opts: { baseUrl?: string; bearerToken?: string; clientForTest?: AxiosInstance } = {}) {
		const baseURL = opts.baseUrl ?? process.env['AXIOM_API_BASE_URL'];
		const bearer = opts.bearerToken ?? process.env['AXIOM_API_KEY']?.trim();
		this.enabled = !!baseURL;

		if (opts.clientForTest) {
			this.client = opts.clientForTest;
		} else if (this.enabled && baseURL) {
			const headers: Record<string, string> = { 'Content-Type': 'application/json' };
			if (bearer) headers['Authorization'] = `Bearer ${bearer}`;
			this.client = axios.create({ baseURL, timeout: 15_000, headers });
		} else {
			this.client = null;
			this.logger.warn(
				'AxiomCriteriaPusher disabled — AXIOM_API_BASE_URL not set. Packs will save AMS-side only.',
			);
		}
	}

	/**
	 * Push a freshly-created axiom-criteria pack to Axiom. Returns the
	 * canonical (programId, programVersion) Axiom assigned, or `null` when
	 * the push couldn't be completed (endpoint missing, network failure,
	 * pusher disabled). Never throws — Cosmos-side pack remains saved.
	 */
	async push(pack: RulePackDocument<unknown>): Promise<PushResult | null> {
		if (!this.enabled || !this.client) {
			return null;
		}

		const criteria = this.serializeCriteria(pack.rules);
		if (criteria.length === 0) {
			this.logger.warn('AxiomCriteriaPusher: pack has zero serializable criteria, skipping push', {
				packId: pack.id,
				tenantId: pack.tenantId,
				ruleCount: Array.isArray(pack.rules) ? pack.rules.length : 0,
			});
			return null;
		}

		try {
			const body = {
				amsPackId: pack.id,
				amsPackVersion: pack.version,
				tenantId: pack.tenantId,
				criteria,
			};
			const resp = await this.client.post<RegisterCriteriaSetResponse>('/api/criteria-sets', body);
			const { programId, programVersion } = resp.data ?? ({} as RegisterCriteriaSetResponse);
			if (!programId || !programVersion) {
				this.logger.warn('AxiomCriteriaPusher: Axiom 2xx but response missing programId/programVersion', {
					packId: pack.id,
					tenantId: pack.tenantId,
					responseShape: Object.keys(resp.data ?? {}),
				});
				return null;
			}
			this.logger.info('AxiomCriteriaPusher: pack registered with Axiom', {
				packId: pack.id,
				tenantId: pack.tenantId,
				axiomProgramId: programId,
				axiomProgramVersion: programVersion,
				criteriaCount: criteria.length,
			});
			return { programId, programVersion };
		} catch (err: unknown) {
			const status = (err as { response?: { status?: number } })?.response?.status;
			if (status === 404) {
				this.logger.warn(
					'AxiomCriteriaPusher: /api/criteria-sets returned 404 — endpoint not yet shipped on Axiom side. Pack saved AMS-side only.',
					{ packId: pack.id, tenantId: pack.tenantId },
				);
			} else {
				this.logger.warn('AxiomCriteriaPusher: push failed (best-effort, pack saved AMS-side only)', {
					packId: pack.id,
					tenantId: pack.tenantId,
					status: status ?? null,
					error: err instanceof Error ? err.message : String(err),
				});
			}
			return null;
		}
	}

	/**
	 * Each rule in the pack's `rules[]` carries an `actions[0].data` payload
	 * with the criterion text (per the Phase H AxiomCriteriaEditor wire format).
	 * Project that into Axiom's flat criterion shape. Rules whose action
	 * payload is missing or unrecognized are dropped — they wouldn't be
	 * evaluable on the Axiom side anyway.
	 */
	private serializeCriteria(rules: unknown): AxiomCriterionPayload[] {
		if (!Array.isArray(rules)) return [];
		const out: AxiomCriterionPayload[] = [];
		for (const r of rules) {
			const rule = r as {
				name?: string;
				salience?: number;
				actions?: Array<{ type?: string; data?: Record<string, unknown> }>;
			};
			const action = rule.actions?.[0];
			const data = action?.data;
			if (!rule.name || !data || typeof data !== 'object') continue;
			const title = String(data['title'] ?? rule.name);
			const description = String(data['description'] ?? '');
			if (!description) continue;
			const payload: AxiomCriterionPayload = {
				id: rule.name,
				title,
				description,
			};
			if (typeof data['expectedAnswer'] === 'string') payload.expectedAnswer = data['expectedAnswer'];
			if (typeof data['rubric'] === 'string')         payload.rubric         = data['rubric'];
			if (typeof rule.salience === 'number')          payload.weight         = rule.salience;
			out.push(payload);
		}
		return out;
	}
}
