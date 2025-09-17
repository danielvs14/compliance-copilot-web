"use client"
import { useState } from "react"

type Task = {
  title: string
  category?: string | null
  frequency?: string | null
  due_date?: string | null
  source_ref: string
  confidence: number
}

export default function DocumentsPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [tasks, setTasks] = useState<Task[]>([])

  const handleUpload = async () => {
    if (!file) return
    setLoading(true)

    const formData = new FormData()
    formData.append("file", file)

    const res = await fetch("http://localhost:8000/documents/upload", {
      method: "POST",
      body: formData,
    })
    const data = await res.json()
    setTasks(data.requirements)
    setLoading(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Upload Document</h1>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="mb-4"
      />
      <button
        onClick={handleUpload}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        {loading ? "Uploading..." : "Upload"}
      </button>

      {tasks.length > 0 && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">Extracted Tasks</h2>
          <ul className="space-y-2">
            {tasks.map((t, i) => (
              <li key={i} className="border p-2 rounded">
                <p><b>{t.title}</b></p>
                <p className="text-sm text-gray-500">
                  Due: {t.due_date || t.frequency}
                </p>
                <p className="text-xs text-gray-400">Source: {t.source_ref}</p>
                <p className="text-xs">Confidence: {t.confidence}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}