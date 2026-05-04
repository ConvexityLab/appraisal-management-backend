import type { ReviewProgram } from '../types/review-tape.types.js';
import { REVIEW_PROGRAM_SEEDS } from '../data/review-programs.js';

const GLOBAL_CLIENT_ID = '__global__';

function normalizeEngineRefs(
  refs: Array<{ programId: string; programVersion: string }> | undefined,
): Array<{ programId: string; programVersion: string }> {
  return (refs ?? []).filter(
    (ref) =>
      typeof ref?.programId === 'string' &&
      ref.programId.trim().length > 0 &&
      typeof ref?.programVersion === 'string' &&
      ref.programVersion.trim().length > 0,
  );
}

function hasInlineConfig(program: Partial<ReviewProgram>): boolean {
  return Boolean(
    program.thresholds ||
    program.decisionRules ||
    (program.autoFlags?.length ?? 0) > 0 ||
    (program.manualFlags?.length ?? 0) > 0,
  );
}

function getSeedProgram(programId: string): ReviewProgram | undefined {
  return REVIEW_PROGRAM_SEEDS.find((seed) => seed.id === programId);
}

export function normalizeReviewProgram(program: ReviewProgram): ReviewProgram {
  const normalizedRulesetRefs = normalizeEngineRefs(program.rulesetRefs);
  const normalizedAiCriteriaRefs = normalizeEngineRefs(program.aiCriteriaRefs);
  const isGlobalProgram = program.clientId == null || program.clientId === GLOBAL_CLIENT_ID;
  const seedProgram = isGlobalProgram ? getSeedProgram(program.id) : undefined;

  const repairedRulesetRefs =
    normalizedRulesetRefs.length > 0
      ? normalizedRulesetRefs
      : normalizeEngineRefs(seedProgram?.rulesetRefs);
  const repairedAiCriteriaRefs =
    normalizedAiCriteriaRefs.length > 0
      ? normalizedAiCriteriaRefs
      : normalizeEngineRefs(seedProgram?.aiCriteriaRefs);

  return {
    ...program,
    clientId: isGlobalProgram ? null : program.clientId,
    ...(repairedRulesetRefs.length > 0 ? { rulesetRefs: repairedRulesetRefs } : {}),
    ...(repairedAiCriteriaRefs.length > 0 ? { aiCriteriaRefs: repairedAiCriteriaRefs } : {}),
  };
}

function scoreProgram(program: ReviewProgram, requestedClientId?: string): number {
  const engineRefScore = (program.aiCriteriaRefs?.length ?? 0) * 100 + (program.rulesetRefs?.length ?? 0) * 100;
  const clientMatchScore = requestedClientId && program.clientId === requestedClientId ? 25 : 0;
  const globalScore = program.clientId == null ? 5 : 0;
  const inlineScore = hasInlineConfig(program) ? 1 : 0;
  const createdAtScore = new Date(program.createdAt ?? 0).getTime() / 1_000_000_000_000;
  return engineRefScore + clientMatchScore + globalScore + inlineScore + createdAtScore;
}

export function selectPreferredReviewProgram(
  programs: ReviewProgram[],
  requestedClientId?: string,
): ReviewProgram | null {
  if (programs.length === 0) {
    return null;
  }

  return [...programs]
    .map((program) => normalizeReviewProgram(program))
    .sort((a, b) => scoreProgram(b, requestedClientId) - scoreProgram(a, requestedClientId))[0] ?? null;
}

export function dedupeReviewPrograms(
  programs: ReviewProgram[],
  requestedClientId?: string,
): ReviewProgram[] {
  const grouped = new Map<string, ReviewProgram[]>();
  for (const program of programs) {
    const current = grouped.get(program.id) ?? [];
    current.push(program);
    grouped.set(program.id, current);
  }

  return [...grouped.values()]
    .map((entries) => selectPreferredReviewProgram(entries, requestedClientId))
    .filter((program): program is ReviewProgram => Boolean(program))
    .sort((a, b) => a.name.localeCompare(b.name));
}
