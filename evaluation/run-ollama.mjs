import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateDataset } from './validate.mjs';
import { outputSchema, validatePrediction, scoreCase, summarizeResults } from './score.mjs';

// Deliberately restricted to the development split and native localhost server.
const endpoint = 'http://127.0.0.1:11435';
const model = 'qwen3.5:9b';
const timeoutMs = 120000;
if (process.argv.slice(2).some(arg => arg !== '--think')) throw new Error('Only --think is supported');
const think = process.argv.includes('--think');
const options = { num_ctx: 16384, num_predict: 4096, temperature: 0, seed: 42 };
const hash = text => createHash('sha256').update(text).digest('hex');
const prompt = readFileSync(new URL('./prompt.txt', import.meta.url), 'utf8');
const datasetBytes = readFileSync(new URL('./cases.json', import.meta.url));
const dataset = JSON.parse(datasetBytes);
const errors = validateDataset(dataset);
if (errors.length) throw new Error(errors.join('\n'));
const cases = dataset.cases.filter(c => c.split === 'development');
async function api(path, body) {
  const response = await fetch(endpoint + path, {
    method: body ? 'POST' : 'GET', redirect: 'error',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
  return response.json();
}
const version = await api('/api/version');
const tags = await api('/api/tags');
const installed = tags.models.find(m => m.name === model);
if (!installed || installed.remote_host || model.includes('cloud')) throw new Error('Expected downloaded local model');
const show = await api('/api/show', { model });
if (show.remote_host || show.remote_model) throw new Error('Remote model is not allowed');
const sourceFiles = ['run-ollama.mjs', 'score.mjs', 'validate.mjs'];
const run = {
  startedAt: new Date().toISOString(), endpoint, model, modelDigest: installed.digest,
  modelDetails: installed.details, ollamaVersion: version.version, capabilities: show.capabilities,
  thinkingMetadata: show.thinking ?? null,
  datasetVersion: dataset.datasetVersion, datasetHash: hash(datasetBytes), split: 'development',
  profile: dataset.profile, prompt, promptHash: hash(prompt), outputSchema,
  options, think, timeoutMs, retries: 0, concurrency: 1,
  sourceHashes: Object.fromEntries(sourceFiles.map(f => [f, hash(readFileSync(new URL(f, import.meta.url)))])),
  gitRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  workingTreeDirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  results: [],
};
const directory = new URL('./results/', import.meta.url);
mkdirSync(directory, { recursive: true });
const output = new URL(`development-${run.startedAt.replaceAll(':','-')}.json`, directory);
const save = () => { run.summary = summarizeResults(run.results); writeFileSync(output, JSON.stringify(run, null, 2) + '\n'); };
save();
for (const c of cases) {
  const record = { id: c.id, tags: c.tags, inputHash: hash(c.text), expectedFindings: c.expectedFindings };
  const started = performance.now();
  if (!c.text.trim()) {
    record.status = 'short_circuit'; record.findings = []; record.score = scoreCase(c, []);
  } else {
    try {
      // Conservative byte bound for this small seed set; never silently truncate.
      if (Buffer.byteLength(prompt + JSON.stringify({ text: c.text }), 'utf8') > 6000) throw new Error('Input exceeds conservative test-run context budget');
      const response = await api('/api/chat', {
        model, stream: false, think, options, keep_alive: '10m', format: outputSchema,
        messages: [{ role: 'system', content: prompt }, { role: 'user', content: JSON.stringify({ text: c.text }) }],
      });
      record.rawOutput = response.message?.content ?? '';
      record.doneReason = response.done_reason;
      record.providerDurationMs = typeof response.total_duration === 'number' ? response.total_duration / 1e6 : null;
      record.loadDurationMs = typeof response.load_duration === 'number' ? response.load_duration / 1e6 : null;
      if (Number.isInteger(response.prompt_eval_count) && Number.isInteger(response.eval_count)) {
        record.usage = { inputTokens: response.prompt_eval_count, outputTokens: response.eval_count };
      }
      if (!response.done || response.done_reason !== 'stop') throw new Error('Incomplete or truncated response');
      record.findings = validatePrediction(c.text, JSON.parse(record.rawOutput));
      record.score = scoreCase(c, record.findings); record.status = 'valid';
    } catch (error) { record.status = 'error'; record.error = error.message; }
  }
  record.wallMs = Math.round(performance.now() - started);
  run.results.push(record); save();
  console.log(`${c.id}: ${record.status}, ${record.score?.exact ? 'exact' : 'not exact'}, ${record.wallMs} ms`);
}
run.finishedAt = new Date().toISOString();
run.loadedModels = await api('/api/ps').catch(() => null);
run.byTag = Object.fromEntries([...new Set(cases.flatMap(c => c.tags))].map(tag => [tag, summarizeResults(run.results.filter(r => r.tags.includes(tag)))]));
save();
console.log(JSON.stringify(run.summary, null, 2));
console.log(`Results: ${output.pathname}`);
if (run.summary.errors) process.exitCode = 1;
