# Development roadmap

This roadmap reflects the agreed [product design](DESIGN.md). The foundation, Luna integration, and quiet Reddit notice are implemented. The user has verified the core Reddit post-body flow in Edge; broader browser acceptance remains in progress. Ollama is deferred. Contextual model analysis is a core capability.

## 1. Establish the evaluation set

Status: [seed dataset v0.1.1](../evaluation/README.md) contains 40 labeled cases, development/evaluation splits, an annotation policy, and executable integrity checks, plus one unscored ambiguous review case. Development labels are accepted as a provisional baseline. A local Ollama runner and tested scorer now support [initial Qwen development measurements](../evaluation/RESULTS.md). These measurements are not held-out results; further configuration work, model comparisons, and reserved evaluation remain outstanding.

Create labeled examples with expected exact passages and intentional no-finding cases. Include the real MS-03 drafting-commentary example, introductions, closing offers, prompts, clear placeholders, middle-of-draft leftovers, ordinary explanations, intentional AI quotations, code blocks, and ambiguous short inputs.

Test representative models before committing to a large rule system. Measure false alarms, missed findings, passage accuracy, output validity, response time, and cloud usage. Record model/configuration details. Keep separate evaluation cases from examples used to tune prompts. Quantitative release thresholds remain to be chosen from evidence, not invented in advance.

## 2. Build the extension foundation

Status: implemented with automated state/DOM checks, TypeScript validation, and an esbuild Manifest V3 package. Edge installation is user-verified. See [local build and test instructions](DEVELOPMENT.md). The generic editor adapter uses removal as a draft boundary; Reddit-specific rerender preservation still needs validation.

Set up the proposed TypeScript/Manifest V3 build and a local editor test page. Establish independent input state, paste-triggered checks, outdated-result rejection, local removal of stale findings, and per-draft dismissal. Implement the shared site configuration with Reddit-only POC defaults. Exclude sensitive fields.

Keep editor integration, check scheduling, providers, UI, and settings separable. Add meaningful automated checks for detection contracts and state transitions.

## 3. Integrate contextual detection

Status: GPT-6 Luna is implemented with explicit cloud consent, optional API host permission, session-only keys, connection/sample tests, exact-excerpt validation, bounded requests, and a narrow basic fallback. The user verified the live sample in Edge. Ollama/local-provider setup is deferred, so the full milestone is not complete. See [provider setup](DEVELOPMENT.md#configure-gpt-6-luna).

Build one local-service and one cloud-provider integration, chosen after compatibility and quality evaluation. Provide model setup, connection/sample testing, cloud opt-in, credential handling, and limited basic mode. Enforce exact-passage validation, input limits, bounded requests, and honest failure status. Do not silently truncate or change providers.

## 4. Deliver the quiet Reddit POC

Status: the user verified post-body detection, exact excerpts with Dismiss only, stale-excerpt removal, dismissal across pastes, and reset after clearing in Edge. Themes, sizes, accents, and offscreen hiding are implemented. Comment editors, title/body independence, scrolling, submission/replacement behavior, Chrome, and accessibility still need manual validation. Sensitivity presets and a current-site quick toggle remain unfinished. See the [Reddit trial checklist](DEVELOPMENT.md#try-the-quiet-popover-on-reddit).

Implement the anchored popover with excerpts and Dismiss only, multiple findings, offscreen behavior, and accessible interaction. Add toolbar status, site controls, sensitivity configuration, size limits, and the repeat-paste setting. Start appearance customization with themes, size, and presets.

Test Reddit post/comment editors and title/body independence, including dynamic editor replacement, successful and failed submissions, and clearing. Verify the shared build in Chrome and Edge.

### POC acceptance checklist

Checked items below have been verified in the user's Edge post-body flow. Unchecked items may have implementation or automated/development evidence but still need broader acceptance testing. The reserved detection evaluation split is untouched.

- [ ] Catches the final drafting-commentary paragraph in the motivating example without automatically flagging the preceding technical paragraph.
- [ ] Detects clear unfilled placeholders.
- [ ] Stays quiet on intentional quotations and ambiguous cases under conservative defaults.
- [ ] Checks the full affected input after paste; never combines fields or includes surrounding page content.
- [ ] Typing does not initiate model checks; outdated results are discarded.
- [x] Editing/removing flagged passages clears stale findings locally.
- [x] One popover per input shows exact excerpts in order, with only Dismiss as an action (verified on one post-body input).
- [ ] Focus, typing, and submission remain uninterrupted; placement avoids editor controls.
- [x] Dismissal persists for the draft, including subsequent pastes by default.
- [ ] The optional repeat-paste setting permits warnings to return only after another paste.
- [x] Clearing the input resets dismissal.
- [ ] Confirmed submission resets dismissal; failed submission does not (clearing/removal is currently the fallback boundary).
- [ ] Site restrictions, immediate disabling, offscreen behavior, and independent editors work.
- [ ] Oversized inputs are skipped with restrained status, not silently truncated.
- [ ] Model failure falls back only to basic checks, with visible reduced-capability status and no silent cloud/provider switch.
- [ ] Cloud transmission requires opt-in; no persistent draft history, draft logs, or exposed credentials.
- [ ] Detection quality and response time are measured, with limitations documented.

## 5. Prepare a public release

Resolve observed false alarms and editor failures. Document setup, model requirements, costs, privacy/data flow, permissions, limitations, and the distinction between basic and contextual checking. Add a short demo, reproducible build instructions, CI checks, and a packaged GitHub release. Evaluate store submission after reliable browser testing.

Production uses all supported sites by default for new configurations. Preserve existing POC/user choices rather than migrating them to broader access silently. Test additional website integrations before claiming support.

## 6. Expand from evidence

Add providers/sites based on demand and test coverage. Complete individual color and font customization. Evaluate optional formulaic-style findings separately from core leftovers and expose them only as opt-in. Consider browser-native local models where supported. Keep the quiet interaction and privacy boundaries intact as coverage grows.

## Remaining decisions and validation

- Local-provider integration and additional cloud models; Luna Responses is the implemented first provider.
- Held-out validation of the conservative prompt/schema, sensitivity behavior, and release thresholds.
- Tuning the implemented request limits and 25-second timeout; model-capacity estimation.
- Propagating content-script size skips to provider status; Unicode code-point limits are implemented.
- Manual validation of sensitive-field exclusions, permission revocation, and session-key lifecycle.
- Robust excerpt tracking and dismissal preservation across editor rerenders.
- Detailed popover placement, accessibility announcements, and appearance defaults.

These details require prototypes and testing; they do not reopen the agreed product behavior.
