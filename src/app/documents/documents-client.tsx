"use client"

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { AppShell } from "@/components/layout/app-shell"
import { LanguageToggle } from "@/components/language-toggle"
import { useLocale } from "@/components/locale-provider"
import { DataTable } from "@/components/ui/data-table"
import { EyeIcon } from "@/components/ui/icons"
import { API_URL, ApiError, apiFetch } from "@/lib/api/client"
import { formatDate } from "@/lib/dates"
import { useApiData } from "@/hooks/useApiData"
import { AuthMeResponse, useAuthedProfile } from "@/hooks/useAuthedProfile"
import { usePersistedLocale } from "@/hooks/usePersistedLocale"

export type DocumentClassification = {
  label: string
  confidence?: number | null
  source?: string | null
} | null

const classificationLabels: Record<string, string> = {
  requirements: "documents.classification.requirements",
  permit: "documents.classification.permit",
  training: "documents.classification.training",
  uncategorized: "documents.classification.uncategorized",
}

function formatClassificationLabel(raw: string, t: (key: string) => string) {
  const key = classificationLabels[raw] ?? classificationLabels.uncategorized
  const translated = t(key)
  if (translated === key) {
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }
  return translated
}

export type DocumentRecord = {
  id: string
  name: string
  status: "PROCESSING" | "READY" | "FAILED"
  classification?: DocumentClassification
  storage_url?: string | null
  download_url?: string | null
  download_path?: string | null
  created_at?: string | null
  extracted_at?: string | null
  requirement_count?: number
}

export type DocumentsResponse = {
  items: DocumentRecord[]
  pagination: {
    page: number
    limit: number
    total: number
  }
}

type DocumentDetailResponse = DocumentRecord

type UploadState = "idle" | "uploading" | "processing"

type DocumentsClientProps = {
  initialDocuments?: DocumentsResponse | null
  initialProfile?: AuthMeResponse | null
}

const PROCESSING_STORAGE_KEY = "lastUploadId"

