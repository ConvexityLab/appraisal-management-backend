/**
 * Seed Module: Decomposition Rules
 *
 * Seeds GLOBAL DEFAULT decomposition rules — the maps from a ClientOrder's
 * productType to the set of VendorOrders that fulfill it. These rules are
 * tenant-agnostic (tenantId = '__global__', default: true) so every tenant
 * inherits them automatically. Tenants or clients can override per-product
 * by writing a row with their tenantId / clientId at higher precedence.
 *
 * Activates the dormant fan-out machinery: until these rules exist, every
 * ClientOrder produces exactly one VendorOrder via a default 1:1 spec.
 * Once seeded, OrderDecompositionService surfaces the multi-vendor breakdown
 * as suggestions to the caller (UI / controller).
 *
 * Compositions seeded (per design conversation 2026-05-05):
 *   DVR              = FULL_APPRAISAL + AVM + DESK_REVIEW + QC_REVIEW
 *   BPO              = BPO + INSPECTION + DESK_REVIEW
 *   HYBRID_APPRAISAL = FULL_APPRAISAL + AVM + DESK_REVIEW
 *   RAPIDVAL         = AVM + DESK_REVIEW
 *
 * Container: decomposition-rules (partition /tenantId)
 */

import type { SeedModule, SeedModuleResult, SeedContext } from '../seed-types.js';
import { upsert, cleanContainer } from '../seed-types.js';
import {
  DECOMPOSITION_RULE_DOC_TYPE,
  DECOMPOSITION_RULES_CONTAINER,
  GLOBAL_DEFAULT_TENANT,
  type DecompositionRule,
  type VendorOrderTemplate,
} from '../../../types/decomposition-rule.types.js';
import { ProductType } from '../../../types/product-catalog.js';

const CONTAINER = DECOMPOSITION_RULES_CONTAINER;

/** Build a single global-default rule. */
function buildRule(
  productType: typeof ProductType[keyof typeof ProductType],
  vendorOrders: VendorOrderTemplate[],
  description: string,
  now: string,
): DecompositionRule {
  return {
    id: `rule-default-${productType}`,
    tenantId: GLOBAL_DEFAULT_TENANT,
    type: DECOMPOSITION_RULE_DOC_TYPE,
    productType,
    default: true,
    // Phase 1: every rule is a SUGGESTION. autoApply remains false even for
    // low-risk products until the auto-place code path lands; operators can
    // flip individual rules when ready.
    autoApply: false,
    vendorOrders,
    createdAt: now,
    updatedAt: now,
    description,
  };
}

function buildRules(now: string): DecompositionRule[] {
  return [
    // ── DVR ─────────────────────────────────────────────────────────────────
    buildRule(
      ProductType.DVR,
      [
        {
          vendorWorkType: ProductType.FULL_APPRAISAL,
          templateKey: 'appraisal',
          instructions: 'Standard interior/exterior appraisal report. Output is the primary deliverable consumed by the desk review.',
        },
        {
          vendorWorkType: ProductType.AVM,
          templateKey: 'avm',
          instructions: 'Interactive AVM cross-check on the subject property. Run in parallel with appraisal.',
        },
        {
          vendorWorkType: ProductType.DESK_REVIEW,
          templateKey: 'desk-review',
          instructions: 'Appraiser desk review of the completed appraisal report.',
          dependsOn: ['appraisal'],
        },
        {
          vendorWorkType: ProductType.QC_REVIEW,
          templateKey: 'qc-review',
          instructions: 'Internal QC pass on the desk review and appraisal package before client delivery. Assign to staff reviewer.',
          dependsOn: ['desk-review'],
        },
      ],
      'Default DVR composition: full appraisal + AVM cross-check + appraiser desk review + internal QC.',
      now,
    ),

    // ── BPO ─────────────────────────────────────────────────────────────────
    buildRule(
      ProductType.BPO,
      [
        {
          vendorWorkType: ProductType.BPO,
          templateKey: 'realtor-bpo',
          instructions: 'Realtor BPO valuation. Generic BPO at the rule level; specialise to BPO_EXTERIOR / BPO_INTERIOR via parameterised rule once selectors land (slice 8h).',
        },
        {
          vendorWorkType: ProductType.INSPECTION,
          templateKey: 'inspection',
          instructions: 'Property inspection — interior/exterior condition, photos, observable defects.',
        },
        {
          vendorWorkType: ProductType.DESK_REVIEW,
          templateKey: 'review',
          instructions: 'Review of the BPO + inspection results before client delivery.',
          dependsOn: ['realtor-bpo', 'inspection'],
        },
      ],
      'Default BPO composition: realtor BPO + property inspection + final review.',
      now,
    ),

    // ── Hybrid Appraisal ────────────────────────────────────────────────────
    buildRule(
      ProductType.HYBRID_APPRAISAL,
      [
        {
          vendorWorkType: ProductType.FULL_APPRAISAL,
          templateKey: 'appraisal',
          instructions: 'Appraiser-completed valuation report, typically informed by third-party inspection data.',
        },
        {
          vendorWorkType: ProductType.AVM,
          templateKey: 'avm',
          instructions: 'AVM cross-check, run in parallel with appraisal.',
        },
        {
          vendorWorkType: ProductType.DESK_REVIEW,
          templateKey: 'desk-review',
          instructions: 'Appraiser desk review of the completed appraisal.',
          dependsOn: ['appraisal'],
        },
      ],
      'Default Hybrid composition: appraisal + AVM cross-check + appraiser desk review.',
      now,
    ),

    // ── RapidVal ────────────────────────────────────────────────────────────
    buildRule(
      ProductType.RAPIDVAL,
      [
        {
          vendorWorkType: ProductType.AVM,
          templateKey: 'avm',
          instructions: 'AVM valuation — primary deliverable for RapidVal.',
        },
        {
          vendorWorkType: ProductType.DESK_REVIEW,
          templateKey: 'desk-review',
          instructions: 'Light-touch appraiser desk review of the AVM output.',
          dependsOn: ['avm'],
        },
      ],
      'Default RapidVal composition: AVM + appraiser desk review.',
      now,
    ),
  ];
}

export const module: SeedModule = {
  name: 'decomposition-rules',
  containers: [CONTAINER],

  async run(ctx: SeedContext): Promise<SeedModuleResult> {
    const result: SeedModuleResult = { created: 0, failed: 0, skipped: 0, cleaned: 0 };

    if (ctx.clean) {
      result.cleaned = await cleanContainer(ctx, CONTAINER);
    }

    const rules = buildRules(ctx.now);
    for (const rule of rules) {
      // Note: global-default rules use tenantId = '__global__' as the partition
      // key sentinel — NOT the seed run's tenantId. The upsert helper writes
      // to the partition specified on the document, not on ctx.
      await upsert(ctx, CONTAINER, rule, result);
    }

    return result;
  },
};
