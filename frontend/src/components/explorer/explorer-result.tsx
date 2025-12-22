"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Loader2 } from "lucide-react"

import { useAdsTxtData } from "@/hooks/use-ads-txt-data"

type Props = {
  domain: string
  type: "ads.txt" | "app-ads.txt"
}

import { useTranslation } from "@/lib/i18n/language-context"

export function ExplorerResult({ domain, type }: Props) {
  const { t } = useTranslation()

  const { data, error, isLoading, filter, setFilter, filteredRecords } = useAdsTxtData(domain, type)

  // Download functionality
  const handleDownload = () => {
    if (!data?.records) return
    const headers = [
      t("common.line"),
      t("common.advertisingSystem"),
      t("common.publisherAccountId"),
      t("common.sellerName"),
      t("common.sellerType"),
      t("common.isConfidential"),
      t("common.sellerDomain"),
      t("common.relationship"),
      t("common.certId"),
      t("common.commentRaw")
    ]
    const csvContent = [
      headers.join(","),
      ...data.records.map((r) =>
        [
          r.line_number === -1 ? t("common.auto") : r.line_number,
          r.domain || "",
          r.account_id || "",
          r.seller_name || "",
          r.seller_type || "",
          r.is_confidential !== undefined ? (r.is_confidential === 1 ? t("common.yes") : t("common.no")) : "",
          r.seller_domain || "",
          r.relationship || "",
          r.certification_authority_id || "",
          r.raw_line.split("#")[1]?.trim() || "" // Extract comment if possible, or just ignore
        ]
          .map((f) => `"${String(f).replace(/"/g, '""')}"`)
          .join(",")
      )
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
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-muted-foreground">{t("common.totalRecords")}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold">{data.stats.total}</CardContent>
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
                <TableHead>{t("common.relationship")}</TableHead>
                <TableHead>{t("common.certId")}</TableHead>
                <TableHead>{t("common.commentRaw")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords?.length ? (
                filteredRecords.map((record, i) => (
                  <TableRow key={i} className="hover:bg-muted/50">
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
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
