# poteto

A Claude Code mod that lists the skills in `~/.claude/skills` in a pane you can search.

- `/poteto` opens the pane. The search box has focus, so type straight away. Every word you type has to appear in a skill's name or description.
- The header shows how many skills match out of the total. The matching part of each name is highlighted.
- Arrow keys or Tab move through the list. Enter opens a card with the full description, the file path, **Run /name** (runs the skill and closes the pane), **Copy name** and **Back**.
- Esc closes the pane.

It reads `SKILL.md` frontmatter from each folder in `~/.claude/skills`, following symlinks. Account-synced skills (`~/.claude/skills/synced`), project skills and plugin skills are not listed.

## Install

```
/plugin install poteto --marketplace saad-kabir/dumpster-fire
```

From a shell: `claude plugin install poteto --marketplace saad-kabir/dumpster-fire`

## Develop

`claude plugin validate plugins/poteto` checks the manifest and hooks module. `claude plugin test plugins/poteto` runs `tests/poteto.test.tsx` on the terminal and desktop surfaces.
