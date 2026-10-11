import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { Draft } from '../.test-build/state.js';
import { defaults, allowed, parseSettings } from '../.test-build/settings.js';
import { mount } from '../.test-build/controller.js';
import { editorFor } from '../.test-build/editors.js';
const result = text => ({ status: 'checked', findings: [...text.matchAll(/BAD/g)].map(m => ({ start: m.index, end: m.index + 3, excerpt: 'BAD' })) });
const tick = () => new Promise(r => setTimeout(r, 10));
test('domain boundaries and preserved empty allow lists', () => {
  assert.equal(allowed('www.reddit.com', defaults), true);
  for (const host of ['notreddit.com', 'reddit.com.evil.test','example.com']) assert.equal(allowed(host, defaults), false);
  assert.equal(allowed('reddit.com', parseSettings({ domains: [] })), false);
  assert.equal(allowed('reddit.com', { ...defaults, enabled: false }), false);
  assert.equal(allowed('example.com', { ...defaults, siteMode: 'block' }), true);
});
test('typing never checks; edits remove touched findings and shift untouched findings', async () => {
  let calls = 0;
  const d = new Draft(async text => { calls++; return result(text); });
  d.edit('BAD'); assert.equal(calls, 0);
  await d.paste('a BAD z BAD', defaults);
  d.edit('prefix a BAD z BAD');
  assert.deepEqual(d.findings.map(f => f.start), [9,15]);
  d.edit('prefix a GOOD z BAD');
  assert.deepEqual(d.findings, [{start:16,end:19,excerpt:'BAD'}]);
  assert.equal(calls, 1);
});
test('outdated responses cannot overwrite edits or newer paste results', async () => {
  const pending = [];
  const d = new Draft(text => new Promise(resolve => pending.push(() => resolve(result(text)))));
  const old = d.paste('BAD old', defaults);
  const current = d.paste('ok', defaults);
  pending[1](); await current;
  pending[0](); await old;
  assert.equal(d.text, 'ok'); assert.deepEqual(d.findings, []);
  const late = d.paste('BAD', defaults); d.edit('changed'); pending[2](); await late;
  assert.deepEqual(d.findings, []); assert.equal(d.status, 'idle');
});
test('dismissal stays per draft and per field; optional paste reopening and clear reset', async () => {
  const d = new Draft(async text => result(text));
  const other = new Draft(async text => result(text));
  await d.paste('BAD', defaults); d.dismiss();
  await d.paste('BAD more', defaults); await other.paste('BAD', defaults);
  assert.equal(d.visible.length, 0); assert.equal(other.visible.length, 1);
  await d.paste('BAD more', { ...defaults, reopenAfterPaste:true });
  assert.equal(d.visible.length, 1);
  d.dismiss(); d.edit(''); assert.equal(d.dismissed, false);
});
test('Unicode limit skips whole input; invalid spans fail closed; unchanged paste deduplicates', async () => {
  let calls = 0;
  const d = new Draft(async text => { calls++; return result(text); });
  await d.paste('😀', {...defaults,maxCharacters:1}); assert.equal(calls, 1);
  await d.paste('😀a', {...defaults,maxCharacters:1}); assert.equal(calls, 1); assert.equal(d.status,'skipped');
  await d.paste('BAD', defaults); await d.paste('BAD', defaults); assert.equal(calls, 2);
  const invalid = new Draft(async () => ({ status:'checked',findings:[{start:0,end:3,excerpt:'bad'}] }));
  await invalid.paste('BAD', defaults); assert.equal(invalid.status,'error'); assert.deepEqual(invalid.findings,[]);
});
test('DOM paste reads full post-paste input; no typing checks; disabling cancels; sensitive fields excluded', async () => {
  const dom = new JSDOM('<body><input id="title"><textarea id="body"></textarea><input id="pw" type="password"><input id="key" name="api_key"><input id="email" type="email"><input id="otp" autocomplete="one-time-code"><textarea id="ro" readonly></textarea></body>', { url:'https://www.reddit.com/' });
  for (const key of ['window','document','location','HTMLElement','HTMLInputElement','HTMLTextAreaElement','MutationObserver']) globalThis[key] = dom.window[key];
  const requests = [], reports = new Map();
  const controller = mount(defaults, async text => { requests.push(text); return result(text); }, (e,d) => reports.set(e.id,d));
  try {
    for (const id of ['pw','key','email','otp','ro']) assert.equal(editorFor(document.getElementById(id)),null);
    const title = document.getElementById('title');
    title.value='existing '; title.dispatchEvent(new window.Event('input',{bubbles:true}));
    assert.equal(requests.length,0);
    title.dispatchEvent(new window.Event('paste',{bubbles:true}));
    title.value+='BAD'; title.dispatchEvent(new window.Event('input',{bubbles:true}));
    await tick(); assert.deepEqual(requests,['existing BAD']);
    reports.get('title').dismiss();
    title.dispatchEvent(new window.Event('submit',{bubbles:true}));
    assert.equal(reports.get('title').dismissed,true, 'unconfirmed submission must not reset dismissal');
    title.dispatchEvent(new window.Event('paste',{bubbles:true})); title.value+=' more';
    controller.update({...defaults,enabled:false}); await tick(); assert.equal(requests.length,1);
    assert.equal(reports.get('title').findings.length,0);
  } finally { controller.dispose(); dom.window.close(); }
});
test('DOM adapter rejects silent value changes and releases removed editors', async () => {
  const dom = new JSDOM('<body><textarea></textarea></body>', {url:'https://reddit.com/'});
  for (const key of ['window','document','location','HTMLElement','HTMLInputElement','HTMLTextAreaElement','MutationObserver']) globalThis[key] = dom.window[key];
  let finish, draft;
  const controller = mount(defaults, text => new Promise(resolve => { finish = () => resolve(result(text)); }), (_e,d) => { draft=d; });
  try {
    const editor=document.querySelector('textarea'); editor.value='BAD';
    editor.dispatchEvent(new window.Event('paste',{bubbles:true})); await tick();
    editor.value='silently replaced'; finish(); await tick();
    assert.equal(draft.text,'silently replaced'); assert.deepEqual(draft.findings,[]);
    editor.value='BAD'; editor.dispatchEvent(new window.Event('paste',{bubbles:true})); await tick();
    editor.remove(); await tick(); finish(); await tick();
    assert.deepEqual(draft.findings,[]);
  } finally { controller.dispose(); dom.window.close(); }
});
test('rich editor ownership and noneditable islands', () => {
  const dom=new JSDOM('<body><div contenteditable="true" id="host"><span id="child">draft</span><span contenteditable="false" id="locked">quote</span></div></body>');
  for (const key of ['window','document','HTMLElement','HTMLInputElement','HTMLTextAreaElement']) globalThis[key]=dom.window[key];
  // jsdom has no editing engine; provide only the browser property needed by selection.
  Object.defineProperty(dom.window.HTMLElement.prototype,'isContentEditable',{get(){ return this.closest('[contenteditable]')?.getAttribute('contenteditable')==='true'; }});
  assert.equal(editorFor(document.getElementById('child')),document.getElementById('host'));
  assert.equal(editorFor(document.getElementById('locked')),null);
  dom.window.close();
});
