/**
 * Pure filename → viewer-language decisions. Kept out of the renderer so the
 * mapping is unit-tested and the Monaco adapter (`ViewerPane`) stays thin. The
 * ids returned here are Monaco language ids, resolved by the `basic-languages`
 * Monarch grammars registered in `monaco-setup.ts`. Unknown files return '' so
 * Monaco falls back to plaintext.
 */

/** Lower-cased extension → Monaco language id. */
const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  jsonc: 'json',
  md: 'markdown',
  markdown: 'markdown',
  py: 'python',
  pyi: 'python',
  rs: 'rust',
  go: 'go',
  rb: 'ruby',
  php: 'php',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cc: 'cpp',
  cpp: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  css: 'css',
  scss: 'scss',
  less: 'less',
  html: 'html',
  htm: 'html',
  xml: 'xml',
  svg: 'xml',
  vue: 'html',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  sh: 'shell',
  bash: 'shell',
  zsh: 'shell',
  ps1: 'powershell',
  sql: 'sql',
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  lua: 'lua',
  r: 'r',
  dart: 'dart',
  scala: 'scala',
  pl: 'perl',
  graphql: 'graphql',
  gql: 'graphql'
}

/** Full basenames (case-insensitive) that carry no extension but map cleanly. */
const BASENAME_TO_LANGUAGE: Record<string, string> = {
  dockerfile: 'dockerfile',
  makefile: 'makefile',
  '.gitignore': 'ignore',
  '.gitattributes': 'ignore',
  '.dockerignore': 'ignore',
  '.npmignore': 'ignore',
  '.env': 'ini'
}

/** The final extension of a filename, lower-cased, or '' when there is none. */
function extensionOf(name: string): string {
  const base = name.slice(name.replace(/\\/g, '/').lastIndexOf('/') + 1)
  const dot = base.lastIndexOf('.')
  // A leading dot (dotfile) or no dot at all means "no extension".
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

/** The basename of a path, lower-cased. */
function basenameOf(name: string): string {
  const norm = name.replace(/\\/g, '/')
  return norm.slice(norm.lastIndexOf('/') + 1).toLowerCase()
}

/**
 * Monaco language id for a file name/path, or '' (plaintext) when unknown.
 * Extension wins; extension-less files fall back to a basename lookup so
 * `Dockerfile`, `Makefile`, `.gitignore`, … still colorize.
 */
export function languageIdForFile(name: string): string {
  const ext = extensionOf(name)
  if (ext && EXT_TO_LANGUAGE[ext]) return EXT_TO_LANGUAGE[ext]!
  const base = basenameOf(name)
  return BASENAME_TO_LANGUAGE[base] ?? ''
}

/** Whether a file should offer the rendered Markdown preview. */
export function isMarkdown(name: string): boolean {
  const ext = extensionOf(name)
  return ext === 'md' || ext === 'markdown'
}
