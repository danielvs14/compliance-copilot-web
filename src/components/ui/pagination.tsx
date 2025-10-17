"use client"

import clsx from "clsx"

export type PaginationProps = {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  previousLabel: string
  nextLabel: string
  disabled?: boolean
}

export function Pagination({ page, pageCount, onPageChange, previousLabel, nextLabel, disabled = false }: PaginationProps) {
  const isFirst = page <= 1
  const isLast = pageCount <= page

  const goTo = (nextPage: number) => {
    if (nextPage < 1 || nextPage > pageCount) return
    onPageChange(nextPage)
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <button
        type="button"
        className={clsx(
          "rounded border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50",
          (disabled || isFirst) && "cursor-not-allowed opacity-50",
        )}
        onClick={() => goTo(page - 1)}
        disabled={disabled || isFirst}
      >
        {previousLabel}
      </button>
      <span className="text-sm text-slate-500">
        {page} / {Math.max(pageCount, 1)}
      </span>
      <button
        type="button"
        className={clsx(
          "rounded border border-slate-200 px-3 py-1 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50",
          (disabled || isLast) && "cursor-not-allowed opacity-50",
        )}
        onClick={() => goTo(page + 1)}
        disabled={disabled || isLast}
      >
        {nextLabel}
      </button>
    </div>
  )
}
