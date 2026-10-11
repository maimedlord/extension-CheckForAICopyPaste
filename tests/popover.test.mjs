import test from 'node:test';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {createNotices,placeNotice} from '../.test-build/popover.js';
import {Draft} from '../.test-build/state.js';
import {defaults} from '../.test-build/settings.js';
test('placement avoids editor and controls, chooses a gutter, and hides when no safe space exists',()=>{
  const editor={left:400,right:700,top:200,bottom:400};
  const view={width:1200,height:800};
  assert.equal(placeNotice(editor,320,180,view).side,'right');
  const blocker={left:700,right:1100,top:100,bottom:500};
  assert.equal(placeNotice(editor,320,180,view,[blocker]).side,'left');
  assert.equal(placeNotice({left:0,right:360,top:0,bottom:700},320,200,{width:360,height:700}),undefined);
});
test('notice renders text safely, never steals focus, dismisses, hides offscreen and removes stale findings',async()=>{
  const dom=new JSDOM('<body><textarea></textarea></body>',{pretendToBeVisual:true});
  for(const key of ['window','document','HTMLElement','getComputedStyle'])globalThis[key]=key==='getComputedStyle'?dom.window.getComputedStyle.bind(dom.window):dom.window[key];
  globalThis.innerWidth=1200;globalThis.innerHeight=800;
  let callback;globalThis.requestAnimationFrame=fn=>{callback=fn;return 1;};globalThis.cancelAnimationFrame=()=>{};
  globalThis.ResizeObserver=class{observe(){}unobserve(){}disconnect(){}};
  let root;
  const attach=dom.window.HTMLElement.prototype.attachShadow;
  dom.window.HTMLElement.prototype.attachShadow=function(options){root=attach.call(this,options);return root;};
  const editor=document.querySelector('textarea');let offscreen=false;
  editor.getBoundingClientRect=()=>({left:400,right:700,top:offscreen?-500:200,bottom:offscreen?-300:400,width:300,height:200});
  const notices=createNotices();
  const excerpt='<img src=x onerror=alert(1)>';
  const draft=new Draft(async()=>({status:'checked',findings:[{start:0,end:excerpt.length,excerpt}]}),()=>notices.update(editor,draft));
  try{
    editor.focus();await draft.paste(excerpt,defaults);
    root.querySelector('section').getBoundingClientRect=()=>({height:180,width:320});callback();
    assert.equal(document.activeElement,editor);
    assert.equal(root.querySelector('img'),null);assert.equal(root.querySelector('li').textContent,excerpt);
    assert.equal(root.querySelectorAll('button').length,1);assert.equal(root.querySelector('[aria-modal]'),null);
    const host=root.host;offscreen=true;window.dispatchEvent(new window.Event('scroll'));callback();assert.equal(host.hidden,true);
    offscreen=false;window.dispatchEvent(new window.Event('scroll'));callback();assert.equal(host.hidden,false);
    root.querySelector('button').click();assert.equal(draft.dismissed,true);assert.equal(host.isConnected,false);
    await draft.paste(excerpt+' more',defaults);assert.equal(draft.visible.length,0);
    draft.clear();await draft.paste(excerpt,defaults);assert.equal(root.host.isConnected,true);
    draft.edit('fixed');assert.equal(root.host.isConnected,false);
  }finally{notices.dispose();dom.window.close();}
});
