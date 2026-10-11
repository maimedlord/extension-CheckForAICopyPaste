import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const kinds = new Set(['assistant_commentary', 'drafting_instruction', 'placeholder']);
const splits = new Set(['development', 'evaluation']);
const sources = new Set(['synthetic', 'user_provided_normalized']);
const requiredText = value => typeof value === 'string' && value.trim().length > 0;

// Occurrences count exact, non-overlapping matches from left to right, starting at 1.
// Returned offsets follow JavaScript string indexing (UTF-16 code units).
export function locate(text, excerpt, occurrence) {
  if (typeof text !== 'string' || !requiredText(excerpt) ||
      !Number.isInteger(occurrence) || occurrence < 1) return null;
  let start = -1;
  let cursor = 0;
  for (let i = 0; i < occurrence; i++) {
    start = text.indexOf(excerpt, cursor);
    if (start < 0) return null;
    cursor = start + excerpt.length;
  }
  return { start, end: cursor };
}

export function validateDataset(data) {
  const errors = [];
  const check = (condition, message) => { if (!condition) errors.push(message); };
  check(data?.schemaVersion === 1, 'Unsupported schemaVersion');
  check(requiredText(data?.datasetVersion), 'Missing datasetVersion');
  check(data?.profile?.sensitivity === 'conservative' &&
    data?.profile?.flagAiLikePhrasing === false, 'Expected conservative profile with style checks off');
  if (!Array.isArray(data?.cases) || !data.cases.length) return [...errors, 'Cases must be a nonempty array'];
  const ids = new Set();
  const texts = new Map();
  const families = new Map();
  for (const c of data.cases) {
    if (!c || typeof c !== 'object') { errors.push('Invalid case object'); continue; }
    const label = c.id ?? '(missing id)';
    check(requiredText(c.id) && !ids.has(c.id), `${label}: missing or duplicate id`);
    ids.add(c.id);
    check(splits.has(c.split), `${label}: invalid split`);
    check(requiredText(c.family), `${label}: missing family`);
    check(!families.has(c.family) || families.get(c.family) === c.split, `${label}: family crosses splits`);
    families.set(c.family, c.split);
    check(sources.has(c.source), `${label}: invalid source`);
    check(requiredText(c.rationale), `${label}: missing rationale`);
    check(Array.isArray(c.tags) && c.tags.length > 0 && c.tags.every(requiredText) &&
      new Set(c.tags).size === c.tags.length, `${label}: invalid tags`);
    check(typeof c.text === 'string', `${label}: text must be a string`);
    if (typeof c.text === 'string') {
      const normalized = c.text.normalize('NFC').replace(/\s+/gu, ' ').trim();
      // Empty and whitespace-only cases intentionally exist in separate splits.
      if (normalized) {
        check(!texts.has(normalized), `${label}: duplicate normalized text (${texts.get(normalized)})`);
        texts.set(normalized, c.id);
      }
    }
    if (!Array.isArray(c.expectedFindings)) { errors.push(`${label}: findings must be an array`); continue; }
    let previousEnd = 0;
    for (const f of c.expectedFindings) {
      check(kinds.has(f?.kind), `${label}: invalid finding kind`);
      const range = locate(c.text, f?.excerpt, f?.occurrence);
      check(range !== null, `${label}: excerpt/occurrence does not locate an exact passage`);
      if (range) {
        check(range.start >= previousEnd, `${label}: findings overlap or are out of source order`);
        previousEnd = range.end;
      }
    }
  }
  for (const split of splits) {
    const group = data.cases.filter(c => c?.split === split);
    check(group.some(c => c.expectedFindings?.length > 0), `${split}: missing positive cases`);
    check(group.some(c => c.expectedFindings?.length === 0), `${split}: missing negative cases`);
  }
  return errors;
}

export function summarize(data) {
  return [...splits].map(split => {
    const cases = data.cases.filter(c => c.split === split);
    return {
      split,
      cases: cases.length,
      positive: cases.filter(c => c.expectedFindings.length > 0).length,
      negative: cases.filter(c => c.expectedFindings.length === 0).length,
      passages: cases.reduce((sum, c) => sum + c.expectedFindings.length, 0),
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const data = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));
    const errors = validateDataset(data);
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else { console.log(`Dataset ${data.datasetVersion}: valid`); console.table(summarize(data)); }
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
