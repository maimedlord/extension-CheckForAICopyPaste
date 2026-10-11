import { mount } from './controller';
import { loadSettings, parseSettings } from './settings';
import type { Checker, Draft } from './state';
import type { Editor } from './editors';
const drafts = new Map<Editor, Draft>();
const checker: Checker = async (text, signal) => {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, 1000);
    signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('Aborted')); }, { once: true });
  });
  return { status: 'checked', findings: [...text.matchAll(/\[\[TEST\]\]/g)].map(m => ({ start: m.index!, end: m.index! + m[0].length, excerpt: m[0] })) };
};
void (async () => {
  const controller = mount(await loadSettings(), checker, (editor, draft) => {
    drafts.set(editor, draft);
    const output = editor.closest('section')?.querySelector('output');
    const value = `Status: ${draft.status}; findings: ${draft.findings.length}; visible: ${draft.visible.length}; dismissed: ${draft.dismissed}`;
    if (output && output.textContent !== value) output.textContent = value;
  }, true);
  document.querySelectorAll('section').forEach(section => section.querySelector('button')!.addEventListener('click', () => {
    const editor = section.querySelector<HTMLElement>('input,textarea,[contenteditable]')!;
    drafts.get(editor)?.dismiss();
  }));
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.settings) controller.update(parseSettings(changes.settings.newValue)); });
})();
