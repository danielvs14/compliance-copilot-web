import auth from "@/mocks/auth.json"
import documents from "@/mocks/documents.json"
import permits from "@/mocks/permits.json"
import requirementComplete from "@/mocks/requirement-complete.json"
import requirements from "@/mocks/requirements.json"
import training from "@/mocks/training.json"

import { ApiError } from "@/lib/api/errors"
import type { ApiFetchOptions } from "@/lib/api/types"
import { isDueWithin, isOverdue } from "@/lib/dates"

const clone = <T>(data: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(data)
  }
  return JSON.parse(JSON.stringify(data)) as T
}

const normalizePath = (pathname: string) => {
  if (pathname === "/") return pathname
  return pathname.endsWith("/") ? pathname.slice(0, -1) : pathname
}

export async function mockApiFetch<T>(
  path: string,
  options: ApiFetchOptions = {},
  baseUrl: string,
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase()
  const targetUrl = path.startsWith("http") ? new URL(path) : new URL(path, baseUrl)
  const pathname = normalizePath(targetUrl.pathname)

  if (method === "GET") {
    switch (pathname) {
      case "/auth/me":
        return clone(auth) as T
      case "/documents":
        return clone(documents) as T
      case "/requirements":
        {
          const response = clone(requirements) as {
            items: Array<Record<string, unknown>>
            pagination: { page: number; limit: number; total: number }
          }

          const search = options.searchParams ?? {}
          const paramValue = (key: string): string | undefined => {
            const value = (search as Record<string, string | number | boolean | undefined>)[key]
            if (value !== undefined && value !== null) {
              return String(value)
            }
            return targetUrl.searchParams.get(key) ?? undefined
          }

          const limitParam = Math.max(
            1,
            Math.min(100, Number(paramValue("limit") ?? response.pagination.limit ?? 10)),
          )
          const requestedPage = Math.max(1, Number(paramValue("page") ?? response.pagination.page ?? 1))
          const dueParam = paramValue("due")

          const filtered = response.items.filter((item) => {
            if (!dueParam) return true
            const dueDate = (item as Record<string, unknown>).due_date as string | null | undefined
            switch (dueParam) {
              case "overdue":
                return isOverdue(dueDate)
              case "due7":
                return isDueWithin(dueDate, 7)
              case "due30":
                return isDueWithin(dueDate, 30)
              default:
                return true
            }
          })

          const total = filtered.length
          const pageCount = Math.max(1, Math.ceil(total / limitParam))
          const page = Math.min(requestedPage, pageCount)
          const start = (page - 1) * limitParam
          const pagedItems = filtered.slice(start, start + limitParam)

          return {
            items: pagedItems,
            pagination: {
              page,
              limit: limitParam,
              total,
            },
          } as T
        }
      case "/permits":
        return clone(permits) as T
      case "/training":
        return clone(training) as T
      default:
        break
    }
  }

  if (method === "POST" && /^\/requirements\/[^/]+\/complete$/.test(pathname)) {
    return clone(requirementComplete) as T
  }

  throw new ApiError(`No mock implemented for ${method} ${pathname}`, 404, null)
}
