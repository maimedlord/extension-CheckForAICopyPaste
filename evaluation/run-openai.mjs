import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { validateDataset } from './validate.mjs';
import { scoreCase, summarizeResults, outputSchema } from './score.mjs';
import { detect, endpoint } from './openai-client.mjs';

async function main() {
  const args = process.argv.slice(2);
  let model, limit = 1, send = false;
  while (args.length) {
    const arg = args.shift();
    if (arg === '--model') model = args.shift();
    else if (arg === '--limit') limit = Number(args.shift());
    else if (arg === '--send') send = true;
    else throw new Error('Use --model MODEL_ID [--limit 1..20] [--send]');
  }
  if (!model || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(model) || model.startsWith('sk-')) throw new Error('Provide a model ID, never a key, with --model');
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error('Limit must be 1 through 20');
  const datasetBytes = readFileSync(new URL('./cases.json', import.meta.url));
  const data = JSON.parse(datasetBytes);
  if (validateDataset(data).length) throw new Error('Dataset validation failed');
  const cases = data.cases.filter(c => c.split === 'development').slice(0, limit);
  console.log(`${send ? 'LIVE' : 'DRY RUN'}: ${cases.length} development cases; at most ${cases.filter(c=>c.text.trim()).length} requests to ${endpoint}; 8192 output tokens/request; no retries.`);
  if (!send) { console.log('No credential read, network request, or result file. Add --send only when ready for a paid cloud run.'); return; }
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey || /\s/.test(apiKey)) throw new Error('Missing or invalid OPENAI_API_KEY. Use the private credential helper.');
  const prompt = readFileSync(new URL('./prompt.txt', import.meta.url), 'utf8');
  const hash = bytes => createHash('sha256').update(bytes).digest('hex');
  const run = {
    startedAt: new Date().toISOString(), provider: 'openai', endpoint, requestedModel: model,
    split: 'development', datasetVersion: data.datasetVersion, datasetHash: hash(datasetBytes),
    prompt, promptHash: hash(prompt), profile: data.profile, outputSchema,
    maxOutputTokens: 8192, requestLimit: limit, timeoutMs: 120000, retries: 0, concurrency: 1,
    generationSettings: 'Provider defaults; no temperature, seed, or reasoning override', store: false,
    gitRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    workingTreeDirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
    sourceHashes: Object.fromEntries(['run-openai.mjs','openai-client.mjs','score.mjs','validate.mjs'].map(f => [f, hash(readFileSync(new URL(f, import.meta.url)))])),
    results: [],
  };
  const directory = new URL('./results/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  const file = new URL(`openai-development-${run.startedAt.replaceAll(':','-')}.json`, directory);
  const save = () => { run.summary = summarizeResults(run.results); writeFileSync(file, JSON.stringify(run,null,2)+'\n'); };
  save();
  for (const c of cases) {
    const start = performance.now();
    const outcome = c.text.trim() ? await detect({ apiKey, model, prompt, text: c.text }) : { status: 'short_circuit', findings: [] };
    const record = { id: c.id, inputHash: hash(c.text), tags: c.tags, expectedFindings: c.expectedFindings, ...outcome, wallMs: Math.round(performance.now()-start) };
    if (record.findings) record.score = scoreCase(c, record.findings);
    run.results.push(record); save();
    console.log(`${c.id}: ${record.status}, ${record.wallMs} ms`);
    // Stop on any failure: no repeat billing or cascade of misconfigured calls.
    if (record.status === 'error') { run.stoppedEarly = true; process.exitCode = 1; break; }
  }
  run.finishedAt = new Date().toISOString(); save();
  console.log(JSON.stringify(run.summary,null,2));
  console.log(`Results: ${file.pathname}`);
}
main().catch(() => { console.error('OpenAI runner stopped. Check arguments, credential setup, and local files. No automatic retry.'); process.exitCode = 1; });
