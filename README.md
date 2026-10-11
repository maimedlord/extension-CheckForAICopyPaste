# extension-CheckForAICopyPaste
Alerts you if you accidentally pasted into an input field parts of an AI response you didn't intend to paste.

## Status

The milestone 2 extension foundation is implemented and can be built for local loading in Edge or Chrome. It includes Reddit-only site configuration, paste/input lifecycle handling, and a local mock-checker test page. Live detection and the warning popover are not connected yet.

See [build instructions and Edge testing](docs/DEVELOPMENT.md). Run `npm ci`, `npm run build`, then load the generated `dist` folder as an unpacked extension.

The planned extension acts as a quiet proofreader: after a paste, it checks the full text of that input and displays possible leftovers in an anchored, non-modal popover. The user edits the original field; the popover offers only Dismiss.

- [Product design and agreed behavior](docs/DESIGN.md)
- [Development roadmap and POC acceptance criteria](docs/ROADMAP.md)
- [Detection evaluation set and validation instructions](evaluation/README.md)

The initial proof of concept targets Reddit. Production is intended to support Chrome and Edge, with checks enabled on supported sites by default and configurable site exclusions.

Contextual analysis will support a user-configured local model service or cloud LLM API. A limited basic mode will work without a model. Cloud analysis will require explicit opt-in.

## License

[MIT](LICENSE).
