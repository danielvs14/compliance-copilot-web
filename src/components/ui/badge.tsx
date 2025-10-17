"use client"

import clsx from "clsx"
import { ReactNode } from "react"

export type BadgeVariant = "default" | "success" | "warning" | "danger" | "muted"

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-slate-100 text-slate-700",
  success: "bg-[color:var(--badge-success-bg)] text-green-700",
  warning: "bg-[color:var(--badge-warning-bg)] text-amber-700",
  danger: "bg-[color:var(--badge-danger-bg)] text-red-700",
  muted: "bg-slate-200 text-slate-700",
}

type BadgeProps = {
  children: ReactNode
  variant?: BadgeVariant
}

export function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", variantClasses[variant])}>
      {children}
    </span>
  )
}
