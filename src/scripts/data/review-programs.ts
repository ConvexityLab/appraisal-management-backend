/**
 * Canonical Review Program Definitions
 *
 * Platform-wide ReviewProgram documents seeded into the `review-programs`
 * Cosmos container. These are client-agnostic (clientId = null); the seed
 * module stamps tenantId from context at run time.
 *
 * Import in the seed module: import { VISION_APPRAISAL_V1_PROGRAM } from '../../data/review-programs.js';
 */

import type { ReviewProgram } from '../../types/review-tape.types.js';
import { REVIEW_PROGRAM_IDS } from '../seed/seed-ids.js';

export const VISION_APPRAISAL_V1_PROGRAM: ReviewProgram = {
  id: REVIEW_PROGRAM_IDS.VISION_APPRAISAL_V1,
  name: 'Vision Appraisal Review Program v1',
  version: '1.0',
  programType: 'APPRAISAL_REVIEW',
  status: 'ACTIVE',
  clientId: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  rulesetRefs: [],
  aiCriteriaRefs: [],
};
