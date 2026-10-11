import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { locate, validateDataset } from './validate.mjs';

const fixture = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url), 'utf8'));

test('all authored cases pass integrity checks', () => {
  assert.deepEqual(validateDataset(fixture), []);
});

test('occurrences resolve separately using UTF-16 offsets without normalizing text', () => {
  assert.deepEqual(locate('🌱 slot\r\nslot', 'slot', 2), { start: 9, end: 13 });
  assert.equal(locate('slot', 'slot', 2), null);
  assert.equal(locate('slot', '', 1), null);
  assert.equal(locate('slot', 'slot', 0), null);
  assert.equal(locate('a\r\nb', 'a\nb', 1), null);
});

test('rejects incorrect annotation boundaries, ordering, kinds, and duplicate IDs', () => {
  const data = structuredClone(fixture);
  data.cases[0].expectedFindings.reverse();
  data.cases[1].expectedFindings[0].excerpt = 'not in the input';
  data.cases[2].expectedFindings[0].kind = 'ai_authorship';
  data.cases[3].id = data.cases[0].id;
  const errors = validateDataset(data).join('\n');
  for (const pattern of [/source order/, /exact passage/, /finding kind/, /duplicate id/]) {
    assert.match(errors, pattern);
  }
});

test('rejects family leakage and normalized duplicate inputs across splits', () => {
  const data = structuredClone(fixture);
  data.cases[20].family = data.cases[0].family;
  data.cases[39].text = data.cases[19].text + '\n';
  const errors = validateDataset(data).join('\n');
  assert.match(errors, /family crosses splits/);
  assert.match(errors, /duplicate normalized text/);
});

test('rejects overlapping findings and missing split coverage', () => {
  const data = structuredClone(fixture);
  data.cases[0].expectedFindings.push(data.cases[0].expectedFindings[1]);
  data.cases = data.cases.filter(c => c.split === 'development');
  const errors = validateDataset(data).join('\n');
  assert.match(errors, /overlap/);
  assert.match(errors, /evaluation: missing positive/);
  assert.match(errors, /evaluation: missing negative/);
});
