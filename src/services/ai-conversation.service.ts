/**
 * AI Conversation Service
 *
 * Source of truth for persisted AI Assistant conversation history.
 * Replaces the frontend-only IndexedDB store.  The frontend treats the
 * backend as authoritative and uses IndexedDB as a local cache.
 *
 * Design:
 *  - Tenant-scoped via `/tenantId` partition key.
 *  - Each conversation document is keyed by `conversationId`; documents
 *    also carry `userId` so per-user queries are cheap.
 *  - Append-only message writes: the client sends individual messages
 *    and the service upserts the full conversation document.
 *  - The service enforces the same caps the frontend slice does
 *    (`MAX_CONVERSATIONS`, `MAX_MESSAGES_PER_CONVERSATION`) so a
 *    misbehaving client can't bloat storage.
 *  - Deletion is explicit: either one conversation by id, or all
 *    conversations for a user (account-closure flow).
 */

import { Logger } from '../utils/logger.js';
import { CosmosDbService } from './cosmos-db.service.js';
import type { ApiResponse } from '../types/index.js';

const CONTAINER_NAME = 'ai-conversations';

export const MAX_MESSAGES_PER_CONVERSATION = 200;
export const MAX_CONVERSATIONS_PER_USER = 50;

export type AiMessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface AiMessage {
	id: string;
	role: AiMessageRole;
	content: string;
	timestamp: number;
	toolCallId?: string;
	toolName?: string;
}

export interface AiConversationDoc {
	id: string; // conversationId
	entityType: 'ai-conversation';
	/** Partition key. */
	tenantId: string;
	userId: string;
	pageType?: string;
	orderId?: string | null;
	createdAt: number;
	updatedAt: number;
	messages: AiMessage[];
}

export class AiConversationService {
	private readonly logger = new Logger('AiConversationService');

	constructor(private readonly cosmos: CosmosDbService) {}

	/** List the current user's conversations, newest first. */
	async listForUser(tenantId: string, userId: string): Promise<ApiResponse<AiConversationDoc[]>> {
		if (!tenantId || !userId) {
			return {
				success: false,
				error: {
					code: 'MISSING_AUTH_CONTEXT',
					message: 'listForUser requires tenantId and userId.',
					timestamp: new Date(),
				},
			};
		}
		const query = `SELECT TOP ${MAX_CONVERSATIONS_PER_USER} * FROM c
			WHERE c.tenantId = @tenantId AND c.userId = @userId
			ORDER BY c.updatedAt DESC`;
		return this.cosmos.queryItems<AiConversationDoc>(CONTAINER_NAME, query, [
			{ name: '@tenantId', value: tenantId },
			{ name: '@userId', value: userId },
		]);
	}

	/** Fetch one conversation by id (and verify ownership). */
	async getOne(
		tenantId: string,
		userId: string,
		conversationId: string,
	): Promise<ApiResponse<AiConversationDoc | null>> {
		if (!tenantId || !userId || !conversationId) {
			return {
				success: false,
				error: {
					code: 'MISSING_IDS',
					message: 'getOne requires tenantId, userId, and conversationId.',
					timestamp: new Date(),
				},
			};
		}
		const query = `SELECT * FROM c
			WHERE c.tenantId = @tenantId AND c.userId = @userId AND c.id = @id`;
		const result = await this.cosmos.queryItems<AiConversationDoc>(CONTAINER_NAME, query, [
			{ name: '@tenantId', value: tenantId },
			{ name: '@userId', value: userId },
			{ name: '@id', value: conversationId },
		]);
		if (!result.success) {
			return result.error
				? { success: false, error: result.error }
				: {
						success: false,
						error: {
							code: 'QUERY_FAILED',
							message: 'Conversation query failed.',
							timestamp: new Date(),
						},
					};
		}
		const first: AiConversationDoc | null = result.data && result.data.length > 0 ? result.data[0]! : null;
		return { success: true, data: first };
	}