function buildColumns(
  locale: string,
  t: (key: string) => string,
): ColumnDef<DocumentRecord>[] {
  return [
    {
      header: t("documents.recentUploads"),
      accessorKey: "name",
      cell: ({ row }) => {
        const record = row.original
        return (
          <div className="space-y-1">
            <p className="font-medium text-slate-900 break-words">{record.name}</p>
            {record.classification?.label && (
              <p className="text-xs uppercase tracking-wide text-slate-500">
                {formatClassificationLabel(record.classification.label, t)}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {t("documents.uploaded")}: {formatDate(record.created_at ?? null, locale)}
            </p>
          </div>
        )
      },
    },
    {
      header: t("documents.extracted"),
      accessorKey: "extracted_at",
      cell: ({ row }) => {
        const record = row.original
        if (record.status === "PROCESSING") {
          return (
            <span className="inline-flex items-center gap-2 text-sm text-blue-600">
              <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
              {t("documents.processing")}
            </span>
          )
        }
        if (record.status === "FAILED") {
          return <span className="text-sm text-rose-600">{t("documents.uploadFailed")}</span>
        }
        return <span className="text-sm text-slate-600">{formatDate(record.extracted_at ?? null, locale)}</span>
      },
    },
    {
      header: t("documents.requirementsColumn"),
      accessorKey: "requirement_count",
      cell: ({ row }) => {
        const record = row.original
        return <span className="text-sm text-slate-600">{record.requirement_count ?? 0}</span>
      },
    },
      {
        header: t("actions.actions", { defaultValue: t("actions.label", { defaultValue: "Actions" }) }),
        accessorKey: "actions",
        cell: ({ row }) => {
          const record = row.original
          const href = record.download_path
            ? `${API_URL}${record.download_path}`
            : record.download_url
          if (!href) {
            return <span className="inline-flex items-center rounded-full border border-dashed border-slate-200 px-2 py-1 text-xs text-slate-400">{t("actions.view")}</span>
          }
          return (
            <a
              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              href={href}
              target="_blank"
              rel="noreferrer"
              aria-label={t("actions.view")}
            >
              <EyeIcon className="h-4 w-4" />
            </a>
          )
        },
      },
  ]
}

export function DocumentsClient({ initialDocuments, initialProfile }: DocumentsClientProps) {
  const router = useRouter()
  const { locale } = useLocale()
  const { t } = useTranslation()
  const { persistLocale, isSaving: isSavingLocale } = usePersistedLocale()

  const [uploadState, setUploadState] = useState<UploadState>("idle")
  const defaultTrade = (initialProfile?.org?.primary_trade ?? "electrical").toLowerCase()
  const [trade, setTrade] = useState(defaultTrade)
  const hasTradeOverride = useRef(false)
  const [file, setFile] = useState<File | null>(null)
  const [documentRows, setDocumentRows] = useState<DocumentRecord[]>(() => initialDocuments?.items ?? [])
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(null)

  const {
    data: profile,
    isLoading: profileLoading,
  } = useAuthedProfile(initialProfile)

  const {
    data: documents,
    error: documentsError,
    isLoading: documentsLoading,
    mutate: refreshDocuments,
  } = useApiData<DocumentsResponse>("/documents", { limit: 5 }, {
    refreshInterval: 60_000,
    fallbackData: initialDocuments ?? undefined,
  })

  const hasRequested = useRef(false)

  const refreshAndHydrateDocuments = useCallback(async () => {
    const latest = await refreshDocuments()
    if (latest?.items) {
      setDocumentRows([...latest.items])
    }
    return latest
  }, [refreshDocuments])

  useEffect(() => {
    if (profile && !hasRequested.current) {
      hasRequested.current = true
      void refreshAndHydrateDocuments()
    }
  }, [profile, refreshAndHydrateDocuments])

  useEffect(() => {
    if (documents?.items) {
      setDocumentRows([...documents.items])
    }
  }, [documents?.items])

  useEffect(() => {
    if (documentsError && !(documentsError instanceof ApiError && documentsError.status === 401)) {
      toast.error(t("toasts.loadError"))
    }
  }, [documentsError, t])

  useEffect(() => {
    const orgTrade = (
      profile?.org?.primary_trade ?? initialProfile?.org?.primary_trade ?? undefined
    )?.toLowerCase()
    if (!hasTradeOverride.current && orgTrade && orgTrade !== trade) {
      setTrade(orgTrade)
    }
  }, [initialProfile?.org?.primary_trade, profile?.org?.primary_trade, trade])

  useEffect(() => {
    if (typeof window === "undefined") return
    const storedId = window.sessionStorage.getItem(PROCESSING_STORAGE_KEY)
    if (storedId) {
      setPendingDocumentId(storedId)
    }
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (pendingDocumentId) {
      window.sessionStorage.setItem(PROCESSING_STORAGE_KEY, pendingDocumentId)
      if (uploadState === "idle") {
        setUploadState("processing")
      }
    } else {
      window.sessionStorage.removeItem(PROCESSING_STORAGE_KEY)
    }
  }, [pendingDocumentId, uploadState])

  useEffect(() => {
    if (uploadState !== "uploading" || typeof window === "undefined") {
      return
    }
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [uploadState])

  useEffect(() => {
    if (!pendingDocumentId) {
      return
    }

    let isCancelled = false
    let timeoutId: NodeJS.Timeout | null = null

    const poll = async () => {
      try {
        const detail = await apiFetch<DocumentDetailResponse>(`/documents/${pendingDocumentId}`)
        if (isCancelled) return

        setDocumentRows((prev) => {
          const updated = prev.map((row) => (row.id === detail.id ? detail : row))
          if (!updated.some((row) => row.id === detail.id)) {
            return [...updated, detail]
          }
          return updated
        })

        if (detail.status === "READY") {
          setPendingDocumentId(null)
          setUploadState("idle")
          toast.success(t("documents.uploadSuccess"))
          router.refresh()
          await refreshAndHydrateDocuments()
          return
        }

        if (detail.status === "FAILED") {
          toast.error(t("documents.uploadFailed"))
          setPendingDocumentId(null)
          setUploadState("idle")
          return
        }

        timeoutId = setTimeout(poll, 5000)
      } catch (error) {
        if (isCancelled) return
        if (error instanceof ApiError && error.status === 404) {
          window.sessionStorage.removeItem(PROCESSING_STORAGE_KEY)
          setPendingDocumentId(null)
          setUploadState("idle")
          await refreshAndHydrateDocuments()
          return
        }
        timeoutId = setTimeout(poll, 8000)
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          toast.error(error.message)
        }
      }
    }

    poll()

    return () => {
      isCancelled = true
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [pendingDocumentId, refreshAndHydrateDocuments, router, t])

  useEffect(() => {
    if (!pendingDocumentId || !documents?.items) {
      return
    }
    const pendingDoc = documents.items.find((item) => item.id === pendingDocumentId)
    if (!pendingDoc) {
      return
    }
    if (pendingDoc.status === "READY") {
      setPendingDocumentId(null)
      setUploadState("idle")
    }
    if (pendingDoc.status === "FAILED") {
      toast.error(t("documents.uploadFailed"))
      setPendingDocumentId(null)
      setUploadState("idle")
    }
  }, [documents?.items, pendingDocumentId, t])

  const handleUpload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!file) {
      toast.error(t("documents.uploadFailed"))
      return
    }

    setUploadState("uploading")

    const formData = new FormData()
    formData.append("file", file)
    formData.append("trade", trade)

    try {
      const response = await fetch(`${API_URL}/documents/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      })

      if (response.status === 401) {
        router.replace("/login")
        return
      }

      const payload = (await response.json().catch(() => null)) as
        | { id: string; status: "PROCESSING" }
        | { detail?: string }
        | null

      if (!response.ok || !payload || !("id" in payload)) {
        const detail =
          (payload as { detail?: string } | null)?.detail ?? t("documents.uploadFailed")
        throw new Error(detail)
      }

      toast.info(t("documents.uploadQueued"))
      setFile(null)
      setUploadState("processing")
      setPendingDocumentId(payload.id)
      void refreshAndHydrateDocuments()
    } catch (error) {
      const message = error instanceof Error ? error.message : t("documents.uploadFailed")
      toast.error(message)
      setUploadState("idle")
      setPendingDocumentId(null)
    }
  }

  const documentColumns = useMemo(() => buildColumns(locale, t), [locale, t])
  const showProcessingBanner = pendingDocumentId !== null && uploadState === "processing"

  return (
    <AppShell
      title={t("documents.title")}
      description={profile?.org?.name ?? ""}
      actions={<LanguageToggle onPersist={(next) => persistLocale(next)} isSaving={isSavingLocale || profileLoading} />}
    >
      {showProcessingBanner && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-blue-600" />
          {t("documents.processing")}
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-base font-semibold text-slate-900">{t("documents.lastFive")}</h3>
              <p className="text-xs text-slate-500">{t("documents.lastFiveHint")}</p>
            </div>
            {uploadState !== "idle" && (
              <span className="flex items-center gap-2 text-xs font-medium text-blue-600 md:text-right">
                <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                {uploadState === "uploading" ? t("documents.uploading") : t("documents.processing")}
              </span>
            )}
          </div>
          <div className="mt-4">
            <DataTable<DocumentRecord>
              key={locale}
              columns={documentColumns}
              data={documentRows}
              isLoading={documentsLoading && documentRows.length === 0}
              loadingMessage={t("app.loading")}
              emptyMessage={t("empty.documents")}
              pageSize={5}
            />
          </div>
        </section>
        <section className="lg:col-span-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-base font-semibold text-slate-900">{t("documents.uploadNew")}</h3>
            {profile?.user?.email && (
              <p className="mt-1 text-xs text-slate-500">{profile.user.email}</p>
            )}
          </div>
          <form className="space-y-4" onSubmit={handleUpload}>
            <div>
              <label className="text-sm font-medium text-slate-700">{t("documents.fields.file")}</label>
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">{t("documents.fields.trade")}</label>
              <select
                value={trade}
                onChange={(event) => {
                  hasTradeOverride.current = true
                  setTrade(event.target.value)
                }}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="electrical">{t("documents.tradeOptions.electrical")}</option>
                <option value="general">{t("documents.tradeOptions.general")}</option>
                <option value="mechanical">{t("documents.tradeOptions.mechanical")}</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={uploadState !== "idle" || !file}
              className="inline-flex w-full items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
            >
              {uploadState === "uploading"
                ? t("app.loading")
                : uploadState === "processing"
                  ? t("documents.processing")
                  : t("actions.upload")}
            </button>
          </form>
        </section>
      </div>
    </AppShell>
  )
}
