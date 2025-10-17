import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"

import { LocaleProvider } from "@/components/locale-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { AppToaster } from "@/components/ui/toaster"

import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "Compliance Copilot",
  description: "Compliance cockpit for trade contractors",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" data-theme="light">
      <body className={`${geistSans.variable} ${geistMono.variable} bg-[color:var(--background)] text-[color:var(--foreground)] antialiased`}>
        <ThemeProvider>
          <LocaleProvider>
            {children}
            <AppToaster />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
