"use client"

import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n/language-context"

export function LanguageSwitcher() {
  const { language, setLanguage } = useTranslation()

  return (
    <div className="flex items-center space-x-2">
      <Button
        variant={language === "en" ? "default" : "ghost"}
        size="sm"
        onClick={() => setLanguage("en")}
        className="h-8 w-8 p-0 font-bold"
      >
        EN
      </Button>
      <Button
        variant={language === "ja" ? "default" : "ghost"}
        size="sm"
        onClick={() => setLanguage("ja")}
        className="h-8 w-8 p-0 font-bold"
      >
        JP
      </Button>
    </div>
  )
}
