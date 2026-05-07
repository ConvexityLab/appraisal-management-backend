import { describe, expect, it, vi } from 'vitest';
import { AiFlagsService } from '../../src/services/ai-flags.service.js';

describe('AiFlagsService.fetchForUser', () => {
	it('returns empty overrides when the ai-feature-flags container is unavailable', async () => {
		const service = new AiFlagsService({
			queryItems: vi.fn().mockResolvedValue({
				success: false,
				error: {
					code: 'QUERY_ITEMS_FAILED',
					message: 'Failed to query items',
					timestamp: new Date(),
					details: {
						statusCode: 404,
						containerName: 'ai-feature-flags',
					},
				},
			}),
		} as any);

		const result = await service.fetchForUser('tenant-a', 'user-1');

		expect(result).toEqual({
			success: true,
			data: {
				tenant: null,
				user: null,
			},
		});
	});

	it('preserves non-container failures', async () => {
		const error = {
			code: 'QUERY_ITEMS_FAILED',
			message: 'Failed to query items',
			timestamp: new Date(),
			details: {
				statusCode: 500,
				containerName: 'ai-feature-flags',
			},
		};
		const service = new AiFlagsService({
			queryItems: vi.fn().mockResolvedValue({ success: false, error }),
		} as any);

		const result = await service.fetchForUser('tenant-a', 'user-1');

		expect(result.success).toBe(false);
		expect(result.error).toBe(error);
	});
});