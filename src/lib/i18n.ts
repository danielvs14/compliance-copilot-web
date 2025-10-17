import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import en from "@/locales/en.json"
import es from "@/locales/es.json"

export const resources = {
  en: { translation: en },
  es: { translation: es },
} as const

export type Locale = keyof typeof resources

const defaultLocale: Locale = "en"

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources,
    lng: defaultLocale,
    fallbackLng: defaultLocale,
    interpolation: {
      escapeValue: false,
    },
  })
}

export const changeLanguage = (locale: Locale) => {
  if (i18n.language !== locale) {
    void i18n.changeLanguage(locale)
  }
}

export default i18n
