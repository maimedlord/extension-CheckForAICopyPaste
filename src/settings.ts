export interface Settings {
  enabled: boolean;
  siteMode: 'allow' | 'block';
  domains: string[];
  reopenAfterPaste: boolean;
  maxCharacters: number | null;
}
export const defaults: Settings = { enabled: true, siteMode: 'allow', domains: ['reddit.com'], reopenAfterPaste: false, maxCharacters: null };
export function domain(value: string): string | null {
  const text = value.trim().toLowerCase().replace(/\.$/, '');
  if (!text || /[\s/:@*]/.test(text)) return null;
  try {
    const hostname = new URL(`https://${text}`).hostname;
    return hostname.split('.').every(part => /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(part)) ? hostname : null;
  } catch { return null; }
}
export function parseSettings(value: unknown): Settings {
  const v = (value && typeof value === 'object' ? value : {}) as Partial<Settings>;
  return {
    enabled: typeof v.enabled === 'boolean' ? v.enabled : defaults.enabled,
    siteMode: v.siteMode === 'block' ? 'block' : 'allow',
    domains: Array.isArray(v.domains) ? v.domains.filter((x): x is string => typeof x === 'string').map(domain).filter((x): x is string => x !== null) : [...defaults.domains],
    reopenAfterPaste: v.reopenAfterPaste === true,
    maxCharacters: typeof v.maxCharacters === 'number' && Number.isSafeInteger(v.maxCharacters) && v.maxCharacters > 0 ? v.maxCharacters : null,
  };
}
export function allowed(host: string, settings: Settings): boolean {
  const normalized = domain(host);
  if (!settings.enabled || !normalized) return false;
  const matches = settings.domains.some(d => normalized === d || normalized.endsWith(`.${d}`));
  return settings.siteMode === 'allow' ? matches : !matches;
}
export async function loadSettings(): Promise<Settings> {
  return parseSettings((await chrome.storage.local.get('settings')).settings);
}
