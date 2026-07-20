import { Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import BrandIcon from './BrandIcon'
import LanguageSwitcher from './LanguageSwitcher'
import WindowControls from './WindowControls'

// Single-line top bar (~48px) replacing the old two-row title bar + AppShell
// header split. The whole strip is a drag region (-webkit-app-region: drag)
// except the right-hand cluster (language switcher, user menu, window
// buttons), which is carved out via .topbar-controls (no-drag) so those stay
// clickable — see index.css. Double-click on the empty drag area
// maximizes/restores for free (native Windows drag-region behavior).
//
// .topbar-controls is a single flat flex row (language switcher, user menu,
// window buttons as direct siblings) with flex-shrink:0, so it can never be
// compressed/overlapped by its neighbors — .topbar-brand is the one that
// truncates under width pressure instead (min-width:0 + Text truncate).
//
// Pre-login (loading/login/register/forgot-password) screens render the full
// bar: brand + language switcher + window controls, no user menu.
//
// `minimal` is used once the sidebar exists (authenticated app shell) — brand,
// language switcher and user menu all live in the sidebar there instead, so
// the top bar shrinks to just the drag region + window controls.
export default function TopBar({ children, minimal = false }) {
  const { t } = useTranslation()
  if (minimal) {
    return (
      <div className="topbar">
        <div className="topbar-spacer" />
        <div className="topbar-controls">
          <WindowControls />
        </div>
      </div>
    )
  }
  return (
    <div className="topbar">
      <div className="topbar-brand">
        <BrandIcon size={20} />
        <Text fw={800} size="sm" truncate>{t('comum.app_name')}</Text>
      </div>
      <div className="topbar-spacer" />
      <div className="topbar-controls">
        <LanguageSwitcher />
        {children}
        <WindowControls />
      </div>
    </div>
  )
}
