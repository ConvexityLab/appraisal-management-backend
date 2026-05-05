/**
 * CompSelectionStrategyRegistry — unit tests
 *
 * Verifies opt-in registration, name-based resolution, and loud failure
 * modes (duplicate registration, unknown name lists what IS registered).
 */

import { describe, expect, it } from 'vitest';

import {
  CompSelectionStrategyRegistry,
  StrategyAlreadyRegisteredError,
  UnknownStrategyError,
} from '../../src/services/comp-selection/registry';
import type {
  CompSelectionInput,
  CompSelectionResult,
  ICompSelectionStrategy,
} from '../../src/services/comp-selection/strategy';

class StubStrategy implements ICompSelectionStrategy {
  constructor(public readonly name: string) {}
  async select(_input: CompSelectionInput): Promise<CompSelectionResult> {
    return {
      strategyName: this.name,
      orderId: 'o',
      clientOrderNumber: 'CO-x',
      selectedSold: [],
      selectedActive: [],
    };
  }
}

describe('CompSelectionStrategyRegistry', () => {
  it('registers and resolves by name', () => {
    const reg = new CompSelectionStrategyRegistry();
    const s = new StubStrategy('alpha');
    reg.register(s);
    expect(reg.has('alpha')).toBe(true);
    expect(reg.resolve('alpha')).toBe(s);
    expect(reg.registeredNames()).toEqual(['alpha']);
  });

  it('throws StrategyAlreadyRegisteredError on duplicate registration', () => {
    const reg = new CompSelectionStrategyRegistry();
    reg.register(new StubStrategy('alpha'));
    expect(() => reg.register(new StubStrategy('alpha'))).toThrow(
      StrategyAlreadyRegisteredError,
    );
  });

  it('throws UnknownStrategyError listing known names when name is unrecognized', () => {
    const reg = new CompSelectionStrategyRegistry();
    reg.register(new StubStrategy('alpha'));
    reg.register(new StubStrategy('beta'));
    try {
      reg.resolve('gamma');
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownStrategyError);
      const msg = (e as Error).message;
      expect(msg).toContain('gamma');
      expect(msg).toContain('alpha');
      expect(msg).toContain('beta');
    }
  });
});
