"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/lib/i18n/language-context"
import { Calendar, Globe, Search } from "lucide-react"
import { useState } from "react"
import useSWR from "swr"

// Type definition for Analytics Data
type AnalyticsData = {
  domain: string
  rank: number | null
  adstxt_lines: number | null
  app_adstxt_lines: number | null
  direct_ratio: number | null
  reseller_ratio: number | null
  updated_at?: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) {
      throw new Error("Domain not found")
    }
    throw new Error("Failed to fetch data")
  }
  return res.json()
}

export default function AnalyticsPage() {
  const { t } = useTranslation()
  const [searchInput, setSearchInput] = useState("")
  const [targetDomain, setTargetDomain] = useState<string | null>(null)

  // Basic domain validation regex
  const isValidDomain = (domain: string) => /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/.test(domain)

  const isSearchDisabled = !searchInput || !isValidDomain(searchInput.trim().toLowerCase())

  const handleSearch = () => {
    if (!isSearchDisabled) {
      setTargetDomain(searchInput.trim().toLowerCase())
    }
  }

  const { data, error, isLoading } = useSWR<AnalyticsData>(
    targetDomain ? `/api/proxy/analytics?domain=${targetDomain}` : null,
    fetcher
  )

  return (
    <div className="container mx-auto py-10 space-y-8 max-w-6xl">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">Insite Analytics</h1>
        <p className="text-muted-foreground text-lg">{t("common.analyticsDescription")}</p>
      </div>

      {/* Search Bar */}
      <div className="flex w-full max-w-xl items-center space-x-2 p-2 bg-white rounded-xl shadow-lg border transition-all focus-within:ring-2 focus-within:ring-purple-500/20">
        <div className="pl-3 text-muted-foreground">
          <Globe className="h-5 w-5" />
        </div>
        <Input
          placeholder="Enter publisher domain (e.g. nytimes.com)"
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
          <Search className="mr-2 h-5 w-5" /> Analyze
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
                  ? "Domain not found in OpenSincera database."
                  : "An error occurred while fetching data."}
              </p>
              <p className="text-sm mt-2 opacity-80">Please check the domain name and try again.</p>
            </div>
          ) : data ? (
            <div className="space-y-8">
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Global Rank</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold">{data.rank ? `#${data.rank.toLocaleString()}` : "N/A"}</div>
                    <p className="text-xs text-muted-foreground mt-1">OpenSincera Rank</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Lines</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold flex items-baseline gap-2">
                      {data.adstxt_lines?.toLocaleString() || 0}
                      <span className="text-sm font-normal text-muted-foreground">ads.txt</span>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      + {data.app_adstxt_lines?.toLocaleString() || 0} app-ads.txt
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Relationship Ratio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-blue-700 font-medium">DIRECT</span>
                        <span>{Math.round((data.direct_ratio || 0) * 100)}%</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${(data.direct_ratio || 0) * 100}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 text-slate-600">RESELLER</span>
                        <span>{Math.round((data.reseller_ratio || 0) * 100)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="text-right text-xs text-muted-foreground">
                <span className="flex items-center justify-end gap-1">
                  <Calendar className="h-3 w-3" />
                  Data updated: {data.updated_at ? new Date(data.updated_at).toLocaleDateString() : "N/A"}
                </span>
                <span className="mt-1 block">Powered by OpenSincera</span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
