/**
 * CompSelectionStrategyRegistry
 *
 * Single source of truth for "which strategy implements which name". The
 * caller (`OrderCompCollectionService`) only ever resolves by name from
 * config — it never references a concrete strategy class. This is what
 * makes selection approaches swappable without touching pipeline code.
 *
 * Lifecycle: a single registry instance is constructed and populated at
 * app bootstrap (`src/app-production.ts`), then injected into the
 * `OrderCompCollectionService`.
 *
 * Strict failure modes (no silent fallbacks):
 *   - `register()` throws if the same name is registered twice.
 *   - `resolve()` throws if the requested name is unknown, listing every
 *     registered name so the operator sees what IS available.
 */

import type { ICompSelectionStrategy } from './strategy.js';

export class StrategyAlreadyRegisteredError extends Error {
  constructor(name: string) {
    super(`CompSelectionStrategyRegistry: strategy "${name}" is already registered`);
    this.name = 'StrategyAlreadyRegisteredError';
  }
}

export class UnknownStrategyError extends Error {
  constructor(name: string, registered: string[]) {
    super(
      `CompSelectionStrategyRegistry: no strategy registered with name "${name}". ` +
        `Registered: [${registered.join(', ')}]`,
    );
    this.name = 'UnknownStrategyError';
  }
}

export class CompSelectionStrategyRegistry {
  private readonly strategies = new Map<string, ICompSelectionStrategy>();

  /** Register a strategy. Throws if the name is already taken. */
  register(strategy: ICompSelectionStrategy): void {
    if (this.strategies.has(strategy.name)) {
      throw new StrategyAlreadyRegisteredError(strategy.name);
    }
    this.strategies.set(strategy.name, strategy);
  }

  /** Resolve a strategy by name. Throws when the name is unknown. */
  resolve(name: string): ICompSelectionStrategy {
    const strategy = this.strategies.get(name);
    if (!strategy) {
      throw new UnknownStrategyError(name, Array.from(this.strategies.keys()));
    }
    return strategy;
  }

  /** True iff a strategy is registered under `name`. */
  has(name: string): boolean {
    return this.strategies.has(name);
  }

  /** Names of all registered strategies (stable insertion order). */
  registeredNames(): string[] {
    return Array.from(this.strategies.keys());
  }
}
