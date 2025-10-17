"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { AppShell } from "@/components/layout/app-shell"
import { LanguageToggle } from "@/components/language-toggle"
import { useLocale } from "@/components/locale-provider"
import { DataTable } from "@/components/ui/data-table"
import { Badge, type BadgeVariant } from "@/components/ui/badge"
import { Pagination } from "@/components/ui/pagination"
import { TriagePanel } from "./triage-panel"
import { EyeIcon, BellIcon, CheckIcon, TrashIcon } from "@/components/ui/icons"
import { ApiError, apiFetch } from "@/lib/api/client"
import { formatDate, daysUntil } from "@/lib/dates"
import { useApiData } from "@/hooks/useApiData"
import { AuthMeResponse, useAuthedProfile } from "@/hooks/useAuthedProfile"
import { usePersistedLocale } from "@/hooks/usePersistedLocale"

const PAGE_SIZE = 10

type UiStatus = "OPEN" | "NEEDS_REVIEW" | "NEEDS_TRIAGE" | "COMPLETED" | "ARCHIVED" | "OVERDUE"

const UI_STATUS_META: Record<
  UiStatus,
  {
    labelKey: string
    defaultLabel: string
    variant: BadgeVariant
  }
> = {
  OPEN: { labelKey: "statuses.open", defaultLabel: "Open", variant: "warning" },
  NEEDS_REVIEW: { labelKey: "statuses.needsReview", defaultLabel: "Needs review", variant: "muted" },
  NEEDS_TRIAGE: { labelKey: "statuses.needsTriage", defaultLabel: "Needs triage", variant: "warning" },
  COMPLETED: { labelKey: "statuses.completed", defaultLabel: "Completed", variant: "success" },
  ARCHIVED: { labelKey: "statuses.archived", defaultLabel: "Archived", variant: "muted" },
  OVERDUE: { labelKey: "statuses.overdue", defaultLabel: "Overdue", variant: "danger" },
}

const FREQUENCY_LABELS: Record<
  string,
  {
    labelKey: string
    defaultLabel: string
  }
> = {
  BEFORE_EACH_USE: { labelKey: "frequencies.beforeEachUse", defaultLabel: "Before each use" },
  DAILY: { labelKey: "frequencies.daily", defaultLabel: "Daily" },
  WEEKLY: { labelKey: "frequencies.weekly", defaultLabel: "Weekly" },
  MONTHLY: { labelKey: "frequencies.monthly", defaultLabel: "Monthly" },
  QUARTERLY: { labelKey: "frequencies.quarterly", defaultLabel: "Quarterly" },
  ANNUAL: { labelKey: "frequencies.annual", defaultLabel: "Annual" },
  EVERY_N_DAYS: { labelKey: "frequencies.everyNDays", defaultLabel: "Every N days" },
  EVERY_N_WEEKS: { labelKey: "frequencies.everyNWeeks", defaultLabel: "Every N weeks" },
  EVERY_N_MONTHS: { labelKey: "frequencies.everyNMonths", defaultLabel: "Every N months" },
  ONE_TIME: { labelKey: "frequencies.oneTime", defaultLabel: "One time" },
}

export type Requirement = {
  id: string
  document_id?: string | null
  document_name?: string | null
  title_en: string
  title_es: string
  description_en: string
  description_es: string
  category?: string | null
  frequency?: string | null
  anchor_type?: string | null
  anchor_value?: Record<string, unknown> | null
  due_date?: string | null
  status: string
  source_ref?: string | null
  next_due?: string | null
  archive_state?: string | null
  attributes?: Record<string, unknown>
}

export type RequirementsResponse = {
  items: Requirement[]
  pagination: {
    page: number
    limit: number
    total: number
  }
}

type DueFilter = "overdue" | "due7" | "due30"
type StatusFilter = "active" | "completed" | "archived" | "triage"

const dueFilterOptions: DueFilter[] = ["overdue", "due7", "due30"]
const statusFilterOptions: StatusFilter[] = ["active", "completed", "archived", "triage"]

const STATUS_QUERY_MAP: Record<StatusFilter, string[]> = {
  active: ["OPEN", "REVIEW"],
  completed: ["DONE", "READY"],
  archived: [],
  triage: ["PENDING_REVIEW"],
}

