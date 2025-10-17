import { RequirementsClient, RequirementsResponse } from "@/app/requirements/requirements-client"
import { AuthMeResponse } from "@/hooks/useAuthedProfile"
import { serverApiFetch } from "@/lib/api/server"

const PAGE_SIZE = 10

const filterKeys = new Set(["overdue", "due7", "due30"])

type SearchParams = Record<string, string | string[] | undefined>

type PageProps = {
  searchParams: SearchParams | Promise<SearchParams>
}

async function resolveSearchParams(searchParams: PageProps["searchParams"]): Promise<SearchParams> {
  if (!searchParams) {
    return {}
  }
  if (typeof (searchParams as Promise<unknown>).then === "function") {
    const resolved = await (searchParams as Promise<unknown>)
    if (!resolved) {
      return {}
    }
    if (resolved instanceof URLSearchParams) {
      return Object.fromEntries(resolved.entries())
    }
    const maybeParams = resolved as SearchParams
    return maybeParams
  }
  if (searchParams instanceof URLSearchParams) {
    return Object.fromEntries(searchParams.entries())
  }
  return searchParams as SearchParams
}

async function fetchInitialRequirements(searchParams: PageProps["searchParams"]) {
  const params = await resolveSearchParams(searchParams)
  const pageParam = typeof params.page === "string" ? params.page : Array.isArray(params.page) ? params.page[0] : undefined
  const dueParam = typeof params.due === "string" ? params.due : Array.isArray(params.due) ? params.due[0] : undefined

  const page = Number.isInteger(Number(pageParam)) && Number(pageParam) > 0 ? Number(pageParam) : 1
  const due = dueParam && filterKeys.has(dueParam) ? dueParam : undefined

  try {
    const [profile, requirements] = await Promise.all([
      serverApiFetch<AuthMeResponse>("/auth/me"),
      serverApiFetch<RequirementsResponse>("/requirements", {
        searchParams: {
          page,
          limit: PAGE_SIZE,
          ...(due ? { due } : {}),
        },
      }),
    ])
    return { profile, requirements }
  } catch (error) {
    console.warn("[requirements] Prefetch failed", error)
    return { profile: null, requirements: null }
  }
}

export default async function RequirementsPage({ searchParams }: PageProps) {
  const initialData = await fetchInitialRequirements(searchParams)

  return (
    <RequirementsClient
      initialProfile={initialData.profile}
      initialRequirements={initialData.requirements}
    />
  )
}
