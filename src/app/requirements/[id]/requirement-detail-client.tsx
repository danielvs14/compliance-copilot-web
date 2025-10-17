"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

import { LanguageToggle } from "@/components/language-toggle"
import { useLocale } from "@/components/locale-provider"
import { usePersistedLocale } from "@/hooks/usePersistedLocale"
import { apiFetch, ApiError } from "@/lib/api/client"
import { formatDate } from "@/lib/dates"
import type { Requirement } from "@/app/requirements/requirements-client"
import type { AuthMeResponse } from "@/hooks/useAuthedProfile"

type StatusOption = {
  value: string
  labelKey: string
  defaultLabel: string
}

const STATUS_LABELS: Record<string, StatusOption> = {
  OPEN: { value: "OPEN", labelKey: "statuses.open", defaultLabel: "Open" },
  REVIEW: { value: "REVIEW", labelKey: "statuses.review", defaultLabel: "Needs review" },
  PENDING_REVIEW: { value: "PENDING_REVIEW", labelKey: "statuses.needsTriage", defaultLabel: "Needs triage" },
  READY: { value: "READY", labelKey: "statuses.scheduled", defaultLabel: "Scheduled" },
  DONE: { value: "DONE", labelKey: "statuses.done", defaultLabel: "Completed" },
  ARCHIVED: { value: "ARCHIVED", labelKey: "statuses.archived", defaultLabel: "Archived" },
} as const

const STATUS_OPTIONS: StatusOption[] = [
  STATUS_LABELS.OPEN,
  STATUS_LABELS.REVIEW,
  STATUS_LABELS.PENDING_REVIEW,
  STATUS_LABELS.READY,
  STATUS_LABELS.DONE,
]

const TRIAGE_FREQUENCIES = [
  "BEFORE_EACH_USE",
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "QUARTERLY",
  "ANNUAL",
  "EVERY_N_DAYS",
  "EVERY_N_WEEKS",
  "EVERY_N_MONTHS",
  "ONE_TIME",
] as const

const TRIAGE_ANCHORS = [
  "UPLOAD_DATE",
  "ISSUE_DATE",
  "CALENDAR",
  "FIRST_COMPLETION",
  "CUSTOM_DATE",
] as const

const deriveDateInput = (value: string | null | undefined): string => {
  if (!value) return ""
  try {
    return new Date(value).toISOString().slice(0, 10)
  } catch {
    return value.slice(0, 10)
  }
}

const deriveAnchorMeta = (value: Record<string, unknown> | null | undefined) => {
  const data = (value ?? {}) as Record<string, unknown>
  const rawDate = typeof data.date === "string" ? data.date : undefined
  const date = rawDate ? deriveDateInput(rawDate) : ""
  const rawInterval = data.interval ?? data.days ?? data.weeks ?? data.months
  const interval =
    typeof rawInterval === "number"
      ? String(rawInterval)
      : typeof rawInterval === "string"
        ? rawInterval
        : ""
  return { date, interval }
}

const extractAssignee = (requirement: Requirement) => {
  const attrs = (requirement.attributes ?? {}) as Record<string, unknown>
  const fromRoot = typeof attrs.assignee === "string" ? attrs.assignee : undefined
  const triageMeta = (attrs.triage ?? {}) as Record<string, unknown>
  const fromTriage = typeof triageMeta.assignee === "string" ? triageMeta.assignee : undefined
  return (fromRoot ?? fromTriage ?? "") as string
}

