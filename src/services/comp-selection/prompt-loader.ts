/**
 * Comp-Selection Prompt Loader
 *
 * Loads versioned prompt templates from `src/prompts/comp-selection/<version>.txt`,
 * caches them in-process, and builds the user-facing prompt body that the
 * tiered-AI strategy sends to the LLM.
 *
 * Strict failure modes:
 *   - Missing template file at construction → throws (no silent fallback).
 *   - Missing `@NUM_COMPS` token in template → throws.
 *
 * Templates are read synchronously at construction so a misconfigured
 * deployment fails at app boot, not on the first order.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { Logger } from '../../utils/logger.js';

/**
 * Subject view passed into the prompt. Strategy passes the subject
 * `PropertyRecord` here; we serialize as JSON inside the wrapper tags.
 */
export type PromptSubject = Record<string, unknown>;

/**
 * One candidate row in the prompt. Must include a `propertyId` so the model
 * can echo it back verbatim — that field is what we ID-validate against
 * to reject hallucinations.
 */
export interface PromptCandidate {
  propertyId: string;
  [key: string]: unknown;
}

export class PromptTemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PromptTemplateError';
  }
}

export class CompSelectionPromptLoader {
  /** Loaded template body. Frozen after construction. */
  private readonly template: string;

  /**
   * @param version Template version (matches `<version>.txt` under `src/prompts/comp-selection/`).
   * @param promptsDir Optional override for the prompts directory (tests).
   */
  constructor(
    public readonly version: string,
    promptsDir?: string,
  ) {
    const candidates: string[] = promptsDir
      ? [resolve(promptsDir, `${version}.txt`)]
      : candidatePromptPaths(version);

    let path: string | undefined;
    for (const p of candidates) {
      if (existsSync(p)) {
        path = p;
        break;
      }
    }
    if (!path) {
      throw new PromptTemplateError(
        `CompSelectionPromptLoader: prompt template "${version}" not found. ` +
          `Searched: ${candidates.join(', ')}`,
      );
    }
    let body: string;
    try {
      body = readFileSync(path, 'utf8');
    } catch (err) {
      throw new PromptTemplateError(
        `CompSelectionPromptLoader: failed to read prompt template at "${path}" ` +
          `for version "${version}": ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (!body.includes('@NUM_COMPS')) {
      throw new PromptTemplateError(
        `CompSelectionPromptLoader: template "${version}" is missing required @NUM_COMPS token`,
      );
    }
    this.template = body;
    new Logger('CompSelectionPromptLoader').info('Loaded prompt template', {
      version,
      path,
      bytes: body.length,
    });
  }

  /**
   * Build the user-message body. Returns a single string suitable for
   * `AIRequest.messages[0].content`.
   *
   * Throws when the candidate list is empty (caller bug).
   */
  buildPrompt(
    subject: PromptSubject,
    candidates: PromptCandidate[],
    numComps: number,
  ): string {
    if (numComps <= 0) {
      throw new PromptTemplateError(
        `CompSelectionPromptLoader.buildPrompt: numComps must be > 0 (received ${numComps})`,
      );
    }
    if (candidates.length === 0) {
      throw new PromptTemplateError(
        'CompSelectionPromptLoader.buildPrompt: candidates is empty',
      );
    }

    const header = this.template.replace(/@NUM_COMPS/g, String(numComps));
    const subjectJson = JSON.stringify(subject, null, 2);
    const candidateBlocks = candidates
      .map(
        (c, i) =>
          `<Property ${i + 1}>\n${JSON.stringify(c, null, 2)}\n</Property ${i + 1}>`,
      )
      .join('\n');

    return (
      `${header}\n\n` +
      `<Subject Property>\n${subjectJson}\n</Subject Property>\n\n` +
      `<Comparable Properties>\n${candidateBlocks}\n</Comparable Properties>\n`
    );
  }
}

/** Default prompts dir, relative to this compiled module's location. */
/**
 * Candidate prompt template locations, tried in order. The .txt files are
 * not copied by `tsc`, so at runtime we have to address the source tree.
 * - dist build (production): __dirname = .../dist/services/comp-selection,
 *   so ../../../src/prompts/comp-selection sits beside dist/.
 * - dev/tests (ts-node, vitest): __dirname = .../src/services/comp-selection,
 *   so ../../prompts/comp-selection is the right anchor.
 * - cwd fallback for unusual run layouts.
 */
function candidatePromptPaths(version: string): string[] {
  const file = `${version}.txt`;
  return [
    resolve(__dirname, '..', '..', 'prompts', 'comp-selection', file),
    resolve(__dirname, '..', '..', '..', 'src', 'prompts', 'comp-selection', file),
    resolve(process.cwd(), 'src', 'prompts', 'comp-selection', file),
  ];
}
