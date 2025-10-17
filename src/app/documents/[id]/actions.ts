"use server"

import { revalidatePath } from "next/cache"

import { serverApiFetch } from "@/lib/api/server"

const SUPPORTED_TARGETS = new Set(["requirements", "permit", "training", "uncategorized"])

type MoveDocumentArgs = {
  documentId: string
  target: string
}

export async function moveDocument({ documentId, target }: MoveDocumentArgs) {
  if (!SUPPORTED_TARGETS.has(target)) {
    throw new Error("Unsupported classification target")
  }

  await serverApiFetch(`/documents/${documentId}/move`, {
    init: {
      method: "POST",
      body: JSON.stringify({ target }),
    },
  })

  revalidatePath("/documents")
  revalidatePath(`/documents/${documentId}`)
}
