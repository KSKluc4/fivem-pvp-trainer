import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import pt from './locales/pt/translation.json'
import en from './locales/en/translation.json'

export const LANG_STORAGE_KEY = 'pvp_language'
const SUPPORTED = ['pt', 'en']

function detectLanguage() {
  const stored = localStorage.getItem(LANG_STORAGE_KEY)
  if (stored && SUPPORTED.includes(stored)) return stored
  return (navigator.language || '').toLowerCase().startsWith('pt') ? 'pt' : 'en'
}

export function setLanguage(lang) {
  if (!SUPPORTED.includes(lang)) return
  localStorage.setItem(LANG_STORAGE_KEY, lang)
  i18n.changeLanguage(lang)
}

i18n.use(initReactI18next).init({
  resources: {
    pt: { translation: pt },
    en: { translation: en },
  },
  lng:            detectLanguage(),
  fallbackLng:    'pt',
  supportedLngs:  SUPPORTED,
  interpolation:  { escapeValue: false },
})

export default i18n
