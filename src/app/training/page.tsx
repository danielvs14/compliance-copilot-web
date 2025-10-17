import { TrainingClient, TrainingCert } from "@/app/training/training-client"
import { AuthMeResponse } from "@/hooks/useAuthedProfile"
import { serverApiFetch } from "@/lib/api/server"

async function fetchInitialTraining(): Promise<{
  profile: AuthMeResponse | null
  training: TrainingCert[] | null
}> {
  try {
    const [profile, training] = await Promise.all([
      serverApiFetch<AuthMeResponse>("/auth/me"),
      serverApiFetch<TrainingCert[]>("/training"),
    ])
    return { profile, training }
  } catch (error) {
    console.warn("[training] Prefetch failed", error)
    return { profile: null, training: null }
  }
}

export default async function TrainingPage() {
  const initialData = await fetchInitialTraining()

  return (
    <TrainingClient
      initialProfile={initialData.profile}
      initialTraining={initialData.training}
    />
  )
}
