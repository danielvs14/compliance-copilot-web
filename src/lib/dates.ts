import { Locale } from "@/lib/i18n"

const getFormatter = (locale: Locale) =>
  new Intl.DateTimeFormat(locale === "es" ? "es-MX" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

export function formatDate(value: string | null | undefined, locale: Locale) {
  if (!value) return "—"
  try {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return getFormatter(locale).format(date)
  } catch {
    return "—"
  }
}

export function daysUntil(value: string | null | undefined) {
  if (!value) return null
  const targetDate = new Date(value)
  if (Number.isNaN(targetDate.getTime())) return null

  const target = Date.UTC(targetDate.getUTCFullYear(), targetDate.getUTCMonth(), targetDate.getUTCDate())
  const now = new Date()
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())

  const diff = target - today
  return Math.round(diff / (1000 * 60 * 60 * 24))
}

export function isOverdue(value: string | null | undefined) {
  const remaining = daysUntil(value)
  return typeof remaining === "number" && remaining < 0
}

export function isDueWithin(value: string | null | undefined, days: number) {
  const remaining = daysUntil(value)
  if (typeof remaining !== "number") return false
  return remaining >= 0 && remaining <= days
}
