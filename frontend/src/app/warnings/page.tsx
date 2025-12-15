"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useTranslation } from "@/lib/i18n/language-context"
import { translations } from "@/lib/i18n/translations"
import { AlertCircle, FileWarning } from "lucide-react"

export default function WarningsPage() {
  const { language, t } = useTranslation()
  const warningKeys = Object.keys(translations.warnings) as (keyof typeof translations.warnings)[]

  return (
    <div className="container mx-auto py-10 max-w-4xl space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{t("warningsPage.title")}</h1>
        <p className="text-muted-foreground text-lg">{t("warningsPage.description")}</p>
      </div>

      <div className="grid gap-6">
        {warningKeys.map((key) => {
          const warning = translations.warnings[key]
          const title = warning.title[language] || warning.title["en"]
          const description = warning.description[language] || warning.description["en"]

          // Recommendation might not exist on all items in type definition yet, handle safely if so
          // But based on our file it does not strictly exist on type unless we define it.
          // We can check if it exists in the object.
          const recommendationObj = (warning as any).recommendation
          const recommendation = recommendationObj ? recommendationObj[language] || recommendationObj["en"] : null

          return (
            <Card key={key} id={key} className="overflow-hidden">
              <CardHeader className="bg-muted/30 border-b pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      {title}
                    </CardTitle>
                    <div className="font-mono text-xs text-muted-foreground bg-muted px-2 py-1 rounded w-fit">
                      {key}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                  <p>{description}</p>
                </div>

                {recommendation && (
                  <>
                    <Separator />
                    <div className="bg-blue-50 p-4 rounded-md">
                      <h4 className="text-sm font-medium text-blue-900 mb-1 flex items-center gap-2">
                        <FileWarning className="h-4 w-4" />
                        {t("warningsPage.recommendation")}
                      </h4>
                      <p className="text-sm text-blue-800">{recommendation}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
