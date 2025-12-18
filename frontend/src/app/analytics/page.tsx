"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { triggerBackgroundScan } from "@/lib/api-utils"
import { extractRootDomain } from "@/lib/domain-utils"
import { useTranslation } from "@/lib/i18n/language-context"
import { Calendar, Globe, Search } from "lucide-react"
import { useState } from "react"
import useSWR from "swr"

// Type definition for Analytics Data
type AnalyticsData = {
  domain: string
  name?: string
  status?: string
  pub_description?: string
  primary_supply_type?: string
  categories?: string[]
  rank: number | null
  adstxt_lines: number | null
  app_adstxt_lines: number | null
  direct_ratio: number | null
  reseller_ratio: number | null
  avg_ads_in_view?: number | null
  avg_page_weight?: number | null
  avg_cpu?: number | null
  total_supply_paths?: number | null
  avg_ads_to_content_ratio?: number | null
  avg_ad_refresh?: number | null
  total_unique_gpids?: number | null
  reseller_count?: number | null
  id_absorption_rate?: number | null
  updated_at?: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    try {
      const errorData = await res.json()
      // Proxy formats error as { error: string }
      // Backend error might be nested as stringified JSON inside Proxy error
      let msg = errorData.error || "Failed to fetch data"

      // Attempt to parse stringified JSON error message from backend
      try {
        const inner = JSON.parse(msg)
        if (inner.error) msg = inner.error
      } catch {}

      if (res.status === 404) {
        throw new Error("Domain not found")
      }
      throw new Error(msg)
    } catch (e) {
      if (e instanceof Error && e.message !== "Failed to fetch data") {
        throw e
      }
    }

    if (res.status === 404) {
      throw new Error("Domain not found")
    }
    throw new Error(`Failed to fetch data (${res.status})`)
  }
  return res.json()
}

