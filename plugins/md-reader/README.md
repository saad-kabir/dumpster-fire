# md-reader

A Claude Code mod that makes plans and markdown easier to read in the terminal.

- `/read [path]` opens a markdown file. With no path it opens the current session's plan.
- Inside [herdr](https://herdr.dev) it splits the current pane and shows the file with [glow](https://github.com/charmbracelet/glow) (`glow --pager`). `q` quits and closes the pane.
- Outside herdr it opens a pane inside Claude Code with a Glow-style colored renderer. Hotkeys while the pane has focus: `n`/`p` next and previous heading, `g`/`e` top and end, `q` close.
- When you approve a plan (ExitPlanMode) the plan opens automatically.

## Install

```
/plugin install md-reader --marketplace saad-kabir/dumpster-fire
```

From a shell: `claude plugin install md-reader --marketplace saad-kabir/dumpster-fire`

Requires `glow` for the herdr pane: `brew install glow`.

## Notes

- Colors in the in-Claude pane are hex, so they need a truecolor terminal.
- Not rendered in the in-Claude pane: nested blockquotes, HTML, images, syntax highlighting inside code blocks.
- Manual test plan: [docs/test-plan.md](docs/test-plan.md). Open it with `/read docs/test-plan.md`.
