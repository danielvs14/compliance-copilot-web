import { USE_MOCKS } from "@/lib/env"

const ATTRIBUTE = "data-last-toast-message"

export function setMockToastMessage(message: string) {
  if (!USE_MOCKS) return
  if (typeof document === "undefined") return
  document.body.setAttribute(ATTRIBUTE, message)
}

export function clearMockToastMessage() {
  if (!USE_MOCKS) return
  if (typeof document === "undefined") return
  document.body.removeAttribute(ATTRIBUTE)
}

export const MOCK_TOAST_ATTRIBUTE = ATTRIBUTE
