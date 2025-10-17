"use client"

import { I18nextProvider } from "react-i18next"
import { ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"

import i18n, { Locale, changeLanguage } from "@/lib/i18n"

type LocaleContextValue = {
  locale: Locale
  setLocale: (nextLocale: Locale) => void
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined)

const STORAGE_KEY = "compliance-copilot-locale"

type LocaleProviderProps = {
  children: ReactNode
  initialLocale?: Locale
}

export function LocaleProvider({ children, initialLocale = "en" }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale)

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null
    if (saved === "en" || saved === "es") {
      setLocaleState(saved)
    } else if (initialLocale && initialLocale !== locale) {
      setLocaleState(initialLocale)
    }
    // We only want this to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    changeLanguage(locale)
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, locale)
    }
  }, [locale])

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
  }, [])

  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale])

  return (
    <LocaleContext.Provider value={value}>
      <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const context = useContext(LocaleContext)
  if (!context) {
    throw new Error("useLocale must be used within LocaleProvider")
  }
  return context
}
