"use client"

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  PaginationState,
  useReactTable,
} from "@tanstack/react-table"
import { useState } from "react"

export type DataTableProps<TData extends Record<string, unknown>> = {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  emptyMessage: string
  isLoading?: boolean
  loadingMessage?: string
  pageSize?: number
  manualPagination?: boolean
  pageCount?: number
  onPageChange?: (pageIndex: number) => void
}

export function DataTable<TData extends Record<string, unknown>>({
  columns,
  data,
  emptyMessage,
  isLoading = false,
  loadingMessage = "Loading",
  pageSize = 10,
  manualPagination = false,
  pageCount,
  onPageChange,
}: DataTableProps<TData>) {
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize })

  const table = useReactTable({
    data,
    columns,
    state: {
      pagination,
    },
    manualPagination,
    pageCount,
    onPaginationChange: onPageChange
      ? (updater) => {
          setPagination((prev) => {
            const next = typeof updater === "function" ? updater(prev) : updater
            onPageChange(next.pageIndex)
            return next
          })
        }
      : setPagination,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
  })

  const headers = table.getHeaderGroups()
  const rows = table.getRowModel().rows

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="relative min-w-full">
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            {headers.map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-6 text-center text-sm text-slate-500">
                  {loadingMessage}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-sm text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50 align-top">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm text-slate-700 align-top break-words whitespace-pre-line">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
