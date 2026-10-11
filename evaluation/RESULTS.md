# Detection development results

## OpenAI comparison

Runs completed October 10, 2026 in America/New_York (UTC filenames begin October 11). Both used the revised development prompt, dataset 0.1.1, strict structured output, 8,192 maximum output tokens, provider-default reasoning, independent Responses calls, a 120-second timeout, and no retries. Each full run includes 19 API requests and one locally handled empty input. These are single development runs, not held-out or production accuracy estimates.

| Metric | GPT-6 Astra | GPT-6 Luna |
| --- | ---: | ---: |
| Exact-span cases, all attempts | 20/20 | 19/20 |
| Invalid responses | 0 | 0 |
| False alarms / valid negative cases | 0/10 | 0/10 |
| Entirely missed positive cases | 0/10 | 0/10 |
| Exact passage precision | 13/13 | 12/12 |
| Exact passage recall | 13/13 | 12/13 |
| Categories correct on matched passages | 13/13 | 11/12 |
| Median API-call wall time | 2,258 ms | 1,288 ms |
| Input tokens | 12,904 | 12,904 |
| Output tokens | 781 | 1,607 |

Luna omitted the checker-directed instruction in dev-009, while correctly finding its date placeholder. This is a partial miss, so the complete-case miss metric remains zero. In dev-002, Luna found the correct passage but categorized it as placeholder instead of drafting_instruction. The case exact-match metric measures spans separately from categories. Both models found the motivating MS-03 passage in dev-005.

Reviewed local run filenames: `openai-development-2026-10-11T02-49-43.660Z.json` (Astra) and `openai-development-2026-10-11T02-53-54.810Z.json` (Luna). Cloud raw records remain Git-ignored; this summary was checked against those records. The separate Astra smoke test used 667 input/63 output tokens and matched dev-001 exactly in 3,809 ms. Costs are not computed by the runner; `apiCost:null` does not mean free usage.

