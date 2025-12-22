import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useTranslation } from "@/lib/i18n/language-context"
import { Loader2, Sparkles } from "lucide-react"
import { useState } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

interface AdviserSectionProps {
  analyticsData: any
}

// Separate type for Benchmark Data (Subset of AnalyticsData)
interface PublisherBenchmarkMetrics {
  avg_ads_to_content_ratio: number
  avg_page_weight: number
  avg_ad_refresh: number
  reseller_count: number
  id_absorption_rate: number
  avg_cpu: number
  avg_ads_in_view: number
}

export function AdviserSection({ analyticsData }: AdviserSectionProps) {
  const { t, language } = useTranslation()
  const [report, setReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState("")

  const handleAnalyze = async () => {
    setLoading(true)
    setError(null)
    setReport(null)

    try {
      // 1. Fetch Benchmark Data (Similar Publishers)
      setStatusMessage(t("adviser.status.fetchingBenchmarks"))

      let benchmarkData: PublisherBenchmarkMetrics | null = null
      const similarIds: number[] = analyticsData.similarPublishers || []

      console.log("Similar IDs:", similarIds)

      if (similarIds.length > 0) {
        // Limit to top 3 similar publishers to avoid load/rate limits
        const targetIds = similarIds.slice(0, 3)

        try {
          const fetchPromises = targetIds.map((id) =>
            fetch(`/api/proxy/insite/publisher?publisherId=${id}`)
              .then((res) => {
                if (!res.ok) return null
                return res.json()
              })
              .catch(() => null)
          )

          const results = await Promise.all(fetchPromises)
          // Extract publisher data (API returns single object now)
          const validResults = results.filter((r) => r !== null && r.publisherId).map((r) => r)

          if (validResults.length > 0) {
            // Calculate averages
            const sum = validResults.reduce(
              (acc, curr) => ({
                avg_ads_to_content_ratio: acc.avg_ads_to_content_ratio + (curr.metadata?.avgAdsToContentRatio || 0),
                avg_page_weight: acc.avg_page_weight + (curr.metadata?.avgPageWeight || 0),
                avg_ad_refresh: acc.avg_ad_refresh + (curr.metadata?.avgAdRefresh || 0),
                reseller_count: acc.reseller_count + (curr.metadata?.resellerCount || 0),
                id_absorption_rate: acc.id_absorption_rate + (curr.metadata?.idAbsorptionRate || 0),
                avg_cpu: acc.avg_cpu + (curr.metadata?.avgCpu || 0),
                avg_ads_in_view: acc.avg_ads_in_view + (curr.metadata?.avgAdsInView || 0)
              }),
              {
                avg_ads_to_content_ratio: 0,
                avg_page_weight: 0,
                avg_ad_refresh: 0,
                reseller_count: 0,
                id_absorption_rate: 0,
                avg_cpu: 0,
                avg_ads_in_view: 0
              }
            )

            const count = validResults.length
            benchmarkData = {
              avg_ads_to_content_ratio: sum.avg_ads_to_content_ratio / count,
              avg_page_weight: sum.avg_page_weight / count,
              avg_ad_refresh: sum.avg_ad_refresh / count,
              reseller_count: Math.round(sum.reseller_count / count),
              id_absorption_rate: sum.id_absorption_rate / count,
              avg_cpu: sum.avg_cpu / count,
              avg_ads_in_view: sum.avg_ads_in_view / count
            }
            console.log("Calculated benchmarks from", count, "similar publishers")
          }
        } catch (e) {
          console.error("Failed to fetch similar publishers", e)
          // Fallback handled below
        }
      }

      if (!benchmarkData) {
        // Hardcoded Industry Benchmark (fallback)
        console.log("Using fallback industry benchmarks")
        benchmarkData = {
          avg_ads_to_content_ratio: 0.25, // 25%
          avg_page_weight: 2.5, // 2.5MB
          avg_ad_refresh: 30.0, // 30s
          reseller_count: 50,
          id_absorption_rate: 0.6, // 60%
          avg_cpu: 10.0, // 10s
          avg_ads_in_view: 0.7 // 70%
        }
      }

      // 2. Call Adviser API
      setStatusMessage(t("adviser.status.generatingReport"))

      const payload = {
        target: {
          name: analyticsData.publisherName || analyticsData.ownerDomain,
          domain: analyticsData.ownerDomain,
          avg_ads_to_content_ratio: analyticsData.metadata?.avgAdsToContentRatio || 0,
          avg_page_weight: analyticsData.metadata?.avgPageWeight || 0,
          avg_ad_refresh: analyticsData.metadata?.avgAdRefresh || 0,
          reseller_count: analyticsData.metadata?.resellerCount || 0,
          id_absorption_rate: analyticsData.metadata?.idAbsorptionRate || 0,
          avg_cpu: analyticsData.metadata?.avgCpu || 0,
          avg_ads_in_view: analyticsData.metadata?.avgAdsInView || 0
        },
        benchmark: {
          name: "Similar Publishers Average",
          domain: "benchmark",
          ...benchmarkData
        },
        language: language // Send current language to backend
      }

      // Use local proxy to handle CORS and IPv4/IPv6 issues
      const res = await fetch("/api/proxy/adviser/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        throw new Error(t("adviser.error.failed"))
      }

      const data = await res.json()
      setReport(data.report)
    } catch (err: any) {
      console.error(err)
      setError(err.message || t("adviser.error.generic"))
    } finally {
      setLoading(false)
      setStatusMessage("")
    }
  }

  return (
    <Card className="border-purple-200 bg-purple-50/30 overflow-hidden">
      <CardHeader className="bg-purple-100/50 border-b border-purple-100 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-purple-600 rounded-lg text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-xl text-purple-900">{t("adviser.title")}</CardTitle>
              <p className="text-sm text-purple-700/80">{t("adviser.description")}</p>
            </div>
          </div>
          {!report && (
            <Button
              onClick={handleAnalyze}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 text-white shadow-md transition-all hover:shadow-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("adviser.button.analyzing")}
                </>
              ) : (
                <>{t("adviser.button.analyze")}</>
              )}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {loading && (
          <div className="p-8 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-purple-600 mx-auto" />
            <p className="text-purple-800 font-medium animate-pulse">{statusMessage}</p>
          </div>
        )}

        {error && (
          <div className="p-6 text-red-600 bg-red-50 text-center">
            <p>Error: {error}</p>
            <Button
              variant="outline"
              onClick={handleAnalyze}
              className="mt-4 border-red-200 hover:bg-red-100 text-red-700"
            >
              {t("adviser.button.tryAgain")}
            </Button>
          </div>
        )}

        {report && (
          <div className="bg-white p-8 prose prose-purple max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ node, ...props }) => <h1 className="text-2xl font-bold text-purple-900 mb-4" {...props} />,
                h2: ({ node, ...props }) => <h2 className="text-xl font-bold text-purple-800 mt-6 mb-3" {...props} />,
                h3: ({ node, ...props }) => <h3 className="text-lg font-bold text-purple-700 mt-4 mb-2" {...props} />,
                p: ({ node, ...props }) => <p className="text-gray-700 leading-relaxed mb-4" {...props} />,
                ul: ({ node, ...props }) => <ul className="list-disc pl-5 mb-4 space-y-2" {...props} />,
                li: ({ node, ...props }) => <li className="text-gray-700" {...props} />,
                strong: ({ node, ...props }) => <strong className="font-semibold text-purple-900" {...props} />,
                blockquote: ({ node, ...props }) => (
                  <blockquote className="border-l-4 border-purple-300 pl-4 italic text-gray-600 my-4" {...props} />
                )
              }}
            >
              {report}
            </ReactMarkdown>

            <div className="mt-8 pt-6 border-t flex justify-end">
              <Button variant="outline" onClick={() => setReport(null)}>
                {t("adviser.button.close")}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
