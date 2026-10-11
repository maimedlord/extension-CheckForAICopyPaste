import test from 'node:test';
import assert from 'node:assert/strict';
import {detect,parseFindings,requestBody,basic,endpoint} from '../.test-build/provider.js';
test('Luna requests use fixed destination, prompt, schema, no storage or tools',async()=>{
  const body=requestBody('draft');assert.equal(body.model,'gpt-6-luna');assert.equal(body.store,false);assert.equal(body.max_output_tokens,8192);assert.equal(body.text.format.strict,true);assert.equal(body.tools,undefined);
  const r=await detect('BAD','dummy-key',new AbortController().signal,async(url,init)=>{
    assert.equal(url,endpoint);assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer dummy-key');
    return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({findings:[{kind:'placeholder',excerpt:'BAD',occurrence:1}]})}]}],usage:{input_tokens:10,output_tokens:5}})};
  });assert.equal(r.status,'checked');assert.equal(r.findings[0].start,0);assert.deepEqual(r.usage,{input:10,output:5});
});
test('output validation rejects overlaps, nonexistent occurrences, unknown keys and rewritten excerpts',()=>{
  assert.equal(parseFindings('BAD BAD',{findings:[{kind:'placeholder',excerpt:'BAD',occurrence:2}]} )[0].start,4);
  for(const f of [{kind:'placeholder',excerpt:'bad',occurrence:1},{kind:'placeholder',excerpt:'BAD',occurrence:3},{kind:'placeholder',excerpt:'BAD',occurrence:1,extra:true}]) assert.throws(()=>parseFindings('BAD BAD',{findings:[f]}));
  const f={kind:'placeholder',excerpt:'BAD',occurrence:1};assert.throws(()=>parseFindings('BAD',{findings:[f,f]}));
});
test('failures and refusals use limited local fallback without leaking response errors',async()=>{
  for(const response of [{ok:false,status:401,json:async()=>{throw Error('must not read error body');}},{ok:true,json:async()=>({status:'incomplete'})},{ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'refusal'}]}]})}]){
    const r=await detect('[insert name]','dummy-key',new AbortController().signal,async()=>response);assert.equal(r.status,'basic');assert.equal(r.findings.length,1);assert.equal(JSON.stringify(r).includes('dummy-key'),false);
  }
  assert.equal(basic('Example: [insert name]').findings.length,0);
});
test('background enforces sender, consent, key isolation, site restrictions and bounded calls',async()=>{
  const listeners=[];const local={},session={};let permitted=true,calls=0;
  const area=(data,name)=>({get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,data[k]])),set:async values=>{Object.assign(data,values);for(const fn of listeners)fn(Object.fromEntries(Object.entries(values).map(([k,v])=>[k,{newValue:v}])),name);},remove:async key=>{delete data[key];for(const fn of listeners)fn({[key]:{}},name);},setAccessLevel:async x=>assert.equal(x.accessLevel,'TRUSTED_CONTEXTS')});
  globalThis.chrome={runtime:{id:'test',getURL:p=>'chrome-extension://test/'+p,onMessage:{addListener(){}}},storage:{local:area(local,'local'),session:area(session,'session'),onChanged:{addListener:f=>listeners.push(f)}},permissions:{contains:async()=>permitted,onRemoved:{addListener(){}}}};
  globalThis.fetch=async()=>{calls++;return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"findings":[]}'}]}]})};};
  const {handle}=await import('../.test-build/background.js');
  const options={id:'test',url:'chrome-extension://test/options.html'};
  const page={id:'test',url:'https://www.reddit.com/r/test',tab:{id:1},frameId:0,documentId:'one'};
  const check=()=>handle({type:'check',id:crypto.randomUUID(),text:'draft'},page);
  assert.equal((await check()).status,'basic');assert.equal(calls,0);
  assert.equal((await handle({type:'key',key:'dummy'},page)).error,'Not allowed');
  await handle({type:'key',key:'dummy'},options);await handle({type:'configure',cloud:true},options);
  const status=await handle({type:'status'},options);assert.equal(status.hasKey,true);assert.equal(JSON.stringify(status).includes('dummy'),false);
  assert.equal((await handle({type:'check',id:'x',text:'draft'},{...page,url:'https://reddit.com.evil.test/'})).error,'Not allowed');
  local.settings={enabled:false};assert.equal((await check()).status,'unavailable');assert.equal(calls,0);delete local.settings;
  permitted=false;assert.equal((await check()).status,'basic');assert.equal(calls,0);permitted=true;
  assert.equal((await check()).status,'checked');assert.equal(calls,1);
  assert.equal(JSON.stringify(session.providerStatus).includes('draft'),false);
  session.requestTimes=Array(12).fill(Date.now());assert.equal((await check()).status,'basic');assert.equal(calls,1);
  session.requestTimes=[];
  await handle({type:'cancel',id:'early'},page);
  const early=await handle({type:'check',id:'early',text:'draft'},page);
  assert.equal(early.status,'unavailable');assert.equal(calls,1);
  let finish,entered;
  const started=new Promise(resolve=>{entered=resolve;});
  globalThis.fetch=async()=>{calls++;entered();await new Promise(resolve=>{finish=resolve;});return {ok:true,json:async()=>({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"findings":[]}'}]}]})};};
  const pending=check();await started;
  await handle({type:'configure',cloud:false},options);finish();
  assert.equal((await pending).status,'unavailable','revoked consent discards in-flight response');
  await handle({type:'forget'},options);assert.equal(session.openaiKey,undefined);
});
