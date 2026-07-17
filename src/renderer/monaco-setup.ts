/**
 * Monaco bootstrap for the Vite renderer. Weft's v1 viewer is read-only text +
 * diff — no language services — so only the base editor worker is registered.
 * Kept in its own module so the (large) Monaco chunk loads once, lazily.
 */
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api'
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'

const g = self as unknown as { MonacoEnvironment?: { getWorker: () => Worker } }
g.MonacoEnvironment = {
  getWorker: () => new EditorWorker()
}

export { monaco }
