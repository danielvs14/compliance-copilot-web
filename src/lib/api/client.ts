import { ApiError } from "@/lib/api/errors"
import { mockApiFetch } from "@/lib/api/mock"
import type { ApiFetchOptions } from "@/lib/api/types"
import { USE_MOCKS } from "@/lib/env"

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export const buildApiUrl = (
  path: string,
  searchParams?: ApiFetchOptions["searchParams"],
) => {
  const url = new URL(path.startsWith("http") ? path : `${API_URL}${path}`)
  if (searchParams) {
    Object.entries(searchParams).forEach(([key, value]) => {
      if (value === undefined || value === null) return
      url.searchParams.set(key, String(value))
    })
  }
  return url.toString()
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { searchParams, headers, ...rest } = options

  if (USE_MOCKS) {
    return mockApiFetch<T>(path, { searchParams, ...rest }, API_URL)
  }

  const url = buildApiUrl(path, searchParams)

  const finalHeaders = new Headers(headers)
  const body = (rest as RequestInit).body
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData
  if (!isFormData && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json")
  }

  const response = await fetch(url, {
    credentials: "include",
    headers: finalHeaders,
    ...rest,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => undefined)
    const message = (payload as { detail?: string } | undefined)?.detail ?? response.statusText
    throw new ApiError(message || "Request failed", response.status, payload)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

export async function apiMutation<T>(path: string, options: ApiFetchOptions = {}) {
  return apiFetch<T>(path, options)
}

export type { ApiFetchOptions } from "@/lib/api/types"
export { ApiError } from "@/lib/api/errors"
