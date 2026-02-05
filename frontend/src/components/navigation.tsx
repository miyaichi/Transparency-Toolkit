"use client"

import { useTranslation } from "@/lib/i18n/language-context"
import Link from "next/link"

export function Navigation() {
  const { t } = useTranslation()

  return (
    <nav className="flex items-center space-x-6 text-sm font-medium">
      <Link href="/" className="transition-colors hover:text-foreground/80 text-foreground/60 notranslate">
        {t("common.validator")}
      </Link>
      <Link href="/explorer" className="transition-colors hover:text-foreground/80 text-foreground/60 notranslate">
        {t("common.dataExplorer")}
      </Link>
      <Link href="/analytics" className="transition-colors hover:text-foreground/80 text-foreground/60 notranslate">
        {t("common.analytics")}
      </Link>
      <Link href="/optimizer" className="transition-colors hover:text-foreground/80 text-foreground/60 notranslate">
        {t("common.optimizer")}
      </Link>
      <Link href="/status" className="transition-colors hover:text-foreground/80 text-foreground/60 notranslate">
        {t("common.scanStatus")}
      </Link>
    </nav>
  )
}
