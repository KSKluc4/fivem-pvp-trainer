import { useState, useEffect, useRef } from 'react'
import { getMe, updateProfile } from '../services/api'
import { toast } from '../services/toast'

const LEVELS = [
  { min: 50, label: 'Elite',        icon: '🏆', color: '#ffa502' },
  { min: 30, label: 'Veterano',     icon: '🏅', color: '#7b2fd4' },
  { min: 15, label: 'Especialista', icon: '🔥', color: '#ff4757' },
  { min: 5,  label: 'Atirador',     icon: '⚔️', color: '#00d4ff' },
  { min: 1,  label: 'Recruta',      icon: '🎯', color: '#2ed573' },
  { min: 0,  label: 'Novato',       icon: '🌱', color: '#7a839a' },
]

function getLevel(n) { return LEVELS.find((l) => n >= l.min) || LEVELS[LEVELS.length - 1] }

function initials(name) {
  return (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

function avatarHue(username) {
  let h = 0
  for (const c of (username || '')) h = (h * 31 + c.charCodeAt(0)) & 0xfffff
  const hues = [195, 270, 350, 145, 35]
  return hues[h % hues.length]
}

export default function UserMenu({ user, onLogout, onUserUpdate, onChangeProfile, onConverter, onAdmin }) {
  const [open,    setOpen]    = useState(false)
  const [profile, setProfile] = useState(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', username: '' })
  const [editErr,  setEditErr]  = useState(null)
  const [saving,   setSaving]   = useState(false)
  const ref = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Fetch full profile when dropdown opens
  useEffect(() => {
    if (!open) return
    getMe().then((res) => setProfile(res.data)).catch(console.error)
  }, [open])

  const hue      = avatarHue(user.username)
  const inits    = initials(user.name)
  const level    = getLevel(profile?.stats?.sessions_completed ?? 0)

  const startEdit = () => {
    setEditForm({ name: user.name, username: user.username })
    setEditErr(null)
    setEditing(true)
  }

  const handleSave = async () => {
    setEditErr(null)
    setSaving(true)
    try {
      const res = await updateProfile(editForm)
      onUserUpdate(res.data)
      setEditing(false)
      setOpen(false)
      setProfile(null) // force reload on next open
      toast.success('Perfil atualizado com sucesso!')
    } catch (err) {
      const msg = err.response?.data?.error || 'Erro ao salvar. Tente novamente.'
      setEditErr(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => onLogout()

  return (
    <div className="user-menu" ref={ref}>
      {/* Avatar button */}
      <button
        className="user-avatar-btn"
        onClick={() => setOpen((p) => !p)}
        style={{ background: `hsl(${hue}, 70%, 40%)` }}
        title={user.name}
      >
        {inits}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="user-dropdown">
          {/* Header */}
          <div className="ud-header">
            <div
              className="ud-avatar-lg"
              style={{ background: `hsl(${hue}, 70%, 35%)` }}
            >
              {inits}
            </div>
            <div className="ud-identity">
              <div className="ud-name">{user.name}</div>
              <div className="ud-username">@{user.username}</div>
              <div className="ud-level" style={{ color: level.color }}>
                {level.icon} {level.label}
              </div>
            </div>
          </div>

          {/* Stats */}
          {profile && (
            <div className="ud-stats">
              <div className="ud-stat">
                <span className="ud-stat-val">{profile.stats.days_trained}</span>
                <span className="ud-stat-lbl">dias</span>
              </div>
              <div className="ud-stat-sep" />
              <div className="ud-stat">
                <span className="ud-stat-val">{profile.stats.streak}</span>
                <span className="ud-stat-lbl">streak</span>
              </div>
              <div className="ud-stat-sep" />
              <div className="ud-stat">
                <span className="ud-stat-val">{profile.stats.exercises_done}</span>
                <span className="ud-stat-lbl">exercícios</span>
              </div>
            </div>
          )}

          {/* Edit form */}
          {editing ? (
            <div className="ud-edit-form">
              <div className="auth-field">
                <label>Nome</label>
                <input
                  className="name-input ud-input"
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Nome completo"
                />
              </div>
              <div className="auth-field">
                <label>Username</label>
                <input
                  className="name-input ud-input"
                  value={editForm.username}
                  onChange={(e) => setEditForm((p) => ({ ...p, username: e.target.value }))}
                  placeholder="username"
                />
              </div>
              {editErr && <div className="ud-error">⚠️ {editErr}</div>}
              <div className="ud-edit-actions">
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
                <button className="btn-secondary" onClick={() => setEditing(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="ud-actions">
              <button className="ud-action-btn" onClick={startEdit}>
                ✏️ Editar perfil
              </button>
              <button className="ud-action-btn" onClick={() => { setOpen(false); onChangeProfile?.() }}>
                ⚙️ Alterar perfil de treino
              </button>
              <button className="ud-action-btn" onClick={() => { setOpen(false); onConverter?.() }}>
                🎮 Conversor de sensibilidade
              </button>
              {user.is_admin && (
                <button className="ud-action-btn ud-action-btn--admin" onClick={() => { setOpen(false); onAdmin?.() }}>
                  ⚙️ Painel admin
                </button>
              )}
              <button className="ud-action-btn ud-action-btn--logout" onClick={handleLogout}>
                🚪 Sair
              </button>
            </div>
          )}
          <div className="ud-version">
            {window.electronAPI ? 'Desktop' : 'Web'} · FiveM PvP Trainer
          </div>
        </div>
      )}
    </div>
  )
}
