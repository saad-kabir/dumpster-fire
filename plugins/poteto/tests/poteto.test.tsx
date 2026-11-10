import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'poteto',
  component: 'Pane',
  requestId: 'poteto',
  props: {
    title: 'Skills',
    isFocused: true,
    bodyColumns: 100,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const SKILL = (name: string, description: string) =>
  `---\nname: ${name}\ndescription: "${description}"\n---\n\n# ${name}\n`

const FILES: Record<string, string> = {
  '/home/.claude/skills/draft-doc/SKILL.md': SKILL('draft-doc', 'Draft a design doc section by section'),
  '/home/.claude/skills/review-doc/SKILL.md': SKILL('review-doc', 'Review a design doc against four lenses'),
  '/home/.claude/skills/unslop/SKILL.md': SKILL('unslop', 'Cut AI tells from any writing'),
  '/home/.claude/skills/synced/abc/pdf/SKILL.md': SKILL('pdf', 'Read and write PDF files'),
  '/proj/.claude/skills/deploy/SKILL.md': SKILL('deploy', 'Deploy this repo'),
}

const DIRS: Record<string, string[]> = {
  '/home/.claude/skills': ['draft-doc', 'review-doc', 'unslop', 'synced'],
  '/home/.claude/skills/synced': ['abc'],
  '/home/.claude/skills/synced/abc': ['pdf'],
  '/proj/.claude/skills': ['deploy'],
}

test('/poteto lists only ~/.claude/skills and the filter narrows them', async ($, on) => {
  on('command.register', () => ({ value: { command: 'poteto' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.cwd', () => ({ value: '/proj' }))
  on('env.get', () => ({ value: '/home' }))
  on('fs.list', (_, e) => {
    const names = DIRS[String(e.path)]
    if (!names) throw new Error('missing')
    return {
      value: names.map(name => ({ name, kind: 'dir', size: 0, mtimeMs: 0, isLink: false })),
    }
  })
  on('fs.exists', (_, e) => ({ value: String(e.path) in FILES }))
  on('fs.read', (_, e) => {
    const text = FILES[String(e.path)]
    if (text === undefined) throw new Error('missing')
    return { value: text }
  })
  on('command.list', () => ({
    value: [
      { name: 'superpowers:brainstorming', description: 'Brainstorm', source: 'plugin', plugin: 'superpowers' },
    ],
  }))

  await $.session.start({ cwd: '/proj', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'poteto' })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect(await ui.find({ type: 'Text', text: /^ 3\/3 $/ })).toBeDefined()
    expect(await ui.find({ key: 'row-draft-doc' })).toBeDefined()
    expect(await ui.find({ key: 'row-unslop' })).toBeDefined()
    expect(await ui.find({ key: 'row-pdf' })).toBeUndefined()
    expect(await ui.find({ key: 'row-deploy' })).toBeUndefined()
    expect(await ui.find({ key: 'row-superpowers:brainstorming' })).toBeUndefined()

    await ui.input({ key: 'filter', text: 'design', kind: 'change' })
    expect(await ui.find({ key: 'row-review-doc' })).toBeDefined()
    expect(await ui.find({ key: 'row-draft-doc' })).toBeDefined()
    expect(await ui.find({ key: 'row-unslop' })).toBeUndefined()

    expect(await ui.find({ type: 'Text', text: /^ 2\/3 $/ })).toBeDefined()

    await ui.press({ key: 'row-review-doc' })
    expect(await ui.find({ type: 'Text', text: /^\/review-doc$/ })).toBeDefined()
    expect(await ui.find({ key: 'run' })).toBeDefined()
    await ui.press({ key: 'back' })
    expect(await ui.find({ key: 'run' })).toBeUndefined()

    await ui.input({ key: 'filter', text: 'zzz', kind: 'change' })
    expect(await ui.find({ type: 'Text', text: /No skills match/ })).toBeDefined()

    await ui.input({ key: 'filter', text: '', kind: 'change' })
    await ui.unmount()
  }
})
