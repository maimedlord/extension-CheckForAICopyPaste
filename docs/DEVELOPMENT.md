# Extension foundation (milestone 2)

This build can be loaded locally in Edge or Chrome. It is a lifecycle foundation, not a working AI proofreader: no local/cloud model is connected, no basic detection rules are implemented, and no warning popover is shown on Reddit. Provider integration and the production notice follow in milestones 3 and 4.

## Build and verify

Use Node.js 22 or newer with npm:

```powershell
npm ci
npm run typecheck
npm test
npm run build
```

The generated `dist` directory contains the extension. Build outputs and dependencies are ignored by Git; the lockfile pins dependencies. Tests include existing evaluation checks plus state and DOM integration tests. No test makes a model request or reads credentials.

## Load in Edge

1. Open `edge://extensions` and enable Developer mode.
2. Select **Load unpacked** and choose this project's `dist` directory.
3. Open the extension toolbar panel or its extension options page.
4. Select **Open local editor test page**.
5. After rebuilding, reload the extension in Edge and refresh any test/Reddit tabs.

Microsoft documents [local extension sideloading](https://learn.microsoft.com/en-us/microsoft-edge/extensions-chromium/getting-started/extension-sideloading). Store publication is unnecessary for local testing.

## Local test page

The extension-owned page uses a mock checker that recognizes `[[TEST]]` after a one-second delay. It is explicitly not a detection-quality test. Status, finding counts, and dismiss buttons are test instruments, not the final warning UI.

- Paste text containing `[[TEST]]` into title, body, and rich-text fields; each field is independent.
- Type without pasting: no check should start.
- Paste, then edit before one second passes: the old response must be discarded.
- Edit around a marked passage: its position should shift. Edit inside it: the finding should disappear locally.
- Dismiss and paste again: it should remain dismissed. Enable the repeat-paste setting and paste again to reopen it.
- Clear a field: dismissal should reset for that field.
- Set a small character limit: oversized inputs should be skipped in full. Counts use Unicode code points, while excerpt positions use JavaScript UTF-16 offsets.
- Paste into the password or API-key field: no draft state/check should be created.
- Disable checking in settings: active work is cancelled and findings removed immediately.

## Scope and architecture

`src/state.ts` manages the checker contract, exact excerpts, cancellation, edits, and dismissal. `src/editors.ts` selects eligible editors. `src/controller.ts` wires document events and editor cleanup. `src/settings.ts` implements a shared allow/block configuration. Content scripts and the options/test pages are separately bundled by esbuild into a Manifest V3 package.

The manifest grants content-script access only to HTTPS Reddit pages and subdomains; there is no all-sites permission, clipboard permission, remote code, or network provider. Domain lists include subdomains using a dot boundary. Stored settings are preserved rather than overwritten on startup. Switching the configuration to block-list mode does not expand browser permissions. Only preferences persist; draft text and findings stay in memory and are not logged.

Checks read the full resulting input after the browser's paste action. Typing only invalidates/updates local state. Plain text inputs, textareas, and editable HTML hosts are supported by the generic adapter. Passwords and non-text input types are excluded, as are disabled/read-only/inert fields, sensitive autocomplete values, and fields with credential/card identifiers. Exclusions are conservative heuristics, not a guarantee that every sensitive custom widget can be identified.

## Remaining browser validation

Automated DOM tests are not a live Edge/Reddit certification. Manual Edge loading and the test-page checklist remain to be verified on the user's machine. Milestone 4 must test Reddit's dynamic editors, shadow DOM behavior, composition/paste timing, submission, and editor replacement. The current generic adapter ends a draft when its editor is removed; it cannot yet distinguish a framework replacement of the same draft from a genuinely new draft. It does not infer success from a submit click. Clearing the input resets the draft; a failed submission that retains its editor retains dismissal.

The local test page uses visible diagnostic controls only. Anchored notices, placement, accessibility testing, provider setup, cloud consent, credential storage, fallback behavior, and model status UI remain future work. Existing PowerShell evaluation credentials are not imported into the extension.
