import { useId } from 'react'

// Icon-only crosshair mark — mirrors assets/brand/logo.svg (the project's
// single source of truth for the brand mark). Used standalone in the app
// header / title bar, and combined with the wordmark in BrandLogo.
export default function BrandIcon({ size = 28 }) {
  const gradientId = useId()
  return (
    <svg width={size} height={size} viewBox="0 0 56 56" fill="none" aria-hidden="true">
      <circle cx="28" cy="28" r="24" stroke={`url(#${gradientId})`} strokeWidth="2.5" />
      <circle cx="28" cy="28" r="10" stroke={`url(#${gradientId})`} strokeWidth="2" />
      <circle cx="28" cy="28" r="3" fill={`url(#${gradientId})`} />
      <line x1="28" y1="2"  x2="28" y2="16" stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="28" y1="40" x2="28" y2="54" stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="2"  y1="28" x2="16" y2="28" stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="40" y1="28" x2="54" y2="28" stroke={`url(#${gradientId})`} strokeWidth="2.5" strokeLinecap="round" />
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="56" y2="56" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00d4ff" /><stop offset="1" stopColor="#7b2fd4" />
        </linearGradient>
      </defs>
    </svg>
  )
}
