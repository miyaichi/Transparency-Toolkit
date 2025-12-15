"use client"

import { useTranslation } from "@/lib/i18n/language-context"
import Link from "next/link"

export function Navigation() {
  const { t } = useTranslation()

  return (
    <nav className="flex items-center space-x-6 text-sm font-medium">
      <Link href="/" className="transition-colors hover:text-foreground/80 text-foreground/60">
        {t("common.validator.en") === "Validator" ? t("common.validator") : "Validator"}
      </Link>
      <Link href="/explorer" className="transition-colors hover:text-foreground/80 text-foreground/60">
        {t("common.dataExplorer")}
      </Link>
      <Link href="/status" className="transition-colors hover:text-foreground/80 text-foreground/60">
        {t("common.scanStatus")}
      </Link>
    </nav>
  )
}