export default function AnalyticsPage() {
  const { t } = useTranslation()
  const [searchInput, setSearchInput] = useState("")
  const [targetDomain, setTargetDomain] = useState<string | null>(null)

  // Basic domain validation regex
  const isValidDomain = (domain: string) => /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/.test(domain)

  const isSearchDisabled = !searchInput || !isValidDomain(extractRootDomain(searchInput))

  const handleSearch = () => {
    const domain = extractRootDomain(searchInput)
    if (domain && isValidDomain(domain)) {
      setTargetDomain(domain)

      // Trigger background scan
      triggerBackgroundScan(domain, "ads.txt")
    }
  }

  const { data, error, isLoading } = useSWR<AnalyticsData>(
    targetDomain ? `/api/proxy/analytics?domain=${targetDomain}` : null,
    fetcher
  )

  return (
    <div className="container mx-auto py-10 space-y-8 max-w-6xl">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("common.analytics")}</h1>
        <p className="text-muted-foreground text-lg">{t("common.analyticsDescription")}</p>
      </div>

      {/* Search Bar */}
      <div className="mx-auto flex w-full max-w-xl items-center space-x-2 p-2 bg-white rounded-xl shadow-lg border transition-all focus-within:ring-2 focus-within:ring-purple-500/20">
        <div className="pl-3 text-muted-foreground">
          <Globe className="h-5 w-5" />
        </div>
        <Input
          placeholder={t("analyticsPage.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isSearchDisabled && handleSearch()}
          className="border-0 shadow-none focus-visible:ring-0 text-lg h-12"
        />
        <Button
          size="lg"
          onClick={handleSearch}
          disabled={isSearchDisabled}
          className="h-12 px-8 rounded-lg shadow-sm bg-purple-600 hover:bg-purple-700"
        >
          <Search className="mr-2 h-5 w-5" /> {t("analyticsPage.analyze")}
        </Button>
      </div>

      {/* Results */}
      {targetDomain && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {isLoading ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-40 rounded-xl bg-muted/20 animate-pulse border" />
              ))}
            </div>
          ) : error ? (
            <div className="p-8 text-center border rounded-xl bg-red-50 text-red-900">
              <p className="text-lg font-medium">
                {error.message === "Domain not found"
                  ? t("analyticsPage.error.domainNotFound")
                  : t("analyticsPage.error.generic")}
              </p>
              {error.message !== "Domain not found" && (
                <p className="text-sm mt-3 font-mono bg-red-100/50 p-2 rounded inline-block text-red-800">
                  Error: {error.message}
                </p>
              )}
              <p className="text-sm mt-2 opacity-80">{t("analyticsPage.error.checkDomain")}</p>
            </div>
          ) : data ? (
            <div className="space-y-8">
              {/* Publisher Info Header */}
              <div className="bg-white p-6 rounded-xl border shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold flex items-center gap-3">
                      {data.name || data.domain}
                      {data.status && (
                        <span
                          className={`text-xs px-2 py-1 rounded-full border ${data.status === "available" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-100 text-gray-600"}`}
                        >
                          {data.status}
                        </span>
                      )}
                    </h2>
                    <p className="text-muted-foreground mt-2 max-w-3xl">{data.pub_description}</p>

                    {data.categories && data.categories.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-4">
                        {data.categories.map((cat, i) => (
                          <span
                            key={i}
                            className="text-xs font-medium px-2.5 py-0.5 rounded-md bg-purple-50 text-purple-700 border border-purple-100"
                          >
                            {cat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{t("analyticsPage.supplyType")}</p>
                    <p className="font-semibold capitalize">{data.primary_supply_type || t("analyticsPage.unknown")}</p>
                  </div>
                </div>
              </div>

              {/* Key Metrics */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-blue-50/50 border-blue-100 overflow-hidden relative">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-100 rounded-full -mr-12 -mt-12 opacity-50 blur-xl" />
                  <CardHeader className="pb-2 relative">
                    <CardTitle className="text-sm font-medium text-blue-900">
                      {t("analyticsPage.metrics.directness")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="text-3xl font-bold text-blue-700">
                      {data.id_absorption_rate ? `${Math.round(data.id_absorption_rate * 100)}%` : "N/A"}
                    </div>
                    <p className="text-xs text-blue-600/80 mt-1">{t("analyticsPage.metrics.idAbsorptionRate")}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("analyticsPage.metrics.adsToContent")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {data.avg_ads_to_content_ratio ? `${Math.round(data.avg_ads_to_content_ratio * 100)}%` : "N/A"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t("analyticsPage.metrics.a2crRatio")}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("analyticsPage.metrics.adRefresh")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {data.avg_ad_refresh ? `${Math.round(data.avg_ad_refresh)}s` : "N/A"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t("analyticsPage.metrics.avgTime")}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("analyticsPage.metrics.inventory")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {data.total_unique_gpids ? data.total_unique_gpids.toLocaleString() : "N/A"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t("analyticsPage.metrics.uniqueGpids")}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Technical Metrics */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("analyticsPage.metrics.adQuality")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {data.avg_ads_in_view ? `${Math.round(data.avg_ads_in_view * 100)}%` : "N/A"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t("analyticsPage.metrics.avgAdsInView")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("analyticsPage.metrics.performance")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">
                      {data.avg_page_weight ? `${Math.round(data.avg_page_weight)} MB` : "N/A"}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{t("analyticsPage.metrics.avgPageWeight")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("analyticsPage.metrics.complexity")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{data.avg_cpu ? `${Math.round(data.avg_cpu)}%` : "N/A"}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t("analyticsPage.metrics.avgCpuUsage")}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {t("analyticsPage.metrics.supplyChain")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-1">
                      <div className="text-3xl font-bold">{data.total_supply_paths || "N/A"}</div>
                      <div className="text-xs text-muted-foreground flex justify-between">
                        <span>{t("analyticsPage.metrics.paths")}</span>
                        <span>
                          {data.reseller_count
                            ? `${data.reseller_count} ${t("analyticsPage.metrics.resellers")}`
                            : `0 ${t("analyticsPage.metrics.resellers")}`}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="text-right text-xs text-muted-foreground">
                <span className="flex items-center justify-end gap-1">
                  <Calendar className="h-3 w-3" />
                  {t("analyticsPage.updatedAt")}{" "}
                  {data.updated_at ? new Date(data.updated_at).toLocaleDateString() : "N/A"}
                </span>
                <span className="mt-1 block">{t("analyticsPage.poweredBy")}</span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
