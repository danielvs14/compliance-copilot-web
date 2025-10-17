"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ReactNode } from "react"
import { useTranslation } from "react-i18next"

import clsx from "clsx"

import { ThemeToggle } from "@/components/theme-toggle"

const navItems = [
  { href: "/documents", key: "nav.documents" },
  { href: "/requirements", key: "nav.requirements" },
  { href: "/permits", key: "nav.permits" },
  { href: "/training", key: "nav.training" },
]

type AppShellProps = {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}

export function AppShell({ title, description, actions, children }: AppShellProps) {
  const pathname = usePathname()
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen bg-[color:var(--background)]">
      <aside className="hidden w-60 flex-shrink-0 border-r border-[color:var(--border)] bg-white/90 backdrop-blur lg:block">
        <div className="px-6 py-6">
          <h1 className="text-lg font-semibold text-slate-900">{t("app.name")}</h1>
        </div>
        <nav className="mt-2 space-y-1 px-4">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center rounded-lg px-3 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-[color:var(--surface-muted)] text-[color:var(--foreground)] shadow-sm"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                )}
              >
                {t(item.key)}
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1">
        <div className="border-b border-[color:var(--border)] bg-white/70 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
              {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {actions}
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
      </main>
    </div>
  )
}
