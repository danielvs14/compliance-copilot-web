"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { AppShell } from "@/components/layout/app-shell"
import { LanguageToggle } from "@/components/language-toggle"
import { useLocale } from "@/components/locale-provider"
import { DataTable } from "@/components/ui/data-table"
import { Badge, type BadgeVariant } from "@/components/ui/badge"
import { Pagination } from "@/components/ui/pagination"
import { ApiError, API_URL } from "@/lib/api/client"
import { EyeIcon, BellIcon } from "@/components/ui/icons"
import { setMockToastMessage } from "@/lib/testing"
import { formatDate, isDueWithin, isOverdue } from "@/lib/dates"
import { useApiData } from "@/hooks/useApiData"
import { AuthMeResponse, useAuthedProfile } from "@/hooks/useAuthedProfile"
import { usePersistedLocale } from "@/hooks/usePersistedLocale"

const PAGE_SIZE = 10

export type Permit = {
  id: string
  name: string
  permit_number?: string | null
  permit_type?: string | null
  jurisdiction?: string | null
  issued_at?: string | null
  expires_at?: string | null
  storage_url?: string | null
  download_url?: string | null
  download_path?: string | null
  created_at?: string | null
}

const statusVariant: Record<string, BadgeVariant> = {
  active: "success",
  expiring: "warning",
  expired: "danger",
  unknown: "muted",
}

type PermitsClientProps = {
  initialPermits?: Permit[] | null
  initialProfile?: AuthMeResponse | null
}

export function PermitsClient({ initialPermits, initialProfile }: PermitsClientProps) {
  const { locale } = useLocale()
  const { t } = useTranslation()
  const { persistLocale, isSaving: isSavingLocale } = usePersistedLocale()

  const [page, setPage] = useState(1)
  const [permitRows, setPermitRows] = useState<Permit[]>(() => initialPermits ?? [])

  const {
    data: profile,
    isLoading: profileLoading,
  } = useAuthedProfile(initialProfile)

  const {
    data: permits,
    error: permitsError,
    isLoading: permitsLoading,
  } = useApiData<Permit[]>("/permits", undefined, {
    refreshInterval: 180_000,
    fallbackData: initialPermits ?? undefined,
  })

  useEffect(() => {
    if (permits) {
      setPermitRows([...permits])
    }
  }, [permits])

  useEffect(() => {
    if (permitsError && !(permitsError instanceof ApiError && permitsError.status === 401)) {
      toast.error(t("toasts.loadError"))
    }
  }, [permitsError, t])

  const pageCount = Math.max(1, Math.ceil(permitRows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const paginated = permitRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const statusFor = useCallback((record: Permit) => {
    if (!record.expires_at) return "unknown"
    if (isOverdue(record.expires_at)) return "expired"
    if (isDueWithin(record.expires_at, 30)) return "expiring"
    return "active"
  }, [])

  const statusLabel = useCallback(
    (code: string) => {
      switch (code) {
        case "expired":
          return t("statuses.overdue")
        case "expiring":
          return t("statuses.expiringSoon")
        case "unknown":
          return "—"
        default:
          return t("statuses.active")
      }
    },
    [t],
  )

  const handleRenew = useCallback(
    (record: Permit) => {
      toast.info(t("permits.renewReminder"), {
        description: record.name,
      })
      setMockToastMessage(t("permits.renewReminder"))
    },
    [t],
  )

  const columns = useMemo<ColumnDef<Permit>[]>(() => {
    return [
      {
        header: t("permits.table.name"),
        accessorKey: "name",
        cell: ({ row }) => {
          const record = row.original
          return (
            <div className="space-y-1">
              <p className="font-medium text-slate-900">{record.name}</p>
              <p className="text-xs text-slate-500">
                {[record.permit_type, record.permit_number].filter(Boolean).join(" · ") || "—"}
              </p>
              {record.jurisdiction && <p className="text-xs text-slate-400">{record.jurisdiction}</p>}
            </div>
          )
        },
      },
      {
        header: t("permits.table.issued"),
        accessorKey: "issued_at",
        cell: ({ row }) => <span className="text-sm text-slate-600">{formatDate(row.original.issued_at ?? null, locale)}</span>,
      },
      {
        header: t("permits.table.added", { defaultValue: "Added" }),
        accessorKey: "created_at",
        cell: ({ row }) => <span className="text-sm text-slate-600">{formatDate(row.original.created_at ?? null, locale)}</span>,
      },
      {
        header: t("permits.table.expires"),
        accessorKey: "expires_at",
        cell: ({ row }) => {
          const record = row.original
          const statusCode = statusFor(record)
          if (!record.expires_at) {
            return <span className="text-sm text-slate-600">—</span>
          }
          return (
            <div className="space-y-1 text-sm text-slate-600">
              <p>{formatDate(record.expires_at ?? null, locale)}</p>
              <Badge variant={statusVariant[statusCode]}>{statusLabel(statusCode)}</Badge>
            </div>
          )
        },
      },
      {
        header: t("permits.table.status"),
        id: "status",
        cell: ({ row }) => {
          const statusCode = statusFor(row.original)
          if (statusCode === "unknown") {
            return <span className="text-sm text-slate-600">—</span>
          }
          return <Badge variant={statusVariant[statusCode]}>{statusLabel(statusCode)}</Badge>
        },
      },
      {
        header: t("actions.actions", { defaultValue: t("actions.label", { defaultValue: "Actions" }) }),
        id: "actions",
        cell: ({ row }) => {
          const record = row.original
          const href = record.download_path
            ? `${API_URL}${record.download_path}`
            : record.download_url
          return (
            <div className="flex flex-wrap items-center gap-2">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                  aria-label={t("actions.view")}
                >
                  <EyeIcon className="h-4 w-4" />
                </a>
              ) : (
                <span className="inline-flex items-center rounded-full border border-dashed border-slate-200 px-2 py-1 text-xs text-slate-400">
                  {t("actions.view")}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRenew(record)}
                className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
                aria-label={t("actions.remind")}
              >
                <BellIcon className="h-4 w-4" />
              </button>
            </div>
          )
        },
      },
    ]
  }, [handleRenew, locale, statusFor, statusLabel, t])

  return (
    <AppShell
      title={t("permits.title")}
      description={profile?.org?.name ?? ""}
      actions={<LanguageToggle onPersist={(next) => persistLocale(next)} isSaving={isSavingLocale || profileLoading} />}
    >
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <DataTable<Permit>
          key={locale}
          columns={columns}
          data={paginated}
          isLoading={permitsLoading && permitRows.length === 0}
          loadingMessage={t("app.loading")}
          emptyMessage={t("empty.permits")}
          pageSize={PAGE_SIZE}
        />
        <div className="mt-6">
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            onPageChange={setPage}
            previousLabel={t("pagination.previous")}
            nextLabel={t("pagination.next")}
            disabled={permitsLoading}
          />
        </div>
      </div>
    </AppShell>
  )
}
