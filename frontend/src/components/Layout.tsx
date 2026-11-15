import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/useTheme'
import type { Theme } from '../theme/ThemeContext'
import { setUiLanguage, getUiLanguage, setExplanationLanguage, getExplanationLanguage } from '../i18n'
import { useAuth } from '../auth/useAuth'
import { Icon } from './ui/Icon'

type NavItem = { to: string; key: string; end?: boolean }

const workNav: NavItem[] = [
  { to: '/dashboard', key: 'nav.dashboard' },
  { to: '/trustscan', key: 'nav.trustscan' },
  { to: '/message-analyzer', key: 'nav.messageAnalyzer' },
  { to: '/reports', key: 'nav.communityReports' },
]

const recordNav: NavItem[] = [
  { to: '/history', key: 'nav.history' },
  { to: '/saved', key: 'nav.saved' },
  { to: '/passports', key: 'nav.myPassports' },
  { to: '/exposure', key: 'nav.exposure' },
]

const accountNav: NavItem[] = [
  { to: '/settings', key: 'nav.settings' },
  { to: '/help/cybercrime', key: 'nav.help' },
]

const adminNav: NavItem[] = [
  { to: '/admin', key: 'nav.adminReports', end: true },
  { to: '/admin/network', key: 'nav.adminNetwork' },
  { to: '/admin/watchlist', key: 'nav.adminWatchlist' },
  { to: '/admin/trends', key: 'nav.adminTrends' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2.5 px-3 py-2 text-[14.5px] leading-snug transition-colors duration-150 ${
    isActive ? 'bg-paper font-semibold text-cover' : 'text-paper/85 hover:bg-paper/10 hover:text-paper'
  }`

function RailNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  const { user } = useAuth()

  const group = (label: string, items: NavItem[]) => (
    <li>
      <p className="px-3 pb-1 pt-4 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-paper/70">{label}</p>
      <ul className="space-y-0.5">
        {items.map((item) => (
          <li key={item.to}>
            <NavLink to={item.to} end={item.end} className={linkClass} onClick={onNavigate}>
              {t(item.key)}
            </NavLink>
          </li>
        ))}
      </ul>
    </li>
  )

  return (
    <ul>
      <li>
        <NavLink to="/" end className={linkClass} onClick={onNavigate}>
          {t('nav.home')}
        </NavLink>
      </li>
      {user && group(t('rail.work'), workNav)}
      {user && group(t('rail.records'), recordNav)}
      {user && group(t('rail.account'), accountNav)}
      {user && (user.role === 'moderator' || user.role === 'admin') && group(t('rail.admin'), adminNav)}
      {!user && (
        <li>
          <NavLink to="/help/cybercrime" className={linkClass} onClick={onNavigate}>
            {t('nav.help')}
          </NavLink>
        </li>
      )}
    </ul>
  )
}

function RailControls({ onNavigate }: { onNavigate?: () => void }) {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const uiLang = getUiLanguage()
  const explLang = getExplanationLanguage()

  async function onLogout() {
    await logout()
    navigate('/')
    onNavigate?.()
  }

  const controlClass =
    'w-full border border-paper/35 bg-cover px-2 py-1.5 font-mono text-[12px] tracking-wide text-paper'

  const selectLabel = 'mb-1 block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-paper/70'

  return (
    <div className="space-y-2 border-t border-paper/25 px-3 pb-4 pt-4">
      <label className="block">
        <span className={selectLabel}>{t('theme.label')}</span>
        <select
          aria-label={t('theme.label')}
          value={theme}
          onChange={(e) => setTheme(e.target.value as Theme)}
          className={controlClass}
        >
          <option value="light">{t('theme.light')}</option>
          <option value="dark">{t('theme.dark')}</option>
          <option value="system">{t('theme.system')}</option>
        </select>
      </label>
      <label className="block">
        <span className={selectLabel}>{t('language.label')}</span>
        <select
          aria-label={t('language.label')}
          value={uiLang}
          onChange={(e) => {
            const lang = e.target.value as 'en' | 'hi'
            setUiLanguage(lang)
            void i18n.changeLanguage(lang)
          }}
          className={controlClass}
        >
          <option value="en">EN</option>
          <option value="hi">HI</option>
        </select>
      </label>
      <label className="block">
        <span className={selectLabel}>{t('explanation.label')}</span>
        <select
          aria-label={t('explanation.label')}
          value={explLang}
          onChange={(e) => setExplanationLanguage(e.target.value as 'en' | 'hi')}
          className={controlClass}
        >
          <option value="en">Expl: EN</option>
          <option value="hi">Expl: HI</option>
        </select>
      </label>

      {user ? (
        <button
          type="button"
          onClick={() => void onLogout()}
          className="mt-2 w-full border border-paper/45 px-3 py-2 text-[13px] font-semibold text-paper transition hover:bg-paper hover:text-cover"
        >
          {t('nav.logout')}
        </button>
      ) : (
        <div className="mt-2 grid gap-2">
          <NavLink
            to="/signin"
            onClick={onNavigate}
            className="w-full border border-paper/45 px-3 py-2 text-center text-[13px] font-semibold text-paper transition hover:bg-paper hover:text-cover"
          >
            {t('nav.signin')}
          </NavLink>
          <NavLink
            to="/signup"
            onClick={onNavigate}
            className="w-full bg-paper px-3 py-2 text-center text-[13px] font-semibold text-cover transition hover:bg-tint"
          >
            {t('nav.signup')}
          </NavLink>
        </div>
      )}
    </div>
  )
}

function RailBody({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation()
  return (
    <>
      <div className="px-3 pb-3 pt-5">
        <NavLink to="/" onClick={onNavigate} className="block text-[22px] font-bold leading-none tracking-[0.16em] text-paper">
          VERITORA
        </NavLink>
        <p className="mt-2 font-mono text-[10px] font-bold uppercase tracking-[0.24em] text-paper/70">{t('rail.file')}</p>
      </div>
      <div className="h-px bg-paper/25" aria-hidden="true" />
      <nav aria-label="Primary" className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        <RailNav onNavigate={onNavigate} />
      </nav>
      <RailControls onNavigate={onNavigate} />
    </>
  )
}

export function Layout() {
  const { t } = useTranslation()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <div className="min-h-screen bg-bg text-text lg:flex">
      <a href="#main" className="skip-link">
        {t('common.skipToContent')}
      </a>

      {/* Narrow screens: the rail folds into a bar; the file itself is unchanged. */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b-2 border-heading bg-cover px-4 py-3 text-paper lg:hidden">
        <NavLink to="/" className="text-lg font-bold tracking-[0.16em] text-paper">
          VERITORA
        </NavLink>
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls={menuOpen ? 'rail-drawer' : undefined}
          className="flex items-center gap-2 border border-paper/45 px-3 py-1.5 text-[13px] font-semibold"
        >
          <Icon name={menuOpen ? 'close' : 'menu'} size={16} />
          {menuOpen ? t('common.close') : t('nav.menu')}
        </button>
      </header>

      {menuOpen && (
        <div id="rail-drawer" className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-cover lg:hidden">
          <div className="flex items-center justify-between border-b border-paper/25 px-4 py-3">
            <span className="text-lg font-bold tracking-[0.16em] text-paper">VERITORA</span>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="flex items-center gap-2 border border-paper/45 px-3 py-1.5 text-[13px] font-semibold"
            >
              <Icon name="close" size={16} />
              {t('common.close')}
            </button>
          </div>
          <RailBody onNavigate={() => setMenuOpen(false)} />
        </div>
      )}

      <aside className="sticky top-0 hidden h-screen w-[252px] shrink-0 flex-col overflow-y-auto border-r-2 border-heading bg-cover text-paper lg:flex">
        <RailBody />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <main id="main" className="mx-auto w-full max-w-[1240px] flex-1 px-5 py-8 sm:px-8">
          <Outlet />
        </main>
        <footer className="border-t border-border bg-surface2/40">
          <div className="mx-auto w-full max-w-[1240px] px-5 py-6 text-[13px] leading-relaxed text-muted sm:px-8">
            <p>{t('common.disclaimer')}</p>
          </div>
        </footer>
      </div>
    </div>
  )
}
