import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { deleteMe, patchMe, type User } from '../lib/api'
import { setExplanationLanguage, setUiLanguage } from '../i18n'
import { useTheme } from '../theme/useTheme'
import type { Theme } from '../theme/ThemeContext'
import { Masthead } from '../components/ui/Masthead'
import { Section } from '../components/ui/Section'
import { Stamp } from '../components/ui/Stamp'
import { Button } from '../components/ui/Button'
import { buttonClass } from '../components/ui/buttonStyles'
import { fieldClass, fieldLabelClass } from '../components/ui/Field'

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
    <div className="mx-auto max-w-xl space-y-8">
      <Masthead
        title="Settings"
        subtitle="Account preferences, interface language, and data controls."
        aside={<Stamp lines={['Account', user?.name ? user.name.slice(0, 12).toUpperCase() : 'guest']} tone="ink" />}
      />

      {msg && (
        <div role="status" className="border-l-2 border-cover bg-cover/[0.06] px-4 py-2.5 text-sm text-text">
          {msg}
        </div>
      )}

      <Section title="Preferences" meta="saved to your account">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void save()
          }}
        >
          <div>
            <label htmlFor="set-name" className={fieldLabelClass}>Name</label>
            <input id="set-name" value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="set-ui" className={fieldLabelClass}>Interface language</label>
            <select id="set-ui" value={uiLang} onChange={(e) => setUiLang(e.target.value as 'en' | 'hi')} className={fieldClass}>
              <option value="en">English</option><option value="hi">हिन्दी</option>
            </select>
          </div>
          <div>
            <label htmlFor="set-expl" className={fieldLabelClass}>Explanation language</label>
            <select id="set-expl" value={explLang} onChange={(e) => setExplLang(e.target.value as 'en' | 'hi')} className={fieldClass}>
              <option value="en">English</option><option value="hi">हिन्दी</option>
            </select>
          </div>
          <div>
            <label htmlFor="set-theme" className={fieldLabelClass}>Theme</label>
            <select id="set-theme" value={theme} onChange={(e) => setTheme(e.target.value as Theme)} className={fieldClass}>
              <option value="light">Light</option><option value="dark">Dark</option><option value="system">System</option>
            </select>
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save settings'}
          </Button>
        </form>
      </Section>

      <Section title="Account & data deletion" meta="requires review">
        <p className="max-w-[60ch] text-sm text-muted">Request deletion of your account and associated data.</p>
        <Button variant="danger" type="button" className="mt-3" onClick={() => setShowDelete(true)}>
          Request deletion
        </Button>
      </Section>

      {showDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="del-title" tabIndex={-1} className="w-full max-w-md border-2 border-heading bg-paper p-6 shadow-lift">
            <h2 id="del-title" className="font-display text-lg font-bold text-heading">Confirm deletion request</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              This will submit a request to delete your account and data. This action may not be immediately reversible.
            </p>
            <div className="mt-5 flex justify-end gap-2.5">
              <button ref={cancelRef} type="button" onClick={() => setShowDelete(false)} className={buttonClass('secondary')}>Cancel</button>
              <button ref={confirmRef} type="button" onClick={() => void confirmDelete()} className={buttonClass('danger')}>Confirm request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
