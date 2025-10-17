export type ApiFetchOptions = RequestInit & {
  searchParams?: Record<string, string | number | boolean | undefined>
}
