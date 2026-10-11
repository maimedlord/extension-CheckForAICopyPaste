# Extension development (milestones 2–4)

This build can be loaded locally in Edge or Chrome. The foundation, GPT-6 Luna integration, and quiet warning popover are implemented for initial Reddit testing. Cloud is off by default; once explicitly enabled, eligible Reddit pastes can make billable requests. Ollama is deferred. The user confirmed the live Edge sample returned both expected excerpts (654 input, 103 output tokens); this verifies the provider path, not Reddit editor compatibility.

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

The manifest grants content-script access only to HTTPS Reddit pages and subdomains. OpenAI host access is optional and requested only when enabling cloud. There is no all-sites permission, clipboard permission, or remote code. Domain lists include subdomains using a dot boundary. Stored settings are preserved rather than overwritten on startup. Switching the configuration to block-list mode does not expand browser permissions. Preferences persist; keys use trusted-context session storage. Draft text and findings stay in memory and are not logged.

Checks read the full resulting input after the browser's paste action. Typing only invalidates/updates local state. Plain text inputs, textareas, and editable HTML hosts are supported by the generic adapter. Passwords and non-text input types are excluded, as are disabled/read-only/inert fields, sensitive autocomplete values, and fields with credential/card identifiers. Exclusions are conservative heuristics, not a guarantee that every sensitive custom widget can be identified.

## Remaining browser validation

Automated DOM tests are not a live Edge/Reddit certification. The user confirmed Edge installation, the live Luna sample, and the Reddit post-body checks listed below. Comment editors, title/body independence, offscreen scrolling, submission success/failure, dynamic editor replacement, composition timing, and Chrome remain unverified. The generic adapter ends a draft when its editor is removed; it cannot yet distinguish a framework replacement of the same draft from a genuinely new draft. It does not infer success from a submit click. Clearing the input resets the draft; a failed submission that retains its editor should retain dismissal, but this still needs live testing.

### User-verified in Edge, October 11, 2026

- Live sample returned both wrapper passages, leaving the meeting sentence unflagged: 654 input and 103 output tokens.
- Reddit post-body paste displayed both excerpts beside the editor, with Dismiss only (screenshot reviewed).
- Removing a flagged sentence removed its stale excerpt.
- Dismissing and pasting again kept the notice hidden.
- Clearing the input and pasting a new sample made the notice return.

These are user-reported manual checks of a single post editor flow, not a claim that all Reddit editors work. No submission was needed for these tests.

The local test page now exercises the same popover as Reddit with its mock checker, alongside diagnostic controls; it never calls the cloud. Existing PowerShell evaluation credentials are not imported into the extension.

## Try the quiet popover on Reddit

1. Reload the extension in `edge://extensions`, then refresh Reddit. Reloading clears the session API key; re-enter it privately in extension settings. Check that cloud mode remains enabled.
2. Open a comment or post editor and paste the sample from the settings page. A notice should show its introduction and closing offer, leaving the meeting sentence unflagged. Posting the draft is unnecessary.
3. Edit away a flagged passage: it should disappear locally without an API call. Dismiss the notice and paste again: it should remain hidden unless repeat-paste reopening is enabled. Clear the draft to reset dismissal.
4. Verify title and body independence, scrolling out of view and back, and ordinary typing without additional model checks. Exercise any submission failure only in a suitable test context; a submit click alone must not reset dismissal.

Notices use isolated shadow styles, plain text excerpts, system fonts, a modest scrollable height, an anchor pointer, and one Dismiss button. They do not use modal semantics, focus traps, automatic focus, or assertive announcements. Keyboard dismissal returns focus to the editor. Appearance settings offer system/light/dark, three text sizes, and warm/neutral accents; save them in options and preview on the mock page.

Placement prefers a side gutter, then above or below the input, avoiding visible document controls and other notices. When no safe space is available the notice is hidden until a scroll/resize provides room. This is deliberately conservative and can hide warnings in cramped layouts. Known remaining validation includes zoom/mobile-sized layouts, site overlays/top-layer dialogs, controls inside shadow roots, screen readers, and editor replacement. These limitations prevent claiming milestone 4 fully accepted or production-ready. Sensitivity presets beyond the evaluated conservative behavior and the current-site quick toggle remain follow-up work.

## Configure GPT-6 Luna

1. Rebuild and reload the extension, then refresh Reddit tabs.
2. Open extension options. Enter your API key in the password field and select **Use key for this session**. The field clears immediately; the key is stored in `chrome.storage.session`, restricted to trusted extension contexts, never synced or returned to content scripts. Browser restart or extension reload clears it. **Forget key** removes this copy, not the key in your OpenAI account.
3. Read and select the cloud transmission checkbox, then **Apply cloud setting**. Approve the optional `api.openai.com` permission in the browser. Site permission alone does not enable cloud analysis.
4. **Test connection** sends a fixed short neutral sentence through Responses; **Test sample** sends the displayed drafting-leftover sample. Both are explicit, potentially billable requests using the configured key, never current webpage text. The result displays status, exact findings, and reported input/output tokens. Connectivity is not a detection quality guarantee. Turning cloud off prevents both tests and automatic requests; basic mode remains available.
5. The toolbar/options status shows the most recent provider result across tabs, with no draft text or findings persisted. It is a provider diagnostic, not a per-input notice.

The extension uses `gpt-6-luna`, the same conservative development prompt (copied verbatim to `src/detection-prompt.txt`), strict JSON schema, 8,192 maximum output tokens, provider-default reasoning, no tools, no response continuation, and `store:false`. This is not a zero-retention claim. Destination is fixed to `https://api.openai.com/v1/responses`; redirects are rejected. See [Luna documentation](https://developers.openai.com/api/docs/models/gpt-6-luna) and [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

The service worker rechecks sender identity, HTTPS Reddit domain, top frame, site settings, consent, key presence, and optional permission. Only the extension options page can configure credentials or request sample tests. Checks are limited to two concurrent requests and twelve admissions per minute, with no automatic retries or queue. Rate timestamps survive worker suspension in session storage. Each request times out after 25 seconds; an aborted or timed-out request may still incur charges. Edits send cancellation messages, and stale results are discarded. Configuration changes cancel pending requests. The transport safety limit is 100,000 UTF-8 bytes plus the optional user character limit; oversized inputs are skipped in full. This is a transport bound, not a model token-capacity guarantee; provider capacity errors use basic fallback and report the failure.

Basic mode only identifies an entire standalone bracketed instruction such as `[insert your name]`. It does not detect contextual commentary or scan embedded placeholders. Missing keys/permissions, provider failures, refusals, malformed output, and request limits report reduced capability and use this limited fallback. There is no silent provider switch. Categories are validated but findings sent to editor state contain only exact excerpt positions/text.

Automated coverage includes mocked Responses requests, malformed/refused output, credential-message authorization, cloud opt-in, site checks, permission denial, rate limiting, early cancellation, and consent revocation during a request. Automated tests make no paid requests. The user subsequently verified the live Edge sample and post-body flow above. Browser-restart credential clearing, permission revocation, and failure states still need manual checks.

Current status limitations: skips caused by the content-script character limit do not yet update the toolbar's provider status. Provider status is the last background check across tabs and can be stale for the current input. Textarea values changed by site scripts without input events are rechecked before model results attach, but changes made after a result may wait for a later observed event to clear findings. Settings changes cancel active provider requests; even appearance changes during a pending request can discard that request. Positioning avoids recognized document controls but can cover ordinary sidebar content.
