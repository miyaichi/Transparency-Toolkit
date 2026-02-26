"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2, Download, Loader2, XCircle } from "lucide-react"

import { isExchangeEntry, isFoundInSellers, useAdsTxtData } from "@/hooks/use-ads-txt-data"
import { ValidationRecord } from "@/types"

type Props = {
  domain: string
  type: "ads.txt" | "app-ads.txt"
}

import { useTranslation } from "@/lib/i18n/language-context"

/**
 * Returns hop count for a record based on relationship + seller_type.
 *
 * Logic:
 *   DIRECT                          → 1 hop
 *   RESELLER + PUBLISHER/BOTH       → 2 hops
 *   RESELLER + INTERMEDIARY         → 3  (displayed as "3+", deeper chain possible)
 *   RESELLER + unknown seller_type  → 2 hops (fallback)
 *   Not an exchange entry / invalid → null
 */
function getHopCount(r: ValidationRecord): number | null {
  if (!isExchangeEntry(r)) return null
  if (!isFoundInSellers(r)) return null

  const rel = r.relationship?.toUpperCase()
  if (rel === "DIRECT") return 1
  if (rel === "RESELLER") {
    const st = r.seller_type?.toUpperCase()
    if (st === "INTERMEDIARY") return 3
    return 2
  }
  return null
}

function HopBadge({ hop }: { hop: number | null }) {
  if (hop === null) return <span className="text-muted-foreground">-</span>
  if (hop === 1)
    return (
      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-mono">
        1
      </Badge>
    )
  if (hop === 2)
    return (
      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 font-mono">
        2
      </Badge>
    )
  // 3+
  return (
    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 font-mono">
      3+
    </Badge>
  )
}

export function ExplorerResult({ domain, type }: Props) {
  const { t } = useTranslation()

  const { data, error, isLoading, filter, setFilter, validOnly, setValidOnly, filteredRecords } = useAdsTxtData(
    domain,
    type
  )

  // Compute sellers.json validity stats and hop stats from all records (pre-filter)
  const allRecords = data?.records ?? []
  const exchangeEntries = allRecords.filter(isExchangeEntry)
  const validCount = exchangeEntries.filter(isFoundInSellers).length
  const invalidCount = exchangeEntries.filter((r) => !isFoundInSellers(r)).length
  const hopCounts = exchangeEntries.map(getHopCount).filter((h): h is number => h !== null)
  const maxHop = hopCounts.length > 0 ? Math.max(...hopCounts) : null
  const avgHop =
    hopCounts.length > 0 ? Math.round((hopCounts.reduce((a, b) => a + b, 0) / hopCounts.length) * 10) / 10 : null

  // Download functionality
  const handleDownload = () => {
    if (!data?.records) return
    const headers = [
      t("common.line"),
      t("common.advertisingSystem"),
      t("common.publisherAccountId"),
      t("common.sellerName"),
      t("explorerPage.validInSellers"),
      t("explorerPage.hop"),
      t("common.relationship"),
      t("common.certId"),
      t("common.commentRaw")
    ]
    const csvContent = [
      headers.join(","),
      ...data.records.map((r) => {
        const hop = getHopCount(r)
        const hopDisplay = hop === null ? "" : hop === 3 ? "3+" : String(hop)
        const validDisplay = !isExchangeEntry(r) ? "" : isFoundInSellers(r) ? "valid" : "invalid"
        return [
          r.line_number === -1 ? t("common.auto") : r.line_number,
          r.domain || "",
          r.account_id || "",
          r.seller_name || "",
          validDisplay,
          hopDisplay,
          r.relationship || "",
          r.certification_authority_id || "",
          r.raw_line.split("#")[1]?.trim() || ""
        ]
          .map((f) => `"${String(f).replace(/"/g, '""')}"`)
          .join(",")
      })
    ].join("\n")

    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `${domain}_${type}_explorer.csv`
    link.click()
  }

  if (!domain) return null

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">{t("explorerPage.fetching", { type })}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-500 bg-red-50 rounded-lg border border-red-200">
        <h3 className="font-semibold mb-2">{t("common.failedToLoad")}</h3>
        <p>{error.message}</p>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("common.totalRecords")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold">{data.stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-emerald-600">{t("explorerPage.validCount")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-emerald-600">{validCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-red-500">{t("explorerPage.invalidCount")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-red-500">{invalidCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-indigo-600">{t("explorerPage.maxHop")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-indigo-600">
            {maxHop !== null ? (maxHop >= 3 ? "3+" : maxHop) : "-"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-teal-600">{t("explorerPage.avgHop")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-teal-600">
            {avgHop !== null ? avgHop : "-"}
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative max-w-sm w-full">
            <Input
              placeholder={t("common.filterPlaceholder")}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="valid-only"
              type="checkbox"
              checked={validOnly}
              onChange={(e) => setValidOnly(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 accent-emerald-600 cursor-pointer"
            />
            <Label htmlFor="valid-only" className="text-sm cursor-pointer select-none">
              {t("explorerPage.validOnly")}
            </Label>
          </div>
        </div>
        <Button variant="outline" onClick={handleDownload} className="shrink-0">
          <Download className="mr-2 h-4 w-4" /> {t("common.downloadCsv")}
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-16">{t("common.line")}</TableHead>
                <TableHead>{t("common.advertisingSystem")}</TableHead>
                <TableHead>{t("common.publisherAccountId")}</TableHead>
                <TableHead>{t("common.sellerName")}</TableHead>
                <TableHead className="w-20">{t("explorerPage.validInSellers")}</TableHead>
                <TableHead className="w-16">{t("explorerPage.hop")}</TableHead>
                <TableHead>{t("common.relationship")}</TableHead>
                <TableHead>{t("common.certId")}</TableHead>
                <TableHead>{t("common.commentRaw")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords?.length ? (
                filteredRecords.map((record, i) => {
                  const isEntry = isExchangeEntry(record)
                  const found = isEntry && isFoundInSellers(record)
                  const notFound = isEntry && !isFoundInSellers(record)
                  const hop = getHopCount(record)

                  return (
                    <TableRow key={i} className={notFound ? "bg-red-50/60 hover:bg-red-50" : "hover:bg-muted/50"}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {record.line_number === -1 ? t("common.auto") : record.line_number}
                      </TableCell>
                      <TableCell className="font-medium">
                        {record.domain || <span className="text-muted-foreground italic">-</span>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {record.account_id || <span className="text-muted-foreground italic">-</span>}
                      </TableCell>
                      <TableCell className="text-xs">
                        {record.seller_name ? (
                          <span className="font-medium text-emerald-600">{record.seller_name}</span>
                        ) : (
                          <span className="text-muted-foreground italic text-xs">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {found ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : notFound ? (
                          <XCircle className="h-4 w-4 text-red-400" />
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <HopBadge hop={hop} />
                      </TableCell>
                      <TableCell className="uppercase text-xs font-semibold text-muted-foreground">
                        {record.relationship || "-"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {record.certification_authority_id || "-"}
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground font-mono max-w-[300px] truncate"
                        title={record.raw_line}
                      >
                        {record.raw_line}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    {t("common.noRecords")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
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
