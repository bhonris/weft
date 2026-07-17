export function App() {
  return (
    <div className="weft-shell">
      <header className="tab-strip" data-testid="tab-strip">
        <span className="tab-strip__empty">Open a project to begin</span>
      </header>
      <main className="workbench">
        <aside className="explorer" data-testid="explorer" />
        <section className="terminal-host" data-testid="terminal-host" />
      </main>
      <footer className="status-bar" data-testid="status-bar">
        <span>Weft</span>
      </footer>
    </div>
  )
}
