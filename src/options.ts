import { domain, loadSettings, type Settings } from './settings';
const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const domains = document.getElementById('domains') as HTMLTextAreaElement;
const mode = document.getElementById('mode') as HTMLSelectElement;
const status = document.getElementById('status')!;
void loadSettings().then(settings => {
  input('enabled').checked = settings.enabled; mode.value = settings.siteMode;
  domains.value = settings.domains.join('\n'); input('reopen').checked = settings.reopenAfterPaste;
  input('maximum').value = settings.maxCharacters?.toString() ?? '';
}).catch(() => { status.textContent = 'Settings could not be loaded.'; });
document.getElementById('settings')!.addEventListener('submit', event => {
  event.preventDefault();
  const entries = domains.value.split('\n').map(x => x.trim()).filter(Boolean);
  const max = input('maximum').value === '' ? null : Number(input('maximum').value);
  if (entries.some(x => !domain(x)) || (max !== null && (!Number.isSafeInteger(max) || max < 1))) { status.textContent = 'Use domain names without URLs, and a positive whole-number limit.'; return; }
  const settings: Settings = { enabled: input('enabled').checked, siteMode: mode.value === 'block' ? 'block' : 'allow', domains: [...new Set(entries.map(x => domain(x)!))], reopenAfterPaste: input('reopen').checked, maxCharacters: max };
  void chrome.storage.local.set({ settings }).then(() => { status.textContent = 'Saved. Applies immediately to open Reddit pages.'; }).catch(() => { status.textContent = 'Settings could not be saved.'; });
});
