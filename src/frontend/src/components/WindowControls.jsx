import { useEffect, useState } from 'react'

// Custom min/max/close buttons for the frame:false BrowserWindow (electron/main.js).
// Renders nothing outside Electron (web/dev-server preview has no window to control).
export default function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    const winApi = window.electronAPI?.window
    if (!winApi) return
    winApi.isMaximized().then(setIsMaximized)
    return winApi.onMaximizedChanged(setIsMaximized)
  }, [])

  const winApi = window.electronAPI?.window
  if (!winApi) return null

  return (
    <div className="win-controls">
      <button
        type="button"
        className="win-btn"
        aria-label="Minimize"
        title="Minimize"
        onClick={() => winApi.minimize()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10"><line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" strokeWidth="1" /></svg>
      </button>
      <button
        type="button"
        className="win-btn"
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        title={isMaximized ? 'Restore' : 'Maximize'}
        onClick={() => winApi.toggleMaximize()}
      >
        {isMaximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="2.5" y="0.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M0.5 2.5H7.5V9.5H0.5Z" fill="var(--bg-card)" stroke="currentColor" strokeWidth="1" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10"><rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" /></svg>
        )}
      </button>
      <button
        type="button"
        className="win-btn win-btn--close"
        aria-label="Close"
        title="Close"
        onClick={() => winApi.close()}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" strokeWidth="1" />
          <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1" />
        </svg>
      </button>
    </div>
  )
}
