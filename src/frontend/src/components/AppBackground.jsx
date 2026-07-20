import { useEffect, useState } from 'react'

// Single reusable decorative background — a static crosshair/reticle grid,
// two brand-color glows and a vignette, rendered once in a fixed layer below
// all content (see .app-background rules in index.css). `intensity` scales
// the whole thing via CSS custom properties, so there's exactly one set of
// gradient definitions shared by the auth screens ("full") and every
// internal screen ("subtle") — no per-screen CSS/SVG duplication.
//
// The glow layer's slow pulse is paused while the window is unfocused
// (data-focused) so it costs nothing when the app is in the background.
export default function AppBackground({ intensity = 'subtle' }) {
  const [focused, setFocused] = useState(() => (typeof document !== 'undefined' ? document.hasFocus() : true))

  useEffect(() => {
    const onFocus = () => setFocused(true)
    const onBlur  = () => setFocused(false)
    window.addEventListener('focus', onFocus)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('blur', onBlur)
    }
  }, [])

  return (
    <div
      className={`app-background app-background--${intensity}`}
      data-focused={focused}
      aria-hidden="true"
    />
  )
}
