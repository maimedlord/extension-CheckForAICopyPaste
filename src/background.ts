import { allowed, loadSettings } from './settings';
import { basic, detect, model, origin, sample } from './provider';
import type { CheckResult } from './state';
type Config = {cloud:boolean};
const active = new Map<string,AbortController>();
const cancelled = new Map<string,number>();
let epoch = 0;
// Session storage is never exposed to content scripts. No key-returning message exists.
const ready = chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
const trusted = (sender: chrome.runtime.MessageSender) => sender.id === chrome.runtime.id && sender.url === chrome.runtime.getURL('options.html');
function reddit(sender: chrome.runtime.MessageSender): string | null {
  if(sender.id!==chrome.runtime.id || sender.tab?.id===undefined || sender.frameId!==0) return null;
  try { const url=new URL(sender.url ?? ''); return url.protocol==='https:' && (url.hostname==='reddit.com'||url.hostname.endsWith('.reddit.com')) ? url.hostname : null; } catch {return null;}
}
function cancelAll() { epoch++; for(const request of active.values()) request.abort(); }
chrome.storage.onChanged.addListener((changes,area)=>{
  if ((area==='local' && (changes.settings || changes.provider)) || (area==='session' && changes.openaiKey)) cancelAll();
  if(area==='session' && changes.openaiKey) void chrome.storage.local.set({providerRevision:Date.now()});
});
chrome.permissions.onRemoved.addListener(cancelAll);
async function remember(result: CheckResult) {
  // Only status and aggregate usage: never excerpts, input, provider errors or keys.
  await chrome.storage.session.set({providerStatus:{detail:result.detail,status:result.status,usage:result.usage ?? null,time:Date.now()}});
  return result;
}
export async function handle(message: unknown, sender: chrome.runtime.MessageSender): Promise<unknown> {
  await ready;
  if(!message || typeof message!=='object') return {error:'Invalid message'};
  const m=message as {type:string;id:string;text:string;key:string;cloud:boolean};
  const owner=`${sender.tab?.id ?? 'options'}:${sender.documentId ?? sender.frameId ?? 0}:`;
  if(m.type==='cancel' && (trusted(sender)||reddit(sender)) && typeof m.id==='string' && /^[a-zA-Z0-9-]{1,64}$/.test(m.id)) {
    active.get(owner+m.id)?.abort();
    for(const [id,time] of cancelled) if(Date.now()-time>60000) cancelled.delete(id);
    cancelled.set(owner+m.id,Date.now());
    // Fail closed on excessive cancellation traffic rather than evicting live IDs.
    if(cancelled.size>256) cancelAll();
    return {ok:true};
  }
  if(['configure','key','forget','status'].includes(m.type)) {
    if(!trusted(sender)) return {error:'Not allowed'};
    if(m.type==='configure') { await chrome.storage.local.set({provider:{cloud:m.cloud===true}}); return {ok:true}; }
    if(m.type==='key') {
      if(typeof m.key!=='string' || !m.key.trim() || /\s/.test(m.key.trim()) || m.key.length>512) return {error:'Invalid key format'};
      await chrome.storage.session.set({openaiKey:m.key.trim()}); return {ok:true};
    }
    if(m.type==='forget') { await chrome.storage.session.remove('openaiKey'); return {ok:true}; }
    const state=await chrome.storage.session.get(['openaiKey','providerStatus']);
    const provider=(await chrome.storage.local.get('provider')).provider as Config|undefined;
    return {hasKey:!!state.openaiKey,cloud:provider?.cloud===true,model,last:state.providerStatus ?? null};
  }
  const test=m.type==='sample'||m.type==='connection';
  if(test ? !trusted(sender) : m.type!=='check'||!reddit(sender)) return {error:'Not allowed'};
  const startedEpoch=epoch;
  const settings=await loadSettings();
  if(!test && !allowed(reddit(sender)!,settings)) return {status:'unavailable',findings:[],detail:'Checking disabled for this site.'};
  const text=test ? (m.type==='sample'?sample:'The meeting starts at noon.') : m.text;
  if(typeof text!=='string' || typeof m.id!=='string' || !/^[a-zA-Z0-9-]{1,64}$/.test(m.id)) return {error:'Invalid check'};
  if(!text.trim()) return {status:'checked',findings:[],detail:'Empty input.'};
  if((settings.maxCharacters!==null && [...text].length>settings.maxCharacters) || new TextEncoder().encode(text).length>100000) return remember({status:'skipped',findings:[],detail:'Input exceeds the configured limit or the provider transport limit (100 KB); entire check skipped.'});
  const provider=(await chrome.storage.local.get('provider')).provider as Config|undefined;
  if(!provider?.cloud) return remember(basic(text,'Cloud is off; limited basic checks used.'));
  if(!await chrome.permissions.contains({origins:[origin]})) return remember(basic(text,'OpenAI permission is missing; limited basic checks used.'));
  const key=(await chrome.storage.session.get('openaiKey')).openaiKey;
  if(typeof key!=='string'||!key) return remember(basic(text,'Add a session API key; limited basic checks used.'));
  // Reserve a slot before the rate-limit storage read to avoid concurrent admissions.
  if(active.size>=2 || active.has(owner+m.id)) return remember(basic(text,'Checker busy; limited basic checks used. Paste again later.'));
  for(const [id,time] of cancelled) if(Date.now()-time>60000) cancelled.delete(id);
  if(cancelled.has(owner+m.id) || cancelled.size>256) return {status:'unavailable',findings:[],detail:'Check cancelled.'};
  const abort=new AbortController(); active.set(owner+m.id,abort);
  let timer: ReturnType<typeof setTimeout>|undefined;
  let timedOut=false;
  try {
    const now=Date.now();
    // Serialize rate admissions via a single chain; timestamps survive worker suspension.
    const admitted=await admit(now);
    if(!admitted) return remember(basic(text,'Request limit reached (12/minute); limited basic checks used.'));
    if(startedEpoch!==epoch || abort.signal.aborted) return {status:'unavailable',findings:[],detail:'Settings changed; check cancelled.'};
    timer=setTimeout(()=>{timedOut=true;abort.abort();},25000);
    const result=await detect(text,key,abort.signal);
    if(startedEpoch!==epoch || (abort.signal.aborted&&!timedOut)) return {status:'unavailable',findings:[],detail:'Check cancelled; a sent request may be billed.'};
    return remember(result);
  } finally {if(timer)clearTimeout(timer);active.delete(owner+m.id);}
}
let admission=Promise.resolve();
function admit(now:number):Promise<boolean> {
  let permitted=false;
  const next=admission.then(async()=>{
    const stored=(await chrome.storage.session.get('requestTimes')).requestTimes;
    const times: number[]=Array.isArray(stored)?stored.filter((t:unknown):t is number=>typeof t==='number'&&now-t<60000):[];
    if(times.length<12){times.push(now);await chrome.storage.session.set({requestTimes:times});permitted=true;}
  });
  admission=next.catch(()=>{});return next.then(()=>permitted);
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{void handle(message,sender).then(respond).catch(()=>respond({error:'Provider operation failed'}));return true;});
