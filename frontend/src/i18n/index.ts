import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import en from './en.json'
import hi from './hi.json'

const UI_LANG_KEY = 'veritrust-ui-lang'
const EXPL_LANG_KEY = 'veritrust-explanation-lang'

const storedUi = localStorage.getItem(UI_LANG_KEY)
const initialLang = storedUi === 'hi' || storedUi === 'en' ? storedUi : 'en'
if (!localStorage.getItem(EXPL_LANG_KEY)) {
  localStorage.setItem(EXPL_LANG_KEY, initialLang)
}

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
  },
  lng: initialLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
})

export function setUiLanguage(lang: 'en' | 'hi') {
  localStorage.setItem(UI_LANG_KEY, lang)
  void i18n.changeLanguage(lang)
}

export function getUiLanguage(): 'en' | 'hi' {
  const v = localStorage.getItem(UI_LANG_KEY)
  return v === 'hi' ? 'hi' : 'en'
}

export function setExplanationLanguage(lang: 'en' | 'hi') {
  localStorage.setItem(EXPL_LANG_KEY, lang)
}

export function getExplanationLanguage(): 'en' | 'hi' {
  const v = localStorage.getItem(EXPL_LANG_KEY)
  return v === 'hi' ? 'hi' : 'en'
}

export default i18n