	/**
	 * Upsert a conversation.  Caller supplies the whole message array
	 * (matching the frontend slice shape).  We trim to the per-doc
	 * message cap before writing, enforce tenant/user fields from auth
	 * (never trust client-supplied values for those), and set
	 * updatedAt to the server clock.
	 */
	async upsert(
		tenantId: string,
		userId: string,
		input: {
			id: string;
			createdAt?: number;
			pageType?: string;
			orderId?: string | null;
			messages: AiMessage[];
		},
	): Promise<ApiResponse<AiConversationDoc>> {
		if (!tenantId || !userId || !input?.id) {
			return {
				success: false,
				error: {
					code: 'MISSING_IDS',
					message: 'upsert requires tenantId, userId, and a conversation id.',
					timestamp: new Date(),
				},
			};
		}
		if (!Array.isArray(input.messages)) {
			return {
				success: false,
				error: {
					code: 'INVALID_MESSAGES',
					message: 'messages must be an array.',
					timestamp: new Date(),
				},
			};
		}

		// Trim to the per-doc cap.  Mirror the frontend slice: prefer
		// to preserve system messages at the head.
		let messages = input.messages;
		if (messages.length > MAX_MESSAGES_PER_CONVERSATION) {
			const overflow = messages.length - MAX_MESSAGES_PER_CONVERSATION;
			let remaining = overflow;
			messages = messages.filter((m) => {
				if (remaining <= 0) return true;
				if (m.role === 'system') return true;
				remaining -= 1;
				return false;
			});
			// Pathological: every message is a system message; plain head-drop.
			if (messages.length > MAX_MESSAGES_PER_CONVERSATION) {
				messages = messages.slice(messages.length - MAX_MESSAGES_PER_CONVERSATION);
			}
		}

		const now = Date.now();
		const doc: AiConversationDoc = {
			id: input.id,
			entityType: 'ai-conversation',
			tenantId,
			userId,
			orderId: input.orderId ?? null,
			createdAt: input.createdAt ?? now,
			updatedAt: now,
			messages,
			...(input.pageType !== undefined && { pageType: input.pageType }),
		};

		const result = await this.cosmos.upsertItem<AiConversationDoc>(CONTAINER_NAME, doc);

		// If after upsert the user has more than MAX_CONVERSATIONS_PER_USER
		// documents, evict the oldest.  Done after the write so the
		// success path never waits on eviction.
		if (result.success) {
			void this.evictOverCap(tenantId, userId);
		}
		return result;
	}

	private async evictOverCap(tenantId: string, userId: string): Promise<void> {
		try {
			const list = await this.cosmos.queryItems<{ id: string; tenantId: string; updatedAt: number }>(
				CONTAINER_NAME,
				`SELECT c.id, c.tenantId, c.updatedAt FROM c
					WHERE c.tenantId = @tenantId AND c.userId = @userId
					ORDER BY c.updatedAt DESC`,
				[
					{ name: '@tenantId', value: tenantId },
					{ name: '@userId', value: userId },
				],
			);
			if (!list.success || !list.data) return;
			const overflow = list.data.slice(MAX_CONVERSATIONS_PER_USER);
			if (overflow.length === 0) return;
			this.logger.info('Evicting old AI conversations over cap', {
				tenantId,
				userId,
				count: overflow.length,
			});
			for (const row of overflow) {
				await this.cosmos.deleteItem(CONTAINER_NAME, row.id, row.tenantId);
			}
		} catch (err) {
			this.logger.warn('Eviction sweep failed (non-fatal)', {
				error: err instanceof Error ? err.message : String(err),
			});
		}
	}

	async deleteOne(
		tenantId: string,
		userId: string,
		conversationId: string,
	): Promise<ApiResponse<boolean>> {
		// Verify ownership before deleting (Cosmos deleteItem doesn't
		// check `userId`; we must enforce it).
		const existing = await this.getOne(tenantId, userId, conversationId);
		if (!existing.success) {
			return existing.error
				? { success: false, error: existing.error }
				: {
						success: false,
						error: {
							code: 'QUERY_FAILED',
							message: 'Ownership check failed before delete.',
							timestamp: new Date(),
						},
					};
		}
		if (!existing.data) {
			return {
				success: false,
				error: {
					code: 'NOT_FOUND',
					message: 'Conversation not found for this user + tenant.',
					timestamp: new Date(),
				},
			};
		}
		return this.cosmos.deleteItem(CONTAINER_NAME, conversationId, tenantId);
	}

	/**
	 * Wipe every conversation for one user.  Right-to-delete entry
	 * point — invoked both from the standard account-closure flow and
	 * from a user-facing "Forget history" button.
	 */
	async deleteAllForUser(
		tenantId: string,
		userId: string,
	): Promise<ApiResponse<{ deleted: number }>> {
		if (!tenantId || !userId) {
			return {
				success: false,
				error: {
					code: 'MISSING_IDS',
					message: 'deleteAllForUser requires tenantId + userId.',
					timestamp: new Date(),
				},
			};
		}
		const list = await this.cosmos.queryItems<{ id: string; tenantId: string }>(
			CONTAINER_NAME,
			'SELECT c.id, c.tenantId FROM c WHERE c.tenantId = @tenantId AND c.userId = @userId',
			[
				{ name: '@tenantId', value: tenantId },
				{ name: '@userId', value: userId },
			],
		);
		if (!list.success || !list.data) {
			return list.error
				? { success: false, error: list.error }
				: {
						success: false,
						error: {
							code: 'QUERY_FAILED',
							message: 'Failed to enumerate conversations for wipe.',
							timestamp: new Date(),
						},
					};
		}
		let deleted = 0;
		for (const row of list.data) {
			const del = await this.cosmos.deleteItem(CONTAINER_NAME, row.id, row.tenantId);
			if (del.success) deleted += 1;
		}
		this.logger.info('AI conversation wipe complete', { tenantId, userId, deleted });
		return { success: true, data: { deleted } };
	}
}
