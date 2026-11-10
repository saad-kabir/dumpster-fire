import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { SkillRow, SkillSourceLabel } from '../types'

const PANE = 'poteto'
const NAME_COLUMN_MAX = 30

const filterAtom = atom({ plugin: 'poteto', key: 'filter' } as const, '')
const loadedAtom = atom({ plugin: 'poteto', key: 'loaded' } as const, false)
const selectedAtom = atom({ plugin: 'poteto', key: 'selected' } as const, '')
// Bump the shape tag when SkillRow's fields change, so a stored list from an
// older version is dropped instead of read with the wrong fields.
const skillsAtom = atom({ plugin: 'poteto', key: 'skills' } as const, [], {
  shape: 'skills-1',
})

// ---------------------------------------------------------------------------
// Reading skills from disk
// ---------------------------------------------------------------------------

type Frontmatter = { name?: string; description?: string }

// Reads `name` and `description` from a SKILL.md's YAML frontmatter. Handles
// plain, quoted and block (`|`, `>`) scalars, which covers how skills are written.
function parseFrontmatter(raw: string): Frontmatter {
  const text = raw.replace(/\r\n/g, '\n')
  if (!text.startsWith('---')) return {}
  const end = text.indexOf('\n---', 3)
  if (end < 0) return {}
  const lines = text.slice(3, end).split('\n')
  const out: Record<string, string> = {}
  for (let i = 0; i < lines.length; i++) {
    const match = /^([A-Za-z_-]+):\s*(.*)$/.exec(lines[i] ?? '')
    if (!match) continue
    const key = match[1] ?? ''
    let value = (match[2] ?? '').trim()
    if (/^[|>][-+]?$/.test(value)) {
      const parts: string[] = []
      while (i + 1 < lines.length && /^\s+\S/.test(lines[i + 1] ?? '')) {
        parts.push((lines[++i] ?? '').trim())
      }
      value = parts.join(' ')
    }
    const quoted =
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    if (quoted) value = value.slice(1, -1)
    out[key] = value
  }
  return { name: out.name, description: out.description }
}

async function readSkill(
  $: EngineInterface,
  dir: string,
  source: SkillSourceLabel,
): Promise<SkillRow | undefined> {
  const path = `${dir}/SKILL.md`
  try {
    if (!(await $.fs.exists(path))) return undefined
    const text = await $.fs.read(path)
    const meta = parseFrontmatter(typeof text === 'string' ? text : '')
    const fallback = dir.split('/').pop() ?? dir
    return {
      name: meta.name || fallback,
      description: meta.description ?? '',
      source,
      path,
    }
  } catch {
    return undefined
  }
}

// Walks a skills folder: each child holding a SKILL.md is a skill; a child
// without one is searched `depth` levels further.
async function scanSkills(
  $: EngineInterface,
  root: string,
  source: SkillSourceLabel,
  depth: number,
): Promise<SkillRow[]> {
  let entries
  try {
    entries = await $.fs.list(root)
  } catch {
    return []
  }
  const rows: SkillRow[] = []
  for (const entry of entries) {
    // Account-synced skills live under `synced/`; /poteto shows only the
    // skills defined directly in ~/.claude/skills.
    if (entry.name.startsWith('.') || entry.name === 'synced' || entry.kind === 'file') continue
    const dir = `${root}/${entry.name}`
    const skill = await readSkill($, dir, source)
    if (skill) {
      rows.push(skill)
    } else if (depth > 0) {
      rows.push(...(await scanSkills($, dir, source, depth - 1)))
    }
  }
  return rows
}

