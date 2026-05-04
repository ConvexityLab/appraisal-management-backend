import { describe, expect, it } from 'vitest';
import { parseAxiomPipelineResults } from '../../src/integrations/axiom/llm-results.adapter.js';

describe('parseAxiomPipelineResults', () => {
  describe('non-object input', () => {
    it('returns ok=false with empty result for null', () => {
      const out = parseAxiomPipelineResults(null);
      expect(out.ok).toBe(false);
      expect(out.result.extractStructuredData).toEqual([]);
      expect(out.result.mergedExtractedData).toBeNull();
      expect(out.issues.length).toBeGreaterThan(0);
    });

    it('returns ok=false for arrays and strings', () => {
      expect(parseAxiomPipelineResults([]).ok).toBe(false);
      expect(parseAxiomPipelineResults('hello').ok).toBe(false);
    });

    it('returns ok=true with empty result for empty object', () => {
      // An empty object is still a valid parse — nothing to extract, no issues.
      const out = parseAxiomPipelineResults({});
      expect(out.ok).toBe(true);
      expect(out.result.mergedExtractedData).toBeNull();
    });
  });

  describe('extractStructuredData merging', () => {
    it('merges per-page extractedData blocks: new keys take first, existing object keys deep-merge later-wins', () => {
      // Documented merge semantics (preserved from axiom.service inline logic):
      //   - First-seen wins for SCALAR existing values
      //   - For object existing values, deep-merge with later-wins on inner fields
      // The {value, confidence, ...} envelope is an object, so a second page
      // emitting the same key updates the inner fields. (Behavioural quirk
      // we intentionally preserve in this slice.)
      const out = parseAxiomPipelineResults({
        results: {
          extractStructuredData: [
            { extractedData: { yearBuilt: { value: 1985, confidence: 0.9 } } },
            { extractedData: { grossLivingArea: { value: 1850 } } },
            { extractedData: { yearBuilt: { value: 9999 } } }, // deep-merged later-wins
          ],
        },
      });
      expect(out.ok).toBe(true);
      expect(out.result.mergedExtractedData).toMatchObject({
        // confidence from page 1 retained, value from page 3 won
        yearBuilt: { value: 9999, confidence: 0.9 },
        grossLivingArea: { value: 1850 },
      });
    });

    it('first-non-null wins for SCALAR existing values', () => {
      const out = parseAxiomPipelineResults({
        results: {
          extractStructuredData: [
            { extractedData: { quality: 'Q4' } },
            { extractedData: { quality: 'Q1' } }, // existing scalar — first wins
          ],
        },
      });
      expect(out.result.mergedExtractedData?.['quality']).toBe('Q4');
    });

    it('deep-merges nested objects across pages', () => {
      const out = parseAxiomPipelineResults({
        results: {
          extractStructuredData: [
            { extractedData: { propertyAddress: { street: { value: '17 David Dr' } } } },
            { extractedData: { propertyAddress: { city: { value: 'Johnston' } } } },
          ],
        },
      });
      expect(out.result.mergedExtractedData?.['propertyAddress']).toEqual({
        street: { value: '17 David Dr' },
        city: { value: 'Johnston' },
      });
    });

    it('skips non-object pages', () => {
      const out = parseAxiomPipelineResults({
        results: {
          extractStructuredData: [
            { extractedData: { yearBuilt: { value: 1985 } } },
            { extractedData: null },
            'malformed' as unknown, // non-object — ignored
          ],
        },
      });
      // The above is intentionally lossy at the type boundary; ensure no throw.
      expect(out.result.mergedExtractedData).toMatchObject({ yearBuilt: { value: 1985 } });
    });
  });

  describe('consolidate stage takes precedence', () => {
    it('uses consolidatedData when present', () => {
      const out = parseAxiomPipelineResults({
        results: {
          extractStructuredData: [
            { extractedData: { yearBuilt: { value: 1985 } } },
          ],
          consolidate: [
            { consolidatedData: { yearBuilt: { value: 2000 } } },
          ],
        },
      });
      expect(out.result.mergedExtractedData).toEqual({ yearBuilt: { value: 2000 } });
      expect(out.result.consolidatedData).toEqual({ yearBuilt: { value: 2000 } });
    });

    it('returns null consolidatedData when stage is empty', () => {
      const out = parseAxiomPipelineResults({
        results: { extractStructuredData: [{ extractedData: { yearBuilt: { value: 1985 } } }] },
      });
      expect(out.result.consolidatedData).toBeNull();
    });
  });

  describe('hoisted variants', () => {
    it('reads stages from the root when results.X is absent', () => {
      const out = parseAxiomPipelineResults({
        extractStructuredData: [{ extractedData: { yearBuilt: { value: 1985 } } }],
        aggregateResults: [{ overallRiskScore: 42, criteria: [] }],
        overallDecision: 'ACCEPT',
        overallRiskScore: 42,
      });
      expect(out.result.mergedExtractedData).toMatchObject({ yearBuilt: { value: 1985 } });
      expect(out.result.aggregate).toMatchObject({ overallRiskScore: 42 });
      expect(out.result.overallDecision).toBe('ACCEPT');
      expect(out.result.overallRiskScore).toBe(42);
    });
  });

  describe('aggregateResults', () => {
    it('extracts aggregate[0] and criteria array', () => {
      const out = parseAxiomPipelineResults({
        results: {
          aggregateResults: [
            {
              overallRiskScore: 73,
              overallDecision: 'CONDITIONAL',
              criteria: [
                { criterionId: 'GLA-CHECK', decision: 'PASS', score: 1 },
                { criterionId: 'COMP-AGE', decision: 'FAIL', score: 0 },
              ],
            },
          ],
        },
      });
      expect(out.result.aggregate?.overallRiskScore).toBe(73);
      expect(out.result.criteria).toHaveLength(2);
      expect(out.result.criteria[0]?.criterionId).toBe('GLA-CHECK');
    });

    it('returns aggregate=null and empty criteria when stage missing', () => {
      const out = parseAxiomPipelineResults({ results: {} });
      expect(out.result.aggregate).toBeNull();
      expect(out.result.criteria).toEqual([]);
    });
  });

  describe('permissive on shape drift', () => {
    it('does NOT throw on unknown top-level fields', () => {
      // Axiom adds a new pipeline output — we still extract what we know.
      const out = parseAxiomPipelineResults({
        results: {
          extractStructuredData: [{ extractedData: { yearBuilt: { value: 1985 } } }],
          newFutureStage: { foo: 'bar' },
        },
        unknownTopLevel: 42,
      });
      expect(out.ok).toBe(true);
      expect(out.result.mergedExtractedData).toMatchObject({ yearBuilt: { value: 1985 } });
    });

    it('falls through with ok=false but populated result when a stage has wrong type', () => {
      const out = parseAxiomPipelineResults({
        results: {
          extractStructuredData: 'not-an-array' as unknown,
          consolidate: [{ consolidatedData: { yearBuilt: { value: 2000 } } }],
        },
      });
      expect(out.ok).toBe(false);
      expect(out.issues.length).toBeGreaterThan(0);
      // Best-effort: consolidate still parsed.
      expect(out.result.consolidatedData).toEqual({ yearBuilt: { value: 2000 } });
    });
  });

  describe('top-level extractedData fallback', () => {
    it('uses extractedData when no stage data is present', () => {
      const out = parseAxiomPipelineResults({
        extractedData: { yearBuilt: { value: 1985 }, grossLivingArea: { value: 1850 } },
      });
      expect(out.result.mergedExtractedData).toMatchObject({ yearBuilt: { value: 1985 } });
    });
  });
});
