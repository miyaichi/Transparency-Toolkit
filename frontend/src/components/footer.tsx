"use client"

import { useTranslation } from "@/lib/i18n/language-context"
import Link from "next/link"

export function Footer() {
  const { t } = useTranslation()

  return (
    <footer className="border-t py-6 md:py-0">
      <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row px-4 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Ads.txt Manager V2</p>
        <div className="flex gap-4">
          <Link href="/warnings" className="hover:underline hover:text-foreground transition-colors">
            {t("footer.validationCodes")}
          </Link>
        </div>
      </div>
    </footer>
  )
}
