import { DocumentsClient, DocumentsResponse } from "@/app/documents/documents-client"
import { AuthMeResponse } from "@/hooks/useAuthedProfile"
import { serverApiFetch } from "@/lib/api/server"
import { ApiError } from "@/lib/api/client"

async function fetchInitialDocuments(): Promise<{
  profile: AuthMeResponse | null
  documents: DocumentsResponse | null
}> {
  let profile: AuthMeResponse | null = null
  let documents: DocumentsResponse | null = null

  try {
    profile = await serverApiFetch<AuthMeResponse>("/auth/me")
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) {
      console.warn("[documents] profile prefetch failed", error)
    }
  }

  try {
    documents = await serverApiFetch<DocumentsResponse>("/documents", { searchParams: { limit: 5 } })
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401)) {
      console.warn("[documents] documents prefetch failed", error)
    }
  }

  return { profile, documents }
}

export default async function DocumentsPage() {
  const initialData = await fetchInitialDocuments()

  return (
    <DocumentsClient
      initialProfile={initialData.profile}
      initialDocuments={initialData.documents}
    />
  )
}
