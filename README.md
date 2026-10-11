# extension-CheckForAICopyPaste
Alerts you if you accidentally pasted into an input field parts of an AI response you didn't intend to paste.

## Status

Design documented; the initial detection evaluation set is available. Extension implementation has not started. There is no installable extension yet.

The planned extension acts as a quiet proofreader: after a paste, it checks the full text of that input and displays possible leftovers in an anchored, non-modal popover. The user edits the original field; the popover offers only Dismiss.

- [Product design and agreed behavior](docs/DESIGN.md)
- [Development roadmap and POC acceptance criteria](docs/ROADMAP.md)
- [Detection evaluation set and validation instructions](evaluation/README.md)

The initial proof of concept targets Reddit. Production is intended to support Chrome and Edge, with checks enabled on supported sites by default and configurable site exclusions.

Contextual analysis will support a user-configured local model service or cloud LLM API. A limited basic mode will work without a model. Cloud analysis will require explicit opt-in.

## License

[MIT](LICENSE).
