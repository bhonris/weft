import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { OpenFile } from '@core/workspace/open-files'

/**
 * Rendered Markdown preview for the viewer's Preview toggle. Reads the file
 * through the same `readFileText` IPC as the Monaco surface (so the 5 MB cap and
 * project-root guard still apply), then renders GFM with highlighted code fences.
 * Embedded raw HTML is intentionally NOT enabled (no `rehype-raw`) so a Markdown
 * file can't inject arbitrary markup into the renderer.
 */
export function MarkdownPreview({ file }: { file: OpenFile }): React.ReactElement {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setContent(null)
    setError(null)
    void window.api
      .readFileText(file.path)
      .then((text) => {
        if (!cancelled) setContent(text)
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      })
    return () => {
      cancelled = true
    }
  }, [file.path])

  if (error) {
    return (
      <div className="viewer__error" role="alert">
        Cannot render markdown: {error}
      </div>
    )
  }

  return (
    <div className="markdown-preview" data-testid="markdown-preview">
      {content !== null && (
        <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {content}
        </Markdown>
      )}
    </div>
  )
}
