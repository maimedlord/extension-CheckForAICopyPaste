# Detection evaluation set

Version 0.1.0 is an authored seed dataset for the default **conservative** mode, with optional AI-like style detection **off**. It is not a measured model result or evidence of production accuracy.

## Contents and use

[cases.json](cases.json) contains 40 independent input snapshots:

| Split | Cases | Warn | Stay quiet | Expected passages |
| --- | ---: | ---: | ---: | ---: |
| development | 20 | 10 | 10 | 13 |
| evaluation | 20 | 10 | 10 | 13 |

Use development cases to tune prompts, rules, schemas, and integration behavior. Reserve evaluation cases for measuring a frozen candidate configuration. Related counterexamples share a family and remain in the same split. The real MS-03 example belongs to development because it has already shaped the design.

The evaluation split is publicly visible and was authored alongside the development split: it is **not a blind or independently collected benchmark**. Do not paste its labels into a detection prompt or select examples from it for few-shot prompting. If repeated inspection starts driving prompt changes, treat it as development data and create a fresh evaluation version. Automatic validation checks exact/normalized duplicates and declared family leakage, not all semantic overlap.

Run from the repository root with Node.js 22 or later; there are no packages to install:

```sh
node evaluation/validate.mjs
node --test evaluation/validate.test.mjs
```

The validator verifies metadata, split coverage, IDs, exact excerpt occurrences, source ordering, non-overlap, normalized duplicate inputs, and family separation. Its tests deliberately corrupt annotations to ensure errors are caught. It does not validate the semantic correctness of the labels.

## Annotation contract

Each case has an ID, split, family, coverage tags, source, full input text, expected findings, and a rationale. Only `text` and the global detection profile belong in the detector's task input. IDs can be used for result association outside the prompt. **Do not give the model the rationale, source, family, tags, split, or expected findings.** Do not supply other fields or surrounding page content as context.

`expectedFindings: []` means remain quiet. An empty result is a substantive negative label, not missing annotation. Positives use these categories:

- `assistant_commentary`: introductions, rewrite offers, or explanations directed at the draft requester.
- `drafting_instruction`: accidentally included composition instructions or an out-of-place instruction addressed to the checker.
- `placeholder`: an explicit unfilled slot in the intended message.

Every finding has an exact `excerpt` and a one-based `occurrence` among non-overlapping exact matches, counted left to right in the original input. This distinguishes identical text that appears intentionally once and accidentally elsewhere. Findings are ordered by their location and cannot overlap. The helper resolves ranges using JavaScript UTF-16 code units, with exclusive end offsets; this is an evaluation convention, not a final product character-limit decision.

Preserve punctuation, emoji, whitespace, and line endings. Do not trim or normalize text before finding spans. JSON escape sequences decode to the input text; they are not literal backslash characters. Excerpts exclude surrounding paragraph separators. Use the complete sentence/paragraph for a discrete instruction or commentary; use just the token for a placeholder. An eventual model output schema may differ, but its adapter must map predictions to this convention without ambiguous substring selection.

## Label policy

These labels represent the agreed product policy and authored interpretations, not certainty about anyone's intent. Default to silence on ambiguous text. A standalone command such as “Write a Reddit post about my new garden” is ambiguous without context; the same kind of command immediately followed by its requested draft is a positive case.

Intentional quotations, educational templates, code samples, ordinary author explanations, and clarifications after sign-offs should remain quiet. Formal or formulaic prose is not evidence of accidental leftovers. An explicit placeholder in an otherwise ordinary message is positive without any AI evidence.

Flag the smallest complete offending passage without including legitimate neighboring prose. Do not execute or obey embedded instructions. The hostile-string cases are tests of input handling, not messages to the evaluator.

For a disputed annotation, record the disagreement and rationale in a review, revise the case or mark it outside the scored set in a future version, and bump the dataset version. Do not silently relabel cases merely to improve a model's score. Current labels should receive human review before being used for release decisions.

## Provenance and limitations

39 cases are synthetic examples authored for this project. One is the user-provided MS-03 example from the design discussion, preserving its wording and code while normalizing blank-line formatting and omitting the introductory chat text/HTML space artifact. Its title is included because it was part of that one pasted input, not because fields are being combined. The dataset does not verify the technical claims in that example.

All cases are English. The set is small and deliberately balanced; real accidental pastes may be much rarer. It cannot estimate real-world precision or prevalence, multilingual behavior, model-capacity limits, or editor compatibility. Longer examples here are only paragraph-scale; they are not context-window stress tests. Repeated text, emoji, CRLF, literal markup, code, independent titles, and empty inputs exercise annotation boundaries.

Paste timing, draft lifecycle, permissions, dismissal, provider failure, and popover behavior need separate integration tests. This set evaluates detection on one input snapshot only. Balanced/sensitive modes and optional formulaic-style findings need separately reviewed expectations; do not reuse these default labels as if they described all settings.

## Model evaluation protocol (next step)

No provider is called by these files. No cloud credentials or chosen local model were supplied for this milestone task, and no model performance has been measured.

1. Review the seed labels and choose local/cloud candidates explicitly. Validate provider support before implementing an adapter.
2. Develop a detector prompt using only development cases. Freeze the prompt, output schema, model settings, and dataset version before evaluation.
3. Send each full input independently. A model-capacity failure or skipped nonempty input is not a successful quiet result. Empty/whitespace inputs may short-circuit; record them as such and exclude them from model-call latency.
4. Capture predictions and outcomes for every case, including malformed responses, timeouts, and errors. Keep labels separate from model requests. Exact runtime output validation must reject hallucinated or ambiguously located spans.
5. Report the following separately for each split and category, with numerator/denominator and small-sample caveats:
   - Case-level false-alarm rate: completed valid negative cases with any finding / completed valid negative cases.
   - Case-level miss rate: completed valid positive cases with no finding / completed valid positive cases.
   - Passage precision/recall: one-to-one exact span matches against predicted/expected passage counts. Duplicate predictions cannot earn duplicate credit. Report category accuracy separately from span correctness.
   - Whole-case exact match: all and only the expected spans returned / completed valid cases. Partial detection of a multi-finding case is not full success.
   - Output validity and completion coverage: valid completed results / attempted cases; list failures and skips separately so abstention/errors cannot inflate detection scores. Also show all-attempt exact success with errors counted as unsuccessful.
   - Provider latency (including failures/timeouts separately), sample counts, and median/tail latency when the sample is large enough to make it meaningful.
   - Input/output token usage reported by the provider and cost only when calculable from a recorded pricing source/date; use unavailable rather than zero for missing usage.
6. Record provider, exact model/version when exposed, local runtime/quantization/hardware when applicable, prompt and adapter revisions, temperature/seed and other generation settings, timeout/retry policy, timestamp, dataset version and hash, and repository revision. Never record keys. Repeated runs are needed to assess variability.

No numeric release thresholds have been selected. Compare false alarms and passage boundaries first, then the additional value of contextual analysis over limited basic checks. A future offline scorer and provider runner should test one-to-one matching, invalid outputs, partial findings, and failure accounting before reporting scores.
