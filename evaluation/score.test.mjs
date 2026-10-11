import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePrediction, scoreCase, summarizeResults } from './score.mjs';
const first = { kind: 'placeholder', excerpt: '[insert date]', occurrence: 1 };
const second = { ...first, occurrence: 2 };
const c = { text: '🌱 [insert date]\r\n[insert date]', expectedFindings: [first, second] };

test('exact spans resolve repeated passages; partial result is not whole-case success', () => {
  assert.equal(scoreCase(c, [first, second]).exact, true);
  const partial = scoreCase(c, [second]);
  assert.equal(partial.matched, 1);
  assert.equal(partial.exact, false);
  assert.equal(partial.expected, 2);
  const wrongKind = scoreCase(c, [{ ...first, kind: 'assistant_commentary' }, second]);
  assert.equal(wrongKind.exact, true);
  assert.equal(wrongKind.typedMatches, 1);
});
test('invalid output cannot score duplicate credit or hallucinated text', () => {
  for (const value of [{ findings: [first, first] }, { findings: [{ ...first, occurrence: 3 }] },
    { findings: [{ ...first, excerpt: 'invented' }] }, { findings: [], explanation: 'extra' },
    { findings: [{ ...first, kind: 'ai_written' }] }, { findings: [second, first] }]) {
    assert.throws(() => validatePrediction(c.text, value));
  }
});
test('false alarms, misses, and errors have distinct denominators', () => {
  const negative = { text: c.text, expectedFindings: [] };
  const rows = [
    { status: 'valid', wallMs: 10, score: scoreCase(c, []) },
    { status: 'valid', wallMs: 20, score: scoreCase(negative, [first]) },
    { status: 'short_circuit', wallMs: 0, score: scoreCase({ text: '', expectedFindings: [] }, []) },
    { status: 'error', wallMs: 120000 },
  ];
  const s = summarizeResults(rows);
  assert.equal(s.errors, 1);
  assert.deepEqual(s.falseAlarm, { numerator: 1, denominator: 2, rate: 0.5 });
  assert.equal(s.miss.rate, 1);
  assert.equal(s.exactAllAttempts.rate, 0.25);
  assert.equal(s.completion.rate, 0.75);
  assert.equal(s.latencyMs.median, 15);
  assert.equal(s.usage.inputTokens, null);
});
test('empty results report unavailable rates instead of perfect accuracy', () => {
  assert.equal(summarizeResults([]).recall.rate, null);
  assert.equal(summarizeResults([]).latencyMs.median, null);
});
