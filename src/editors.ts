export type Editor = HTMLInputElement | HTMLTextAreaElement | HTMLElement;
export function editorFor(target: EventTarget | null): Editor | null {
  if (!(target instanceof HTMLElement)) return null;
  const candidate = target.closest<HTMLElement>('input, textarea, [contenteditable]');
  if (!candidate) return null;
  let editor = candidate;
  if (!(editor instanceof HTMLInputElement) && !(editor instanceof HTMLTextAreaElement)) {
    if (!editor.isContentEditable) return null;
    while (editor.parentElement?.isContentEditable) editor = editor.parentElement;
  }
  if (editor.closest('[inert], [aria-disabled="true"], [data-proofreader-ignore]')) return null;
  if (editor instanceof HTMLInputElement && !['text'].includes(editor.type)) return null;
  if ((editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement) && (editor.disabled || editor.readOnly)) return null;
  const autocomplete = (editor.getAttribute('autocomplete') ?? '').toLowerCase().split(/\s+/);
  if (autocomplete.some(x => /^(?:.*password|username|one-time-code|cc-.*|email|tel.*|street-address|address-line.*|postal-code|bday.*)$/.test(x))) return null;
  const hints = ['name','id','aria-label','placeholder'].map(a => editor.getAttribute(a) ?? '').join(' ');
  if (/password|passcode|secret|token|api.?key|credit.?card|card.?number|\bssn\b|social.?security|\botp\b/i.test(hints)) return null;
  return editor;
}
export function readEditor(editor: Editor): string {
  return editor instanceof HTMLInputElement || editor instanceof HTMLTextAreaElement ? editor.value : editor.innerText;
}
