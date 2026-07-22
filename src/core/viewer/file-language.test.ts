import { describe, it, expect } from 'vitest'
import { languageIdForFile, isMarkdown } from './file-language'

describe('languageIdForFile', () => {
  it('maps common code extensions to Monaco language ids', () => {
    expect(languageIdForFile('app.ts')).toBe('typescript')
    expect(languageIdForFile('Component.tsx')).toBe('typescript')
    expect(languageIdForFile('script.js')).toBe('javascript')
    expect(languageIdForFile('data.json')).toBe('json')
    expect(languageIdForFile('main.py')).toBe('python')
    expect(languageIdForFile('lib.rs')).toBe('rust')
    expect(languageIdForFile('server.go')).toBe('go')
    expect(languageIdForFile('styles.css')).toBe('css')
    expect(languageIdForFile('page.html')).toBe('html')
    expect(languageIdForFile('config.yaml')).toBe('yaml')
    expect(languageIdForFile('config.yml')).toBe('yaml')
    expect(languageIdForFile('build.sh')).toBe('shell')
    expect(languageIdForFile('query.sql')).toBe('sql')
    expect(languageIdForFile('notes.md')).toBe('markdown')
  })

  it('is case-insensitive on the extension', () => {
    expect(languageIdForFile('App.TS')).toBe('typescript')
    expect(languageIdForFile('DATA.JSON')).toBe('json')
  })

  it('resolves language from the last extension of a full path', () => {
    expect(languageIdForFile('/home/u/project/src/main.py')).toBe('python')
    expect(languageIdForFile('C:\\repos\\weft\\a.tsx')).toBe('typescript')
    expect(languageIdForFile('archive.tar.gz')).toBe('') // unknown final ext
  })

  it('falls back to a basename lookup for extension-less files', () => {
    expect(languageIdForFile('Dockerfile')).toBe('dockerfile')
    expect(languageIdForFile('Makefile')).toBe('makefile')
    expect(languageIdForFile('/repo/.gitignore')).toBe('ignore')
    expect(languageIdForFile('.env')).toBe('ini')
  })

  it('returns plaintext ("") for unknown or extension-less files', () => {
    expect(languageIdForFile('README')).toBe('')
    expect(languageIdForFile('mystery.zzz')).toBe('')
    expect(languageIdForFile('LICENSE')).toBe('')
  })
})

describe('isMarkdown', () => {
  it('is true for .md and .markdown', () => {
    expect(isMarkdown('README.md')).toBe(true)
    expect(isMarkdown('notes.markdown')).toBe(true)
    expect(isMarkdown('DOC.MD')).toBe(true)
  })

  it('is false for everything else', () => {
    expect(isMarkdown('app.ts')).toBe(false)
    expect(isMarkdown('README')).toBe(false)
    expect(isMarkdown('mdfile')).toBe(false)
  })
})
