import { useCallback, useState } from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { apiFetch } from "@/lib/api/client"
import type { Locale } from "@/lib/i18n"

export function usePersistedLocale() {
  const { t } = useTranslation()
  const [isSaving, setIsSaving] = useState(false)

  const persistLocale = useCallback(
    async (nextLocale: Locale) => {
      setIsSaving(true)
      try {
        await apiFetch("/auth/me", {
          method: "PATCH",
          body: JSON.stringify({ preferred_locale: nextLocale }),
        })
      } catch (error) {
        toast.error(t("app.error"))
        throw error
      } finally {
        setIsSaving(false)
      }
    },
    [t],
  )

  return { persistLocale, isSaving }
}
