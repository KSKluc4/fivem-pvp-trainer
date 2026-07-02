import { useState, useEffect } from 'react'
import { saveProgress, getUserServers, deleteUserServer } from '../services/api'
import { toast } from '../services/toast'
import AddServerModal from './AddServerModal'

const DIFFICULTY_LABELS = {
  beginner:     { label: 'Iniciante',    color: '#2ed573' },
  intermediate: { label: 'Intermediário', color: '#ffa502' },
  advanced:     { label: 'Avançado',     color: '#ff4757' },
}

const FOCUS_LABELS = { aim: 'Mira', reflex: 'Reflexo', movement: 'Movimento' }

const SECTION_ICONS = { 'Aquecimento': '🔥', 'Treino Principal': '⚡', 'Revisão': '📋' }

// ── Recommended playlists ─────────────────────────────────────────────────────
const PLAYLISTS = {
  kovaak: [
    {
      name:  'Voltaic Benchmark',
      desc:  'O padrão ouro — avalia seu nível real com 6 cenários de tracking, flick e controle',
      url:   'https://discord.gg/voltaic',
      tag:   'Benchmark',
      color: '#ffa502',
    },
    {
      name:  'Smooth & Click',
      desc:  'Progressão de tracking suave a flick shots precisos — ideal para iniciantes e intermediários',
      url:   'https://steamcommunity.com/workshop/browse/?appid=824270&searchtext=smooth+click+training',
      tag:   'Progressivo',
      color: '#00d4ff',
    },
    {
      name:  'Voltaic FPS Pack',
      desc:  'Cenários validados pela comunidade competitiva — referência de treino para FPS',
      url:   'https://steamcommunity.com/workshop/browse/?appid=824270&searchtext=voltaic+fps',
      tag:   'Competitivo',
      color: '#7b2fd4',
    },
  ],
  aimlab: [
    {
      name:  'Aim Lab Routines',
      desc:  'Rotinas oficiais organizadas por nível — iniciante, intermediário e avançado',
      url:   'https://aimlab.gg/routines',
      tag:   'Oficial',
      color: '#2ed573',
    },
    {
      name:  'Gridshot Challenge',
      desc:  'O exercício mais famoso do Aim Lab — mede velocidade, precisão e consistência',
      url:   'https://aimlab.gg/aim/tasks/gridshot',
      tag:   'Popular',
      color: '#ffa502',
    },
    {
      name:  'Tracking Fundamentals',
      desc:  'Progressão de tracking básico a avançado — do Circletrack ao Multilitrack',
      url:   'https://aimlab.gg/aim/tasks?mode=tracking',
      tag:   'Tracking',
      color: '#7b2fd4',
    },
  ],
}

// ── FiveM server links ─────────────────────────────────────────────────────────
//
// Servidores oficiais (fixos). O cfxCode é o código da URL cfx.re/join/XXXXXX —
// conecta pelo FiveM (fivem://connect/cfx.re/join/<code>) e serve de fallback de
// navegador (https://cfx.re/join/<code>) quando o FiveM.exe não é encontrado.
// Adicione novos servidores oficiais acrescentando um objeto a este array.
const FIVEM_SERVERS = [
  {
    id:       'goat',
    name:     'Goat PvP',
    desc:     'Servidor brasileiro focado em PvP tático',
    icon:     '🐐',
    cfxCode:  'q93zep',
    webUrl:   'https://discord.com/invite/goatgg',
    color:    '#00d4ff',
    official: true,
  },
  {
    id:       'plf',
    name:     'PLF',
    desc:     'Servidor brasileiro de PvP',
    icon:     '🛡️',
    cfxCode:  'oemxzx',
    color:    '#7b2fd4',
    official: true,
  },
]

const MAX_CUSTOM_SERVERS = 5

