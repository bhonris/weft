/**
 * Monaco bootstrap for the Vite renderer. Registers the `basic-languages`
 * Monarch grammars (syntax highlighting for ~90 languages — no language-service
 * workers, so only the base `EditorWorker` is needed) and defines the three
 * named themes weft's app-theme maps onto (see `@core/viewer/monaco-theme`).
 * Kept in its own module so the (large) Monaco chunk loads once, lazily.
 */
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
// Monarch tokenizers for the built-in languages — enables syntax highlighting
// without pulling in the heavier per-language IntelliSense workers.
import 'monaco-editor/esm/vs/basic-languages/monaco.contribution'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

const g = self as unknown as { MonacoEnvironment?: { getWorker: () => Worker } }
g.MonacoEnvironment = {
  getWorker: () => new EditorWorker()
}

// weft-light / weft-dark just re-skin the stock vs / vs-dark themes with the
// app's editor background; weft-cyberpunk adds neon token colors over vs-dark to
// match the CRT palette in styles.css (--p1 pink, --p2 cyan, --bg #07070c).
monaco.editor.defineTheme('weft-light', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: { 'editor.background': '#ffffff' }
})
monaco.editor.defineTheme('weft-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [],
  colors: { 'editor.background': '#1e1e1e' }
})
monaco.editor.defineTheme('weft-cyberpunk', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '5b6b7a', fontStyle: 'italic' },
    { token: 'keyword', foreground: 'ff2d78' },
    { token: 'string', foreground: '21e6ff' },
    { token: 'number', foreground: 'ffb000' },
    { token: 'type', foreground: '9d7bff' },
    { token: 'function', foreground: '21e6ff' },
    { token: 'variable', foreground: 'c8ccd8' }
  ],
  colors: {
    'editor.background': '#07070c',
    'editor.foreground': '#c8ccd8',
    'editorLineNumber.foreground': '#2f5f66',
    'editorCursor.foreground': '#21e6ff',
    'editor.selectionBackground': '#21e6ff33'
  }
})

export { monaco }
