import { locate } from './validate.mjs';

export const outputSchema = {
  type: 'object', additionalProperties: false, required: ['findings'],
  properties: { findings: { type: 'array', items: {
    type: 'object', additionalProperties: false, required: ['kind', 'excerpt', 'occurrence'],
    properties: {
      kind: { type: 'string', enum: ['assistant_commentary', 'drafting_instruction', 'placeholder'] },
      excerpt: { type: 'string', minLength: 1 }, occurrence: { type: 'integer', minimum: 1 },
    },
  } } },
};

export function validatePrediction(text, value) {
  if (!value || Array.isArray(value) || Object.keys(value).join() !== 'findings' || !Array.isArray(value.findings)) {
    throw new Error('Expected only a findings array');
  }
  let end = 0;
  for (const f of value.findings) {
    if (!f || Object.keys(f).sort().join() !== 'excerpt,kind,occurrence' ||
      !outputSchema.properties.findings.items.properties.kind.enum.includes(f.kind)) {
      throw new Error('Invalid finding shape or kind');
    }
    const span = locate(text, f.excerpt, f.occurrence);
    if (!span || span.start < end) throw new Error('Missing, duplicate, overlapping, or unordered excerpt');
    end = span.end;
  }
  return value.findings;
}

export function scoreCase(c, findings) {
  validatePrediction(c.text, { findings });
  const key = f => { const s = locate(c.text, f.excerpt, f.occurrence); return `${s.start}:${s.end}`; };
  const gold = new Map(c.expectedFindings.map(f => [key(f), f.kind]));
  const predicted = new Map(findings.map(f => [key(f), f.kind]));
  let matched = 0, typedMatches = 0;
  for (const [span, kind] of predicted) {
    if (gold.has(span)) { matched++; if (gold.get(span) === kind) typedMatches++; }
  }
  return {
    positive: gold.size > 0, warned: predicted.size > 0,
    expected: gold.size, predicted: predicted.size, matched, typedMatches,
    exact: matched === gold.size && matched === predicted.size,
  };
}

const ratio = (numerator, denominator) => ({ numerator, denominator, rate: denominator ? numerator / denominator : null });
export function summarizeResults(results) {
  const valid = results.filter(r => r.status === 'valid' || r.status === 'short_circuit');
  const positive = valid.filter(r => r.score.positive);
  const negative = valid.filter(r => !r.score.positive);
  const sum = field => valid.reduce((n, r) => n + r.score[field], 0);
  const latencies = results.filter(r => r.status === 'valid').map(r => r.wallMs).sort((a,b) => a-b);
  const middle = Math.floor(latencies.length / 2);
  const median = latencies.length ? (latencies.length % 2 ? latencies[middle] : (latencies[middle-1] + latencies[middle]) / 2) : null;
  return {
    attempted: results.length, valid: valid.length,
    errors: results.filter(r => r.status !== 'valid' && r.status !== 'short_circuit').length,
    shortCircuits: results.filter(r => r.status === 'short_circuit').length,
    completion: ratio(valid.length, results.length),
    falseAlarm: ratio(negative.filter(r => r.score.warned).length, negative.length),
    miss: ratio(positive.filter(r => !r.score.warned).length, positive.length),
    precision: ratio(sum('matched'), sum('predicted')),
    recall: ratio(sum('matched'), sum('expected')),
    categoryAccuracyOnMatchedSpans: ratio(sum('typedMatches'), sum('matched')),
    exactValid: ratio(valid.filter(r => r.score.exact).length, valid.length),
    exactAllAttempts: ratio(valid.filter(r => r.score.exact).length, results.length),
    latencyMs: { calls: latencies.length, median, min: latencies[0] ?? null, max: latencies.at(-1) ?? null },
    usage: {
      reportedCalls: results.filter(r => r.usage).length,
      inputTokens: results.some(r => r.usage) ? results.reduce((n,r) => n + (r.usage?.inputTokens ?? 0), 0) : null,
      outputTokens: results.some(r => r.usage) ? results.reduce((n,r) => n + (r.usage?.outputTokens ?? 0), 0) : null,
      apiCost: null,
    },
  };
}
