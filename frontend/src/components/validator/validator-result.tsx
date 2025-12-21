"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { useTranslation } from "@/lib/i18n/language-context"
import { CheckCircle, Download, HelpCircle, Loader2, XCircle } from "lucide-react"
import Link from "next/link"

import { useAdsTxtData } from "@/hooks/use-ads-txt-data"

type Props = {
  domain: string
  type: "ads.txt" | "app-ads.txt"
}

export function ValidatorResult({ domain, type }: Props) {
  const { t, language } = useTranslation() // added language

  const { data, error, isLoading, filter, setFilter, filteredRecords } = useAdsTxtData(domain, type)


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
          r.account_type || "", // Assuming account_type maps to Cert ID in parser
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

  return (
    <div className="space-y-6">
      {hasMissingSellers && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 flex items-start space-x-3 text-blue-900 animate-in fade-in slide-in-from-top-2">
          <Loader2 className="h-5 w-5 text-blue-600 animate-spin mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium">{t("common.note") || "Note"}</p>
            <p>{t("common.backgroundFetchHint")}</p>
          </div>
        </div>
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
                {data.stats.direct_count + (data.stats.reseller_count || 0) > 0
                  ? Math.round(
                    (data.stats.direct_count / (data.stats.direct_count + (data.stats.reseller_count || 0))) * 100
                  )
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">
                {data.stats.direct_count} {t("common.records")}
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
                {data.stats.direct_count !== undefined && data.stats.direct_count + data.stats.reseller_count > 0
                  ? Math.round(
                    (data.stats.reseller_count / (data.stats.direct_count + data.stats.reseller_count)) * 100
                  )
                  : 0}
                %
              </div>
              <p className="text-xs text-muted-foreground">
                {data.stats.reseller_count} {t("common.records")}
              </p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-red-600">{t("common.invalidRecords")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-red-600">{data.stats.invalid}</CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-yellow-600">{t("common.warnings")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-yellow-600">{data.stats.warnings}</CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Input
            placeholder={t("common.filterPlaceholder")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
          {/* Search icon could go here */}
        </div>
        <Button variant="outline" onClick={handleDownload} className="shrink-0">
          <Download className="mr-2 h-4 w-4" /> {t("common.downloadCsv")}
        </Button>
      </div>

      {/* Table - Rebuilt with plain HTML for better scroll/background control */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left min-w-max border-collapse">
            <thead className="bg-muted/50 text-muted-foreground font-medium">
              <tr>
                <th className="p-3 border-b w-16 font-medium">{t("common.line")}</th>
                <th className="p-3 border-b font-medium">{t("common.advertisingSystem")}</th>
                <th className="p-3 border-b font-medium">{t("common.publisherAccountId")}</th>
                <th className="p-3 border-b font-medium">{t("common.relationship")}</th>
                <th className="p-3 border-b font-medium">{t("common.certId")}</th>
                <th className="p-3 border-b font-medium">{t("common.status")}</th>
                <th className="p-3 border-b font-medium">{t("common.message")}</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords?.length ? (
                filteredRecords.map((record, i) => {
                  // Message Translation Logic
                  const key = record.validation_key
                  const params = {
                    domain: record.domain || "",
                    account_id: record.account_id || "",
                    seller_domain: record.domain || "", // Assuming seller domain is same field
                    publisher_domain: domain,
                    seller_type: "INTERMEDIARY" // Don't have this in record currently
                  }

                  // Try to translate validation key
                  let translatedMessage = ""
                  if (key) {
                    const path = `warnings.${key}.description`
                    const val = t(path, params)
                    if (val !== path) {
                      translatedMessage = val
                    }
                  }

                  const displayMessage = translatedMessage || record.warning_message || record.validation_key || ""

                  const rowClass = !record.is_valid
                    ? "bg-red-50 hover:bg-red-100/80"
                    : record.has_warning
                      ? "bg-yellow-50 hover:bg-yellow-100/80"
                      : "hover:bg-muted/50"

                  const isVariable = !!record.variable_type

                  return (
                    <tr key={i} className={`border-b border-gray-100 last:border-0 transition-colors ${rowClass}`}>
                      <td className="p-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {record.line_number}
                      </td>
                      <td className="p-3 font-medium whitespace-nowrap">
                        {isVariable ? (
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 font-normal">
                            {record.variable_type}
                          </Badge>
                        ) : (
                          record.domain || <span className="text-muted-foreground italic">-</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs whitespace-nowrap">
                        {isVariable ? (
                          <span className="text-slate-700">{record.value}</span>
                        ) : (
                          record.account_id || <span className="text-muted-foreground italic">-</span>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {record.relationship ? (
                          <Badge
                            variant="outline"
                            className={
                              record.relationship.toUpperCase() === "DIRECT"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : ""
                            }
                          >
                            {record.relationship}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground italic">-</span>
                        )}
                      </td>
                      <td className="p-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {record.certification_authority_id || "-"}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        {record.is_valid ? (
                          <div className="flex items-center text-green-600 font-medium text-xs">
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> {t("common.ok")}
                          </div>
                        ) : (
                          <div className="flex items-center text-red-600 font-medium text-xs">
                            <XCircle className="w-3.5 h-3.5 mr-1" /> {t("common.error")}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-xs max-w-md min-w-[300px]">
                        {record.has_warning ? (
                          record.validation_key ? (
                            <Link
                              href={`/warnings#${toKebabCase(record.validation_key)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-yellow-700 hover:underline decoration-yellow-700/50 underline-offset-4 flex items-center gap-1 group"
                            >
                              <span className="truncate">{displayMessage}</span>
                              <HelpCircle className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </Link>
                          ) : (
                            <span className="text-yellow-700 truncate block">{displayMessage}</span>
                          )
                        ) : !record.is_valid ? (
                          record.validation_key ? (
                            <Link
                              href={`/warnings#${toKebabCase(record.validation_key)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-red-600 font-mono hover:underline decoration-red-600/50 underline-offset-4 flex items-center gap-1 group"
                            >
                              <span className="truncate">{displayMessage}</span>
                              <HelpCircle className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </Link>
                          ) : (
                            <span className="text-red-600 font-mono truncate block">{displayMessage}</span>
                          )
                        ) : null}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground">
                    {t("common.noRecords")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="text-xs text-muted-foreground text-right">
        {t("common.sourceUrl")}:{" "}
        <a href={data.ads_txt_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
          {data.ads_txt_url}
        </a>
      </div>
    </div>
  )
}
