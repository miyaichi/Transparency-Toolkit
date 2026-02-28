"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/lib/i18n/language-context"
import { CheckCircle, Download, HelpCircle, Loader2, XCircle } from "lucide-react"
import { useEffect, useState } from "react"

import { useAdsTxtData } from "@/hooks/use-ads-txt-data"
import { ProgressModal } from "./progress-modal"

type Props = {
  domain: string
  type: "ads.txt" | "app-ads.txt"
}

export function ValidatorResult({ domain, type }: Props) {
  const { t, language } = useTranslation()

  const { data, error, isLoading, filter, setFilter, filteredRecords } = useAdsTxtData(domain, type, language)

  // Progress modal state
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [progressId, setProgressId] = useState<string | null>(null)

  // Show progress modal when validation returns processing status
  useEffect(() => {
    if (data?.is_processing && data?.progress_id) {
      setProgressId(data.progress_id)
      setShowProgressModal(true)
    } else if (!data?.is_processing) {
      // Auto-close modal when processing is complete
      setShowProgressModal(false)
    }
  }, [data?.is_processing, data?.progress_id])

  // Download functionality
  const handleDownload = () => {
    if (!data?.records) return
    const headers = [
      t("common.line"),
      t("common.advertisingSystem"),
      t("common.publisherAccountId"),
      t("common.relationship"),
      t("common.certId"),
      t("common.status"),
      t("common.message")
    ]
    const csvContent = [
      headers.join(","),
      ...data.records.map((r) => {
        // Handle variable records where variable_type/value replaces domain/account_id
        const col1 = r.variable_type || r.domain || ""
        const col2 = r.value || r.account_id || ""

        return [
          r.line_number,
          col1,
          col2,
          r.relationship || "",
          r.certification_authority_id || "", // Fixed: use certification_authority_id instead of account_type
          r.is_valid ? "OK" : "ERROR",
          r.warning_message || r.validation_key || ""
        ]
          .map((f) => `"${String(f).replace(/"/g, '""')}"`)
          .join(",")
      })
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `${domain}_${type}_report.csv`
    link.click()
  }

  // Helper to convert camelCase to kebab-case for anchor links
  const toKebabCase = (str: string) => {
    return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
  }

  if (!domain) {
    return (
      <div className="text-muted-foreground text-center py-20 bg-muted/20 rounded-lg">{t("common.enterDomain")}</div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-500 bg-red-50 rounded-lg border border-red-200">
        <h3 className="font-semibold mb-2">{t("common.failedToLoad")}</h3>
        <p>{error.message}</p>
        <p className="text-sm mt-2 text-muted-foreground">Backend URL: /api/proxy/validator</p>
      </div>
    )
  }

  if (!data) return null

  // Check if we have missing sellers.json warnings
  const hasMissingSellers = data.records.some((r) => r.validation_key === "noSellersJson")

  // Calculate stats safely
  const directCount = data.stats.direct_count || 0
  const resellerCount = data.stats.reseller_count || 0
  const totalExchangeEntries = directCount + resellerCount

  return (
    <div className="space-y-6">
      {/* Progress Modal */}
      {progressId && (
        <ProgressModal
          progressId={progressId}
          isOpen={showProgressModal}
          onClose={() => {
            setShowProgressModal(false)
            setProgressId(null)
          }}
          onComplete={() => {
            // Auto-refresh data after progress completes
            setProgressId(null)
          }}
        />
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("common.totalRecords")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold">{data.stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-green-600">{t("common.validRecords")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-green-600">{data.stats.valid}</CardContent>
        </Card>
        {data.stats.direct_count !== undefined && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm text-blue-600">{t("common.direct")}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-blue-600">
                {totalExchangeEntries > 0 ? Math.round((directCount / totalExchangeEntries) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {directCount} {t("common.records")}
              </p>
            </CardContent>
          </Card>
        )}
        {data.stats.reseller_count !== undefined && (
          <Card>
            <CardHeader className="p-4 pb-2">
              <CardTitle className="text-sm text-purple-600">{t("common.reseller")}</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="text-2xl font-bold text-purple-600">
                {totalExchangeEntries > 0 ? Math.round((resellerCount / totalExchangeEntries) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {resellerCount} {t("common.records")}
              </p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-yellow-600">{t("common.warnings")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-yellow-600">{data.stats.warnings}</CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-red-600">{t("common.invalidRecords")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-red-600">{data.stats.invalid}</CardContent>
        </Card>
      </div>

      {/* Filter Bar and Download Button */}
      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="text-sm font-medium text-muted-foreground">{t("common.search")}</label>
          <Input
            placeholder={t("common.searchPlaceholder") || "Search..."}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button onClick={handleDownload} className="gap-2">
          <Download className="h-4 w-4" />
          {t("common.downloadCSV") || "Download CSV"}
        </Button>
      </div>

      {/* Records Table */}
      {filteredRecords && filteredRecords.length > 0 ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-semibold">{t("common.line")}</th>
                  <th className="text-left p-3 font-semibold">{t("common.advertisingSystem")}</th>
                  <th className="text-left p-3 font-semibold">{t("common.publisherAccountId")}</th>
                  <th className="text-left p-3 font-semibold">{t("common.relationship")}</th>
                  <th className="text-left p-3 font-semibold">{t("common.certId")}</th>
                  <th className="text-left p-3 font-semibold">{t("common.status")}</th>
                  <th className="text-left p-3 font-semibold">{t("common.message")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record, idx) => (
                  <tr key={idx} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono text-xs">{record.line_number}</td>
                    <td className="p-3">
                      {record.variable_type ? (
                        <Badge variant="outline">{record.variable_type}</Badge>
                      ) : (
                        <span>{record.domain}</span>
                      )}
                    </td>
                    <td className="p-3">
                      {record.variable_type ? (
                        <code className="text-xs bg-muted px-2 py-1 rounded">{record.value}</code>
                      ) : (
                        <code className="text-xs bg-muted px-2 py-1 rounded">{record.account_id}</code>
                      )}
                    </td>
                    <td className="p-3">{record.relationship}</td>
                    <td className="p-3">{record.certification_authority_id || "-"}</td>
                    <td className="p-3">
                      {record.is_valid ? (
                        <div className="flex items-center gap-1 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          <span>OK</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600">
                          <XCircle className="h-4 w-4" />
                          <span>ERROR</span>
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {record.warning_message && (
                        <div className="flex items-start gap-1">
                          <HelpCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-yellow-600" />
                          {record.validation_key ? (
                            <a
                              href={`/warnings#${toKebabCase(record.validation_key)}`}
                              className="hover:underline text-yellow-700"
                            >
                              {record.warning_message}
                            </a>
                          ) : (
                            <span>{record.warning_message}</span>
                          )}
                        </div>
                      )}
                      {record.validation_key && !record.warning_message && (
                        <code className="text-xs bg-yellow-100 text-yellow-900 px-2 py-1 rounded">
                          {record.validation_key}
                        </code>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <div className="text-center py-8 text-muted-foreground">{t("common.noRecords")}</div>
      )}
    </div>
  )
}
