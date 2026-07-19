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
// Rendered identically on every screen: pre-login (loading/login/register/
// forgot-password) screens just pass no children, so the right cluster shows
// only the language switcher + window controls, no user menu.
export default function TopBar({ children }) {
  const { t } = useTranslation()
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
