// Shared avatar fallback (initials + deterministic background hue) — used
// everywhere an Avatar renders (sidebar/UserMenu, profile screen) so a user
// without an uploaded photo looks the same in every spot.

export function initials(name) {
  return (name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
}

export function avatarHue(username) {
  let h = 0
  for (const c of (username || '')) h = (h * 31 + c.charCodeAt(0)) & 0xfffff
  const hues = [195, 270, 350, 145, 35]
  return hues[h % hues.length]
}
