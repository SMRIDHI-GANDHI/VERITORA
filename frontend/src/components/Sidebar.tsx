import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../auth/useAuth'

type SidebarItem = { to: string; key?: string; label?: string }

const items: SidebarItem[] = [
  { to: '/dashboard', key: 'nav.dashboard' },
  { to: '/trustscan', key: 'nav.trustscan' },
  { to: '/message-analyzer', key: 'nav.messageAnalyzer' },
  { to: '/reports', key: 'nav.communityReports' },
  { to: '/history', key: 'nav.history' },
  { to: '/saved', key: 'nav.saved' },
  { to: '/passports', key: 'nav.myPassports' },
  { to: '/exposure', label: 'Data Exposure' },
  { to: '/settings', key: 'nav.settings' },
]

const adminItems: SidebarItem[] = [
  { to: '/admin', key: 'nav.adminReports' },
  { to: '/admin/network', key: 'nav.adminNetwork' },
  { to: '/admin/watchlist', key: 'nav.adminWatchlist' },
  { to: '/admin/trends', key: 'nav.adminTrends' },
]

export function Sidebar() {
  const { t } = useTranslation()
  const { user } = useAuth()
  if (!user) return null
  return (
    <aside className="w-full shrink-0 md:w-60" aria-label="Dashboard navigation">
      <nav className="rounded-xl border border-border bg-surface p-3">
        <ul className="space-y-1 text-sm">
          {items.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `block rounded-lg px-3 py-2 transition ${isActive ? 'bg-caramel/20 font-medium text-heading' : 'text-text hover:bg-latte/40'}`
                }
              >
                {item.key ? t(item.key) : item.label}
              </NavLink>
            </li>
          ))}
          {(user.role === 'moderator' || user.role === 'admin') && (
            <>
              <li className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted">Admin</li>
              {adminItems.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === '/admin'}
                    className={({ isActive }) =>
                      `block rounded-lg px-3 py-2 transition ${isActive ? 'bg-caramel/20 font-medium text-heading' : 'text-text hover:bg-latte/40'}`
                    }
                  >
                    {item.key ? t(item.key) : item.label}
                  </NavLink>
                </li>
              ))}
            </>
          )}
        </ul>
      </nav>
    </aside>
  )
}