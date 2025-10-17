import { PermitsClient, Permit } from "@/app/permits/permits-client"
import { AuthMeResponse } from "@/hooks/useAuthedProfile"
import { serverApiFetch } from "@/lib/api/server"

async function fetchInitialPermits(): Promise<{
  profile: AuthMeResponse | null
  permits: Permit[] | null
}> {
  try {
    const [profile, permits] = await Promise.all([
      serverApiFetch<AuthMeResponse>("/auth/me"),
      serverApiFetch<Permit[]>("/permits"),
    ])
    return { profile, permits }
  } catch (error) {
    console.warn("[permits] Prefetch failed", error)
    return { profile: null, permits: null }
  }
}

export default async function PermitsPage() {
  const initialData = await fetchInitialPermits()

  return (
    <PermitsClient
      initialProfile={initialData.profile}
      initialPermits={initialData.permits}
    />
  )
}
