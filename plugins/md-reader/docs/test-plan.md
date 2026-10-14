# md-reader Test Plan

Open this file with `/read md-reader-test-plan.md`. Each section below exercises one part of the renderer, so you can check how it looks and tick it off.

## 1. Headings

### Heading level 3
#### Heading level 4
##### Heading level 5

Expected: H1 is white on a purple block, H2 is blue with `##`, H3 and below are lighter blue with their `#` marks.

## 2. Inline styles

Plain text, **bold text**, *italic text*, _underscore italic_, ~~strikethrough~~, and `inline code` in one paragraph.

A **bold phrase with `code` inside** and a [an example link](https://example.com) in teal and underlined.

A long paragraph that should wrap in the pane without breaking words: Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

## 3. Lists

- First bullet
- Second bullet with **bold** and `code`
  - Nested bullet
    - Deeper nested bullet
- Third bullet

1. First step
2. Second step
3. Third step

- [x] Done item (green check, dimmed)
- [ ] Open item
- [x] Another done item

## 4. Blockquote

> A quoted line in muted italic.
> A second quoted line with **bold** inside.

## 5. Code blocks

```typescript
const greet = (name: string) => `Hello, ${name}`
console.log(greet('world'))
```

```
A block with no language label
  indented line
```

## 6. Table

| Feature | Status | Notes |
| --- | --- | --- |
| Headings | done | H1 to H6 |
| Tables | done | Header row is yellow |
| `Code` cells | done | Inline styles work |

## 7. Horizontal rule

Above the rule.

---

Below the rule.

## 8. Scrolling

Fill this pane past the screen height, then scroll with the mouse wheel or arrow keys while the pane has focus (Tab to focus it).

1. Line one
2. Line two
3. Line three
4. Line four
5. Line five
6. Line six
7. Line seven
8. Line eight
9. Line nine
10. Line ten
11. Line eleven
12. Line twelve
13. Line thirteen
14. Line fourteen
15. Line fifteen
16. Line sixteen
17. Line seventeen
18. Line eighteen
19. Line nineteen
20. Line twenty
21. Line twenty-one
22. Line twenty-two
23. Line twenty-three
24. Line twenty-four
25. Line twenty-five
26. Line twenty-six
27. Line twenty-seven
28. Line twenty-eight
29. Line twenty-nine
30. End of the scroll test

## 9. Command and plan behaviour checks

Run these in the prompt, not in this file:

- [ ] `/read md-reader-test-plan.md` opens this file in the pane
- [ ] `/read` with no path and no plan says "No plan for this session yet"
- [ ] `/read does-not-exist.md` shows a red "Could not read file" message in the pane
- [ ] `/read /absolute/path/to/any.md` works with an absolute path
- [ ] Enter plan mode (Shift+Tab), ask for a small plan, then `/read` shows that session's plan
- [ ] Approve the plan: the pane opens by itself on the plan (ExitPlanMode hook)
- [ ] Start a second session in another terminal: `/read` there does not show the first session's plan
- [ ] Narrow the terminal below 110 columns: note whether the pane waits to open
- [ ] Run `/read` on another file while the pane is open: it replaces the content

## 10. Known gaps (not bugs)

- Nested blockquotes, HTML, and images are not rendered
- No syntax highlighting inside code blocks
- Long table rows do not wrap
- Colors are hex, so they need a truecolor terminal
