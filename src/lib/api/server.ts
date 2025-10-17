import { cookies, headers } from "next/headers"

import { API_URL, buildApiUrl } from "@/lib/api/client"
import { ApiError } from "@/lib/api/errors"
import { mockApiFetch } from "@/lib/api/mock"
import type { ApiFetchOptions } from "@/lib/api/types"
import { USE_MOCKS } from "@/lib/env"

type ServerApiFetchOptions = {
  searchParams?: Record<string, string | number | boolean | undefined>
  init?: RequestInit
}

const buildCookieHeader = async () => {
  try {
    const cookieStore = await cookies()
    const all = await cookieStore.getAll()
    if (!all.length) {
      return undefined
    }
    return all.map(({ name, value }) => `${name}=${value}`).join("; ")
  } catch {
    return undefined
  }
}

const buildForwardedHeaders = async (initHeaders: HeadersInit | undefined): Promise<Headers> => {
  const result = new Headers(initHeaders ?? undefined)
  const cookieHeader = await buildCookieHeader()
  if (cookieHeader && !result.has("cookie")) {
    result.set("cookie", cookieHeader)
  }
  try {
    const incomingHeaders = await headers()
    const acceptLanguage = incomingHeaders.get("accept-language")
    if (acceptLanguage && !result.has("accept-language")) {
      result.set("accept-language", acceptLanguage)
    }
    const userAgent = incomingHeaders.get("user-agent")
    if (userAgent && !result.has("user-agent")) {
      result.set("user-agent", userAgent)
    }
  } catch {
    // headers() is only available in a request context; ignore if unavailable.
  }
  result.set("accept", "application/json")
  if (!result.has("content-type")) {
    result.set("content-type", "application/json")
  }
  return result
}

export async function serverApiFetch<T>(
  path: string,
  { searchParams, init }: ServerApiFetchOptions = {},
): Promise<T> {
  if (USE_MOCKS) {
    return mockApiFetch<T>(
      path,
      {
        searchParams,
        method: init?.method,
        body: init?.body ?? undefined,
      } as ApiFetchOptions,
      API_URL,
    )
  }

  const url = buildApiUrl(path, searchParams)
  const headers = await buildForwardedHeaders(init?.headers)

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
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
