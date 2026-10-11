# Product design

Agreed design as of October 10, 2026. This document describes intended behavior, not implemented capabilities. Implementation details requiring experiments are identified separately.

## Purpose

Catch assistant commentary, drafting instructions, and clear unfilled placeholders accidentally pasted into a message before publication. The extension is a quiet proofreader: it points out a possible mistake and leaves the user in control.

The core feature does not determine authorship. Polished, generic, or apparently AI-like writing alone is not a finding by default. Users can intentionally quote AI responses; when intent is uncertain, the default behavior is silence.

The project is public and MIT-licensed, both for community use and as a portfolio project. No backend, developer-funded model account, or API key should be needed for basic mode.

## Detection scope

Analyze each eligible input independently. A paste triggers analysis of the entire resulting text of that input, including text present before the paste. Do not combine fields, collect surrounding page content, or inspect clipboard history. Reddit post titles and bodies are separate inputs.

Detect possible leftovers anywhere in the input, not only at the beginning or end:

- Assistant introductions such as “Here is a version you can post.”
- Closing offers such as “Let me know if you would like a shorter version.”
- Accidentally included prompts or drafting instructions.
- Commentary explaining how or why the assistant constructed the draft.
- Clear placeholders such as “[insert your experience here],” even without other AI evidence.

Position and wording are supporting evidence, not proof. A sign-off followed by commentary may indicate a transition from addressing the intended audience to addressing the person who requested the draft. Legitimate quotations, discussions about AI, ordinary explanations, and technical code examples must not automatically trigger findings.

### Motivating example

A user-provided Reddit draft asks about MS-03 IOMMU groups and NIC passthrough. After the questions, a shell command, and “Thanks in advance!”, it includes a technical distinction about PCIe functions and reset behavior, followed by:

> That's why I included both the IOMMU grouping question and a request for successful real-world passthrough experience.

That final paragraph is the clearest candidate: it appears to explain drafting choices to the requester. The preceding technical paragraph could legitimately belong in the post and should not automatically be included in the finding. This is a semantic detection example, not a verification of the hardware claims.

## Checking and draft lifecycle

| Event | Behavior |
| --- | --- |
| Paste into an eligible input | Start a check promptly, subject to site settings, size limits, and provider availability. |
| Ordinary typing or editing | Do not start a new model check. |
| Text changes while analysis is pending | Discard the outdated result. A later paste can initiate a new check. |
| Flagged passage is removed or changed | Use local tracking to remove its stale finding without requesting model analysis. |
| All visible findings are gone | Close the popover. |
| Dismiss | Hide the entire notice for the current draft in that input. |
| Another paste after dismissal | Check again, but suppress the popover by default. |
| Successful submission or cleared input | End the draft and reset dismissal. |

The setting “Show warnings again after another paste” is off by default. When enabled, another paste makes a dismissed input eligible to show findings again. Typing never reopens a dismissed popover. Dismissal is independent for each input and leaves no persistent finding badge.

A Submit click alone is not proof of success. A failed submission retains the draft and its dismissal state. Where successful submission cannot be detected reliably, clearing or replacement of the editor is the fallback boundary. Site-specific testing must distinguish a genuine new editor/draft from a framework rerender of the same draft.

## Finding popover

Use an anchored, non-modal popover that points to the affected input. It contains a short issue label, the exact problematic excerpts in source order, and a single Dismiss button. There are no editing actions, removal buttons, rewrite suggestions, links to settings, or required confirmations in this notice. Users make changes directly in the input.

There is one popover per affected input. Multiple findings share that popover and one dismissal action. Limit its height and allow internal scrolling for many findings.

- Never steal keyboard focus, dim the page, block typing, or block submission.
- Avoid covering input text, editor controls, or submission controls; adapt placement to available space.
- Losing focus does not dismiss the notice.
- Hide it while the input is offscreen; restore it on return unless dismissed.
- Remove it when its input is removed.
- Avoid repeated appearance, resizing, or repositioning while the user types.
- Make the notice and Dismiss action accessible without interruptive announcements.

## Settings

### Site scope

Provide a global on/off switch and two mutually exclusive modes:

1. Check all supported sites except listed domains.
2. Check only listed domains.

Production defaults to the first mode. The development POC uses the second mode with reddit.com and its subdomains. Use the same configuration system for both. Never broaden existing user preferences during an upgrade.

Rules initially apply to domains rather than individual URLs. The UI must make subdomain coverage explicit. Apply changes immediately and remove notices when a site is disabled. A toolbar panel provides current-site status, a quick site toggle, and access to settings. Browser permissions and configured checking scope are distinct and must remain consistent.

