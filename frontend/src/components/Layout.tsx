import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/useTheme'
import type { Theme } from '../theme/ThemeContext'
import { setUiLanguage, getUiLanguage, setExplanationLanguage, getExplanationLanguage } from '../i18n'
import { useAuth } from '../auth/useAuth'
import { Sidebar } from './Sidebar'

const primaryNav = [
  { to: '/', key: 'nav.home', end: true },
  { to: '/dashboard', key: 'nav.dashboard' },
  { to: '/trustscan', key: 'nav.trustscan' },
  { to: '/reports', key: 'nav.reports' },
]

export function Layout() {
  const { t, i18n } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const uiLang = getUiLanguage()
  const explLang = getExplanationLanguage()

  async function onLogout() {
    await logout()
    navigate('/')
  }

  const linkBase = 'rounded px-2 py-1 text-cream/90 transition hover:text-cream'
  const active = 'bg-caramel/20 text-cream'
  const showSidebar =
    !!user &&
    ['/dashboard', '/trustscan', '/message-analyzer', '/reports', '/history', '/saved', '/settings', '/admin', '/exposure'].some(
      (p) => location.pathname.startsWith(p),
    )

  return (
    <div className="min-h-screen bg-bg text-text">
      <a href="#main" className="skip-link">{t('common.skipToContent')}</a>
      <header className="sticky top-0 z-40 border-b border-latte/30 bg-espresso text-cream shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <NavLink to="/" className="mr-3 text-xl font-semibold tracking-wide text-cream">VERITORA</NavLink>
          <nav aria-label="Primary" className="flex flex-wrap items-center gap-1 text-sm">
            {primaryNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) => `${linkBase} ${isActive ? active : ''}`}
              >
                {t(item.key)}
              </NavLink>
            ))}
            <NavLink to="/help/cybercrime" className={({ isActive }) => `${linkBase} ${isActive ? active : ''}`}>
              {t('nav.help')}
            </NavLink>
          </nav>
          <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
            {user ? (
              <>
                <NavLink to="/settings" className={linkBase}>{t('nav.settings')}</NavLink>
                <button type="button" onClick={onLogout} className="rounded border border-cream/30 px-2 py-1 text-cream/90 hover:text-cream">Logout</button>
              </>
            ) : (
              <>
                <NavLink to="/signin" className={linkBase}>{t('nav.signin')}</NavLink>
                <NavLink to="/signup" className="rounded bg-caramel px-3 py-1 font-medium text-buttonText hover:opacity-95">{t('nav.signup')}</NavLink>
              </>
            )}
            <label className="flex items-center gap-1">
              <span className="sr-only">{t('theme.label')}</span>
              <select
                aria-label={t('theme.label')}
                value={theme}
                onChange={(e) => setTheme(e.target.value as Theme)}
                className="rounded border border-cream/30 bg-espresso/80 px-2 py-1 text-cream"
              >
                <option value="light">{t('theme.light')}</option>
                <option value="dark">{t('theme.dark')}</option>
                <option value="system">{t('theme.system')}</option>
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="sr-only">{t('language.label')}</span>
              <select
                aria-label={t('language.label')}
                value={uiLang}
                onChange={(e) => {
                  const lang = e.target.value as 'en' | 'hi'
                  setUiLanguage(lang)
                  void i18n.changeLanguage(lang)
                }}
                className="rounded border border-cream/30 bg-espresso/80 px-2 py-1 text-cream"
              >
                <option value="en">EN</option>
                <option value="hi">HI</option>
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="sr-only">{t('explanation.label')}</span>
              <select
                aria-label={t('explanation.label')}
                value={explLang}
                onChange={(e) => setExplanationLanguage(e.target.value as 'en' | 'hi')}
                className="rounded border border-cream/30 bg-espresso/80 px-2 py-1 text-cream"
              >
                <option value="en">Expl: EN</option>
                <option value="hi">Expl: HI</option>
              </select>
            </label>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-8">
        {showSidebar ? (
          <div className="flex flex-col gap-6 md:flex-row md:items-start">
            <Sidebar />
            <div className="min-w-0 flex-1">
              <Outlet />
            </div>
          </div>
        ) : (
          <Outlet />
        )}
      </main>
      <footer className="border-t border-border bg-surface2/40">
        <div className="mx-auto max-w-7xl px-4 py-6 text-sm text-muted">
          <p>{t('common.disclaimer')}</p>
        </div>
      </footer>
    </div>
  )
}