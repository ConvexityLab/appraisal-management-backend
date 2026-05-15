/**
 * Public surface of the vendor-matching rules provider module.
 * Engine + tests should import from here, not the individual provider files.
 */

export type {
  VendorMatchingRulesProvider,
  ProviderName,
  RuleEvaluationContext,
  RuleEvaluationResult,
} from './provider.types.js';

export { HomegrownVendorMatchingRulesProvider } from './homegrown.provider.js';
export { MopVendorMatchingRulesProvider, type MopProviderConfig } from './mop.provider.js';
export {
  FallbackVendorMatchingRulesProvider,
  type FallbackProviderConfig,
} from './fallback.provider.js';
export { createVendorMatchingRulesProvider, type FactoryDeps } from './factory.js';