All-sites coverage means eligible inputs on supported pages, not all page content. Sensitive fields, including passwords, are excluded. The complete exclusion policy needs implementation review. Enabling a site does not itself authorize cloud transmission.

### Appearance

Planned controls include system/light/dark themes, background/text/border or accent colors, local font choices, and text size. Include a live preview with a sample finding and Dismiss, reset-to-defaults, and feedback for poor contrast. Use system or bundled fonts rather than external font requests.

POC scope can begin with themes, text size, and color presets. Individual colors and font choices may follow. Customization must not change the minimal interaction model.

### Detection model

| Mode | Configuration |
| --- | --- |
| Basic | Limited local rules; no model required. |
| Local model | Address of a running local model service and selected model. |
| Cloud API | Provider, API key, and selected model. |

Start in basic mode until a model is configured. A downloaded model file alone is insufficient: a service must run it. Model-based contextual analysis is central to the intended experience; basic mode must be presented as limited.

Offer Test connection and a sample-text test. Connectivity does not establish detection quality. Show the active mode and a restrained status in the toolbar panel/settings when the model is unavailable, analysis fails, or a check is skipped. These statuses do not belong in the finding popover.

If the configured model fails, continue basic checks and accurately indicate the reduced capability. Never silently switch providers or fall back to cloud. Custom endpoints are an advanced option with a clearly displayed destination.

### Sensitivity and optional style checks

Offer Conservative, Balanced, and Sensitive levels for leftovers and placeholders. Conservative is the default and favors silence when uncertain. These are behavior presets requiring evaluation, not promises of calibrated model confidence.

Separately offer “Also flag AI-like phrasing,” off by default. It expands detection scope rather than merely lowering the leftover threshold. Describe such findings as possibly formulaic phrasing, not evidence that text is AI-written. Explain the increased false-alarm risk. Validate core detection before implementing this optional expansion.

### Input size

Analyze the whole input by default. Allow an optional maximum characters per check. If the input exceeds the configured limit, skip analysis and show a restrained toolbar-panel status. Do not silently truncate, analyze only the beginning/end, or imply a complete check occurred.

Full analysis remains subject to model capacity. If the provider cannot accommodate the input, report that the check could not complete. Character counting conventions and model-capacity checks need implementation decisions.

## Privacy, security, and model handling

Cloud analysis requires explicit enabling of automatic draft transmission to the chosen provider. Identify the destination for local services as well. Local checking can operate without cloud consent. A user-configured remote endpoint must not be presented as local merely because it uses the same API format.

Keep no persistent draft history. Hold text only as needed for active checks and current-draft UI state; exclude draft text and credentials from logs. Do not claim control over an external provider's retention policy.

Never ship or commit developer API keys. Keep user credentials out of webpages and content scripts, restrict access to trusted extension contexts, and do not sync keys as ordinary preferences. Session-only credentials are the proposed initial approach; any persistence needs a deliberate design and accurate user disclosure.

Treat input text as data, including instructions embedded in it. Treat model output as untrusted. Require structured findings with exact excerpts, validate that they exist in the current draft, handle repeated excerpts unambiguously, and reject malformed or stale output. Never execute model output, silently remove text, or render returned markup as trusted HTML.

Bound requests, avoid redundant checks of unchanged text, handle timeouts and provider limits, and prevent retry loops. Rate limits and queue behavior must preserve the intent to check pastes while remaining honest about incomplete checks. Users of cloud APIs bear their provider's charges; provider terms and browser integration support must be checked per integration.

## Architecture and scale

Keep detection providers, input/editor integration, popover rendering, settings, and check/dismissal state separate. Use a shared codebase for Chrome and Edge, with feature detection and browser-specific integration where needed. Proposed tooling is Windows, TypeScript, HTML/CSS, Manifest V3, Node.js/npm, and Git; precise libraries and versions remain undecided.

Start with one local and one cloud integration behind a common provider interface. Basic mode should remain usable without either. Avoid promising universal model support before compatibility testing.

Local analysis and direct user-configured services can limit project-hosted infrastructure, but website/editor compatibility, provider differences, support, and detection evaluation still grow with adoption. Expanding website coverage is a tested capability, not just adding domain permissions.

## Deferred possibilities and non-goals

Copy-source tracking was explored, but is not part of the agreed initial design. There is no clipboard history or cross-site copy tracking. Automatic editing, submission blocking, and typing-triggered model checks are outside the agreed experience.

Broader drafting-leftover detection is included through clear placeholders. General grammar checking, authorship claims, and broad rewriting are not the core product. Store distribution, additional sites/providers, and optional browser-native models follow validation of the POC.
