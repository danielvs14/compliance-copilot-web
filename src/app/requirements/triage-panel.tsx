"use client"

import { FormEvent, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"

import { Requirement, formatTriageReason } from "./requirements-client"
import { TrashIcon } from "@/components/ui/icons"

type Props = {
  selected: Requirement[]
  onSubmit: (payload: {
    requirement_ids: string[]
    frequency?: string
    anchor_type?: string
    anchor_value?: Record<string, unknown>
    due_date?: string
    assignee?: string
  }) => Promise<void>
  onDismiss?: (requirements: Requirement[], options?: { reason?: string }) => Promise<void>
  onCancel: () => void
}

type FormState = {
  frequency?: string
  anchorType?: string
  anchorDate?: string
  dueDate?: string
  assignee?: string
  interval?: string
  status?: string
}

const FREQUENCIES = [
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

const ANCHORS = [
  "UPLOAD_DATE",
  "ISSUE_DATE",
  "CALENDAR",
  "FIRST_COMPLETION",
  "CUSTOM_DATE",
] as const

export function TriagePanel({ selected, onSubmit, onDismiss, onCancel }: Props) {
  const { t } = useTranslation()
  const [form, setForm] = useState<FormState>({ status: "OPEN" })
  const [submitting, setSubmitting] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  const needsInterval = (form.frequency ?? "").startsWith("EVERY_N_")

  const selectionSummary = useMemo(() => {
    if (selected.length === 0) return { reasons: [], titles: [] as string[] }
    const reasons = new Set<string>()
    const titles: string[] = []
    selected.forEach((item) => {
      titles.push(item.title_en)
      const triageMeta = (item.attributes as Record<string, any>)?.triage
      const values = Array.isArray(triageMeta?.reasons) ? triageMeta?.reasons : []
      values.forEach((value: string) => reasons.add(value))
    })
    return { reasons: Array.from(reasons), titles }
  }, [selected])

  const handleChange = (field: keyof FormState, value: string | undefined) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()

    if (!form.status) {
      toast.error(t("triage.statusRequired", { defaultValue: "Choose a status before saving." }))
      return
    }
    const frequency = form.frequency
    if (!frequency) {
      toast.error(t("triage.frequencyRequired", { defaultValue: "Select a frequency before resolving." }))
      return
    }
    const needsDueDate = !["BEFORE_EACH_USE", "ONE_TIME"].includes(frequency)
    if (needsDueDate && !form.dueDate) {
      toast.error(t("triage.dueRequired", { defaultValue: "Set a due date before resolving." }))
      return
    }
    const requiresInterval = frequency?.startsWith("EVERY_N_") ?? false
    const intervalValue = form.interval ? Number(form.interval) : undefined
    if (requiresInterval && (!intervalValue || Number.isNaN(intervalValue) || intervalValue <= 0)) {
      toast.error(t("triage.intervalRequired", { defaultValue: "Provide an interval value" }))
      return
    }

    setSubmitting(true)
    try {
      const payload: {
        requirement_ids: string[]
        frequency?: string
        anchor_type?: string
        anchor_value?: Record<string, unknown>
        due_date?: string
        assignee?: string
        status?: string
      } = {
        requirement_ids: selected.map((item) => item.id),
      }
      if (frequency) {
        payload.frequency = frequency
      }
      if (form.anchorType) {
        payload.anchor_type = form.anchorType
        if (form.anchorDate) {
          payload.anchor_value = { date: new Date(form.anchorDate).toISOString() }
        }
      }
      if (payload.anchor_type && !payload.anchor_value) {
        payload.anchor_value = {}
      }
      if (requiresInterval && intervalValue) {
        const anchorValue = (payload.anchor_value ?? {}) as Record<string, unknown>
        anchorValue["interval"] = intervalValue
        if (frequency === "EVERY_N_DAYS") {
          anchorValue["days"] = intervalValue
        } else if (frequency === "EVERY_N_WEEKS") {
          anchorValue["weeks"] = intervalValue
        } else if (frequency === "EVERY_N_MONTHS") {
          anchorValue["months"] = intervalValue
        }
        payload.anchor_value = anchorValue
      }
      if (form.dueDate) {
        payload.due_date = new Date(form.dueDate).toISOString()
      }
      if (form.assignee) {
        payload.assignee = form.assignee
      }
      if (form.status) {
        payload.status = form.status
      }

      await onSubmit(payload)
      setForm({ status: "OPEN" })
    } finally {
      setSubmitting(false)
    }
  }

  const selectedDue = selected.length === 1 ? selected[0].due_date ?? undefined : undefined
  const reasons = selectionSummary.reasons
  const titles = selectionSummary.titles

  const handleDismissClick = async () => {
    if (!onDismiss) return
    const message =
      selected.length === 1
        ? t("triage.confirmDismiss", { defaultValue: "Archive this requirement as not applicable?" })
        : t("triage.confirmDismissMany", {
            count: selected.length,
            defaultValue: "Archive {{count}} requirements as not applicable?",
          })

    if (!window.confirm(message)) {
      return
    }

    const reasonPrompt = t("triage.dismissReasonPrompt", { defaultValue: "Add a note for why these requirements are being archived." })
    const reasonInput = window.prompt(reasonPrompt, t("triage.dismissReason", { defaultValue: "Not applicable" }))
    if (reasonInput === null) {
      return
    }
    const archiveReason = reasonInput.trim()
    if (!archiveReason) {
      toast.error(t("requirements.detail.archiveReasonRequired", { defaultValue: "Add a reason to continue." }))
      return
    }

    setDismissing(true)
    try {
      await onDismiss(selected, { reason: archiveReason })
    } finally {
      setDismissing(false)
    }
  }

  return (
    <aside className="w-full max-w-xl space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-1">
        <p className="text-sm font-medium text-slate-600">
          {t("triage.selection", { defaultValue: "Selected" })}: {selected.length}
        </p>
            {reasons.length > 0 && (
              <div className="flex flex-wrap gap-1 text-xs text-slate-700">
                <span className="font-semibold uppercase tracking-wide">
                  {t("triage.reasonsLabel", { defaultValue: "Reasons" })}:
                </span>
                {reasons.map((reason) => {
                  const label = formatTriageReason(reason, t)
                  return (
                    <span key={reason} className="rounded bg-slate-200 px-2 py-0.5 text-slate-700">
                      {label}
                    </span>
                  )
                })}
              </div>
            )}
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="triage-status">
            {t("triage.status", { defaultValue: "Status" })}
          </label>
          <select
            id="triage-status"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
            value={form.status ?? ""}
            onChange={(event) => handleChange("status", event.target.value || undefined)}
          >
            <option value="">{t("triage.statusPlaceholder", { defaultValue: "Choose status" })}</option>
            <option value="OPEN">{t("statuses.open", { defaultValue: "Open" })}</option>
            <option value="REVIEW">{t("statuses.review", { defaultValue: "Needs review" })}</option>
            <option value="DONE">{t("statuses.done", { defaultValue: "Completed" })}</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="triage-frequency">
            {t("triage.frequency", { defaultValue: "Frequency" })}
          </label>
          <select
            id="triage-frequency"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
            value={form.frequency ?? ""}
            onChange={(event) => handleChange("frequency", event.target.value || undefined)}
          >
            <option value="">{t("triage.frequencyPlaceholder", { defaultValue: "Choose frequency" })}</option>
            {FREQUENCIES.map((value) => (
              <option key={value} value={value}>
                {t(`frequencies.${toTranslationKey(value)}`, { defaultValue: humanizeToken(value) })}
              </option>
            ))}
          </select>
        </div>

        {needsInterval && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="triage-interval">
              {t("triage.interval", { defaultValue: "Interval" })}
            </label>
            <input
              id="triage-interval"
              type="number"
              min={1}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
              value={form.interval ?? ""}
              onChange={(event) => handleChange("interval", event.target.value || undefined)}
              placeholder="5"
            />
            <p className="text-xs text-slate-500">
              {t("triage.intervalHint", { defaultValue: "Required for every-N schedules" })}
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="triage-anchor-type">
              {t("triage.anchorType", { defaultValue: "Schedule reference" })}
            </label>
            <select
              id="triage-anchor-type"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
              value={form.anchorType ?? ""}
              onChange={(event) => handleChange("anchorType", event.target.value || undefined)}
            >
              <option value="">{t("triage.anchorTypePlaceholder", { defaultValue: "Select reference" })}</option>
              {ANCHORS.map((value) => (
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
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700" htmlFor="triage-anchor-date">
              {t("triage.anchorDate", { defaultValue: "Reference date" })}
            </label>
            <input
              id="triage-anchor-date"
              type="date"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
              value={form.anchorDate ?? ""}
              onChange={(event) => handleChange("anchorDate", event.target.value || undefined)}
              disabled={!form.anchorType || form.anchorType === "FIRST_COMPLETION"}
            />
            <p className="text-xs text-slate-500">
              {t("triage.anchorDateHint", {
                defaultValue: "Optional date to start the schedule (leave blank to use today).",
              })}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="triage-due-date">
            {t("triage.dueDate", { defaultValue: "Due date" })}
          </label>
          <input
            id="triage-due-date"
            type="date"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
            value={form.dueDate ?? (selectedDue ? selectedDue.slice(0, 10) : "")}
            onChange={(event) => handleChange("dueDate", event.target.value || undefined)}
          />
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="triage-assignee">
            {t("triage.assignee", { defaultValue: "Assignee" })}
          </label>
          <input
            id="triage-assignee"
            type="email"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm"
            value={form.assignee ?? ""}
            onChange={(event) => handleChange("assignee", event.target.value || undefined)}
            placeholder="triage@example.com"
          />
        </div>

        {titles.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">
              {t("triage.selectionList", { defaultValue: "Selected requirements" })}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-slate-700">
              {titles.map((title) => (
                <li key={title} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span>{title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={submitting || dismissing || selected.length === 0}
            className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? t("app.loading") : t("actions.save", { defaultValue: "Save" })}
          </button>
          {onDismiss && (
            <button
              type="button"
              onClick={handleDismissClick}
              disabled={submitting || dismissing || selected.length === 0}
              className="inline-flex items-center gap-2 rounded-full border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {dismissing ? (
                <span className="h-4 w-4 animate-spin rounded-full border border-rose-200 border-t-transparent" />
              ) : (
                <TrashIcon className="h-4 w-4" />
              )}
              <span>{t("requirements.actions.archive", { defaultValue: "Archive" })}</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setForm({ status: "OPEN" })
              onCancel()
            }}
            disabled={submitting || dismissing}
            className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {t("actions.cancel", { defaultValue: "Cancel" })}
          </button>
        </div>
      </form>
    </aside>
  )
}

function humanizeToken(value: string): string {
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
