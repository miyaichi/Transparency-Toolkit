"use client"

import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "@/lib/i18n/language-context"
import { ExternalLink } from "lucide-react"

interface ResourceCardProps {
  title: string
  description: string
  href: string
  linkLabel: string
}

function ResourceCard({ title, description, href, linkLabel }: ResourceCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-sm text-muted-foreground mb-4">{description}</p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {linkLabel}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </CardContent>
    </Card>
  )
}

export default function StandardsToolsPage() {
  const { t } = useTranslation()

  return (
    <div className="container mx-auto py-10 max-w-4xl space-y-10">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t("standardsToolsPage.title")}</h1>
        <p className="mt-2 text-muted-foreground">{t("standardsToolsPage.description")}</p>
      </div>

      {/* IAB Standards */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("standardsToolsPage.iabStandards.title")}</h2>
        <ResourceCard
          title={t("standardsToolsPage.iabStandards.title")}
          description={t("standardsToolsPage.iabStandards.description")}
          href="https://iab-docs.apti.jp/"
          linkLabel={t("standardsToolsPage.iabStandards.linkLabel")}
        />
      </section>

      {/* Open Tools for Transparency */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("standardsToolsPage.openTools.title")}</h2>
        <ResourceCard
          title={t("standardsToolsPage.openTools.transparencyToolkit.title")}
          description={t("standardsToolsPage.openTools.transparencyToolkit.description")}
          href="https://ttkit.apti.jp/"
          linkLabel={t("standardsToolsPage.openTools.transparencyToolkit.linkLabel")}
        />
      </section>

      {/* Ad Transparency Monthly Reports */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold">{t("standardsToolsPage.reports.title")}</h2>
        <ResourceCard
          title={t("standardsToolsPage.reports.title")}
          description={t("standardsToolsPage.reports.description")}
          href="https://reports.apti.jp/"
          linkLabel={t("standardsToolsPage.reports.linkLabel")}
        />
      </section>
    </div>
  )
}
