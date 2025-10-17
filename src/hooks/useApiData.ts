import useSWR, { SWRConfiguration } from "swr"

import { ApiError, apiFetch } from "@/lib/api/client"

type KeyTuple = [string, Record<string, string | number | boolean | undefined> | undefined]

const defaultConfig: SWRConfiguration = {
  revalidateOnFocus: false,
  shouldRetryOnError: false,
  revalidateOnMount: true,
  keepPreviousData: true,
}

export function useApiData<T>(
  path: string | null,
  params?: Record<string, string | number | boolean | undefined>,
  config?: SWRConfiguration,
) {
  const swrKey: KeyTuple | null = path ? [path, params] : null

  return useSWR<T, ApiError>(
    swrKey,
    ([url, search]) => apiFetch<T>(url, { searchParams: search }),
    {
      ...defaultConfig,
      ...config,
    },
  )
}
