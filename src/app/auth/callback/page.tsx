"use client"
import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export default function AuthCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"loading" | "error">("loading")
  const [message, setMessage] = useState("Signing you in...")

  useEffect(() => {
    const token = searchParams.get("token")
    if (!token) {
      setStatus("error")
      setMessage("Missing token. Please request a new magic link.")
      return
    }

    const redeem = async () => {
      try {
        const response = await fetch(`${API_URL}/auth/callback?token=${encodeURIComponent(token)}`, {
          credentials: "include",
        })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({ detail: "Login failed" }))
          throw new Error(payload.detail ?? "Login failed")
        }
        const data = await response.json()
        const destination = data.redirect_path || "/documents"
        router.replace(destination)
      } catch (err) {
        setStatus("error")
        setMessage(err instanceof Error ? err.message : "Unable to complete login")
      }
    }

    redeem()
  }, [router, searchParams])

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="rounded-lg bg-white p-8 shadow">
        <p className="text-sm text-slate-700">{message}</p>
        {status === "error" && (
          <button
            className="mt-4 rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            onClick={() => router.replace("/login")}
          >
            Back to login
          </button>
        )}
      </div>
    </div>
  )
}
