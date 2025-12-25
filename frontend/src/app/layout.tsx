import { Footer } from "@/components/footer"
import { LanguageSwitcher } from "@/components/language-switcher"
import { Navigation } from "@/components/navigation"
import { SentryInit } from "@/components/sentry-init"
import { LanguageProvider } from "@/lib/i18n/language-context"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"]
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"]
})

export const metadata: Metadata = {
  title: "Transparency Toolkit",
  description: "Transparency Toolkit: Manage, Validate, and Optimize your ads.txt and sellers.json files."
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased flex min-h-screen flex-col`}>
        <SentryInit />
        <LanguageProvider>
          <header className="border-b">
            <div className="container mx-auto flex h-16 items-center px-4">
              <div className="mr-8 font-bold text-lg">Transparency Toolkit</div>
              <Navigation />
              <div className="ml-auto">
                <LanguageSwitcher />
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <Footer />
        </LanguageProvider>
      </body>
    </html>
  )
}
