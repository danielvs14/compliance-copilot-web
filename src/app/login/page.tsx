"use client"
import { FormEvent, useState } from "react"

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

const localeOptions = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
]

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [locale, setLocale] = useState("en")
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus("sending")
    setError(null)

    try {
      const response = await fetch(`${API_URL}/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, preferred_locale: locale, redirect_path: "/documents" }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({ detail: "Unable to send link" }))
        throw new Error(payload.detail ?? "Unable to send link")
      }

      setStatus("sent")
    } catch (err) {
      setStatus("error")
      setError(err instanceof Error ? err.message : "Unable to send link")
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow">
        <h1 className="text-2xl font-bold text-slate-900">Compliance Copilot</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your email to receive a secure login link. No password needed.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 p-2 focus:border-blue-600 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700">Language</label>
            <select
              value={locale}
              onChange={(event) => setLocale(event.target.value)}
              className="mt-1 w-full rounded border border-slate-300 p-2"
            >
              {localeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full rounded bg-blue-600 py-2 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {status === "sending" ? "Sending link..." : "Send magic link"}
          </button>
        </form>

        {status === "sent" && (
          <p className="mt-4 rounded bg-green-50 p-3 text-sm text-green-700">
            Magic link sent! Check your inbox to continue.
          </p>
        )}
        {status === "error" && error && (
          <p className="mt-4 rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>
        )}
      </div>
    </div>
  )
}
