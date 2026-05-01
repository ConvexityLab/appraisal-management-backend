/**
 * parseAndValidatePicks — unit tests for the tiered-AI strategy's
 * AI-response parser. Confirms loud failure on malformed JSON, non-arrays,
 * missing propertyId, and hallucinated ids.
 */

import { describe, expect, it } from 'vitest';

import { parseAndValidatePicks } from '../../src/services/comp-selection/strategies/tiered-ai.strategy';

const validIds = new Set(['p1', 'p2', 'p3']);

describe('parseAndValidatePicks', () => {
  it('parses a clean JSON array', () => {
    const r = parseAndValidatePicks(
      JSON.stringify([
        { propertyId: 'p1', reasoning: 'best match' },
        { propertyId: 'p2' },
      ]),
      validIds,
    );
    expect(r).toEqual([
      { propertyId: 'p1', reasoning: 'best match' },
      { propertyId: 'p2' },
    ]);
  });

  it('strips ```json code fences', () => {
    const raw = '```json\n[{"propertyId":"p1"}]\n```';
    const r = parseAndValidatePicks(raw, validIds);
    expect(r).toEqual([{ propertyId: 'p1' }]);
  });

  it('throws on malformed JSON', () => {
    expect(() => parseAndValidatePicks('not json', validIds)).toThrow(/parse/i);
  });

  it('throws when the response is not an array', () => {
    expect(() => parseAndValidatePicks('{"propertyId":"p1"}', validIds)).toThrow(
      /not a JSON array/,
    );
  });

  it('throws when an item is missing propertyId', () => {
    expect(() => parseAndValidatePicks('[{"foo":"bar"}]', validIds)).toThrow(
      /missing string propertyId/,
    );
  });

  it('throws when the AI hallucinates a propertyId not in the batch', () => {
    expect(() =>
      parseAndValidatePicks('[{"propertyId":"ghost"}]', validIds),
    ).toThrow(/hallucination/);
  });
});