const humanizeToken = (value: string) =>
  value
    .split(/[_-]/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ")

const toTranslationKey = (value: string) =>
  value
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

const extractArchiveMeta = (requirement: Requirement) => {
  const raw = (requirement.attributes?.archive as Record<string, unknown> | undefined) ?? {}
  return {
    state: (raw.state as string | undefined) ?? requirement.archive_state ?? null,
    reason: typeof raw.reason === "string" ? raw.reason : undefined,
    requestedAt: typeof raw.requested_at === "string" ? raw.requested_at : undefined,
    requestedBy: typeof raw.requested_by === "string" ? raw.requested_by : undefined,
  }
}

export type RequirementDetailClientProps = {
  requirement: Requirement
  profile: AuthMeResponse | null
}

export function RequirementDetailClient({ requirement, profile }: RequirementDetailClientProps) {
  const router = useRouter()
  const { locale, setLocale } = useLocale()
  const { persistLocale, isSaving: isSavingLocale } = usePersistedLocale()
  const { t } = useTranslation()

  const [currentRequirement, setCurrentRequirement] = useState(requirement)
  const [baselineStatus, setBaselineStatus] = useState(requirement.status ?? "OPEN")
  const [baselineDueDate, setBaselineDueDate] = useState(deriveDateInput(requirement.due_date))
  const [status, setStatus] = useState(baselineStatus)
  const [dueDate, setDueDate] = useState(baselineDueDate)
  const [isSaving, setIsSaving] = useState(false)
  const [isArchiving, setIsArchiving] = useState(false)
  const [isRestoring, setIsRestoring] = useState(false)
  const initialFrequency = requirement.frequency ?? ""
  const initialAnchorType = requirement.anchor_type ?? ""
  const { date: initialAnchorDate, interval: initialInterval } = deriveAnchorMeta(
    requirement.anchor_value as Record<string, unknown> | undefined,
  )
  const initialAssignee = extractAssignee(requirement)
  const [baselineFrequency, setBaselineFrequency] = useState(initialFrequency)
  const [baselineAnchorType, setBaselineAnchorType] = useState(initialAnchorType)
  const [baselineAnchorDate, setBaselineAnchorDate] = useState(initialAnchorDate)
  const [baselineInterval, setBaselineInterval] = useState(initialInterval)
  const [baselineAssignee, setBaselineAssignee] = useState(initialAssignee)
  const [frequency, setFrequency] = useState(initialFrequency)
  const [anchorType, setAnchorType] = useState(initialAnchorType)
  const [anchorDate, setAnchorDate] = useState(initialAnchorDate)
  const [intervalValue, setIntervalValue] = useState(initialInterval)
  const [assignee, setAssignee] = useState(initialAssignee)

  const archiveMeta = useMemo(() => extractArchiveMeta(currentRequirement), [currentRequirement])
  const [archiveState, setArchiveState] = useState<string | null>(archiveMeta.state)
  const [archiveReason, setArchiveReason] = useState<string | undefined>(archiveMeta.reason)
  const [archiveRequestedAt, setArchiveRequestedAt] = useState<string | undefined>(archiveMeta.requestedAt)
  const [archiveRequestedBy, setArchiveRequestedBy] = useState<string | undefined>(archiveMeta.requestedBy)

  useEffect(() => {
    setCurrentRequirement(requirement)
    const initialStatus = requirement.status ?? "OPEN"
    const initialDue = deriveDateInput(requirement.due_date)
    setBaselineStatus(initialStatus)
    setBaselineDueDate(initialDue)
    setStatus(initialStatus)
    setDueDate(initialDue)
    const nextFrequency = requirement.frequency ?? ""
    const nextAnchorType = requirement.anchor_type ?? ""
    const { date: nextAnchorDate, interval: nextInterval } = deriveAnchorMeta(
      requirement.anchor_value as Record<string, unknown> | undefined,
    )
    const nextAssignee = extractAssignee(requirement)
    setBaselineFrequency(nextFrequency)
    setFrequency(nextFrequency)
    setBaselineAnchorType(nextAnchorType)
    setAnchorType(nextAnchorType)
    setBaselineAnchorDate(nextAnchorDate)
    setAnchorDate(nextAnchorDate)
    setBaselineInterval(nextInterval)
    setIntervalValue(nextInterval)
    setBaselineAssignee(nextAssignee)
    setAssignee(nextAssignee)
    const initialArchive = extractArchiveMeta(requirement)
    setArchiveState(initialArchive.state)
    setArchiveReason(initialArchive.reason)
    setArchiveRequestedAt(initialArchive.requestedAt)
    setArchiveRequestedBy(initialArchive.requestedBy)
  }, [requirement])

  const isTriageMode = baselineStatus === "PENDING_REVIEW"
  const triageDirty =
    frequency !== baselineFrequency ||
    anchorType !== baselineAnchorType ||
    anchorDate !== baselineAnchorDate ||
    intervalValue !== baselineInterval ||
    assignee !== baselineAssignee ||
    status !== baselineStatus ||
    dueDate !== baselineDueDate
  const standardDirty = status !== baselineStatus || dueDate !== baselineDueDate
  const isDirty = isTriageMode ? triageDirty : standardDirty
  const retentionDisabled = archiveState === "archived"

  const retentionLabel = useMemo(() => {
    if (archiveState === "archived") {
      return t("requirements.detail.archivedBadge", { defaultValue: "Archived" })
    }
    return null
  }, [archiveState, t])

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (!isDirty) return
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
  }, [isDirty])

  const localized = useMemo(() => {
    const title = locale === "es" ? currentRequirement.title_es : currentRequirement.title_en
    const description = locale === "es" ? currentRequirement.description_es : currentRequirement.description_en
    return { title, description }
  }, [locale, currentRequirement.description_en, currentRequirement.description_es, currentRequirement.title_en, currentRequirement.title_es])

  const statusOptions = useMemo(() => {
    const base: StatusOption[] = [...STATUS_OPTIONS]
    if (
      (status === "ARCHIVED" || baselineStatus === "ARCHIVED") &&
      !base.some((option) => option.value === "ARCHIVED")
    ) {
      base.push(STATUS_LABELS.ARCHIVED)
    }
    return base
  }, [baselineStatus, status])

  const hydrateFromResponse = (updated: Requirement) => {
    setCurrentRequirement(updated)
    const nextStatus = updated.status ?? "OPEN"
    const nextDue = deriveDateInput(updated.due_date)
    setBaselineStatus(nextStatus)
    setBaselineDueDate(nextDue)
    setStatus(nextStatus)
    setDueDate(nextDue)
    const nextFrequency = updated.frequency ?? ""
    const nextAnchorType = updated.anchor_type ?? ""
    const { date: nextAnchorDate, interval: nextInterval } = deriveAnchorMeta(
      updated.anchor_value as Record<string, unknown> | undefined,
    )
    const nextAssignee = extractAssignee(updated)
    setBaselineFrequency(nextFrequency)
    setFrequency(nextFrequency)
    setBaselineAnchorType(nextAnchorType)
    setAnchorType(nextAnchorType)
    setBaselineAnchorDate(nextAnchorDate)
    setAnchorDate(nextAnchorDate)
    setBaselineInterval(nextInterval)
    setIntervalValue(nextInterval)
    setBaselineAssignee(nextAssignee)
    setAssignee(nextAssignee)
    const parsed = extractArchiveMeta(updated)
    setArchiveState(parsed.state)
    setArchiveReason(parsed.reason)
    setArchiveRequestedAt(parsed.requestedAt)
    setArchiveRequestedBy(parsed.requestedBy)
  }

  const syncRequirementFromServer = useCallback(async () => {
    const latest = await apiFetch<Requirement>(`/requirements/${requirement.id}`)
    hydrateFromResponse(latest)
  }, [requirement.id])

  const handleBack = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        t("requirements.detail.confirmLeave", {
          defaultValue: "You have unsaved changes. Leave without saving?",
        }),
      )
      if (!confirmed) {
        toast.info(
          t("requirements.detail.keepEditing", {
            defaultValue: "Keep editing to save your updates.",
          }),
        )
        return
      }
      toast.warning(
        t("requirements.detail.changesDiscarded", {
          defaultValue: "Unsaved changes were discarded.",
        }),
      )
    }
    router.back()
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      if (!isDirty) {
        toast.info(t("requirements.detail.noChanges", { defaultValue: "No changes to save." }))
        return
      }

      if (isTriageMode) {
        if (!frequency) {
          toast.error(t("triage.frequencyRequired", { defaultValue: "Select a frequency before saving." }))
          return
        }
        const needsDueDate = !["BEFORE_EACH_USE", "ONE_TIME"].includes(frequency)
        if (needsDueDate && !dueDate) {
          toast.error(t("triage.dueRequired", { defaultValue: "Set a due date before saving." }))
          return
        }
        const requiresInterval = frequency.startsWith("EVERY_N_")
        const intervalNumber = intervalValue ? Number(intervalValue) : undefined
        if (requiresInterval && (!intervalNumber || Number.isNaN(intervalNumber) || intervalNumber <= 0)) {
          toast.error(t("triage.intervalRequired", { defaultValue: "Provide an interval value" }))
          return
        }

        const payload: {
          requirement_ids: string[]
          frequency?: string
          anchor_type?: string
          anchor_value?: Record<string, unknown>
          due_date?: string
          assignee?: string
          status?: string
        } = {
          requirement_ids: [requirement.id],
          status,
        }

        if (frequency) {
          payload.frequency = frequency
        }
        if (anchorType) {
          payload.anchor_type = anchorType
        }
        if (anchorType || anchorDate || (requiresInterval && intervalNumber)) {
          const anchorValue: Record<string, unknown> = {}
          if (anchorDate) {
            anchorValue.date = new Date(`${anchorDate}T00:00:00Z`).toISOString()
          }
          if (requiresInterval && intervalNumber) {
            anchorValue.interval = intervalNumber
            if (frequency === "EVERY_N_DAYS") {
              anchorValue.days = intervalNumber
            } else if (frequency === "EVERY_N_WEEKS") {
              anchorValue.weeks = intervalNumber
            } else if (frequency === "EVERY_N_MONTHS") {
              anchorValue.months = intervalNumber
            }
          }
          payload.anchor_value = anchorValue
        }
        if (dueDate) {
          payload.due_date = new Date(`${dueDate}T12:00:00Z`).toISOString()
        }
        if (assignee.trim()) {
          payload.assignee = assignee.trim()
        }

        const result = await apiFetch<{ items: Requirement[]; updated: number }>("/requirements/triage/bulk", {
          method: "POST",
          body: JSON.stringify(payload),
        })
        if (Array.isArray(result.items) && result.items.length > 0) {
          hydrateFromResponse(result.items[0])
        } else {
          await syncRequirementFromServer()
        }
        toast.success(t("requirements.detail.triageSuccess", { defaultValue: "Requirement updated" }))
        router.push("/requirements")
      } else {
        const payload: { status?: string; due_date?: string | null } = {}
        if (status !== baselineStatus) {
          payload.status = status
        }
        if (dueDate !== baselineDueDate) {
          payload.due_date = dueDate ? new Date(`${dueDate}T12:00:00Z`).toISOString() : null
        }
        const updated = await apiFetch<Requirement>(`/requirements/${requirement.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        })
        hydrateFromResponse(updated)
        toast.success(t("requirements.detail.saveSuccess", { defaultValue: "Requirement updated" }))
        router.push("/requirements")
      }
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("requirements.detail.saveError", { defaultValue: "Unable to save requirement" })
      toast.error(message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleRemind = () => {
    if (retentionDisabled) {
      return
    }
    toast.info(t("requirements.renewReminder", { defaultValue: locale === "es" ? "Recordatorio programado" : "Reminder scheduled" }), {
      description: localized.title,
    })
  }

  const handleArchive = async () => {
    const promptLabel = t("requirements.detail.promptArchiveReason", {
      defaultValue: "Provide a reason for archiving this requirement.",
    })
    const reasonInput = window.prompt(promptLabel, archiveReason ?? "")
    if (reasonInput === null) {
      return
    }
    const reason = reasonInput.trim()
    if (!reason) {
      toast.error(t("requirements.detail.archiveReasonRequired", { defaultValue: "Add a reason to continue." }))
      return
    }

    setIsArchiving(true)
    try {
      const updated = await apiFetch<Requirement>(`/requirements/${requirement.id}/archive`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      })
      hydrateFromResponse(updated)
      await syncRequirementFromServer()
      toast.success(t("requirements.detail.archived", { defaultValue: "Requirement archived" }))
      router.push("/requirements")
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("requirements.detail.archiveError", { defaultValue: "Unable to update retention state" })
      toast.error(message)
    } finally {
      setIsArchiving(false)
    }
  }

  const handleRestore = async () => {
    if (!window.confirm(t("requirements.detail.confirmRestore", { defaultValue: "Restore this requirement to active?" }))) {
      return
    }

    setIsRestoring(true)
    try {
      const updated = await apiFetch<Requirement>(`/requirements/${requirement.id}/archive/restore`, {
        method: "POST",
        body: JSON.stringify({}),
      })
      hydrateFromResponse(updated)
      await syncRequirementFromServer()
      toast.success(t("requirements.detail.restored", { defaultValue: "Requirement restored" }))
      router.push("/requirements")
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("requirements.detail.archiveError", { defaultValue: "Unable to update retention state" })
      toast.error(message)
    } finally {
      setIsRestoring(false)
    }
  }

  return (
    <div className="space-y-6">
      {retentionLabel && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-700">{retentionLabel}</p>
          {archiveReason && <p className="mt-1 text-sm text-slate-500">{archiveReason}</p>}
          {archiveRequestedAt && (
            <p className="mt-1 text-xs text-slate-400">
              {t("requirements.detail.requestedBy", {
                defaultValue: "Requested by {{user}} on {{date}}",
                user: archiveRequestedBy ?? t("requirements.detail.unknownUser", { defaultValue: "unknown" }),
                date: formatDate(archiveRequestedAt ?? null, locale),
              })}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <button
          type="button"
          onClick={handleBack}
          className="rounded-lg border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
        >
          {t("actions.back", { defaultValue: "Back" })}
        </button>
        <LanguageToggle
          onPersist={(next) => {
            setLocale(next)
            void persistLocale(next)
          }}
          isSaving={isSavingLocale}
        />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="space-y-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{locale === "es" ? "Documento" : "Document"}</p>
            <p className="mt-1 text-sm text-slate-800">{currentRequirement.document_name ?? "—"}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{locale === "es" ? "Estado" : "Status"}</label>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                disabled={archiveState === "archived"}
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey, { defaultValue: option.defaultLabel })}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{locale === "es" ? "Fecha límite" : t("requirements.table.due")}</label>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
              <p className="mt-1 text-xs text-slate-500">
                {currentRequirement.due_date
                  ? formatDate(currentRequirement.due_date, locale)
                  : locale === "es"
                    ? "Sin fecha límite"
                    : "No due date set"}
              </p>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{locale === "es" ? "Título" : "Title"}</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-900">{localized.title}</h2>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{locale === "es" ? "Descripción" : "Description"}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{localized.description}</p>
          </div>

          {status === "PENDING_REVIEW" && (
            <div className="space-y-4 rounded-xl bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-700">
                {t("requirements.detail.triageSection", { defaultValue: "Triage details" })}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("triage.frequency", { defaultValue: "Frequency" })}
                  </label>
                  <select
                    value={frequency}
                    onChange={(event) => setFrequency(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                  >
                <option value="">{t("triage.frequencyPlaceholder", { defaultValue: "Choose frequency" })}</option>
                {TRIAGE_FREQUENCIES.map((value) => (
                  <option key={value} value={value}>
                    {t(`frequencies.${toTranslationKey(value)}`, { defaultValue: humanizeToken(value) })}
                  </option>
                ))}
              </select>
            </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("triage.assignee", { defaultValue: "Assignee email (optional)" })}
                  </label>
                  <input
                    type="email"
                    value={assignee}
                    onChange={(event) => setAssignee(event.target.value)}
                    placeholder="triage@example.com"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                  />
                </div>
                {frequency.startsWith("EVERY_N_") && (
                  <div className="space-y-1">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {t("triage.interval", { defaultValue: "Interval" })}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={intervalValue}
                      onChange={(event) => setIntervalValue(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                      placeholder="5"
                    />
                    <p className="text-xs text-slate-500">
                      {t("triage.intervalHint", { defaultValue: "Required for every-N schedules." })}
                    </p>
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("triage.anchorType", { defaultValue: "Schedule reference" })}
                  </label>
                  <select
                    value={anchorType}
                    onChange={(event) => setAnchorType(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                  >
                <option value="">{t("triage.anchorTypePlaceholder", { defaultValue: "Select reference" })}</option>
                {TRIAGE_ANCHORS.map((value) => (
                  <option key={value} value={value}>
                    {t(`anchors.${toTranslationKey(value)}`, { defaultValue: humanizeToken(value) })}
                  </option>
                ))}
              </select>
                  <p className="text-xs text-slate-500">
                    {t("triage.anchorTypeHint", {
                      defaultValue: "Use upload date or first completion to schedule future cycles.",
                    })}
                  </p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {t("triage.anchorDate", { defaultValue: "Reference date" })}
                  </label>
                  <input
                    type="date"
                    value={anchorDate}
                    onChange={(event) => setAnchorDate(event.target.value)}
                    disabled={!anchorType || anchorType === "FIRST_COMPLETION"}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <p className="text-xs text-slate-500">
                    {t("triage.anchorDateHint", {
                      defaultValue: "Optional date to start the schedule.",
                    })}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {isSaving ? t("app.saving") : t("actions.save")}
          </button>
          <button
            type="button"
            onClick={handleRemind}
            disabled={retentionDisabled}
            className="inline-flex items-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t("actions.remind")}
          </button>
          {archiveState !== "archived" && (
            <button
              type="button"
              onClick={handleArchive}
              disabled={isArchiving}
              className="inline-flex items-center rounded-lg border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isArchiving ? t("app.loading") : t("requirements.detail.archiveNow", { defaultValue: "Archive" })}
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">
            {t("requirements.detail.retentionTitle", { defaultValue: "Record retention" })}
          </h3>
          {archiveState === "archived" && (
            <span className="text-xs font-medium text-slate-500">
              {t("requirements.detail.archivedBadge", { defaultValue: "Archived" })}
            </span>
          )}
        </div>

        {archiveState === "archived" ? (
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            <p>{t("requirements.detail.archivedSummary", { defaultValue: "This requirement is archived and hidden from active queues." })}</p>
            {archiveReason && <p className="text-xs text-slate-500">{archiveReason}</p>}
            <p className="text-xs text-slate-500">
              {t("requirements.detail.requestedBy", {
                defaultValue: "Requested by {{user}} on {{date}}",
                user: archiveRequestedBy ?? t("requirements.detail.unknownUser", { defaultValue: "unknown" }),
                date: formatDate(archiveRequestedAt ?? null, locale),
              })}
            </p>
            <button
              type="button"
              onClick={handleRestore}
              disabled={isRestoring}
              className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isRestoring ? t("app.loading") : t("requirements.detail.restore", { defaultValue: "Restore" })}
            </button>
          </div>
        ) : (
          <div className="mt-3 space-y-3 text-sm text-slate-700">
            {archiveReason && archiveState === "restored" && (
              <p className="text-xs text-slate-500">
                {t("requirements.detail.previousArchiveReason", {
                  defaultValue: "Previously archived because: {{reason}}",
                  reason: archiveReason,
                })}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {t("requirements.detail.archiveGuidance", {
                defaultValue: "Archive requirements once they are no longer in your active workflow."
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
