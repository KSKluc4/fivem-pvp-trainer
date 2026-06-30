import { useState, useEffect } from 'react'

export default function UpdateBanner() {
  const [updateInfo, setUpdateInfo]     = useState(null)
  const [restarting, setRestarting]     = useState(false)
  const [dismissed,  setDismissed]      = useState(false)

  useEffect(() => {
    if (!window.electronAPI?.onUpdateReady) return
    window.electronAPI.onUpdateReady((info) => {
      setUpdateInfo(info)
      setDismissed(false)
    })
  }, [])

  if (!updateInfo || dismissed) return null

  return (
    <div className="update-banner" role="alert">
      <span className="update-banner-icon">🚀</span>
      <span className="update-banner-text">
        Versão <strong>{updateInfo.version}</strong> disponível — baixada e pronta para instalar
      </span>
      <div className="update-banner-actions">
        <button
          className="update-banner-btn update-banner-btn--primary"
          onClick={() => { setRestarting(true); window.electronAPI.restartNow() }}
          disabled={restarting}
        >
          {restarting ? 'Reiniciando…' : 'Reiniciar agora'}
        </button>
        <button
          className="update-banner-btn update-banner-btn--dismiss"
          onClick={() => setDismissed(true)}
          title="Será instalado ao fechar o app"
        >
          Depois
        </button>
      </div>
    </div>
  )
}
