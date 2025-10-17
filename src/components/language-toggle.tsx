"use client"

import clsx from "clsx"

import { useLocale } from "@/components/locale-provider"
import { Locale } from "@/lib/i18n"
import { useTranslation } from "react-i18next"

type LanguageToggleProps = {
  onPersist?: (nextLocale: Locale, previousLocale: Locale) => Promise<void> | void
  isSaving?: boolean
}

const options: { value: Locale; labelKey: string }[] = [
  { value: "en", labelKey: "app.languageShort.en" },
  { value: "es", labelKey: "app.languageShort.es" },
]

export function LanguageToggle({ onPersist, isSaving = false }: LanguageToggleProps) {
  const { locale, setLocale } = useLocale()
  const { t } = useTranslation()

  const handleChange = async (nextLocale: Locale) => {
    if (nextLocale === locale || isSaving) return
    const previousLocale = locale
    setLocale(nextLocale)
    if (onPersist) {
      try {
        await onPersist(nextLocale, previousLocale)
      } catch (error) {
        setLocale(previousLocale)
        throw error
      }
    }
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 text-xs font-medium text-slate-600 shadow-sm">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={isSaving}
          onClick={() => void handleChange(option.value)}
          className={clsx(
            "rounded-full px-3 py-1 transition",
            option.value === locale ? "bg-blue-600 text-white" : "hover:bg-slate-100",
            isSaving && "cursor-wait",
          )}
        >
          {t(option.labelKey)}
        </button>
      ))}
    </div>
  )
}
