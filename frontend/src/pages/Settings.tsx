import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { deleteMe, patchMe, type User } from '../lib/api'
import { setExplanationLanguage, setUiLanguage } from '../i18n'
import { useTheme } from '../theme/useTheme'
import type { Theme } from '../theme/ThemeContext'

export function Settings() {
  const { user, refreshMe, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [name, setName] = useState(user?.name ?? '')
  const [uiLang, setUiLang] = useState<'en' | 'hi'>(user?.preferred_language ?? 'en')
  const [explLang, setExplLang] = useState<'en' | 'hi'>(user?.explanation_language ?? 'en')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [showDelete, setShowDelete] = useState(false)
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (user) {
      setName(user.name ?? '')
      setUiLang((user.preferred_language as 'en' | 'hi') ?? 'en')
      setExplLang((user.explanation_language as 'en' | 'hi') ?? 'en')
    }
  }, [user])

  useEffect(() => {
    if (showDelete) cancelRef.current?.focus()
  }, [showDelete])

  useEffect(() => {
    if (!showDelete) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { setShowDelete(false); return }
      if (e.key === 'Tab') {
        const focusables = [cancelRef.current, confirmRef.current].filter(Boolean) as HTMLElement[]
        if (focusables.length === 0) return
        const idx = focusables.indexOf(document.activeElement as HTMLElement)
        e.preventDefault()
        const next = e.shiftKey ? (idx <= 0 ? focusables.length - 1 : idx - 1) : (idx === focusables.length - 1 ? 0 : idx + 1)
        focusables[next].focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [showDelete])

  async function save() {
    setSaving(true); setMsg(null)
    try {
      const payload: Partial<User> = { name, preferred_language: uiLang, explanation_language: explLang, theme }
      await patchMe(payload)
      setUiLanguage(uiLang)
      setExplanationLanguage(explLang)
      await refreshMe()
      setMsg('Settings saved.')
    } catch {
      setMsg('Could not save settings. Please try again.')
    } finally { setSaving(false) }
  }

  async function confirmDelete() {
    try {
      await deleteMe()
      setShowDelete(false)
      await logout()
    } catch {
      setMsg('Could not submit deletion request.')
      setShowDelete(false)
    }
  }

  return (
    <section className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>
      {msg && <div role="status" className="rounded border border-border bg-surface p-2 text-sm">{msg}</div>}
      <div className="space-y-4 rounded-lg border border-border bg-surface p-6">
        <div>
          <label htmlFor="set-name" className="mb-1 block text-sm font-medium">Name</label>
          <input id="set-name" value={name} onChange={(e) => setName(e.target.value)} className="w-full rounded border border-border bg-bg px-3 py-2" />
        </div>
        <div>
          <label htmlFor="set-ui" className="mb-1 block text-sm font-medium">Interface language</label>
          <select id="set-ui" value={uiLang} onChange={(e) => setUiLang(e.target.value as 'en' | 'hi')} className="w-full rounded border border-border bg-bg px-3 py-2">
            <option value="en">English</option><option value="hi">हिन्दी</option>
          </select>
        </div>
        <div>
          <label htmlFor="set-expl" className="mb-1 block text-sm font-medium">Explanation language</label>
          <select id="set-expl" value={explLang} onChange={(e) => setExplLang(e.target.value as 'en' | 'hi')} className="w-full rounded border border-border bg-bg px-3 py-2">
            <option value="en">English</option><option value="hi">हिन्दी</option>
          </select>
        </div>
        <div>
          <label htmlFor="set-theme" className="mb-1 block text-sm font-medium">Theme</label>
          <select id="set-theme" value={theme} onChange={(e) => setTheme(e.target.value as Theme)} className="w-full rounded border border-border bg-bg px-3 py-2">
            <option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option>
          </select>
        </div>
        <button type="button" onClick={save} disabled={saving} className="rounded bg-caramel px-4 py-2 font-semibold text-buttonText disabled:opacity-60">
          {saving ? 'Saving...' : 'Save settings'}
        </button>
      </div>

      <div className="rounded-lg border border-danger/30 bg-surface p-6">
        <h2 className="text-lg font-semibold text-danger">Account & data deletion</h2>
        <p className="mt-1 text-sm text-muted">Request deletion of your account and associated data.</p>
        <button type="button" onClick={() => setShowDelete(true)} className="mt-3 rounded border border-danger px-4 py-2 text-danger">Request deletion</button>
      </div>

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="del-title" tabIndex={-1} className="w-full max-w-md rounded-lg bg-surface p-6">
            <h2 id="del-title" className="text-lg font-bold">Confirm deletion request</h2>
            <p className="mt-2 text-sm text-muted">This will submit a request to delete your account and data. This action may not be immediately reversible.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button ref={cancelRef} type="button" onClick={() => setShowDelete(false)} className="rounded border border-border px-4 py-2">Cancel</button>
              <button ref={confirmRef} type="button" onClick={confirmDelete} className="rounded bg-danger px-4 py-2 font-semibold text-white">Confirm request</button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}