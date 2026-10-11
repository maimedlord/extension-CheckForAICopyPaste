import { domain, loadSettings, type Settings } from './settings';
import { origin } from './provider';
const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const domains = document.getElementById('domains') as HTMLTextAreaElement;
const mode = document.getElementById('mode') as HTMLSelectElement;
const status = document.getElementById('status')!;
void loadSettings().then(settings => {
  input('enabled').checked = settings.enabled; mode.value = settings.siteMode;
  domains.value = settings.domains.join('\n'); input('reopen').checked = settings.reopenAfterPaste;
  input('maximum').value = settings.maxCharacters?.toString() ?? '';
  for(const id of ['theme','textSize','colorPreset'] as const)(document.getElementById(id) as HTMLSelectElement).value=settings[id];
}).catch(() => { status.textContent = 'Settings could not be loaded.'; });
document.getElementById('settings')!.addEventListener('submit', event => {
  event.preventDefault();
  const entries = domains.value.split('\n').map(x => x.trim()).filter(Boolean);
  const max = input('maximum').value === '' ? null : Number(input('maximum').value);
  if (entries.some(x => !domain(x)) || (max !== null && (!Number.isSafeInteger(max) || max < 1))) { status.textContent = 'Use domain names without URLs, and a positive whole-number limit.'; return; }
  const theme=(document.getElementById('theme') as HTMLSelectElement).value;
  const size=(document.getElementById('textSize') as HTMLSelectElement).value;
  const settings: Settings = { enabled: input('enabled').checked, siteMode: mode.value === 'block' ? 'block' : 'allow', domains: [...new Set(entries.map(x => domain(x)!))], reopenAfterPaste: input('reopen').checked, maxCharacters: max,theme:theme==='light'||theme==='dark'?theme:'system',textSize:size==='small'||size==='large'?size:'medium',colorPreset:(document.getElementById('colorPreset') as HTMLSelectElement).value==='neutral'?'neutral':'warm' };
  void chrome.storage.local.set({ settings }).then(() => { status.textContent = 'Saved. Applies immediately to open Reddit pages.'; }).catch(() => { status.textContent = 'Settings could not be saved.'; });
});
const providerStatus=document.getElementById('provider-status')!;
const sampleResult=document.getElementById('sample-result')!;
async function refresh() {
  const result=await chrome.runtime.sendMessage({type:'status'});
  input('cloud').checked=result.cloud===true;
  providerStatus.textContent=`${result.cloud?'GPT-6 Luna enabled':'Basic mode'}; ${result.hasKey?'session key available':'no session key'}. ${result.last?.detail ?? ''}`;
}
function action(id:string,work:()=>Promise<void>) {
  const button=document.getElementById(id) as HTMLButtonElement;
  button.addEventListener('click',()=>{button.disabled=true;void work().catch(()=>{providerStatus.textContent='Operation failed. Reload the extension settings and try again.';}).finally(()=>{button.disabled=false;});});
}
action('provider-save',async()=>{
  const cloud=input('cloud').checked;
  if(cloud && !await chrome.permissions.request({origins:[origin]})) {providerStatus.textContent='Permission not granted. Cloud remains off.';return;}
  await chrome.runtime.sendMessage({type:'configure',cloud});await refresh();
});
action('key-save',async()=>{
  const field=input('api-key');const key=field.value;field.value='';
  const result=await chrome.runtime.sendMessage({type:'key',key});
  if(result.error) {providerStatus.textContent=result.error;return;} await refresh();
});
action('key-forget',async()=>{await chrome.runtime.sendMessage({type:'forget'});await refresh();});
for(const id of ['connection','sample']) action(id,async()=>{
  sampleResult.textContent='Checking…';
  const result=await chrome.runtime.sendMessage({type:id,id:crypto.randomUUID()});
  if(result.error){sampleResult.textContent=result.error;return;}
  sampleResult.textContent=[result.detail,...(result.findings??[]).map((f:{excerpt:string})=>`• ${f.excerpt}`),result.usage?`Tokens: ${result.usage.input} input, ${result.usage.output} output.`:''].join('\n');
  await refresh();
});
void refresh().catch(()=>{providerStatus.textContent='Provider status unavailable.';});
chrome.storage.onChanged.addListener((changes,area)=>{
  if(area==='session' && changes.providerStatus) {
    const last=changes.providerStatus.newValue as {detail?:unknown}|undefined;
    if(typeof last?.detail==='string') providerStatus.textContent=last.detail;
  }
});
