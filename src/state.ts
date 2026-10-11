import type { Settings } from './settings';
export interface Finding { start: number; end: number; excerpt: string; }
export type Status = 'idle' | 'checking' | 'checked' | 'unavailable' | 'skipped' | 'error';
export interface CheckResult { findings: Finding[]; status: 'checked' | 'unavailable'; }
export type Checker = (text: string, signal: AbortSignal) => Promise<CheckResult>;
// Milestone 2 deliberately has no rules or network provider.
export const unavailableChecker: Checker = async () => ({ findings: [], status: 'unavailable' });
export function validateFindings(text: string, findings: Finding[]): Finding[] {
  let previousEnd = 0;
  return findings.map(f => {
    if (!Number.isInteger(f.start) || !Number.isInteger(f.end) || f.start < previousEnd || f.end <= f.start || f.end > text.length || text.slice(f.start, f.end) !== f.excerpt) throw new Error('Invalid finding');
    previousEnd = f.end;
    return { start: f.start, end: f.end, excerpt: f.excerpt };
  });
}
export class Draft {
  text = '';
  findings: Finding[] = [];
  dismissed = false;
  status: Status = 'idle';
  private version = 0;
  private request?: AbortController;
  private checkedText?: string;
  constructor(private checker: Checker, private changed: () => void = () => {}) {}
  get visible(): Finding[] { return this.dismissed ? [] : this.findings; }
  edit(next: string): void {
    if (next === this.text) return;
    this.cancel();
    const before = this.text;
    let start = 0;
    while (start < before.length && start < next.length && before[start] === next[start]) start++;
    let oldEnd = before.length, newEnd = next.length;
    while (oldEnd > start && newEnd > start && before[oldEnd - 1] === next[newEnd - 1]) { oldEnd--; newEnd--; }
    const delta = newEnd - oldEnd;
    // Preserve only passages entirely outside the changed range. Ambiguous multi-edit
    // updates conservatively remove findings rather than attaching them to other text.
    this.findings = this.findings.flatMap(f => {
      if (f.end <= start) return [f];
      if (f.start >= oldEnd) return [{ ...f, start: f.start + delta, end: f.end + delta }];
      return [];
    }).filter(f => next.slice(f.start, f.end) === f.excerpt);
    this.text = next;
    this.checkedText = undefined;
    this.status = 'idle';
    if (!next.trim()) { this.findings = []; this.dismissed = false; }
    this.changed();
  }
  async paste(text: string, settings: Settings): Promise<void> {
    this.edit(text);
    if (settings.reopenAfterPaste) this.dismissed = false;
    if (!text.trim()) { this.changed(); return; }
    if (settings.maxCharacters !== null && [...text].length > settings.maxCharacters) {
      this.cancel(); this.findings = []; this.status = 'skipped'; this.changed(); return;
    }
    if (this.checkedText === text) { this.changed(); return; }
    this.cancel();
    const version = this.version;
    const request = this.request = new AbortController();
    this.status = 'checking'; this.changed();
    try {
      const result = await this.checker(text, request.signal);
      if (version !== this.version || request.signal.aborted) return;
      this.findings = validateFindings(text, result.findings);
      this.status = result.status;
      this.checkedText = text;
    } catch {
      if (version !== this.version || request.signal.aborted) return;
      this.findings = []; this.status = 'error';
    }
    this.changed();
  }
  dismiss(): void { this.dismissed = true; this.changed(); }
  invalidate(): void { this.cancel(); this.findings = []; this.checkedText = undefined; this.status = 'idle'; this.changed(); }
  cancel(): void { this.version++; this.request?.abort(); this.request = undefined; }
  clear(): void { this.cancel(); this.text = ''; this.findings = []; this.dismissed = false; this.checkedText = undefined; this.status = 'idle'; this.changed(); }
}
