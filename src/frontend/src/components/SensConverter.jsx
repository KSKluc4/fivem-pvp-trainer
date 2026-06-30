import { useState, useEffect, useCallback } from 'react'
import { convertSensitivity, getSensitivityHistory } from '../services/api'
import { toast } from '../services/toast'

// Community-validated yaw values (mirrors backend constants)
const GTA_YAW    = 0.009
const KOVAAK_YAW = 0.022
const AIMLAB_YAW = 0.022

function calcLocal(gtaSens, dpi) {
  const abs = Math.abs(gtaSens)
  const cm  = (360 / (dpi * abs * GTA_YAW)) * 2.54
  return {
    cm_per_360:         +cm.toFixed(4),
    kovaak_sensitivity: +((360 * 2.54) / (dpi * KOVAAK_YAW * cm)).toFixed(4),
    aimlab_sensitivity: +((360 * 2.54) / (dpi * AIMLAB_YAW * cm)).toFixed(4),
    inverted:           gtaSens < 0,
  }
}

const DPI_PRESETS = [400, 800, 1200, 1600, 3200]

function fmt(n, dp = 3) {
  return typeof n === 'number' ? n.toFixed(dp) : '—'
}

function CopyBtn({ value }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(String(value)).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button className="sens-copy-btn" onClick={copy} title="Copiar">
      {copied ? '✓' : '⎘'}
    </button>
  )
}

