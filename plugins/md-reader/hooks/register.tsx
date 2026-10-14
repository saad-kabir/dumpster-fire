import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Doc } from '../types'

const PANE = 'md-reader'
const empty: Doc = { path: '', text: '' }
const doc = atom({ plugin: 'md-reader', key: 'doc' } as const, empty)
// The plan file of this session, learned from plan mode's own notes
const cur = atom({ plugin: 'md-reader', key: 'cur' } as const, 0)
const plan = atom({ plugin: 'md-reader', key: 'plan' } as const, '')


// Glow-style palette
const C = {
  h1Fg: '#ffffff',
  h1Bg: '#5f5fd7',
  h2: '#7aa2ff',
  h3: '#8ec5ff',
  h4: '#9aa5ce',
  bullet: '#af87ff',
  code: '#ff875f',
  codeBg: '#2a2a35',
  fence: '#c0caf5',
  fenceBg: '#1f2335',
  quote: '#8a8fa8',
  link: '#2ac3a2',
  rule: '#4a4e69',
  tableHead: '#e0af68',
  check: '#9ece6a',
}

function inline(Text: any, src: string, base: any = {}): any[] {
  const out: any[] = []
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(~~[^~]+~~)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)]+\))/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push(<Text {...base}>{src.slice(last, m.index)}</Text>)
    const t = m[0]
    if (m[1]) out.push(<Text color={C.code} backgroundColor={C.codeBg}>{` ${t.slice(1, -1)} `}</Text>)
    else if (m[2]) out.push(<Text {...base} bold>{inline(Text, t.slice(2, -2), { ...base, bold: true })}</Text>)
    else if (m[3]) out.push(<Text {...base} strikethrough dimColor>{t.slice(2, -2)}</Text>)
    else if (m[4]) out.push(<Text {...base} italic>{t.slice(1, -1)}</Text>)
    else {
      const [, label] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t) as RegExpExecArray
      out.push(<Text color={C.link} underline>{label}</Text>)
    }
    last = m.index + t.length
  }
  if (last < src.length) out.push(<Text {...base}>{src.slice(last)}</Text>)
  return out
}

function table(Box: any, Text: any, rows: string[]): any {
  const cells = rows
    .filter(r => !/^\s*\|?[\s:|-]+\|?\s*$/.test(r))
    .map(r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim()))
  const widths: number[] = []
  cells.forEach(r => r.forEach((c, i) => { widths[i] = Math.max(widths[i] ?? 0, c.replace(/[`*_]/g, '').length) }))
  return (
    <Box flexDirection="column" marginY={1}>
      {cells.map((r, ri) => (
        <Text>
          {r.map((c, i) => {
            const plain = c.replace(/[`*_]/g, '')
            const pad = ' '.repeat(Math.max(0, widths[i] - plain.length))
            return (
              <Text>
                <Text color={C.rule}>{i === 0 ? '│ ' : ' │ '}</Text>
                {ri === 0 ? <Text bold color={C.tableHead}>{plain}</Text> : inline(Text, c)}
                {pad}
              </Text>
            )
          })}
          <Text color={C.rule}> │</Text>
        </Text>
      ))}
    </Box>
  )
}

function renderMarkdown(Box: any, Text: any, src: string): { nodes: any[]; count: number } {
  let hn = 0
  const lines = src.replace(/\r\n/g, '\n').split('\n')
  const out: any[] = []
  let i = 0
  let para: string[] = []
  const flush = () => {
    if (para.length) out.push(<Box marginBottom={1}><Text>{inline(Text, para.join(' '))}</Text></Box>)
    para = []
  }
  while (i < lines.length) {
    const line = lines[i]
    let m: RegExpExecArray | null
    if (/^\s*```/.test(line)) {
      flush()
      const lang = line.replace(/^\s*```/, '').trim()
      const body: string[] = []
      i++
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++])
      i++
      const width = Math.max(...body.map(b => b.length), lang.length, 1) + 2
      out.push(
        <Box flexDirection="column" marginBottom={1}>
          {lang !== '' && <Text color={C.h4} backgroundColor={C.fenceBg}>{` ${lang}`.padEnd(width)}</Text>}
          {body.map(b => <Text color={C.fence} backgroundColor={C.fenceBg}>{` ${b}`.padEnd(width)}</Text>)}
        </Box>,
      )
      continue
    }
    if ((m = /^(#{1,6})\s+(.*)$/.exec(line))) {
      flush()
      const n = m[1].length
      if (n === 1) out.push(<Box key={`h${hn++}`} marginY={1}><Text bold color={C.h1Fg} backgroundColor={C.h1Bg}>{` ${m[2]} `}</Text></Box>)
      else if (n === 2) out.push(<Box key={`h${hn++}`} marginTop={1} marginBottom={1}><Text bold color={C.h2}>{`## ${m[2]}`}</Text></Box>)
      else out.push(<Box key={`h${hn++}`} marginBottom={1}><Text bold color={n === 3 ? C.h3 : C.h4}>{`${m[1]} ${m[2]}`}</Text></Box>)
    } else if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush()
      out.push(<Box marginBottom={1}><Text color={C.rule}>{'─'.repeat(40)}</Text></Box>)
    } else if (/^\s*\|.*\|\s*$/.test(line)) {
      flush()
      const rows: string[] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) rows.push(lines[i++])
      out.push(table(Box, Text, rows))
      continue
    } else if ((m = /^(\s*)>\s?(.*)$/.exec(line))) {
      flush()
      out.push(<Text><Text color={C.rule}>│ </Text>{inline(Text, m[2], { color: C.quote, italic: true })}</Text>)
    } else if ((m = /^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?(.*)$/.exec(line))) {
      flush()
      const depth = Math.floor(m[1].length / 2)
      const ordered = /\d/.test(m[2])
      const marker = m[3] ? (/[xX]/.test(m[3]) ? '✓ ' : '☐ ') : ordered ? `${m[2]} ` : depth % 2 ? '◦ ' : '• '
      const done = m[3] && /[xX]/.test(m[3])
      out.push(
        <Text>
          {'  '.repeat(depth)}
          <Text color={done ? C.check : C.bullet}>{marker}</Text>
          {inline(Text, m[4], done ? { dimColor: true } : {})}
        </Text>,
      )
      if (i + 1 < lines.length && lines[i + 1].trim() === '' && !/^\s*([-*+]|\d+[.)])\s/.test(lines[i + 2] ?? '')) out.push(<Text> </Text>)
    } else if (line.trim() === '') {
      flush()
    } else {
      para.push(line.trim())
    }
    i++
  }
  flush()
  return { nodes: out, count: hn }
}