// Only the user's own skills: ~/.claude/skills, symlinks followed, `synced/`
// left out. Project and plugin skills are not listed.
async function loadSkills($: EngineInterface): Promise<SkillRow[]> {
  const home = await $.env.get('HOME')
  if (!home) return []
  const rows = await scanSkills($, `${home}/.claude/skills`, 'user', 1)
  const seen = new Set<string>()
  return rows
    .filter(row => (seen.has(row.name) ? false : (seen.add(row.name), true)))
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ---------------------------------------------------------------------------
// Filtering and layout helpers
// ---------------------------------------------------------------------------

function termsOf(filter: string): string[] {
  return filter.toLowerCase().split(/\s+/).filter(Boolean)
}

// Every space-separated term must appear in the name or description.
function matches(row: SkillRow, terms: readonly string[]): boolean {
  if (terms.length === 0) return true
  const hay = `${row.name} ${row.description}`.toLowerCase()
  return terms.every(term => hay.includes(term))
}

// Splits `text` around the earliest occurrence of any term, so the match can
// be drawn highlighted. Returns [before, match, after].
function splitMatch(text: string, terms: readonly string[]): [string, string, string] {
  const lower = text.toLowerCase()
  let best: { at: number; len: number } | undefined
  for (const term of terms) {
    const at = lower.indexOf(term)
    if (at >= 0 && (!best || at < best.at)) best = { at, len: term.length }
  }
  if (!best) return [text, '', '']
  return [
    text.slice(0, best.at),
    text.slice(best.at, best.at + best.len),
    text.slice(best.at + best.len),
  ]
}

function clip(text: string, width: number): string {
  if (width <= 1) return ''
  return text.length <= width ? text : `${text.slice(0, Math.max(0, width - 1))}…`
}

function shortenHome(path: string, home: string | undefined): string {
  return home && path.startsWith(home) ? `~${path.slice(home.length)}` : path
}

// The slice of `count` rows to draw so the selected row stays in view.
function windowFor(count: number, selectedIndex: number, room: number): [number, number] {
  if (count <= room) return [0, count]
  const start = Math.min(Math.max(0, selectedIndex - Math.floor(room / 2)), count - room)
  return [start, start + room]
}

// ---------------------------------------------------------------------------
// Opening and actions
// ---------------------------------------------------------------------------

async function openBrowser($: EngineInterface): Promise<void> {
  await update($, filterAtom, () => '')
  await update($, selectedAtom, () => '')
  await update($, loadedAtom, () => false)
  void $.ui
    .open({ id: PANE, title: 'Skills', focus: true, closeOnEscape: true })
    .catch(() => undefined)
  const rows = await loadSkills($)
  await update($, skillsAtom, () => rows)
  await update($, loadedAtom, () => true)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'poteto',
      description: 'Browse and filter your skills in ~/.claude/skills',
    })
    return next(e)
  })

  on('command.run', { command: 'poteto' }, $ =>
    openBrowser($)
      .then(() => ({ text: 'Skills browser opened. Type to filter, Esc to close.' }))
      .catch((error: unknown) => {
        const reason = error instanceof Error ? error.message : String(error)
        return { text: `Could not open the skills browser: ${reason}` }
      }),
  )

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Input, Button } = $.ui.resolve(e)
    const filter = await read($, filterAtom)
    const loaded = await read($, loadedAtom)
    const selectedName = await read($, selectedAtom)
    const skills = await read($, skillsAtom)
    const home = await $.env.get('HOME')

    const terms = termsOf(filter)
    const shown = skills.filter(row => matches(row, terms))
    const selected = shown.find(row => row.name === selectedName)
    const selectedIndex = selected ? shown.indexOf(selected) : 0

    const columns = Math.max(40, e.props.bodyColumns ?? e.viewport?.columns ?? 80)
    const nameWidth = Math.min(
      NAME_COLUMN_MAX,
      Math.max(8, ...shown.map(row => row.name.length + 1)),
    )
    const descWidth = Math.max(10, columns - nameWidth - 6)

    // Header, search box, count line, footer and gaps take about 10 rows; the
    // detail card about 8 more when it is open.
    const totalRows = e.viewport?.rows ?? 30
    const room = Math.max(4, totalRows - 10 - (selected ? 8 : 0))
    const [from, to] = windowFor(shown.length, selectedIndex, room)
    const visible = shown.slice(from, to)

    const select = (name: string) => {
      void update($, selectedAtom, current => (current === name ? '' : name))
    }

    return (
      <Box flexDirection="column" paddingX={1} gap={1}>
        {/* Header: title on the left, count badge on the right */}
        <Box flexDirection="row" justifyContent="space-between">
          <Box flexDirection="row" gap={1}>
            <Text bold color="claude">
              ◆ Skills
            </Text>
            <Text color="subtle">~/.claude/skills</Text>
          </Box>
          <Text inverse color={terms.length > 0 ? 'suggestion' : 'subtle'}>
            {loaded ? ` ${shown.length}/${skills.length} ` : ' … '}
          </Text>
        </Box>

        {/* Search box */}
        <Box
          borderStyle="round"
          borderColor={e.props.isFocused ? 'suggestion' : 'inactive'}
          paddingX={1}
        >
          <Input
            key="filter"
            label="⌕ "
            placeholder="Search skills by name or description"
            value={filter}
            submitLabel="filter"
            autoFocus
            onInput={value => {
              void update($, filterAtom, () => value)
            }}
            onSubmit={value => {
              void update($, filterAtom, () => value)
            }}
          />
        </Box>

        {/* List */}
        {!loaded && <Text color="subtle">Reading ~/.claude/skills…</Text>}

        {loaded && shown.length === 0 && (
          <Box flexDirection="column" paddingX={2} paddingY={1}>
            <Text color="warning">{`No skills match "${filter}"`}</Text>
            <Text color="subtle">Try fewer or shorter words.</Text>
          </Box>
        )}

        {loaded && shown.length > 0 && (
          <Box flexDirection="column">
            {from > 0 && <Text color="subtle">{`  ↑ ${from} more`}</Text>}
            {visible.map(row => {
              const isSelected = row.name === selected?.name
              const [before, hit, after] = splitMatch(row.name, terms)
              const pad = ' '.repeat(Math.max(1, nameWidth - row.name.length))
              const description = clip(row.description || 'No description', descWidth)
              return (
                <Button key={`row-${row.name}`} plain onPress={() => select(row.name)}>
                  <Text color={isSelected ? 'claude' : 'inactive'}>
                    {isSelected ? '▸ ' : '  '}
                  </Text>
                  {before && (
                    <Text bold color={isSelected ? 'claude' : 'text'}>
                      {before}
                    </Text>
                  )}
                  {hit && (
                    <Text bold underline color="warning">
                      {hit}
                    </Text>
                  )}
                  {after && (
                    <Text bold color={isSelected ? 'claude' : 'text'}>
                      {after}
                    </Text>
                  )}
                  <Text>{pad}</Text>
                  <Text color="subtle">{description}</Text>
                </Button>
              )
            })}
            {to < shown.length && (
              <Text color="subtle">{`  ↓ ${shown.length - to} more`}</Text>
            )}
          </Box>
        )}

        {/* Detail card for the selected skill */}
        {selected && (
          <Box borderStyle="round" borderColor="claude" paddingX={1} flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between">
              <Text bold color="claude">{`/${selected.name}`}</Text>
              <Text color="subtle">user skill</Text>
            </Box>
            <Text wrap="wrap">{selected.description || 'No description.'}</Text>
            {selected.path && (
              <Text color="subtle" wrap="truncate-middle">
                {shortenHome(selected.path, home)}
              </Text>
            )}
            <Box flexDirection="row" gap={1} marginTop={1}>
              <Button
                key="run"
                variant="primary"
                onPress={() => {
                  void $.command.run({ command: selected.name }).catch(() => undefined)
                  void $.ui.close({ id: PANE }).catch(() => undefined)
                }}
              >
                {`Run /${selected.name}`}
              </Button>
              <Button
                key="copy"
                onPress={press => {
                  void $.ui
                    .copy({ text: `/${selected.name}`, surface: press.surface })
                    .then(() => $.ui.toast(`Copied /${selected.name}`))
                    .catch(() => undefined)
                }}
              >
                Copy name
              </Button>
              <Button key="back" dimColor onPress={() => select(selected.name)}>
                Back
              </Button>
            </Box>
          </Box>
        )}

        {/* Footer: key hints */}
        <Text color="subtle">
          {e.props.isFocused
            ? 'type to filter · ↑↓ move · enter open · esc close'
            : 'ctrl+x tab to focus · esc close'}
        </Text>
      </Box>
    )
  })
}
