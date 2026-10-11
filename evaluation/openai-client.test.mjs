import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, detect, endpoint } from './openai-client.mjs';

const options = { apiKey: 'dummy-test-secret', model: 'test-model', prompt: 'test prompt', text: '[insert date]' };
const completed = content => ({ status: 'completed', model: 'test-model-snapshot',
  usage: { input_tokens: 10, output_tokens: 5 },
  output: [{ type: 'message', content }] });
const fake = data => async () => ({ ok: true, json: async () => data });

test('request is stateless, schema-constrained, and contains only prompt and input', () => {
  const body = buildRequest(options);
  assert.equal(body.store, false);
  assert.equal(body.max_output_tokens, 8192);
  assert.equal(body.text.format.strict, true);
  assert.deepEqual(body.input, [{ role: 'user', content: JSON.stringify({text: options.text}) }]);
  assert.ok(!JSON.stringify(body).includes(options.apiKey));
  assert.equal(body.tools, undefined);
});
test('correct endpoint and auth; parses exact passages and usage', async () => {
  const findings = [{kind:'placeholder',excerpt:options.text,occurrence:1}];
  const result = await detect({...options, fetchImpl: async (url, init) => {
    assert.equal(url, endpoint);
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, `Bearer ${options.apiKey}`);
    return {ok:true,json:async()=>completed([{type:'output_text',text:JSON.stringify({findings})}])};
  }});
  assert.equal(result.status, 'valid');
  assert.deepEqual(result.findings, findings);
  assert.equal(result.usage.inputTokens, 10);
});
test('refusals, truncation, and fabricated excerpts are failures', async () => {
  const inputs = [
    {...completed([]),status:'incomplete'},
    completed([{type:'refusal',refusal:'no'}]),
    completed([{type:'output_text',text:'{"findings":[{"kind":"placeholder","excerpt":"absent","occurrence":1}]}'}]),
  ];
  for (const data of inputs) assert.equal((await detect({...options,fetchImpl:fake(data)})).status,'error');
});
test('network errors and HTTP bodies cannot leak a key and are not retried', async () => {
  let calls = 0;
  for (const fetchImpl of [async()=>{calls++;throw Error(options.apiKey);},async()=>{calls++;return {ok:false,status:401,text:async()=>options.apiKey};}]) {
    const result = await detect({...options,fetchImpl});
    assert.equal(result.status,'error');
    assert.ok(!JSON.stringify(result).includes(options.apiKey));
  }
  assert.equal(calls,2);
});
test('unexpected key echo is not retained', async () => {
  const result = await detect({...options,fetchImpl:fake(completed([{type:'output_text',text:options.apiKey}]))});
  assert.equal(result.status,'error');
  assert.ok(!JSON.stringify(result).includes(options.apiKey));
});
