/**
 * CompBasedValueEstimator
 *
 * Pure computation: estimate subject value from the runtime AVM projection on
 * the selected sold comps (`propertyRecord.avm`) + the subject's GLA.
 *
 * Important Phase P6 boundary:
 *   - For subject/canonical property APIs, AVM truth now comes from immutable
 *     `avm-update` observations with legacy root fallback.
 *   - This estimator intentionally does NOT read observations. It consumes the
 *     in-memory comp AVM values hydrated by comp collection for the current
 *     selection/evaluation run. Those are workflow/runtime projections, not
 *     parcel source-of-truth reads.
 *
 * Formula:
 *   For each sold comp with avm.value AND propertyRecord.building.gla > 0:
 *     pricePerSqft = avm.value / building.gla
 *   estimatedValue = mean(pricePerSqft) * subject.building.gla
 *   confidence     = mean(avm.confidence) — when available on every comp used
 *
 * Strict failure modes (no silent fallbacks):
 *   - subject.building.gla <= 0 → throws (caller bug).
 *   - soldComps is empty → throws (caller bug — no basis to estimate).
 *   - No sold comp had a usable avm.value → throws (data-quality failure;
 *     caller should surface this rather than persist a fake number).
 *
 * NOTE: We intentionally drop onelend's hardcoded `repairEstimate=55000`,
 * `marketingTime=60`, and `fairMarketMonthlyRent=2800` — they are silent
 * defaults that misrepresent unknown values. If business needs them, add
 * explicit config keys and surface them through this estimator's input.
 */

import type { PropertyRecord } from '@l1/shared-types';
import type {
  IValueEstimator,
  SelectedCompWithPropertyRecord,
  ValueEstimate,
} from './value-estimator.js';

export class CompBasedValueEstimator implements IValueEstimator {
  public readonly name = 'comp-based' as const;

  async compute(
    subject: PropertyRecord,
    soldComps: SelectedCompWithPropertyRecord[],
  ): Promise<ValueEstimate> {
    const subjectGla = subject.building.gla;
    if (!(subjectGla > 0)) {
      throw new Error(
        `CompBasedValueEstimator: subject.building.gla must be > 0 (received ${subjectGla})`,
      );
    }
    if (soldComps.length === 0) {
      throw new Error(
        'CompBasedValueEstimator: soldComps is empty — cannot estimate value with no comps',
      );
    }

    const pricePerSqft: number[] = [];
    const confidences: number[] = [];
    for (const c of soldComps) {
      const compGla = c.propertyRecord.building.gla;
      const compAvm = c.propertyRecord.avm?.value;
      const compConf = c.propertyRecord.avm?.confidence;
      if (typeof compAvm === 'number' && compAvm > 0 && compGla > 0) {
        pricePerSqft.push(compAvm / compGla);
        if (typeof compConf === 'number') {
          confidences.push(compConf);
        }
      }
    }

    if (pricePerSqft.length === 0) {
      throw new Error(
        `CompBasedValueEstimator: none of the ${soldComps.length} sold comps had a usable avm.value + GLA — cannot compute estimate`,
      );
    }

    const meanPricePerSqft =
      pricePerSqft.reduce((a, b) => a + b, 0) / pricePerSqft.length;
    const minPricePerSqft = Math.min(...pricePerSqft);
    const maxPricePerSqft = Math.max(...pricePerSqft);

    const result: ValueEstimate = {
      estimatorName: this.name,
      estimatedValue: round2(meanPricePerSqft * subjectGla),
      lowerBound: round2(minPricePerSqft * subjectGla),
      upperBound: round2(maxPricePerSqft * subjectGla),
      perCompPricePerSqft: pricePerSqft.map(round2),
      computedAt: new Date().toISOString(),
    };
    if (confidences.length > 0) {
      result.confidence = round2(
        confidences.reduce((a, b) => a + b, 0) / confidences.length,
      );
    }
    return result;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
