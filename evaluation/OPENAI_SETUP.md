# Private OpenAI API setup on Windows

The evaluation integration has completed development runs with GPT-6 Astra and GPT-6 Luna on the user's account; see [results](RESULTS.md). This uses an OpenAI API account, not a ChatGPT conversation/session. A different account still needs its own key, billing, and model access. These PowerShell instructions are separate from the extension's session-only key setup in [DEVELOPMENT.md](../docs/DEVELOPMENT.md#configure-gpt-6-luna).

## Add your key privately

1. Create a project API key in your [OpenAI API account](https://platform.openai.com/api-keys). Keep its permissions limited to what this evaluation needs (model responses). Never send the key through chat, screenshots, issues, or commits.
2. Open **your own Windows PowerShell terminal**, not an assistant-controlled interactive session, and run:

```powershell
Set-Location 'C:\Users\liste\OneDrive\Documents\projects\extension-CheckForAICopyPaste'
.\evaluation\openai-credentials.ps1 -Action Save
```

3. Paste the key into the hidden prompt and press Enter. It is not entered as a shell command and is not printed. Save makes no network requests. If you copied it, clear it from your clipboard/history afterward as appropriate.
4. Verify presence without displaying or decrypting the key:

```powershell
.\evaluation\openai-credentials.ps1 -Action Status
```

If PowerShell blocks scripts, do not disable machine-wide execution policy. Share the error **without the key** so we can choose an appropriate way to run the local helper.

The encrypted file is `%LOCALAPPDATA%\CheckForAICopyPaste\openai-key.dpapi`, outside the repository and its OneDrive folder. Windows DPAPI protects it for your Windows account. This is not protection against software already running as you or a compromised account. During an authorized run, the key must exist in process memory. It is temporarily exposed to the child Node process as `OPENAI_API_KEY`, never passed as a command-line argument or stored as a persistent environment variable. The prior process variable is restored after the run. Do not enable shell tracing or record your credential-entry session.

Saving again replaces the local encrypted copy. To remove it, run `-Action Remove`; to revoke it, use the OpenAI account dashboard. Neither action implies the other.

## Preview and run

Replace `MODEL_ID` with a model agreed for this experiment. No default paid model is silently selected. Start with the preview, which reads no saved key and makes no network request:

```powershell
.\evaluation\openai-credentials.ps1 -Action Run -Model MODEL_ID -Limit 1
```

Only when ready for a paid request, add `-Send`:

```powershell
.\evaluation\openai-credentials.ps1 -Action Run -Model MODEL_ID -Limit 1 -Send
```

After verifying the first case, `-Limit 20 -Send` runs the development split (19 requests plus one empty-input short-circuit). Limit means the first N development cases. The held-out split and unscored review case are never selected. Full-input text and the shared prompt are sent to OpenAI; labels and rationales are not sent. Each case is independent.

Each call allows at most 8,192 output tokens, including reasoning where applicable. The runner has a 120-second timeout, no retries, and stops after the first error or invalid output. Timed-out requests may still be billed. Limits bound request count and output tokens, **not dollar spend**; review the chosen model's pricing before using `-Send`. Input usage is also billable. Model-specific reasoning/sampling settings currently use provider defaults and are disclosed in the run file; they are not equivalent to Ollama's temperature/seed settings.

The endpoint is fixed to `https://api.openai.com/v1/responses`, redirects are rejected, and there are no tools, conversation continuation, or automatic cloud fallbacks. `store:false` disables response storage for later API retrieval; it is not a promise of zero provider retention. Review your account's applicable data policies.

Results use the same exact-span validator/scorer as Ollama and record model returned by the API, prompt/dataset/source hashes, usage, timing, and failures. Result files `evaluation/results/openai-*.json` are Git-ignored pending review. Raw final outputs may contain excerpts of the public development corpus. Do not adapt this tool to collect private browsing drafts automatically. Errors never log request headers or raw HTTP error bodies. Missing pricing is represented as unavailable, not zero cost.

## Offline verification

```powershell
node --test evaluation/validate.test.mjs evaluation/score.test.mjs evaluation/openai-client.test.mjs
node evaluation/run-openai.mjs --model MODEL_ID --limit 20
```

Tests use a dummy credential and mocked responses; they cannot establish account/model access or actual API schema acceptance. Start with a one-case smoke test on a new setup. If an assistant execution environment cannot see the encrypted file that your terminal sees, run the helper in your own terminal; do not copy the credential into the repository or chat.

Implementation references: [OpenAI quickstart](https://developers.openai.com/api/docs/quickstart), [Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [Responses API reference](https://developers.openai.com/api/reference/resources/responses/methods/create).