Luna is the initial extension provider based on this development comparison. The missed instruction, category error, small authored dataset, and absence of reserved evaluation results limit that choice. Extension behavior is also a different configuration: its network timeout is 25 seconds, with request limits and basic fallback. The user subsequently verified the Edge sample and core Reddit post-body lifecycle; see [manual validation](../docs/DEVELOPMENT.md#user-verified-in-edge-october-11-2026).

## Local Qwen development baseline

Run on October 10, 2026 (America/New_York); raw filenames use UTC and therefore start with October 11. These are development measurements on a small authored set, not held-out performance or production guarantees. The reserved evaluation split and unresolved review case were not submitted.

## Setup

- Native Windows Ollama 0.40.2 on localhost port 11435; cloud disabled.
- Qwen 3.5 9B, Q4_K_M, model digest `56671c2ab9385f9cfcb404638e32cd62d88e3501d44822208363c010179a3c90`.
- Download size: 6,550,825,550 bytes. Loaded model memory reported by Ollama: 5,828,646,010 bytes, all in VRAM.
- NVIDIA RTX 5080, 16 GB VRAM, driver 610.88; 64 GiB installed system RAM.
- Dataset 0.1.1; 20 development cases, 10 positive and 10 negative, 13 gold passages.
- Frozen initial prompt with no few-shot examples, structured JSON output, temperature 0, seed 42, 8,192-token context, 1,536-token generation cap, sequential requests, 120-second timeout, no retries.
- An empty-input negative is short-circuited locally. Every other case makes a fresh independent request. Labels and rationales are not sent.

## Thinking disabled

Raw record: [development-2026-10-11T02-02-50.627Z.json](results/development-2026-10-11T02-02-50.627Z.json).

| Metric | Result |
| --- | --- |
| Valid cases including empty short-circuit | 19/20 |
| Entire case has exact expected spans, all attempts | 11/20 |
| False alarms on negative cases | 5/10 (5/9 nonempty negatives) |
| Completely missed positive cases among valid cases | 1/9 |
| Exact passage precision among valid cases | 8/14 (57.1%) |
| Exact passage recall among valid cases | 8/12 (66.7%) |
| Correct categories among exact matched spans | 7/8 |
| Median valid model-call wall time | 291 ms |
| First cold request | 42.81 seconds |

The rejected case is excluded from valid-only passage metrics; it must not be mistaken for successful silence. Errors count as unsuccessful in the 11/20 all-attempt exact score. A positive case with some missing passages is a partial failure even when it is not a complete case-level miss.

### Observed failures

- **dev-001:** marked the entire draft as commentary instead of only its introduction and closing offer.
- **dev-005:** returned no finding for the real MS-03 drafting explanation.
- **dev-007:** replaced the curly apostrophe in `Here’s` with a straight apostrophe. Exact-text validation rejected the finding rather than silently repairing it.
- **dev-009:** identified the checker-directed instruction but missed the date placeholder.
- **dev-011 / dev-013:** flagged legitimate instructions to readers in discussions of AI leftovers and templates.
- **dev-014:** flagged an intentional placeholder inside a code example.
- **dev-016:** flagged the ambiguous standalone prompt despite the conservative label.
- **dev-020:** treated `[approximately]` as an unfinished placeholder.

The revised dev-012 repair-guide example remained quiet, as did dev-017 and dev-018. This baseline is fast once loaded but too noisy for the agreed quiet-proofreader experience, and it fails the motivating semantic example. It does not establish that a larger model or any particular prompt adjustment will solve those problems.

## Thinking enabled, same generation budget

Raw record: [development-2026-10-11T02-04-03.874Z.json](results/development-2026-10-11T02-04-03.874Z.json).

Only the thinking switch changed; the prompt, labels, and 1,536-token generation budget stayed the same. The model was already warm. Results:

- 8/20 valid cases including the empty short-circuit; 12 incomplete responses exhausted the generation cap.
- 7/20 all-attempt exact successes.
- The MS-03 example still returned no finding.
- Median wall time among the seven valid model calls: 4.315 seconds. Truncated requests took about 12.3–12.6 seconds and are excluded from that valid-call median, not from the failure totals.
- Among valid cases only: 0/5 negative false alarms, 1/3 positive complete misses, 2/2 exact passage precision, and 2/3 exact passage recall. These tiny, selectively completed subsets cannot establish better accuracy than the non-thinking run.
- Provider-reported usage: 6,825 input and 23,702 generated tokens, versus 6,863 input and 508 generated tokens with thinking disabled. Generated tokens include thinking; traces were not stored.

This configuration is not suitable as shipped. A larger thinking budget could improve completion but would be a separate experiment and may add latency. This test does not measure the model's unconstrained reasoning quality.

## Follow-up interpretation

Do not revise the accepted labels to agree with these outputs. Review systematic errors, improve the development prompt or configuration, and retain this run as the initial baseline. Any reasoning-mode comparison must account for the shared generation cap: thinking consumes tokens before the final answer and can cause incomplete output. A larger budget is a separate experiment with different latency expectations.

## Revised prompt and increased budget

The second prompt distinguishes intended audience content from commentary about constructing a draft; prioritizes intentional quotations, templates, and code; defines explicit unfilled slots; asks for a full scan for independent findings; and reinforces literal excerpt copying. No case text, labels, or model weights changed. No few-shot answers were added, but this prompt was informed by development errors, so improvement is in-sample tuning.

The generation cap increased from 1,536 to 4,096 tokens. The context window increased from 8,192 to 16,384 to reserve space for input, schema, deliberation, and final output. Temperature, seed, timeout, and retry policy are unchanged. Prompt and budget changed together versus the original runs, so those effects cannot be attributed independently. The two revised runs differ only in the thinking switch.

Records:

- [Revised prompt, thinking on](results/development-2026-10-11T02-13-59.081Z.json)
- [Revised prompt, thinking off](results/development-2026-10-11T02-20-12.612Z.json)

| Metric | Original, thinking off | Original, thinking on | Revised, thinking off | Revised, thinking on |
| --- | ---: | ---: | ---: | ---: |
| Exact cases / all attempts | 11/20 | 7/20 | 12/20 | 13/20 |
| Errors | 1 | 12 | 2 | 6 |
| False alarms / valid negatives | 5/10 | 0/5 | 0/9 | 0/9 |
| Complete misses / valid positives | 1/9 | 1/3 | 6/9 | 1/5 |
| Exact passage precision, valid only | 8/14 | 2/2 | 4/4 | 5/5 |
| Exact passage recall, valid only | 8/12 | 2/3 | 4/12 | 5/6 |
| Median valid model-call latency | 291 ms | 4,315 ms | 209 ms | 7,932 ms |

All exact-case and valid-negative counts include one local empty-input short-circuit. Latency excludes that case and errors. Valid-only metrics have different denominators because failures remove cases, so they cannot be compared as if every request succeeded. Thinking-on truncations with the revised configuration took approximately 33–36 seconds.

### What improved and what regressed

- Revised thinking-on completion rose from 8/20 to 14/20; exact case success rose from 7/20 to 13/20. It now completes and correctly handles the repeated placeholders, standalone placeholder, quoted AI discussion, shared template, code example, and bracketed ordinary prose.
- Six thinking-on cases still exhausted all 4,096 generated tokens: dev-001, dev-004, dev-007, dev-008, dev-009, and dev-016. These are failures, not conservative abstentions.
- Both revised modes still missed the final MS-03 drafting explanation (dev-005).
- Thinking-off became too conservative: it returned no findings on dev-001, dev-004, dev-005, dev-007, dev-008, and dev-009. Its correct valid positive findings were placeholders only.
- Thinking-off dev-002 included a legitimate announcement as a placeholder and assigned it a nonexistent second occurrence. Dev-020 similarly labeled ordinary brackets as placeholders with a nonexistent occurrence. Both responses were rejected in full. The zero false-alarm figure among valid negatives must not hide the attempted false alarm on invalid dev-020.

The larger budget and revised prompt are not a production-ready improvement: fewer completed false alarms come with incomplete results, missed commentary, and higher reasoning latency. Do not promote the prompt on the strength of a 13/20 score. Next experiments should separate prompt changes from generation settings, investigate completion/output reliability, and compare another configuration or model if contextual detection remains weak. Preserve the reserved evaluation split until a candidate is selected using development data.
