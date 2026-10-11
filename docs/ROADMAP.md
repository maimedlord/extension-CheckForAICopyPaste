# Development roadmap

This roadmap reflects the agreed [product design](DESIGN.md). Implementation has not begun. The earlier plan to finish a rules-only MVP before exploring models is superseded: contextual model analysis is a core capability and should be evaluated early.

## 1. Establish the evaluation set

Create labeled examples with expected exact passages and intentional no-finding cases. Include the real MS-03 drafting-commentary example, introductions, closing offers, prompts, clear placeholders, middle-of-draft leftovers, ordinary explanations, intentional AI quotations, code blocks, and ambiguous short inputs.

Test representative models before committing to a large rule system. Measure false alarms, missed findings, passage accuracy, output validity, response time, and cloud usage. Record model/configuration details. Keep separate evaluation cases from examples used to tune prompts. Quantitative release thresholds remain to be chosen from evidence, not invented in advance.

## 2. Build the extension foundation

Set up the proposed TypeScript/Manifest V3 build and a local editor test page. Establish independent input state, paste-triggered checks, outdated-result rejection, local removal of stale findings, and per-draft dismissal. Implement the shared site configuration with Reddit-only POC defaults. Exclude sensitive fields.

Keep editor integration, check scheduling, providers, UI, and settings separable. Add meaningful automated checks for detection contracts and state transitions.

## 3. Integrate contextual detection

Build one local-service and one cloud-provider integration, chosen after compatibility and quality evaluation. Provide model setup, connection/sample testing, cloud opt-in, credential handling, and limited basic mode. Enforce exact-passage validation, input limits, bounded requests, and honest failure status. Do not silently truncate or change providers.

## 4. Deliver the quiet Reddit POC

Implement the anchored popover with excerpts and Dismiss only, multiple findings, offscreen behavior, and accessible interaction. Add toolbar status, site controls, sensitivity configuration, size limits, and the repeat-paste setting. Start appearance customization with themes, size, and presets.

Test Reddit post/comment editors and title/body independence, including dynamic editor replacement, successful and failed submissions, and clearing. Verify the shared build in Chrome and Edge.

### POC acceptance checklist

- [ ] Catches the final drafting-commentary paragraph in the motivating example without automatically flagging the preceding technical paragraph.
- [ ] Detects clear unfilled placeholders.
- [ ] Stays quiet on intentional quotations and ambiguous cases under conservative defaults.
- [ ] Checks the full affected input after paste; never combines fields or includes surrounding page content.
- [ ] Typing does not initiate model checks; outdated results are discarded.
- [ ] Editing/removing flagged passages clears stale findings locally.
- [ ] One popover per input shows exact excerpts in order, with only Dismiss as an action.
- [ ] Focus, typing, and submission remain uninterrupted; placement avoids editor controls.
- [ ] Dismissal persists for the draft, including subsequent pastes by default.
- [ ] The optional repeat-paste setting permits warnings to return only after another paste.
- [ ] Clearing/confirmed submission resets dismissal; failed submission does not.
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

## Implementation decisions still open

- Initial local/cloud providers, model choices, and supported API formats.
- Exact build/test tooling and dependency versions.
- Prompt/output schema, sensitivity behavior, and evaluation thresholds.
- Rate limits, timeout values, request coalescing, and capacity estimation.
- Character-count convention and long-input status wording.
- Sensitive-field exclusions, permission requests, and credential persistence policy.
- Robust excerpt tracking and dismissal preservation across editor rerenders.
- Detailed popover placement, accessibility announcements, and appearance defaults.

These details require prototypes and testing; they do not reopen the agreed product behavior.
