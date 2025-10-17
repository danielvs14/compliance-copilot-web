const TRUE_VALUES = new Set(["1", "true", "yes", "on"])

export const USE_MOCKS = TRUE_VALUES.has((process.env.NEXT_PUBLIC_USE_MOCKS ?? "").toLowerCase())
