import { useState, useEffect, useCallback } from 'react'
import { convertSensitivity, getSensitivityHistory } from '../services/api'
import { toast } from '../services/toast'
import { ZONES, getZone } from '../utils/sensitivityZones'

// Community-validated yaw values (mirrors backend constants)
const GTA_YAW    = 0.0009  // GTA V scale 0–100 (in-game slider)
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
  const [gtaSens, setGtaSens]     = useState('50')
  const [dpi,     setDpi]         = useState('800')
  const [result,  setResult]      = useState(null)
  const [history, setHistory]     = useState([])
  const [loading, setLoading]     = useState(false)
  const [histErr, setHistErr]     = useState(false)
  const [showFormula, setShowFormula] = useState(false)

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

    if (isNaN(s) || s === 0)          { toast.error('Informe uma sensibilidade válida (diferente de zero).'); return }
    if (Math.abs(s) > 100)            { toast.error('Sensibilidade deve estar entre -100 e 100.'); return }
    if (isNaN(d) || d <= 0)           { toast.error('Informe um DPI válido (número positivo).'); return }

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
                  <span className="sens-label-hint">escala 0–100 · aceita negativo para eixo invertido</span>
                </label>
                <input
                  type="number"
                  step="1"
                  min="-100"
                  max="100"
                  className="name-input sens-input"
                  value={gtaSens}
                  onChange={(e) => setGtaSens(e.target.value)}
                  placeholder="ex: 50 ou -35"
                  autoFocus
                />
                <p className="sens-hint">
                  Configure em GTA V → <code>Opções → Controles → Sensibilidade do Mouse</code>
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

          {/* Formula info — collapsible */}
          <div className="section-card sens-formula-card">
            <button
              className="sens-formula-toggle"
              type="button"
              onClick={() => setShowFormula((v) => !v)}
              aria-expanded={showFormula}
            >
              <span>{showFormula ? '▾' : '▸'}</span>
              Como calculamos isso?
            </button>
            <div className={`sens-formula-collapse ${showFormula ? 'open' : ''}`}>
              <div className="sens-formula-divider" style={{ margin: '0.5rem 0 0.75rem' }} />
              <div className="sens-formula-rows">
                <div className="sens-formula-row">
                  <span className="sens-formula-label">GTA V yaw</span>
                  <code className="sens-formula-val">0.0009 °/count</code>
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
                {display && (
                  <div className="sens-formula-result-cm">
                    <span className="sens-formula-label">cm / 360° exato</span>
                    <code className="sens-formula-val">{fmt(display.cm_per_360, 4)} cm</code>
                  </div>
                )}
                <p className="sens-formula-source">
                  Valores validados pela comunidade via mouse-sensitivity.com e r/FPSAimTrainer
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Result panel ── */}
        <div className="sens-results-col">
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

              <ZoneDisplay cm={display.cm_per_360} kovaak={display.kovaak_sensitivity} aimlab={display.aimlab_sensitivity} />
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

function ZoneDisplay({ cm, kovaak, aimlab }) {
  const zone = getZone(cm)

  return (
    <div className="sens-zone-display">
      {/* Zone name + icon */}
      <div className="sens-zone-name-wrap">
        <span className="sens-zone-icon">{zone.icon}</span>
        <span className="sens-zone-name" style={{ color: zone.color }}>{zone.label}</span>
      </div>

      {/* 5-zone chip strip */}
      <div className="sens-zone-chips">
        {ZONES.map((z) => (
          <div
            key={z.id}
            className={`sens-zone-chip ${z.id === zone.id ? 'active' : ''}`}
            style={z.id === zone.id
              ? { background: z.color, borderColor: z.color, color: '#080810' }
              : { borderColor: z.color + '55', color: z.color + 'aa' }
            }
            title={z.label}
          >
            <span className="sens-chip-icon">{z.icon}</span>
            <span className="sens-chip-label">{z.label}</span>
          </div>
        ))}
      </div>

      {/* Zone phrase */}
      <p className="sens-zone-phrase">{zone.phrase}</p>

      {/* 180° travel card */}
      <div className="sens-180-card">
        <span className="sens-180-icon">📐</span>
        <div className="sens-180-text">
          <span className="sens-180-label">Para girar 180°</span>
          <span className="sens-180-value">~{(cm / 2).toFixed(1)} cm de mousepad</span>
        </div>
      </div>

      {/* Trainer values */}
      <div className="sens-trainer-row">
        <div className="sens-trainer-item">
          <span className="sens-trainer-label">KovaaK's</span>
          <span className="sens-trainer-value">{fmt(kovaak, 3)}</span>
          <CopyBtn value={fmt(kovaak, 3)} />
        </div>
        <div className="sens-trainer-divider" />
        <div className="sens-trainer-item">
          <span className="sens-trainer-label">Aim Lab</span>
          <span className="sens-trainer-value">{fmt(aimlab, 3)}</span>
          <CopyBtn value={fmt(aimlab, 3)} />
        </div>
      </div>

      {/* Qualitative reference */}
      <p className="sens-ref-line">
        <span className="sens-ref-icon">💡</span>
        {zone.ref}
      </p>
    </div>
  )
}
