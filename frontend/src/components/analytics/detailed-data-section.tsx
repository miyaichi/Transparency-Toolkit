import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/lib/i18n/language-context"
import { ExternalLink, HelpCircle } from "lucide-react"

interface DetailedDataSectionProps {
  data: any // We'll use the PublisherMetadata type effectively
}

export function DetailedDataSection({ data }: DetailedDataSectionProps) {
  const { t, language } = useTranslation()

  // Helper to resolve nested values
  const getValue = (obj: any, path: string) => {
    return path.split(".").reduce((o, i) => (o ? o[i] : null), obj)
  }

  // Helper to format values
  const formatValue = (value: any) => {
    if (value === null || value === undefined) return <span className="text-muted-foreground italic">N/A</span>
    if (typeof value === "boolean") return value ? "True" : "False"
    if (Array.isArray(value)) return value.join(", ")
    // Check if it looks like a date
    if (typeof value === "string" && !isNaN(Date.parse(value)) && value.includes("-") && value.includes("T")) {
      return new Date(value).toLocaleString()
    }
    return String(value)
  }

  // Field configuration: key path, label i18n key (or raw), anchor id
  const fields = [
    { key: "publisherId", label: t("analyticsPage.fields.publisherId"), anchor: "publisher-id" },
    { key: "publisherName", label: t("analyticsPage.fields.publisherName"), anchor: "publisher-name" },
    { key: "ownerDomain", label: t("analyticsPage.fields.ownerDomain"), anchor: "owner-domain" },
    { key: "domain", label: t("analyticsPage.fields.domain"), anchor: "domain" },
    { key: "status", label: t("analyticsPage.fields.status"), anchor: "status" },
    { key: "verificationStatus", label: t("analyticsPage.fields.verificationStatus"), anchor: "verification-status" },
    { key: "lastUpdated", label: t("analyticsPage.fields.lastUpdated"), anchor: "last-updated" },
    { key: "contactEmail", label: t("analyticsPage.fields.contactEmail"), anchor: "contact-email" },
    { key: "categories", label: t("analyticsPage.fields.categories"), anchor: "categories" },
    { key: "parentEntityId", label: t("analyticsPage.fields.parentEntityId"), anchor: "parent-entity-id" },
    { key: "similarPublishers", label: t("analyticsPage.fields.similarPublishers"), anchor: "similar-publishers" },
    // Metadata fields
    { key: "metadata.description", label: t("analyticsPage.fields.description"), anchor: "description" },
    { key: "metadata.primarySupplyType", label: t("analyticsPage.fields.primarySupplyType"), anchor: "primary-supply-type" },
    { key: "metadata.avgAdsToContentRatio", label: t("analyticsPage.fields.avgAdsToContentRatio"), anchor: "avg-ads-to-content-ratio" },
    { key: "metadata.avgAdsInView", label: t("analyticsPage.fields.avgAdsInView"), anchor: "avg-ads-in-view" },
    { key: "metadata.avgAdRefresh", label: t("analyticsPage.fields.avgAdRefresh"), anchor: "avg-ad-refresh" },
    { key: "metadata.totalUniqueGpids", label: t("analyticsPage.fields.totalUniqueGpids"), anchor: "total-unique-gpids" },
    { key: "metadata.idAbsorptionRate", label: t("analyticsPage.fields.idAbsorptionRate"), anchor: "id-absorption-rate" },
    { key: "metadata.avgPageWeight", label: t("analyticsPage.fields.avgPageWeight"), anchor: "avg-page-weight" },
    { key: "metadata.avgCpu", label: t("analyticsPage.fields.avgCpu"), anchor: "avg-cpu" },
    { key: "metadata.totalSupplyPaths", label: t("analyticsPage.fields.totalSupplyPaths"), anchor: "total-supply-paths" },
    { key: "metadata.resellerCount", label: t("analyticsPage.fields.resellerCount"), anchor: "reseller-count" },
    { key: "metadata.slug", label: t("analyticsPage.fields.slug"), anchor: "slug" }
  ]

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-gray-50 border-b pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl text-gray-800 flex items-center gap-2">Detailed Data</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <a href="/metadata" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4" /> Definition Guide
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y text-sm">
          {fields.map((field, index) => {
            const value = getValue(data, field.key)
            // Skip if value is fully missing for cleaner UI? Or show N/A?
            // User asked for "raw data", usually implies showing everything.

            return (
              <div key={index} className="grid grid-cols-1 md:grid-cols-3 hover:bg-gray-50/50 transition-colors">
                <div className="p-4 bg-gray-50/30 font-medium text-gray-600 flex items-center justify-between md:border-r">
                  <span>{field.key}</span> {/* Showing the key itself as it is "raw data" */}
                  <a
                    href={`/metadata#${field.anchor}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`View definition for ${field.key}`}
                    className="text-gray-400 hover:text-purple-600 transition-colors"
                  >
                    <HelpCircle className="h-4 w-4" />
                  </a>
                </div>
                <div className="p-4 md:col-span-2 break-all text-gray-800 font-mono text-xs md:text-sm flex items-center">
                  {formatValue(value)}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
