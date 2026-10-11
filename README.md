# extension-CheckForAICopyPaste
Alerts you if you accidentally pasted into an input field parts of an AI response you didn't intend to paste.

## Status

The extension is a locally installable Reddit POC with opt-in GPT-6 Luna checks, session-only credentials, and quiet anchored notices containing exact excerpts and Dismiss. Cloud mode is off by default. In Edge, the user verified the sample test and Reddit post-body detection, removal of stale excerpts, dismissal across pastes, and reset after clearing. Comment editors, title/body independence, scrolling, and submission behavior still need live verification; Chrome has not been manually verified.

See [build instructions and Edge testing](docs/DEVELOPMENT.md). Run `npm ci`, `npm run build`, then load the generated `dist` folder as an unpacked extension.

After a paste, the extension checks the full text of that input and displays possible leftovers in an anchored, non-modal popover. The user edits the original field; the popover offers only Dismiss.

- [Product design and agreed behavior](docs/DESIGN.md)
- [Development roadmap and POC acceptance criteria](docs/ROADMAP.md)
- [Detection evaluation set and validation instructions](evaluation/README.md)
- [Qwen, Astra, and Luna development results](evaluation/RESULTS.md)

The initial proof of concept targets Reddit. Production is intended to support Chrome and Edge, with checks enabled on supported sites by default and configurable site exclusions.

Contextual analysis currently uses GPT-6 Luna with explicit cloud opt-in and the user's API key. Without cloud, basic mode only detects standalone explicit placeholders. Ollama integration is deferred. See the development guide for permissions, request limits, privacy behavior, and known placement/editor limitations. This is not a store release or a production accuracy claim.

## License

[MIT](LICENSE).