async function load($: any, arg: string): Promise<Doc> {
  try {
    let path = arg.trim()
    if (!path) {
      path = await read($, plan)
      if (!path) {
        // Managed installs skip prompt.attachment: find the plan path plan mode named in this session
        const rows = await $.session.messages().catch(() => [])
        const found = JSON.stringify(rows).match(/\/[^"\s\\]*\.claude\/plans\/[\w.-]+\.md/g)
        if (found) path = found[found.length - 1]
      }
      if (!path) return { path: '', text: '', error: 'No plan for this session yet. Enter plan mode, or pass a path.' }
    }
    return { path, text: await $.fs.read(path) }
  } catch (err) {
    return { path: arg, text: '', error: `Could not read file: ${(err as Error).message}` }
  }
}

async function show($: any, arg: string) {
  const next = await load($, arg)
  await update($, doc, () => next)
  await update($, cur, () => 0)
  await $.ui.open({ id: PANE, title: 'Reader' })

  return next
}


async function jump($: any, step: number, count: number) {
  if (count === 0) return
  const next = Math.max(0, Math.min(count - 1, (await read($, cur)) + step))
  await update($, cur, () => next)
  await $.ui.scroll({ to: { key: `h${next}` }, in: PANE, block: 'start' })
}

async function openInHerdr($: any, arg: string): Promise<string> {
  const bin = await $.env.get('HERDR_BIN_PATH')
  const here = await $.env.get('HERDR_PANE_ID')
  if (!bin || !here) return 'Not running inside herdr.'
  const d = await load($, arg)
  if (d.error) return d.error
  const split = await $.process.run([bin, 'pane', 'split', '--pane', here, '--direction', 'right', '--no-focus'])
  const id = /"pane_id":"([^"]+)"/.exec(`${split.stdout}`)?.[1]
  if (split.exitCode !== 0 || !id) return `herdr split failed: ${split.stderr || split.stdout}`
  const quoted = `'${d.path.replace(/'/g, "'\\''")}'`
  await $.process.run([bin, 'pane', 'run', id, `glow --pager -w $(($(tput cols) - 2)) ${quoted}; exit`])
  return `Opened ${d.path} in herdr pane ${id} (q quits the pager and closes the pane).`
}

// Inside herdr the reader opens in a split herdr pane; elsewhere in Claude's own pane
async function open($: any, arg: string): Promise<string> {
  if (await $.env.get('HERDR_PANE_ID')) return openInHerdr($, arg)
  const shown = await show($, arg)

  return shown.error ?? `Reading ${shown.path}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'read',
      description: 'Read a markdown file (or the current session plan), in a herdr pane when inside herdr: /read [path]',
    })

    return next(e)
  })

  on('command.run', { command: 'read' }, async ($, e) => {
    return { text: await open($, e.args) }
  })

  on('prompt.attachment', async ($, e, next) => {
    if (e.type === 'plan_mode' || e.type === 'plan_mode_exit' || e.type === 'plan_mode_reentry') {
      const path = e.detail?.planFilePath
      if (path) await update($, plan, () => path)
    }

    return next(e)
  })

  on('tool.call', { tool: 'ExitPlanMode' }, async ($, e, next) => {
    const ran = await next(e)
    const path = (ran as any).result?.filePath
    if (path) await update($, plan, () => path).catch(() => undefined)
    await open($, '').catch(() => undefined)

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const d = await read($, doc)

    const md = d.text !== '' ? renderMarkdown(Box, Text, d.text) : { nodes: [], count: 0 }

    return (
      <Box flexDirection="column" paddingX={1}>
        {d.path !== '' && <Text dimColor>{d.path}</Text>}
        {d.error !== undefined && <Text color="red">{d.error}</Text>}
        {d.path === '' && d.error === undefined && (
          <Text dimColor>Run /read [path] to open a markdown file.</Text>
        )}
        <Box>
          <Button key="next" hotkey="n" plain onPress={() => jump($, 1, md.count)}>next heading</Button>
          <Text>  </Text>
          <Button key="prev" hotkey="p" plain onPress={() => jump($, -1, md.count)}>prev</Button>
          <Text>  </Text>
          <Button key="top" hotkey="g" plain onPress={() => $.ui.scroll({ to: 'start', in: PANE })}>top</Button>
          <Text>  </Text>
          <Button key="end" hotkey="e" plain onPress={() => $.ui.scroll({ to: 'end', in: PANE })}>end</Button>
          <Text>  </Text>
          <Button key="close" hotkey="q" plain onPress={() => $.ui.close({ id: PANE })}>close</Button>
        </Box>
        {md.nodes.length > 0 && <Box flexDirection="column" marginTop={1}>{md.nodes}</Box>}
      </Box>
    )
  })
}
