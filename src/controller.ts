import { Draft, unavailableChecker, type Checker } from './state';
import { editorFor, readEditor, type Editor } from './editors';
import { allowed, type Settings } from './settings';
export function mount(settings: Settings, checker: Checker = unavailableChecker, report: (editor: Editor, draft: Draft) => void = () => {}, fixture = false) {
  const states = new Map<Editor, Draft>();
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const enabled = () => fixture ? settings.enabled : allowed(location.hostname, settings);
  const get = (editor: Editor) => {
    let draft = states.get(editor);
    if (!draft) {
      draft = new Draft(async (text, signal) => {
        const result = await checker(text, signal);
        // Scripts can update .value without dispatching input. Check the live editor
        // again before letting a response attach to this draft.
        if (!editor.isConnected || editorFor(editor) !== editor) draft!.invalidate();
        else draft!.edit(readEditor(editor));
        return result;
      }, () => report(editor, draft!));
      states.set(editor, draft);
    }
    return draft;
  };
  const target = (event: Event) => editorFor(event.composedPath()[0] ?? event.target);
  const input = (event: Event) => {
    if (!enabled()) return;
    const editor = target(event);
    if (editor) get(editor).edit(readEditor(editor));
  };
  const paste = (event: Event) => {
    if (!enabled()) return;
    const editor = target(event);
    if (!editor) return;
    // Capture prior text before the browser performs its default paste. Never read
    // clipboardData: the resulting editor content is the only analysis input.
    get(editor).edit(readEditor(editor));
    const timer = setTimeout(() => {
      timers.delete(timer);
      if (!enabled() || !editor.isConnected || editorFor(editor) !== editor) return;
      void get(editor).paste(readEditor(editor), settings);
    }, 0);
    timers.add(timer);
  };
  document.addEventListener('input', input, true);
  document.addEventListener('paste', paste, true);
  const observer = new MutationObserver(() => {
    for (const [editor, draft] of states) {
      if (!editor.isConnected || editorFor(editor) !== editor) { draft.clear(); states.delete(editor); }
      else draft.edit(readEditor(editor));
    }
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['disabled','readonly','contenteditable','type','autocomplete','inert','aria-disabled'] });
  return {
    update(next: Settings) {
      settings = next;
      for (const timer of timers) clearTimeout(timer);
      timers.clear();
      for (const draft of states.values()) draft.invalidate();
    },
    dispose() {
      document.removeEventListener('input', input, true); document.removeEventListener('paste', paste, true);
      observer.disconnect(); for (const timer of timers) clearTimeout(timer);
      for (const draft of states.values()) draft.clear(); states.clear();
    },
  };
}
