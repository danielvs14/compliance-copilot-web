"use client"

import { forwardRef, type SVGProps } from "react"

export const EyeIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(function EyeIcon(props, ref) {
  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M1.5 12s3.5-6.5 10.5-6.5 10.5 6.5 10.5 6.5-3.5 6.5-10.5 6.5S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
})

export const BellIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(function BellIcon(props, ref) {
  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M10.5 21h3" />
      <path d="M18 16v-4a6 6 0 0 0-12 0v4l-1.5 2h15Z" />
    </svg>
  )
})

export const CheckIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(function CheckIcon(props, ref) {
  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  )
})

export const TrashIcon = forwardRef<SVGSVGElement, SVGProps<SVGSVGElement>>(function TrashIcon(props, ref) {
  return (
    <svg
      ref={ref}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M3 6h18" />
      <path d="M8 6v-.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V6" />
      <path d="M8 10v7.5A1.5 1.5 0 0 0 9.5 19h5A1.5 1.5 0 0 0 16 17.5V10" />
      <path d="M10 10v7" />
      <path d="M14 10v7" />
    </svg>
  )
})
