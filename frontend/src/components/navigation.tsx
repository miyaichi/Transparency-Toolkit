"use client"

import { useTranslation } from "@/lib/i18n/language-context"
import Link from "next/link"

export function Navigation() {
  const { t } = useTranslation()

  return (
    <nav className="flex items-center space-x-6 text-sm font-medium">
      <Link href="/" className="transition-colors hover:text-foreground/80 text-foreground/60">
        Validator
      </Link>
      <Link href="/explorer" className="transition-colors hover:text-foreground/80 text-foreground/60">
        Data Explorer
      </Link>
      <Link href="/status" className="transition-colors hover:text-foreground/80 text-foreground/60">
        Scan Status
      </Link>
      <Link href="/analytics" className="transition-colors hover:text-foreground/80 text-foreground/60">
        Insite Analytics
      </Link>
    </nav>
  )
}
