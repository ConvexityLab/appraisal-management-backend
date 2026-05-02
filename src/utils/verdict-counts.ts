/**
 * Verdict-count computation shared by axiom.service (when stamping per-run
 * counts onto the run-ledger record's statusDetails) and any consumer that
 * needs to render a pass/warn/fail breakdown for a criteria evaluation.
 *
 * Kept as a pure helper so it can be unit-tested without dragging in the
 * full Axiom service / pipeline mocking surface.
 */

export interface VerdictCounts {
  passCount: number;
  warnCount: number;
  failCount: number;
  totalCount: number;
}

interface CriterionWithEvaluation {
  evaluation?: string | null;
}

export function computeVerdictCounts(
  criteria: ReadonlyArray<CriterionWithEvaluation>,
): VerdictCounts {
  let passCount = 0;
  let warnCount = 0;
  let failCount = 0;

  for (const criterion of criteria) {
    switch (criterion?.evaluation) {
      case 'pass':
        passCount += 1;
        break;
      case 'warning':
        warnCount += 1;
        break;
      case 'fail':
        failCount += 1;
        break;
      default:
        // 'unknown' / null / undefined / unexpected values are intentionally
        // not counted so the totals reflect criteria that returned a verdict.
        break;
    }
  }

  return {
    passCount,
    warnCount,
    failCount,
    totalCount: criteria.length,
  };
}
