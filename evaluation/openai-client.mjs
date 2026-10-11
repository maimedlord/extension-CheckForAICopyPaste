import { outputSchema, validatePrediction } from './score.mjs';

export const endpoint = 'https://api.openai.com/v1/responses';
export function buildRequest({ model, prompt, text, maxOutputTokens = 8192 }) {
  return {
    model, store: false, stream: false, max_output_tokens: maxOutputTokens,
    instructions: prompt,
    input: [{ role: 'user', content: JSON.stringify({ text }) }],
    text: { format: { type: 'json_schema', name: 'paste_findings', strict: true, schema: outputSchema } },
  };
}

export async function detect({ apiKey, model, prompt, text, fetchImpl = fetch }) {
  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(buildRequest({ model, prompt, text })),
    });
  } catch { return { status: 'error', error: 'Network error or timeout; request may have been billed.' }; }
  // Never log response error bodies, request headers, or transport exception details.
  if (!response.ok) return { status: 'error', error: `HTTP ${response.status}`, httpStatus: response.status };
  let data;
  try { data = await response.json(); } catch { return { status: 'error', error: 'Invalid API JSON response' }; }
  const record = { resolvedModel: data.model, responseStatus: data.status };
  if (Number.isInteger(data.usage?.input_tokens) && Number.isInteger(data.usage?.output_tokens)) {
    record.usage = { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens,
      reasoningTokens: data.usage.output_tokens_details?.reasoning_tokens ?? null,
      cachedInputTokens: data.usage.input_tokens_details?.cached_tokens ?? null };
  }
  if (data.status !== 'completed') return { ...record, status: 'error', error: 'Response incomplete or failed' };
  const content = (data.output ?? []).filter(x => x.type === 'message').flatMap(x => x.content ?? []);
  if (content.some(x => x.type === 'refusal')) return { ...record, status: 'error', error: 'Model refusal' };
  const parts = content.filter(x => x.type === 'output_text');
  if (parts.length !== 1 || typeof parts[0].text !== 'string') {
    return { ...record, status: 'error', error: 'Expected one structured output text' };
  }
  const rawOutput = parts[0].text;
  // Defense in depth: even unexpected echoed credentials cannot enter run files.
  if (apiKey && rawOutput.includes(apiKey)) return { ...record, status: 'error', error: 'Sensitive output rejected' };
  try {
    const findings = validatePrediction(text, JSON.parse(rawOutput));
    return { ...record, status: 'valid', rawOutput, findings };
  } catch { return { ...record, status: 'error', rawOutput, error: 'Invalid findings or excerpt boundaries' }; }
}
