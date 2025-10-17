import { notFound } from "next/navigation"

import { AppShell } from "@/components/layout/app-shell"
import { serverApiFetch } from "@/lib/api/server"

import type { Requirement } from "@/app/requirements/requirements-client"
import type { AuthMeResponse } from "@/hooks/useAuthedProfile"
import { RequirementDetailClient } from "@/app/requirements/[id]/requirement-detail-client"
import { ApiError } from "@/lib/api/client"

async function fetchRequirement(id: string) {
  let profile: AuthMeResponse | null = null
  let requirement: Requirement | null = null

  try {
    profile = await serverApiFetch<AuthMeResponse>("/auth/me")
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) {
      console.warn("[requirements] profile fetch failed", error)
    }
  }

  try {
    requirement = await serverApiFetch<Requirement>(`/requirements/${id}`)
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) {
      console.warn(`[requirements:${id}] fetch failed`, error)
    }
    requirement = null
  }

  return { profile, requirement }
}

export default async function RequirementDetailPage({ params }: { params: { id: string } | Promise<{ id: string }> }) {
  const resolved = await Promise.resolve(params)
  const { profile, requirement } = await fetchRequirement(resolved.id)

  if (!requirement) {
    notFound()
  }

  return (
    <AppShell
      title={requirement.title_en}
      description={profile?.org?.name ?? ""}
    >
      <RequirementDetailClient requirement={requirement} profile={profile} />
    </AppShell>
  )
}
