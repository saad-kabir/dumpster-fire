export type SkillSourceLabel = 'user' | 'synced' | 'project' | 'plugin'

export type SkillRow = {
  name: string
  description: string
  source: SkillSourceLabel
  plugin?: string
  path?: string
}

declare module 'claude-code' {
  interface PluginState {
    poteto: {
      filter: string
      loaded: boolean
      selected: string
      skills: Shaped<SkillRow[]>
    }
  }
}
