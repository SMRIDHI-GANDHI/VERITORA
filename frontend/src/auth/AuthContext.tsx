import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import * as api from '../lib/api'
import type { User } from '../lib/api'
import { setUiLanguage, setExplanationLanguage } from '../i18n'
import { useTheme } from '../theme/useTheme'
import { AuthContext } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { setTheme } = useTheme()

  const applyProfile = useCallback((u: User | null) => {
    if (!u) return
    if (u.preferred_language) setUiLanguage(u.preferred_language)
    if (u.explanation_language) setExplanationLanguage(u.explanation_language)
    if (u.theme) setTheme(u.theme)
  }, [setTheme])

  const refreshMe = useCallback(async () => {
    try {
      const me = await api.getMe()
      setUser(me)
      applyProfile(me)
    } catch {
      setUser(null)
      api.setAccessToken(null)
    }
  }, [applyProfile])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.refresh()
        if (res.access_token) api.setAccessToken(res.access_token)
        if (!cancelled) {
          setUser(res.user)
          applyProfile(res.user)
        }
      } catch {
        if (!cancelled) {
          api.setAccessToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [applyProfile])

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login({ email, password })
    if (res.access_token) api.setAccessToken(res.access_token)
    setUser(res.user)
    applyProfile(res.user)
  }, [applyProfile])

  const register = useCallback(async (name: string, email: string, password: string) => {
    const res = await api.register({ name, email, password })
    if (res.access_token) api.setAccessToken(res.access_token)
    setUser(res.user)
    applyProfile(res.user)
  }, [applyProfile])

  const logoutFn = useCallback(async () => {
    try { await api.logout() } catch { /* ignore */ }
    api.setAccessToken(null)
    setUser(null)
  }, [])

  const value = useMemo(() => ({ user, loading, login, register, logout: logoutFn, refreshMe }), [user, loading, login, register, logoutFn, refreshMe])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