function HistoryRow({ row }) {
  const d = new Date(row.created_at)
  const dateStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`
  return (
    <div className="sens-history-row">
      <span className="sens-hist-date">{dateStr}</span>
      <span className="sens-hist-field">
        GTA <strong>{row.gta_sensitivity > 0 ? row.gta_sensitivity : `${row.gta_sensitivity} ↕`}</strong>
        {' / '}{row.dpi} DPI
      </span>
      <span className="sens-hist-result">
        KovaaK <strong>{fmt(row.kovaak_sens)}</strong>
        {' · '}Aim Lab <strong>{fmt(row.aimlab_sens)}</strong>
        {' · '}<span className="sens-hist-cm">{fmt(row.cm_per_360, 1)} cm</span>
      </span>
    </div>
  )
}

export default function SensConverter({ onBack }) {
  const [gtaSens, setGtaSens]   = useState('5')
  const [dpi,     setDpi]       = useState('800')
  const [result,  setResult]    = useState(null)
  const [history, setHistory]   = useState([])
  const [loading, setLoading]   = useState(false)
  const [histErr, setHistErr]   = useState(false)

  // Preview result computed locally on every keystroke
  const preview = (() => {
    const s = parseFloat(gtaSens)
    const d = parseInt(dpi, 10)
    if (!isNaN(s) && s !== 0 && !isNaN(d) && d > 0) return calcLocal(s, d)
    return null
  })()

  const loadHistory = useCallback(() => {
    getSensitivityHistory()
      .then((res) => setHistory(res.data))
      .catch(() => setHistErr(true))
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const handleConvert = async (e) => {
    e.preventDefault()
    const s = parseFloat(gtaSens)
    const d = parseInt(dpi, 10)

    if (isNaN(s) || s === 0) { toast.error('Informe uma sensibilidade válida (diferente de zero).'); return }
    if (isNaN(d) || d <= 0)  { toast.error('Informe um DPI válido (número positivo).'); return }

    // Show instant local result
    const local = calcLocal(s, d)
    setResult(local)

    // Persist to backend (fire-and-forget)
    setLoading(true)
    try {
      await convertSensitivity({ gta_sensitivity: s, dpi: d })
      loadHistory()
    } catch {
      // Conversion result is already shown — backend failure is non-fatal
    } finally {
      setLoading(false)
    }
  }

  const display = result || preview

  return (
    <div className="sens-view">
      {/* Header */}
      <div className="sens-header">
        <div>
          <h1>Conversor de Sensibilidade</h1>
          <p className="routine-meta">GTA V / FiveM → KovaaK's · Aim Lab</p>
        </div>
        <button className="btn-secondary" onClick={onBack}>← Voltar ao Treino</button>
      </div>

      <div className="sens-layout">
        {/* ── Input panel ── */}
        <div className="sens-panel">
          <div className="section-card">
            <div className="section-header">
              <h2><span className="section-icon">🎮</span> Configuração</h2>
            </div>

            <form className="sens-form" onSubmit={handleConvert}>
              {/* GTA V sensitivity */}
              <div className="sens-field">
                <label className="sens-label">
                  Sensibilidade GTA V
                  <span className="sens-label-hint">escala 0–10 · aceita negativo para eixo invertido</span>
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="name-input sens-input"
                  value={gtaSens}
                  onChange={(e) => setGtaSens(e.target.value)}
                  placeholder="ex: 5 ou -3.5"
                  autoFocus
                />
                <p className="sens-hint">
                  Encontre em <code>Documents\Rockstar Games\GTA V\settings.xml</code> → campo <code>MouseSensitivity</code> × 10
                </p>
              </div>

              {/* DPI */}
              <div className="sens-field">
                <label className="sens-label">
                  DPI do Mouse
                </label>
                <input
                  type="number"
                  step="1"
                  min="1"
                  className="name-input sens-input"
                  value={dpi}
                  onChange={(e) => setDpi(e.target.value)}
                  placeholder="ex: 800"
                />
                <div className="dpi-presets">
                  {DPI_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`dpi-preset-btn ${parseInt(dpi, 10) === p ? 'active' : ''}`}
                      onClick={() => setDpi(String(p))}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="btn-primary"
                disabled={loading || !preview}
                style={{ width: '100%' }}
              >
                {loading ? 'Salvando...' : 'Converter e Salvar'}
              </button>
            </form>
          </div>

          {/* Formula info */}
          <div className="section-card sens-formula-card">
            <div className="section-header">
              <h2><span className="section-icon">📐</span> Fórmula</h2>
            </div>
            <div className="sens-formula-rows">
              <div className="sens-formula-row">
                <span className="sens-formula-label">GTA V yaw</span>
                <code className="sens-formula-val">0.009 °/count</code>
              </div>
              <div className="sens-formula-row">
                <span className="sens-formula-label">KovaaK's yaw</span>
                <code className="sens-formula-val">0.022 °/count</code>
              </div>
              <div className="sens-formula-row">
                <span className="sens-formula-label">Aim Lab yaw</span>
                <code className="sens-formula-val">0.022 °/count</code>
              </div>
              <div className="sens-formula-divider" />
              <p className="sens-formula-eq">
                cm/360 = (360 ÷ (DPI × |sens| × yaw)) × 2.54
              </p>
              <p className="sens-formula-source">
                Valores validados pela comunidade via mouse-sensitivity.com e r/FPSAimTrainer
              </p>
            </div>
          </div>
        </div>

        {/* ── Result panel ── */}
        <div className="sens-results-col">
          {/* Live preview result */}
          {display ? (
            <div className={`section-card sens-result-card ${display.inverted ? 'sens-result--inverted' : ''}`}>
              <div className="section-header">
                <h2><span className="section-icon">⚡</span> Resultado</h2>
                {result && <span className="tag" style={{ background: 'rgba(46,213,115,0.1)', color: '#2ed573' }}>Salvo</span>}
              </div>

              {display.inverted && (
                <div className="sens-inverted-warning">
                  <span>↕</span>
                  <span>Eixo invertido detectado — os valores de sensibilidade são corretos, mas o mouse estará com direções Y trocadas.</span>
                </div>
              )}

              <div className="sens-result-grid">
                <div className="sens-result-item sens-result--cm">
                  <div className="sens-result-icon">📐</div>
                  <div className="sens-result-label">cm / 360°</div>
                  <div className="sens-result-value">{fmt(display.cm_per_360, 1)}<span className="sens-result-unit">cm</span></div>
                  <CopyBtn value={fmt(display.cm_per_360, 2)} />
                </div>

                <div className="sens-result-item sens-result--kovaak">
                  <div className="sens-result-icon">⚡</div>
                  <div className="sens-result-label">KovaaK's</div>
                  <div className="sens-result-value">{fmt(display.kovaak_sensitivity, 3)}</div>
                  <div className="sens-result-sublabel">Sensibilidade</div>
                  <CopyBtn value={fmt(display.kovaak_sensitivity, 3)} />
                </div>

                <div className="sens-result-item sens-result--aimlab">
                  <div className="sens-result-icon">🎯</div>
                  <div className="sens-result-label">Aim Lab</div>
                  <div className="sens-result-value">{fmt(display.aimlab_sensitivity, 3)}</div>
                  <div className="sens-result-sublabel">Sensibilidade</div>
                  <CopyBtn value={fmt(display.aimlab_sensitivity, 3)} />
                </div>
              </div>

              {/* Visual bar showing where cm/360 sits */}
              <div className="sens-cm-bar-wrap">
                <div className="sens-cm-bar-labels">
                  <span>Baixa sens. (alto cm)</span>
                  <span>Alta sens. (baixo cm)</span>
                </div>
                <div className="sens-cm-bar-track">
                  <div
                    className="sens-cm-bar-fill"
                    style={{ width: `${Math.min(100, Math.max(2, (1 - Math.log(display.cm_per_360 / 5) / Math.log(200)) * 100))}%` }}
                  />
                  <div
                    className="sens-cm-bar-marker"
                    style={{ left: `${Math.min(98, Math.max(2, (1 - Math.log(display.cm_per_360 / 5) / Math.log(200)) * 100))}%` }}
                  />
                </div>
                <div className="sens-cm-bar-value">{fmt(display.cm_per_360, 1)} cm/360°</div>
              </div>
            </div>
          ) : (
            <div className="section-card sens-empty-result">
              <div className="sens-empty-icon">🎯</div>
              <p>Informe a sensibilidade e o DPI para ver o resultado em tempo real</p>
            </div>
          )}

          {/* History */}
          <div className="section-card">
            <div className="section-header">
              <h2><span className="section-icon">🗂️</span> Histórico</h2>
              <span className="section-duration">{history.length} conversões</span>
            </div>
            {histErr ? (
              <div className="empty-section">
                <span>⚠️</span>
                <span>Histórico indisponível. Execute a migration v2 no Supabase primeiro.</span>
              </div>
            ) : history.length === 0 ? (
              <div className="empty-section">
                <span>📭</span>
                <span>Nenhuma conversão salva ainda. Clique em "Converter e Salvar" para registrar.</span>
              </div>
            ) : (
              <div className="sens-history-list">
                {history.map((row) => <HistoryRow key={row.id} row={row} />)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
