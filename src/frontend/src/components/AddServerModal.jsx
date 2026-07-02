import { useState } from 'react'
import { addUserServer } from '../services/api'

const CFX_CODE_RE = /^[a-z0-9]{4,10}$/

// Accepts "https://cfx.re/join/abc123", "cfx.re/join/abc123" or just "abc123"
// and extracts the bare join code.
function parseCfxCode(raw) {
  const trimmed = (raw || '').trim()
  if (!trimmed) return ''
  const joinMatch = trimmed.match(/cfx\.re\/join\/([a-z0-9]+)/i)
  if (joinMatch) return joinMatch[1].toLowerCase()
  return trimmed.replace(/^https?:\/\//i, '').replace(/\/+$/, '').toLowerCase()
}

export default function AddServerModal({ onClose, onAdded }) {
  const [name, setName]     = useState('')
  const [link, setLink]     = useState('')
  const [nameErr, setNameErr] = useState(null)
  const [linkErr, setLinkErr] = useState(null)
  const [formErr, setFormErr] = useState(null)
  const [saving, setSaving]   = useState(false)

  const validate = () => {
    const trimmedName = name.trim()
    let nextNameErr = null
    if (!trimmedName) nextNameErr = 'Informe um nome para o servidor.'
    else if (trimmedName.length > 40) nextNameErr = 'Nome deve ter no máximo 40 caracteres.'
    setNameErr(nextNameErr)

    const code = parseCfxCode(link)
    const nextLinkErr = CFX_CODE_RE.test(code)
      ? null
      : 'Link ou código cfx.re inválido. Use algo como cfx.re/join/abc123.'
    setLinkErr(nextLinkErr)

    if (nextNameErr || nextLinkErr) return null
    return { name: trimmedName, cfx_code: code }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setFormErr(null)
    const payload = validate()
    if (!payload) return

    setSaving(true)
    try {
      const res = await addUserServer(payload)
      onAdded(res.data)
    } catch (err) {
      setFormErr(err.response?.data?.error || 'Erro ao adicionar servidor. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-card">
        <div className="modal-header">
          <h3>Adicionar servidor</h3>
          <button className="modal-close" onClick={onClose} title="Fechar" type="button">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="auth-field">
            <label>Nome do servidor</label>
            <input
              className="name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Minha Cidade RP"
              maxLength={40}
              autoFocus
            />
            {nameErr && <div className="modal-field-error">⚠️ {nameErr}</div>}
          </div>
          <div className="auth-field">
            <label>Link ou código cfx.re</label>
            <input
              className="name-input"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="cfx.re/join/abc123 ou abc123"
            />
            {linkErr && <div className="modal-field-error">⚠️ {linkErr}</div>}
          </div>
          {formErr && <div className="modal-field-error">⚠️ {formErr}</div>}
          <div className="modal-actions">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Adicionando...' : 'Adicionar'}
            </button>
            <button type="button" className="btn-secondary" onClick={onClose}>
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