const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  active: "Open",
  completed: "Completed",
  archived: "Archived",
  triage: "Needs triage",
}

function parseDueFilters(params: URLSearchParams | null): DueFilter[] {
  if (!params) return []
  const raw = params.get("due")
  if (!raw) return []
  const tokens = raw.split(",").map((token) => token.trim())
  return dueFilterOptions.filter((option) => tokens.includes(option))
}

function parseStatusFilters(params: URLSearchParams | null): StatusFilter[] {
  const selected = new Set<StatusFilter>()
  if (params?.get("archived") === "true") {
    selected.add("archived")
  }
  const rawStatus = params?.get("status")
  if (rawStatus) {
    const tokens = rawStatus.split(",").map((token) => token.trim().toUpperCase())
    if (tokens.some((token) => token === "DONE" || token === "READY")) {
      selected.add("completed")
    }
    if (tokens.some((token) => token === "OPEN" || token === "REVIEW")) {
      selected.add("active")
    }
    if (tokens.some((token) => token === "PENDING_REVIEW")) {
      selected.add("triage")
    }
  }
  return Array.from(selected)
}

function buildColumns(
  locale: string,
  t: (key: string, options?: Record<string, unknown>) => string,
  completingId: string | null,
  handleView: (requirement: Requirement) => void,
  handleComplete: (requirement: Requirement) => Promise<void>,
  handleRemind: (requirement: Requirement) => void,
  selectedIds: Set<string>,
  toggleSelection: (requirement: Requirement, checked: boolean) => void,
  enableSelection: boolean,
  handleDismiss: (requirements: Requirement[]) => void,
  handleArchive: (requirement: Requirement) => void,
  toggleSelectAll: (checked: boolean) => void,
  selectAllState: { allSelected: boolean; someSelected: boolean; hasSelectable: boolean },
): ColumnDef<Requirement>[] {
  const columns: ColumnDef<Requirement>[] = []

  if (enableSelection) {
    columns.push({
      id: "select",
      header: () => (
        <input
          type="checkbox"
          className="h-4 w-4"
          checked={selectAllState.hasSelectable && selectAllState.allSelected}
          aria-label={t("triage.selectAll", { defaultValue: "Select all for triage" })}
          onChange={(event) => toggleSelectAll(event.target.checked)}
          ref={(element) => {
            if (element) {
              element.indeterminate = selectAllState.hasSelectable && !selectAllState.allSelected && selectAllState.someSelected
            }
          }}
          disabled={!selectAllState.hasSelectable}
        />
      ),
      cell: ({ row }) => {
        const requirement = row.original
        if (requirement.status !== "PENDING_REVIEW") {
          return null
        }
        const checked = selectedIds.has(requirement.id)
        return (
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={checked}
            onChange={(event) => toggleSelection(requirement, event.target.checked)}
            aria-label={t("triage.select", { defaultValue: "Select for triage" })}
          />
        )
      },
      size: 32,
    })
  }

  columns.push(
    {
      header: t("requirements.table.document"),
      accessorKey: "document_name",
      cell: ({ row }) => {
        const record = row.original
        const name = record.document_name ?? "—"
        return (
          <span className="inline-block break-words text-sm text-slate-600" title={name}>
            {name}
          </span>
        )
      },
    },
    {
      header: t("requirements.table.requirement"),
      accessorKey: "title_en",
      cell: ({ row }) => {
        const record = row.original
        const title = locale === "es" ? record.title_es : record.title_en
        const description = locale === "es" ? record.description_es : record.description_en
        const triageMeta = (record.attributes as Record<string, any> | undefined)?.triage as
          | { reasons?: string[]; assignee?: string; resolved_at?: string }
          | undefined
        const reasons = Array.isArray(triageMeta?.reasons) ? triageMeta?.reasons : []
        return (
          <div className="space-y-1">
            <p className="font-medium text-slate-900">{title}</p>
            <p className="text-sm text-slate-600">{description}</p>
            {record.source_ref && <p className="text-xs text-slate-400">{record.source_ref}</p>}
            {record.status === "PENDING_REVIEW" && reasons.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {reasons.map((reason) => (
                  <span key={reason} className="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                    {formatTriageReason(reason, t)}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      },
    },
    {
      header: t("requirements.table.category"),
      accessorKey: "category",
      cell: ({ row }) => {
        const label = formatCategoryLabel(row.original.category, t)
        return <span className="text-sm text-slate-600">{label}</span>
      },
    },
    {
      header: t("requirements.table.frequency"),
      accessorKey: "frequency",
      cell: ({ row }) => {
        const value = row.original.frequency ?? null
        return <span className="text-sm text-slate-600">{formatFrequencyLabel(value, t)}</span>
      },
    },
    {
      header: t("requirements.table.due"),
      accessorKey: "due_date",
      cell: ({ row }) => {
        const record = row.original
        return <span className="text-sm text-slate-600">{formatDate(record.due_date ?? null, locale)}</span>
      },
    },
    {
      header: t("requirements.table.status"),
      accessorKey: "status",
      cell: ({ row }) => {
        const record = row.original
        if (record.archive_state === "pending") {
          return <Badge variant="warning">{t("requirements.detail.pendingApproval", { defaultValue: "Pending approval" })}</Badge>
        }
        if (record.archive_state === "archived") {
          return <Badge variant="muted">{t("requirements.detail.archivedBadge", { defaultValue: "Archived" })}</Badge>
        }
        if (record.archive_state === "deleted") {
          return <Badge variant="danger">{t("requirements.detail.deletedBadge", { defaultValue: "Deleted" })}</Badge>
        }
        const uiStatus = deriveUiStatus(record)
        const meta = UI_STATUS_META[uiStatus]
        return (
          <Badge variant={meta?.variant ?? "muted"}>
            {t(meta?.labelKey ?? "statuses.open", { defaultValue: meta?.defaultLabel ?? uiStatus })}
          </Badge>
        )
      },
    },
    {
      header: t("requirements.table.alerts", { defaultValue: "Alerts" }),
      id: "alerts",
      cell: ({ row }) => {
        const record = row.original
        const daysRemaining = daysUntil(record.due_date)

        if (record.status === "DONE") {
          return <span className="text-xs text-slate-400">{t("statuses.done")}</span>
        }
        if (typeof daysRemaining !== "number") {
          return <span className="text-xs text-slate-400">—</span>
        }
        if (daysRemaining < 0) {
          return <Badge variant="danger">{t("statuses.overdue")}</Badge>
        }
        if (daysRemaining === 0) {
          return <Badge variant="warning">{t("statuses.dueToday", { defaultValue: "Due today" })}</Badge>
        }
        if (daysRemaining > 0 && daysRemaining <= 7) {
          return <Badge variant="warning">{t("statuses.expiringSoon")}</Badge>
        }
        return <span className="text-xs text-slate-400">{t("alerts.clear", { defaultValue: "—" })}</span>
      },
    },
    {
      header: t("actions.actions", { defaultValue: t("actions.label", { defaultValue: "Actions" }) }),
      id: "actions",
      cell: ({ row }) => {
        const record = row.original
        const isPending = completingId === record.id
        const hasRetentionHold = record.archive_state === "archived" || record.status === "ARCHIVED"
        const isPendingReview = record.status === "PENDING_REVIEW"
        return (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleView(record)}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
              aria-label={t("actions.view")}
            >
              <EyeIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleComplete(record)}
              disabled={isPending || record.status === "DONE" || hasRetentionHold || isPendingReview}
              className="inline-flex items-center justify-center rounded-full border border-blue-200 p-2 text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t("actions.complete")}
            >
              <CheckIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => handleRemind(record)}
              disabled={isPending}
              className="inline-flex items-center justify-center rounded-full border border-slate-200 p-2 text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={t("actions.remind")}
            >
              <BellIcon className="h-4 w-4" />
            </button>
            {record.status === "PENDING_REVIEW" ? (
              <button
                type="button"
                onClick={() => handleDismiss([record])}
                aria-label={t("requirements.actions.archive", { defaultValue: "Archive" })}
                className="inline-flex items-center justify-center rounded-full border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            ) : (
              !hasRetentionHold && (
                <button
                  type="button"
                  onClick={() => handleArchive(record)}
                  aria-label={t("requirements.archiveAction", { defaultValue: "Archive requirement" })}
                  className="inline-flex items-center justify-center rounded-full border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              )
            )}
          </div>
        )
      },
    },
  )

  return columns
}

export function RequirementsClient({ initialRequirements, initialProfile }: RequirementsClientProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { locale } = useLocale()
  const { t } = useTranslation()
  const { persistLocale, isSaving: isSavingLocale } = usePersistedLocale()

  const { data: profile, isLoading: profileLoading } = useAuthedProfile(initialProfile)

  const [completingId, setCompletingId] = useState<string | null>(null)
  const [requirementRows, setRequirementRows] = useState<Requirement[]>(() => initialRequirements?.items ?? [])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filtersContainerRef = useRef<HTMLDivElement | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const selectedDueFilters = useMemo(() => parseDueFilters(searchParams), [searchParams])
  const selectedStatusFilters = useMemo(() => parseStatusFilters(searchParams), [searchParams])

  const [pendingDueFilters, setPendingDueFilters] = useState<DueFilter[]>(selectedDueFilters)
  const [pendingStatusFilters, setPendingStatusFilters] = useState<StatusFilter[]>(selectedStatusFilters)

  useEffect(() => {
    setPendingDueFilters(selectedDueFilters)
  }, [selectedDueFilters])

  useEffect(() => {
    setPendingStatusFilters(selectedStatusFilters)
  }, [selectedStatusFilters])

  const ensureFiltersClosedOnClickAway = useCallback((event: MouseEvent) => {
    if (!filtersContainerRef.current) {
      return
    }
    if (!filtersContainerRef.current.contains(event.target as Node)) {
      setFiltersOpen(false)
    }
  }, [])

  useEffect(() => {
    if (!filtersOpen) return
    document.addEventListener("mousedown", ensureFiltersClosedOnClickAway)
    return () => document.removeEventListener("mousedown", ensureFiltersClosedOnClickAway)
  }, [filtersOpen, ensureFiltersClosedOnClickAway])

  const resolvePage = useCallback(() => {
    const pageParam = searchParams?.get("page")
    const parsed = pageParam ? Number.parseInt(pageParam, 10) : 1
    if (Number.isNaN(parsed) || parsed < 1) {
      return 1
    }
    return parsed
  }, [searchParams])

  const requestedPage = resolvePage()

  const queryParams = useMemo(() => {
    const base: Record<string, string | number | boolean> = {
      page: requestedPage,
      limit: PAGE_SIZE,
    }
    if (selectedDueFilters.length > 0) {
      base.due = selectedDueFilters.join(",")
    }

    const includeArchived = selectedStatusFilters.includes("archived")
    if (includeArchived) {
      base.archived = "true"
    } else {
      const includeActive = selectedStatusFilters.includes("active")
      const includeCompleted = selectedStatusFilters.includes("completed")
      const includeTriage = selectedStatusFilters.includes("triage")
      if (includeActive || includeCompleted || includeTriage) {
        const statusTokens = new Set<string>()
        if (includeActive) {
          STATUS_QUERY_MAP.active.forEach((value) => statusTokens.add(value))
        }
        if (includeCompleted) {
          STATUS_QUERY_MAP.completed.forEach((value) => statusTokens.add(value))
        }
        if (includeTriage) {
          STATUS_QUERY_MAP.triage.forEach((value) => statusTokens.add(value))
        }
        if (statusTokens.size > 0) {
          base.status = Array.from(statusTokens).join(",")
        }
      }
    }

    return base
  }, [requestedPage, selectedDueFilters, selectedStatusFilters])

  const {
    data: requirements,
    error: requirementsError,
    isLoading: requirementsLoading,
    mutate: refreshRequirements,
  } = useApiData<RequirementsResponse>("/requirements", queryParams, {
    refreshInterval: 120_000,
    fallbackData: initialRequirements ?? undefined,
  })

  const refreshAndHydrate = useCallback(
    async () => {
      const latest = await refreshRequirements()
      if (latest?.items) {
        setRequirementRows([...latest.items])
      }
      return latest
    },
    [refreshRequirements],
  )

  useEffect(() => {
    if (profile && !requirements && !profileLoading) {
      void refreshAndHydrate()
    }
  }, [profile, profileLoading, requirements, refreshAndHydrate])

  useEffect(() => {
    if (requirements?.items) {
      setRequirementRows([...requirements.items])
    }
  }, [requirements?.items])

  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => requirementRows.some((item) => item.id === id && item.status === "PENDING_REVIEW")))
  }, [requirementRows])

  useEffect(() => {
    if (requirementsError && !(requirementsError instanceof ApiError && requirementsError.status === 401)) {
      toast.error(t("toasts.loadError"))
    }
  }, [requirementsError, t])

  const totalItems = requirements?.pagination.total ?? requirementRows.length
  const pageCount = Math.max(1, Math.ceil(totalItems / PAGE_SIZE))
  const currentPage = requirements?.pagination.page ?? requestedPage

  const updateQuery = useCallback(
    (next: { dueFilters?: DueFilter[]; statusFilters?: StatusFilter[]; page?: number }) => {
      const params = new URLSearchParams(searchParams ? searchParams.toString() : "")

      if (next.dueFilters) {
        if (next.dueFilters.length === 0) {
          params.delete("due")
        } else {
          params.set("due", next.dueFilters.join(","))
        }
      }

      if (next.statusFilters !== undefined) {
        const normalizedStatuses = next.statusFilters
        const includeArchived = normalizedStatuses.includes("archived")

        if (includeArchived) {
          params.delete("status")
          params.set("archived", "true")
        } else {
          const includeActive = normalizedStatuses.includes("active")
          const includeCompleted = normalizedStatuses.includes("completed")
          const includeTriage = normalizedStatuses.includes("triage")
          if (includeActive || includeCompleted || includeTriage) {
            const statusTokens = new Set<string>()
            if (includeActive) {
              STATUS_QUERY_MAP.active.forEach((value) => statusTokens.add(value))
            }
            if (includeCompleted) {
              STATUS_QUERY_MAP.completed.forEach((value) => statusTokens.add(value))
            }
            if (includeTriage) {
              STATUS_QUERY_MAP.triage.forEach((value) => statusTokens.add(value))
            }
            if (statusTokens.size > 0) {
              params.set("status", Array.from(statusTokens).join(","))
            }
          } else {
            params.delete("status")
          }
          params.delete("archived")
        }
      }

      if (next.page !== undefined) {
        if (next.page <= 1) {
          params.delete("page")
        } else {
          params.set("page", String(next.page))
        }
      }

      setRequirementRows([])
      setSelectedIds([])
      const queryString = params.toString()
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const applyFilters = useCallback(() => {
    const normalizedStatus = [...pendingStatusFilters]
    setPendingStatusFilters(normalizedStatus)
    updateQuery({ dueFilters: pendingDueFilters, statusFilters: normalizedStatus, page: 1 })
    setFiltersOpen(false)
  }, [pendingDueFilters, pendingStatusFilters, updateQuery])

  const clearFilters = useCallback(() => {
    setPendingDueFilters([])
    setPendingStatusFilters([])
    updateQuery({ dueFilters: [], statusFilters: [], page: 1 })
    setFiltersOpen(false)
  }, [updateQuery])

  const toggleDueFilter = useCallback((value: DueFilter) => {
    setPendingDueFilters((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]))
  }, [])

  const toggleStatusFilter = useCallback((value: StatusFilter) => {
    setPendingStatusFilters((prev) => {
      if (value === "archived") {
        if (prev.includes("archived")) {
          return prev.filter((item) => item !== "archived")
        }
        return ["archived"]
      }
      const next = prev.filter((item) => item !== "archived")
      if (next.includes(value)) {
        return next.filter((item) => item !== value)
      }
      return [...next, value]
    })
  }, [])

  const handleView = useCallback(
    (requirement: Requirement) => {
      router.push(`/requirements/${requirement.id}`)
    },
    [router],
  )

  const handleComplete = useCallback(
    async (requirement: Requirement) => {
      if (requirement.status === "DONE" || requirement.status === "PENDING_REVIEW") {
        return
      }
      setCompletingId(requirement.id)
      try {
        const updated = await apiFetch<Requirement>(`/requirements/${requirement.id}/complete`, {
          method: "POST",
          body: JSON.stringify({ completed_by: profile?.user?.email ?? null }),
        })
        toast.success(t("requirements.completeSuccess"))
        setRequirementRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
        await refreshAndHydrate()
      } catch (error) {
        const message = error instanceof ApiError ? error.message : t("requirements.completeError")
        toast.error(message)
      } finally {
        setCompletingId(null)
      }
    },
    [profile?.user?.email, refreshAndHydrate, t],
  )

  const handleRemind = useCallback(
    (requirement: Requirement) => {
      toast.info(t("requirements.renewReminder"), {
        description: requirement.title_en,
      })
    },
    [t],
  )

  const toggleSelection = useCallback((requirement: Requirement, checked: boolean) => {
    if (requirement.status !== "PENDING_REVIEW") {
      return
    }
    setSelectedIds((prev) => {
      if (checked) {
        if (prev.includes(requirement.id)) {
          return prev
        }
        return [...prev, requirement.id]
      }
      return prev.filter((id) => id !== requirement.id)
    })
  }, [])

  const toggleSelectAll = useCallback(
    (checked: boolean) => {
      setSelectedIds((prev) => {
        const triageIdsOnPage = requirementRows
          .filter((item) => item.status === "PENDING_REVIEW")
          .map((item) => item.id)
        if (triageIdsOnPage.length === 0) {
          return prev
        }
        if (checked) {
          const next = new Set(prev)
          triageIdsOnPage.forEach((id) => next.add(id))
          return Array.from(next)
        }
        return prev.filter((id) => !triageIdsOnPage.includes(id))
      })
    },
    [requirementRows],
  )

  const dismissRequirementsList = useCallback(
    async (requirementsToDismiss: Requirement[], options: { confirm?: boolean; reason?: string } = {}) => {
      if (requirementsToDismiss.length === 0) return
      const { confirm = true, reason: providedReason } = options
      let archiveReason = providedReason ?? t("triage.dismissReason", { defaultValue: "Not applicable" })
      if (confirm) {
        const message =
          requirementsToDismiss.length === 1
            ? t("triage.confirmDismiss", { defaultValue: "Archive this requirement as not applicable?" })
            : t("triage.confirmDismissMany", {
                count: requirementsToDismiss.length,
                defaultValue: "Archive {{count}} requirements as not applicable?",
              })
        if (!window.confirm(message)) {
          return
        }
        const promptMessage = t("triage.dismissReasonPrompt", { defaultValue: "Add a note for why these requirements are being archived." })
        const input = window.prompt(promptMessage, archiveReason)
        if (input === null) {
          return
        }
        const trimmed = input.trim()
        if (!trimmed) {
          toast.error(t("requirements.detail.archiveReasonRequired", { defaultValue: "Add a reason to continue." }))
          return
        }
        archiveReason = trimmed
      }

      try {
        await Promise.all(
          requirementsToDismiss.map((requirement) =>
            apiFetch<Requirement>(`/requirements/${requirement.id}/archive`, {
              method: "POST",
              body: JSON.stringify({
                reason: archiveReason,
              }),
            }),
          ),
        )

        const count = requirementsToDismiss.length
        toast.success(
          count === 1
            ? t("triage.dismissed", { defaultValue: "Requirement archived" })
            : t("triage.dismissedMany", { count, defaultValue: "Archived {{count}} requirements" }),
        )

        setSelectedIds((prev) => prev.filter((id) => !requirementsToDismiss.some((req) => req.id === id)))
        await refreshAndHydrate()
      } catch (error) {
        const message = error instanceof ApiError ? error.message : t("triage.error", { defaultValue: "Unable to update requirements" })
        toast.error(message)
      }
    },
    [refreshAndHydrate, t],
  )

  const archiveRequirement = useCallback(
    async (requirement: Requirement) => {
      if (requirement.archive_state === "archived" || requirement.status === "ARCHIVED") {
        return
      }
      const promptMessage = t("requirements.detail.promptArchiveReason", {
        defaultValue: "Provide a reason for archiving this requirement.",
      })
      const reasonInput = window.prompt(promptMessage, "")
      if (reasonInput === null) {
        return
      }
      const reason = reasonInput.trim()
      if (!reason) {
        toast.error(t("requirements.detail.archiveReasonRequired", { defaultValue: "Add a reason to continue." }))
        return
      }
      try {
        const updated = await apiFetch<Requirement>(`/requirements/${requirement.id}/archive`, {
          method: "POST",
          body: JSON.stringify({ reason }),
        })
        toast.success(t("requirements.detail.archived", { defaultValue: "Requirement archived" }))
        setRequirementRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)))
        setSelectedIds((prev) => prev.filter((id) => id !== requirement.id))
        await refreshAndHydrate()
      } catch (error) {
        const message = error instanceof ApiError ? error.message : t("requirements.detail.archiveError", { defaultValue: "Unable to update retention state" })
        toast.error(message)
      }
    },
    [refreshAndHydrate, t],
  )

  const selectedRequirements = useMemo(
    () => requirementRows.filter((item) => selectedIds.includes(item.id)),
    [requirementRows, selectedIds],
  )

  const handleDismiss = useCallback(
    (requirements: Requirement[], options?: { confirm?: boolean }) => dismissRequirementsList(requirements, options),
    [dismissRequirementsList],
  )

  const handleTriageSubmit = useCallback(
    async (payload: {
      requirement_ids: string[]
      frequency?: string
      anchor_type?: string
      anchor_value?: Record<string, unknown>
      due_date?: string
      assignee?: string
    }) => {
      try {
        await apiFetch<{ items: Requirement[]; updated: number }>("/requirements/triage/bulk", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        toast.success(t("triage.success", { defaultValue: "Triage updated" }))
        setSelectedIds([])
        await refreshAndHydrate()
      } catch (error) {
        console.error("[triage] bulk update failed", error)
        toast.error(t("triage.error", { defaultValue: "Unable to update triage" }))
      }
    },
    [refreshAndHydrate, t],
  )

  const selectionSet = useMemo(() => new Set(selectedIds), [selectedIds])
  const showSelectionColumn = useMemo(
    () =>
      selectedStatusFilters.includes("triage") || requirementRows.some((item) => item.status === "PENDING_REVIEW"),
    [requirementRows, selectedStatusFilters],
  )

  const triageRowsOnPage = useMemo(
    () => requirementRows.filter((item) => item.status === "PENDING_REVIEW"),
    [requirementRows],
  )
  const selectAllState = useMemo(() => {
    const idsOnPage = triageRowsOnPage.map((item) => item.id)
    const hasSelectable = idsOnPage.length > 0
    if (!hasSelectable) {
      return { hasSelectable: false, allSelected: false, someSelected: false }
    }
    const allSelected = idsOnPage.every((id) => selectionSet.has(id))
    const someSelected = idsOnPage.some((id) => selectionSet.has(id))
    return { hasSelectable, allSelected, someSelected }
  }, [triageRowsOnPage, selectionSet])

  useEffect(() => {
    if (!showSelectionColumn && selectedIds.length > 0) {
      setSelectedIds([])
    }
  }, [showSelectionColumn, selectedIds.length])

  const columns = useMemo(
    () =>
      buildColumns(
        locale,
        t,
        completingId,
        handleView,
        handleComplete,
        handleRemind,
        selectionSet,
        toggleSelection,
        showSelectionColumn,
        dismissRequirementsList,
        archiveRequirement,
        toggleSelectAll,
        selectAllState,
      ),
    [
      locale,
      t,
      completingId,
      handleView,
      handleComplete,
      handleRemind,
      selectionSet,
      toggleSelection,
      showSelectionColumn,
      dismissRequirementsList,
      archiveRequirement,
      toggleSelectAll,
      selectAllState,
    ],
  )

  const hasSelection = selectedRequirements.length > 0

  return (
    <AppShell
      title={t("requirements.title")}
      description={profile?.org?.name ?? ""}
      actions={<LanguageToggle onPersist={(next) => persistLocale(next)} isSaving={isSavingLocale || profileLoading} />}
    >
      <div className="mb-6 flex justify-end">
        <div className="relative" ref={filtersContainerRef}>
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition ${
              filtersOpen ? "bg-slate-900 text-white" : "border border-slate-300 text-slate-700 hover:bg-slate-100"
            }`}
          >
            <svg
              aria-hidden="true"
              className="mr-2 h-4 w-4"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h14M5 10h10M8 15h4" />
            </svg>
            <span className="text-sm">{t("actions.filter")}</span>
          </button>
          {filtersOpen && (
            <div className="absolute right-0 z-20 mt-3 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">{t("requirements.filters.label")}</p>
                <div className="mt-3 space-y-2">
                  {dueFilterOptions.map((option) => (
                    <label
                      key={option}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:border-slate-300"
                    >
                      <span>{t(`filters.${option}`)}</span>
                      <input
                        type="checkbox"
                        checked={pendingDueFilters.includes(option)}
                        onChange={() => toggleDueFilter(option)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t border-slate-200 pt-4">
                <p className="text-xs font-semibold uppercase text-slate-500">{t("requirements.filters.statusLabel")}</p>
                <div className="mt-3 space-y-2">
                  {statusFilterOptions.map((option) => (
                    <label
                      key={option}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:border-slate-300"
                    >
                      <span>{t(`statusFilters.${option}`, { defaultValue: STATUS_FILTER_LABELS[option] })}</span>
                      <input
                        type="checkbox"
                        checked={pendingStatusFilters.includes(option)}
                        onChange={() => toggleStatusFilter(option)}
                      />
                    </label>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-sm font-semibold text-slate-500 hover:text-slate-700"
                >
                  {t("actions.clear", { defaultValue: "Clear" })}
                </button>
                <button
                  type="button"
                  onClick={applyFilters}
                  className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {t("actions.apply", { defaultValue: "Apply" })}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className={
          hasSelection
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]"
            : "space-y-6"
        }
      >
        <div className={hasSelection ? "space-y-6" : undefined}>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <DataTable<Requirement>
              key={locale}
              columns={columns}
              data={requirementRows}
              isLoading={requirementsLoading && requirementRows.length === 0}
              loadingMessage={t("app.loading")}
              emptyMessage={t("empty.requirements")}
              pageSize={PAGE_SIZE}
            />
            <div className="mt-6 flex items-center justify-end">
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                previousLabel={t("pagination.previous")}
                nextLabel={t("pagination.next")}
                onPageChange={(page) => updateQuery({ page })}
              />
            </div>
          </div>
        </div>

        {hasSelection && (
          <TriagePanel
            selected={selectedRequirements}
            onSubmit={handleTriageSubmit}
            onDismiss={(reqs, options) => dismissRequirementsList(reqs, { confirm: false, reason: options?.reason })}
            onCancel={() => setSelectedIds([])}
          />
        )}
      </div>
    </AppShell>
  )
}
function formatFrequencyLabel(value: string | null | undefined, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!value) {
    return "—"
  }
  const meta = FREQUENCY_LABELS[value]
  if (meta) {
    return t(meta.labelKey, { defaultValue: meta.defaultLabel })
  }
  const formatted = value.replaceAll("_", " ").toLowerCase()
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

function formatCategoryLabel(value: string | null | undefined, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!value) {
    return "—"
  }
  const key = toTranslationKey(value)
  return t(`categories.${key}`, { defaultValue: value })
}

function deriveUiStatus(record: Requirement): UiStatus {
  if (record.archive_state === "archived" || record.archive_state === "deleted") {
    return "ARCHIVED"
  }
  if (record.status === "ARCHIVED") {
    return "ARCHIVED"
  }

  const status = record.status ?? "OPEN"
  const daysRemaining = daysUntil(record.due_date)

  if (status === "PENDING_REVIEW") {
    if (typeof daysRemaining === "number" && daysRemaining < 0) {
      return "OVERDUE"
    }
    return "NEEDS_TRIAGE"
  }

  if (status === "DONE" || status === "READY") {
    if (typeof daysRemaining === "number" && daysRemaining < 0) {
      return "OVERDUE"
    }
    return "COMPLETED"
  }

  if (status === "REVIEW") {
    if (typeof daysRemaining === "number" && daysRemaining < 0) {
      return "OVERDUE"
    }
    return "NEEDS_REVIEW"
  }

  if (typeof daysRemaining === "number" && daysRemaining < 0) {
    return "OVERDUE"
  }

  return "OPEN"
}

export function formatTriageReason(reason: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const normalized = toSnakeCase(reason)
  const key = `triage.reasons.${normalized}`
  const defaultLabel = humanizeToken(reason)
  return t(key, { defaultValue: defaultLabel })
}

function humanizeToken(value: string): string {
  if (!value) {
    return value
  }
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ")
}

function toTranslationKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part, index) => {
      const lower = part.toLowerCase()
      if (index === 0) {
        return lower
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1)
    })
    .join("")
}

function toSnakeCase(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_|_$/g, "")
    .toLowerCase()
}
