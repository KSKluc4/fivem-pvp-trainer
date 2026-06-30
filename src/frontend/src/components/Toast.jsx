import { useState, useEffect } from 'react'
import { toast } from '../services/toast'

const ICONS = { success: '✓', error: '✕', info: 'i' }

export default function ToastContainer() {
  const [items, setItems] = useState([])
  const [exiting, setExiting] = useState(new Set())

  useEffect(() => {
    return toast.subscribe((item) => {
      setItems((prev) => [...prev, item])
      const exitTimer = setTimeout(() => {
        setExiting((prev) => new Set([...prev, item.id]))
        setTimeout(() => {
          setItems((prev) => prev.filter((t) => t.id !== item.id))
          setExiting((prev) => { const s = new Set(prev); s.delete(item.id); return s })
        }, 280)
      }, item.duration)
      return () => clearTimeout(exitTimer)
    })
  }, [])

  if (!items.length) return null

  return (
    <div className="toast-container" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`toast toast--${t.type} ${exiting.has(t.id) ? 'toast--exit' : ''}`}
          role="alert"
        >
          <span className="toast-icon">{ICONS[t.type]}</span>
          <span className="toast-msg">{t.msg}</span>
        </div>
      ))}
    </div>
  )
}
