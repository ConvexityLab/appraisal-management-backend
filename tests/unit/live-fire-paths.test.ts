import path from 'path';
import { describe, expect, it } from 'vitest';

import { resolveLiveFirePath } from '../../scripts/live-fire/_axiom-live-fire-common.js';

describe('resolveLiveFirePath', () => {
  it('accepts workspace-relative paths', () => {
    const resolved = resolveLiveFirePath('test-artifacts/live-fire/cache.json', 'AXIOM_LIVE_TOKEN_CACHE_FILE');

    expect(resolved).toBe(path.resolve(process.cwd(), 'test-artifacts/live-fire/cache.json'));
  });

  it('rejects paths outside the workspace roots', () => {
    const outsidePath = path.resolve(process.cwd(), '..', 'outside-cache.json');

    expect(() => resolveLiveFirePath(outsidePath, 'AXIOM_LIVE_TOKEN_CACHE_FILE')).toThrow(
      /AXIOM_LIVE_TOKEN_CACHE_FILE must resolve inside the workspace root or scripts\/live-fire directory/,
    );
  });
});