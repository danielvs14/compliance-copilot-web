"use client"

import { useTranslation } from "react-i18next"

import { useTheme } from "@/components/theme-provider"

export function ThemeToggle() {
  const { t } = useTranslation()
  const { theme, toggleTheme } = useTheme()

  const nextTheme = theme === "dark" ? "light" : "dark"

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
      aria-label={t("theme.toggle", { defaultValue: "Toggle theme" })}
    >
      {theme === "dark" ? t("theme.light", { defaultValue: "Light" }) : t("theme.dark", { defaultValue: "Dark" })}
    </button>
  )
}
