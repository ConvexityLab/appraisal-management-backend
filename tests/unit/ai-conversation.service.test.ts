import { describe, expect, it, vi } from 'vitest';
import { AiConversationService } from '../../src/services/ai-conversation.service.js';

describe('AiConversationService.listForUser', () => {
	it('returns an empty list when the ai-conversations container is unavailable', async () => {
		const service = new AiConversationService({
			queryItems: vi.fn().mockResolvedValue({
				success: false,
				error: {
					code: 'QUERY_ITEMS_FAILED',
					message: 'Failed to query items',
					timestamp: new Date(),
					details: {
						statusCode: 404,
						containerName: 'ai-conversations',
					},
				},
			}),
		} as any);

		const result = await service.listForUser('tenant-a', 'user-1');

		expect(result).toEqual({ success: true, data: [] });
	});

	it('returns an empty list when Cosmos reports a not-found message for ai-conversations', async () => {
		const service = new AiConversationService({
			queryItems: vi.fn().mockResolvedValue({
				success: false,
				error: {
					code: 'QUERY_ITEMS_FAILED',
					message: 'Container ai-conversations does not exist',
					timestamp: new Date(),
				},
			}),
		} as any);

		const result = await service.listForUser('tenant-a', 'user-1');

		expect(result).toEqual({ success: true, data: [] });
	});

	it('preserves non-container failures', async () => {
		const error = {
			code: 'QUERY_ITEMS_FAILED',
			message: 'Failed to query items',
			timestamp: new Date(),
			details: {
				statusCode: 500,
				containerName: 'ai-conversations',
			},
		};
		const service = new AiConversationService({
			queryItems: vi.fn().mockResolvedValue({ success: false, error }),
		} as any);

		const result = await service.listForUser('tenant-a', 'user-1');

		expect(result.success).toBe(false);
		expect(result.error).toBe(error);
	});
});