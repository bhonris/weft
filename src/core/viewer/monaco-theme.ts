/**
 * Pure app-theme → Monaco-theme-name mapping. The renderer registers the three
 * named themes on `monaco-setup.ts` load and calls `monaco.editor.setTheme(...)`
 * with the result of this function so the editor tracks weft's theme. Keeping
 * the decision here makes it unit-testable and keeps `ViewerPane` a thin adapter.
 * The union mirrors `WorkspaceState.theme` / the renderer's `ThemeChoice`; it is
 * redeclared here so `core/` stays framework-free (no renderer import).
 */
export type AppTheme = 'system' | 'light' | 'dark' | 'cyberpunk'

export type MonacoThemeName = 'weft-light' | 'weft-dark' | 'weft-cyberpunk'

/**
 * Resolve the app theme to a registered Monaco theme name. `'system'` follows
 * the OS preference (`systemPrefersDark`, from `matchMedia` in the renderer).
 */
export function monacoThemeForApp(
  appTheme: AppTheme,
  systemPrefersDark: boolean
): MonacoThemeName {
  switch (appTheme) {
    case 'light':
      return 'weft-light'
    case 'dark':
      return 'weft-dark'
    case 'cyberpunk':
      return 'weft-cyberpunk'
    case 'system':
      return systemPrefersDark ? 'weft-dark' : 'weft-light'
  }
}