export default function TrainingRoutine({ userId, sessionId, routine, username, onViewProgress, onChangeProfile, onConverter }) {
  const [completed, setCompleted]     = useState({})
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [connectingId, setConnectingId] = useState(null)
  const [customServers, setCustomServers]           = useState([])
  const [customServersError, setCustomServersError] = useState(false)
  const [showAddServer, setShowAddServer]           = useState(false)
  const [removingId, setRemovingId]                 = useState(null)

  const mainExercises  = routine.sections[1]?.exercises || []
  const completedCount = Object.values(completed).filter(Boolean).length
  const toolLabel      = routine.tool === 'kovaak' ? "KovaaK's" : 'Aim Lab'
  const toolClass      = routine.tool === 'kovaak' ? 'tool--kovaak' : 'tool--aimlab'
  const playlists      = PLAYLISTS[routine.tool] || PLAYLISTS.aimlab

  const customServerCards = customServers.map((s) => ({
    id:       s.id,
    name:     s.name,
    desc:     null,
    icon:     '🎮',
    cfxCode:  s.cfx_code,
    color:    '#8892a4',
    official: false,
  }))
  const allServers = [...FIVEM_SERVERS, ...customServerCards]

  useEffect(() => {
    let cancelled = false
    getUserServers()
      .then((res) => { if (!cancelled) setCustomServers(res.data || []) })
      .catch(() => { if (!cancelled) setCustomServersError(true) })
    return () => { cancelled = true }
  }, [])

  const toggleExercise = (name) => setCompleted((p) => ({ ...p, [name]: !p[name] }))

  const handleConnect = async (srv) => {
    if (connectingId) return
    setConnectingId(srv.id)
    try {
      if (window.electronAPI?.connectFivem) {
        const result = await window.electronAPI.connectFivem(srv.cfxCode)
        if (result?.ok) {
          if (result.method === 'registry' || result.method === 'path') {
            toast.success('Abrindo FiveM e conectando ao servidor...')
          } else if (result.method === 'protocol') {
            toast.info('Solicitando conexão ao FiveM...')
          } else if (result.method === 'browser') {
            toast.info('FiveM não encontrado. Abrimos a página do servidor no navegador.')
          }
        } else {
          toast.error(
            <>
              Não foi possível abrir o FiveM. Verifique se ele está instalado.{' '}
              <a href="https://fivem.net" target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                Baixar FiveM
              </a>
            </>,
            6000
          )
        }
      } else {
        window.location.href = `fivem://connect/cfx.re/join/${srv.cfxCode}`
      }
    } catch (e) {
      console.error(e)
      toast.error('Não foi possível abrir o FiveM. Verifique se ele está instalado.')
    } finally {
      setConnectingId(null)
    }
  }

  const handleServerAdded = (row) => {
    setCustomServers((prev) => [...prev, row])
    setShowAddServer(false)
    toast.success('Servidor adicionado!')
  }

  const handleRemoveServer = async (srv) => {
    if (!window.confirm(`Remover o servidor "${srv.name}"?`)) return
    setRemovingId(srv.id)
    try {
      await deleteUserServer(srv.id)
      setCustomServers((prev) => prev.filter((s) => s.id !== srv.id))
      toast.success('Servidor removido.')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Erro ao remover servidor.')
    } finally {
      setRemovingId(null)
    }
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      for (const [name, done] of Object.entries(completed)) {
        if (done)
          await saveProgress({ user_id: userId, session_id: sessionId, exercise_name: name, completed: 1 })
      }
      await saveProgress({
        user_id: userId, session_id: sessionId,
        exercise_name: '__session__', completed: 1, session_completed: true,
      })
      setSaved(true)
      toast.success(`Sessão finalizada! ${completedCount} exercício${completedCount !== 1 ? 's' : ''} concluído${completedCount !== 1 ? 's' : ''}.`)
    } catch (e) {
      console.error(e)
      toast.error('Erro ao salvar sessão. Verifique sua conexão e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="routine">
      {/* ── Header ── */}
      <div className="routine-header">
        <div>
          <h1>Rotina de Hoje</h1>
          <p className="routine-meta">
            Olá, <strong>{username}</strong>&nbsp;•&nbsp;
            Foco: <span className="tag">{FOCUS_LABELS[routine.focus_area] || routine.focus_area}</span>
            &nbsp;•&nbsp;<span className={`tag ${toolClass}`}>{toolLabel}</span>
            &nbsp;•&nbsp;<span className="tag">{routine.total_duration} min</span>
          </p>
        </div>
        <div className="routine-header-btns">
          <button className="btn-secondary" onClick={onViewProgress}>📊 Progresso</button>
          <button className="btn-ghost" onClick={onConverter} title="Conversor de sensibilidade GTA V → KovaaK / Aim Lab">
            🎮 Conversor
          </button>
          <button className="btn-ghost" onClick={onChangeProfile} title="Refazer questionário de perfil">
            ⚙️ Alterar perfil
          </button>
        </div>
      </div>

      {/* ── Exercise sections ── */}
      {routine.sections.map((section, si) => (
        <div key={si} className={`section-card section-card--${si}`}>
          <div className="section-header">
            <h2>
              <span className="section-icon">{SECTION_ICONS[section.name] || '📌'}</span>
              {section.name}
            </h2>
            <span className="section-duration">{section.duration} min</span>
          </div>
          <div className="section-tip">
            <span className="tip-icon">💡</span>
            <span>{section.tip}</span>
          </div>

          {section.exercises.length > 0 ? (
            <div className="exercises-list">
              {section.exercises.map((ex, idx) => {
                const diff   = DIFFICULTY_LABELS[ex.difficulty] || { label: ex.difficulty, color: '#8892a4' }
                const isMain = section.name === 'Treino Principal'
                const isDone = !!completed[ex.name]

                return (
                  <div
                    key={ex.name}
                    className={`exercise-card ${isDone ? 'done' : ''} ${isMain ? 'clickable' : ''}`}
                    onClick={isMain ? () => toggleExercise(ex.name) : undefined}
                  >
                    <div className={`exercise-accent-bar ${toolClass}`} />
                    <div className="exercise-num">{String(idx + 1).padStart(2, '0')}</div>
                    <div className="exercise-body">
                      <div className="exercise-name-row">
                        <span className="exercise-name">{ex.name}</span>
                      </div>
                      <div className="exercise-desc">{ex.description}</div>
                      <div className="exercise-tags">
                        <span className={`tool-badge ${toolClass}`}>{toolLabel}</span>
                        <span className="difficulty-badge" style={{ color: diff.color, borderColor: diff.color }}>
                          {diff.label}
                        </span>
                      </div>
                    </div>
                    <div className="exercise-right">
                      <span className="exercise-duration">{ex.duration} min</span>
                      {isMain && (
                        <div className={`checkbox ${isDone ? 'checked' : ''}`}>{isDone ? '✓' : ''}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="empty-section">
              <span>📝</span>
              <span>Sessão de reflexão — anote suas observações e identifique o que melhorou hoje.</span>
            </div>
          )}
        </div>
      ))}

      {/* ── Footer ── */}
      <div className="routine-footer">
        <div className="footer-progress">
          <div className="progress-summary">
            {completedCount}/{mainExercises.length} exercícios concluídos
          </div>
          <div className="footer-bar-track">
            <div
              className="footer-bar-fill"
              style={{ width: mainExercises.length ? `${(completedCount / mainExercises.length) * 100}%` : '0%' }}
            />
          </div>
        </div>
        {!saved ? (
          <button
            className="btn-primary"
            onClick={handleFinish}
            disabled={saving || completedCount === 0}
            title={completedCount === 0 ? 'Marque pelo menos um exercício para finalizar' : ''}
          >
            {saving
              ? <><span style={{ opacity: 0.7 }}>Salvando</span><span className="saving-dots">...</span></>
              : 'Finalizar Sessão ✓'}
          </button>
        ) : (
          <div className="success-msg">🏆 Sessão salva! Bom treino, {username}!</div>
        )}
      </div>

      {/* ── Recommended Playlists ── */}
      <div className="playlists-section">
        <div className="playlists-header">
          <h3>Playlists Recomendadas — {toolLabel}</h3>
          <p>Coleções curadas para acelerar sua evolução</p>
        </div>
        <div className="playlists-grid">
          {playlists.map((pl) => (
            <a
              key={pl.name}
              href={pl.url}
              target="_blank"
              rel="noreferrer"
              className="playlist-card"
              style={{ '--pl-color': pl.color }}
            >
              <div className="playlist-tag" style={{ color: pl.color, borderColor: pl.color }}>
                {pl.tag}
              </div>
              <div className="playlist-name">{pl.name}</div>
              <div className="playlist-desc">{pl.desc}</div>
              <div className="playlist-cta">Acessar →</div>
            </a>
          ))}
        </div>
      </div>

      {/* ── FiveM Server Links ── */}
      <div className="server-links-section">
        <div className="server-links-header">
          <h3>Praticar no Servidor</h3>
          <p>Aplique o treino em servidores PvP reais do FiveM</p>
        </div>
        <div className="server-btns">
          {allServers.map((srv) => (
            <div
              key={srv.official ? srv.id : `custom-${srv.id}`}
              className={`server-card ${srv.official ? '' : 'server-card--custom'}`}
              style={{ '--srv-color': srv.color }}
            >
              {!srv.official && <span className="server-card-badge">Personalizado</span>}
              <div className="server-card-icon">{srv.icon}</div>
              <div className="server-card-info">
                <div className="server-card-name">{srv.name}</div>
                {srv.desc && <div className="server-card-desc">{srv.desc}</div>}
              </div>
              <div className="server-card-actions">
                <button
                  className="btn-server btn-server--connect"
                  title="Conectar direto no FiveM"
                  disabled={connectingId === srv.id}
                  onClick={() => handleConnect(srv)}
                >
                  {connectingId === srv.id ? 'Conectando…' : 'Conectar'}
                </button>
                {srv.webUrl && (
                  <a href={srv.webUrl} target="_blank" rel="noreferrer" className="btn-server btn-server--discord">
                    Discord
                  </a>
                )}
                {!srv.official && (
                  <button
                    className="server-card-remove"
                    title="Remover servidor"
                    disabled={removingId === srv.id}
                    onClick={() => handleRemoveServer(srv)}
                  >
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}

          {customServers.length < MAX_CUSTOM_SERVERS && (
            <button type="button" className="server-card server-card--add" onClick={() => setShowAddServer(true)}>
              <span className="server-card-add-icon">➕</span>
              <span>Adicionar servidor</span>
            </button>
          )}
        </div>

        {customServersError && (
          <div className="server-links-warning">
            ⚠️ Não foi possível carregar seus servidores personalizados no momento.
          </div>
        )}
      </div>

      {showAddServer && (
        <AddServerModal onClose={() => setShowAddServer(false)} onAdded={handleServerAdded} />
      )}
    </div>
  )
}
