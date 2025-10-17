import type { Locale } from "@/lib/i18n"

export const normalizeLocale = (value: string | null | undefined): Locale =>
  value && value.toLowerCase().startsWith("es") ? "es" : "en"
