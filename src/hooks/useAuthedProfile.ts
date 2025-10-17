import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { useLocale } from "@/components/locale-provider"
import { ApiError } from "@/lib/api/client"
import { normalizeLocale } from "@/lib/locale"
import { useApiData } from "@/hooks/useApiData"
import { useTranslation } from "react-i18next"

export type UserProfile = {
  email: string
  preferred_locale: string | null
}

export type OrgSummary = {
  id: string
  name: string
  primary_trade?: string | null
}

export type AuthMeResponse = {
  user: UserProfile
  org: OrgSummary
}

export function useAuthedProfile(initialData?: AuthMeResponse | null) {
  const router = useRouter()
  const { setLocale } = useLocale()
  const { t } = useTranslation()

  const response = useApiData<AuthMeResponse>("/auth/me", undefined, {
    fallbackData: initialData ?? undefined,
  })

  useEffect(() => {
    if (response.error instanceof ApiError) {
      if (response.error.status === 401) {
        router.replace("/login")
      } else {
        toast.error(t("app.error"))
      }
    }
  }, [response.error, router, t])

  useEffect(() => {
    if (response.data?.user?.preferred_locale) {
      setLocale(normalizeLocale(response.data.user.preferred_locale))
    }
  }, [response.data?.user?.preferred_locale, setLocale])

  return response
}
