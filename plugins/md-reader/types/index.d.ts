export type Doc = { path: string; text: string; error?: string }

declare module 'claude-code' {
  interface PluginState {
    'md-reader': { doc: Doc; plan: string; cur: number }
  }
}
