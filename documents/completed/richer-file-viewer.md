# Richer file viewer — syntax highlighting + Markdown preview

## Feature specification

Enrich weft's Monaco file viewer beyond plain text: **syntax highlighting** for
code files and a **rendered Markdown preview**, both tracking the app theme.
Previously every file (including `.md`) rendered as uncolored `plaintext` in a
hard-coded `vs-dark` editor.

## Scope

- Broad syntax highlighting via Monaco's `basic-languages` Monarch grammars
  (~90 languages) in View, Edit, and Diff modes.
- Language detected from the filename (pure `languageIdForFile`).
- A **Preview** toggle on Markdown files that renders GFM (headings, lists,
  tables, task lists, links) with highlighted code fences. Raw source is the
  default; Preview is opt-in per file.
- Monaco editor + Markdown preview follow the app theme (light / dark /
  cyberpunk / system), replacing the static `vs-dark`.

### Out of scope

- IntelliSense / hover / diagnostics / language-service workers (highlighting
  only).
- Live split source-and-preview view (single surface with a toggle).
- Editing rendered Markdown (Preview is read-only; Edit uses the source editor).
- Rendering embedded raw HTML in Markdown (kept escaped for safety).

## User stories

- As a developer browsing a project, I want code files colorized so I can read
  them at a glance instead of a wall of monochrome text.
- As a developer opening a `README`, I want a formatted preview so docs are
  readable without mentally parsing Markdown syntax.
- As a user on the light or cyberpunk theme, I want the editor to match the rest
  of the app rather than always being dark.

## Acceptance criteria

- [x] Opening a `.ts`/`.py`/`.json`/… file shows multiple Monaco token colors.
- [x] Language is derived from the extension/basename (pure, unit-tested).
- [x] `.md` files show a **Preview** toggle; clicking it renders the Markdown;
      **View** returns to the highlighted source.
- [x] Preview highlights fenced code blocks and matches the theme.
- [x] Editor + preview colors change when the app theme is cycled, without the
      editor being torn down (no lost unsaved edits).
- [x] The 5 MB read cap and "reload never kills a PTY" invariants are untouched.

## Architecture & technical design

Per the layer boundary, decisions live in pure `core/`; `main/` and the renderer
stay thin.

- `src/core/viewer/file-language.ts` — `languageIdForFile(name)`,
  `isMarkdown(name)` (pure, unit-tested).
- `src/core/viewer/monaco-theme.ts` — `monacoThemeForApp(appTheme, prefersDark)`
  → registered theme name (pure, unit-tested).
- `src/renderer/monaco-setup.ts` — registers `basic-languages` Monarch grammars
  and defines `weft-light` / `weft-dark` / `weft-cyberpunk` themes.
- `src/renderer/store/viewer-store.ts` — new `preview` flag + `setPreview`, reset
  whenever the file/mode changes.
- `src/renderer/components/MarkdownPreview.tsx` — `react-markdown` + `remark-gfm`
  + `rehype-highlight`; reads content via the existing `readFileText` IPC.
- `src/renderer/components/ViewerPane.tsx` — passes the language to every model,
  sets the theme via `monaco.editor.setTheme` (global, no editor recreation),
  adds the Preview toggle, and swaps in `MarkdownPreview` when previewing.
- `src/renderer/styles.css` — `.markdown-preview` typography + theme-aware
  `.hljs-*` token colors.

## Security considerations

- No `rehype-raw`: embedded HTML in Markdown stays escaped, so a file can't
  inject markup into the renderer.
- Reads reuse `readFileText` — the project-root guard and 5 MB cap in
  `diff-service.ts` still apply.

## Testing strategy

- Unit: `file-language.test.ts`, `monaco-theme.test.ts`, extended
  `viewer-store.test.ts` (preview reducer + resets).
- E2E (`e2e/viewer.spec.ts`): highlighting (distinct `.mtk*` classes), Markdown
  preview toggle (rendered heading/list/link/highlighted fence), return to View.

## Dependencies

- `react-markdown`, `remark-gfm`, `rehype-highlight`, `highlight.js`.

## Todo

- [x] Core helpers + tests
- [x] Monaco basic-languages + themes
- [x] Viewer store preview state + tests
- [x] MarkdownPreview component
- [x] ViewerPane wiring (language, theme, Preview toggle)
- [x] Styles
- [x] E2E coverage
- [x] Full `pnpm test:cov` green (695 tests) + `e2e/viewer.spec.ts` green (4 tests)
