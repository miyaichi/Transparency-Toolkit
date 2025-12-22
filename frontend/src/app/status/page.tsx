"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { fetcher } from "@/lib/api-utils"
import { useTranslation } from "@/lib/i18n/language-context"
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, Database, FileText } from "lucide-react"
import { useEffect, useState } from "react"
import useSWR from "swr"

// Types
type SellersFile = {
  id: string
  domain: string
  fetched_at: string
  http_status: number
  etag: string | null
}

type AdsTxtScan = {
  id: string
  domain: string
  scanned_at: string
  records_count: number
  valid_count: number
  warning_count: number
  file_type?: "ads.txt" | "app-ads.txt"
  status_code?: number
}

const ClientDate = ({ date, locale = "en" }: { date: string; locale?: string }) => {
  const [formatted, setFormatted] = useState<string>("")

  useEffect(() => {
    if (date) {
      setFormatted(new Date(date).toLocaleString(locale))
    }
  }, [date, locale])

  if (!formatted) {
    return <div className="h-4 w-20 bg-muted/20 animate-pulse rounded" />
  }

  return (
    <div className="flex items-center text-muted-foreground text-xs">
      <Clock className="mr-1 h-3 w-3" />
      {formatted}
    </div>
  )
}

function AdsTxtScanStatus() {
  const { t, language } = useTranslation()
  const { data, isLoading, error } = useSWR<AdsTxtScan[]>("/api/proxy/history", fetcher)

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
        <CardContent className="pt-6 text-center text-red-600 space-y-2">
          <AlertCircle className="h-8 w-8 mx-auto" />
          <p className="font-medium">{t("scanStatusPage.messages.failed")}</p>
          <p className="text-sm opacity-80">{error.message}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("scanStatusPage.adstxt.title")}</CardTitle>
        <CardDescription>{t("scanStatusPage.adstxt.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8 space-x-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>{t("scanStatusPage.messages.loading")}</span>
          </div>
        ) : !data || !Array.isArray(data) || data.length === 0 ? (
          <div className="text-muted-foreground p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-md border border-dashed">
            {t("scanStatusPage.messages.noScans")}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("scanStatusPage.headers.domain")}</TableHead>
                  <TableHead>{t("scanStatusPage.headers.type")}</TableHead>
                  <TableHead>{t("scanStatusPage.headers.scannedAt")}</TableHead>
                  <TableHead>{t("scanStatusPage.headers.stats")}</TableHead>
                  <TableHead className="w-[100px]">{t("scanStatusPage.headers.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">{scan.domain}</div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-900/30 dark:text-blue-400 dark:ring-blue-400/30">
                        {scan.file_type || "ads.txt"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <ClientDate date={scan.scanned_at} locale={language === "ja" ? "ja-JP" : "en-US"} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-3 text-xs">
                        <div className="flex items-center" title={t("common.totalRecords")}>
                          <FileText className="mr-1 h-3 w-3 text-muted-foreground" />
                          {scan.records_count}
                        </div>
                        <div className="flex items-center text-green-600" title={t("common.validRecords")}>
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          {scan.valid_count}
                        </div>
                        {scan.warning_count > 0 && (
                          <div className="flex items-center text-yellow-600" title={t("common.warnings")}>
                            <AlertTriangle className="mr-1 h-3 w-3" />
                            {scan.warning_count}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {scan.status_code ? (
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                            scan.status_code >= 200 && scan.status_code < 300
                              ? "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-400/30"
                              : "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-400/30"
                          }`}
                        >
                          {scan.status_code}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SellersJsonStatus() {
  const { t, language } = useTranslation()
  const { data, isLoading, error } = useSWR<SellersFile[]>("/api/proxy/sellers/files", fetcher)

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-900/10">
        <CardContent className="pt-6 text-center text-red-600 space-y-2">
          <AlertCircle className="h-8 w-8 mx-auto" />
          <p className="font-medium">{t("scanStatusPage.messages.failed")}</p>
          <p className="text-sm opacity-80">{error.message}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("scanStatusPage.sellers.title")}</CardTitle>
        <CardDescription>{t("scanStatusPage.sellers.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8 space-x-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span>{t("scanStatusPage.messages.loading")}</span>
          </div>
        ) : !data || !Array.isArray(data) || data.length === 0 ? (
          <div className="text-muted-foreground p-8 text-center bg-slate-50 dark:bg-slate-900 rounded-md border border-dashed">
            {t("scanStatusPage.messages.noScans")}
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("scanStatusPage.headers.domain")}</TableHead>
                  <TableHead>{t("scanStatusPage.headers.fetchedAt")}</TableHead>
                  <TableHead className="w-[100px]">{t("scanStatusPage.headers.status")}</TableHead>
                  <TableHead className="w-[200px]">{t("scanStatusPage.headers.etag")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <Database className="mr-2 h-4 w-4 text-blue-600 dark:text-blue-400" />
                        {file.domain}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ClientDate date={file.fetched_at} locale={language === "ja" ? "ja-JP" : "en-US"} />
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          file.http_status === 200
                            ? "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/30 dark:text-green-400 dark:ring-green-400/30"
                            : "bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-400/30"
                        }`}
                      >
                        {file.http_status || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {file.etag ? file.etag.substring(0, 20) + (file.etag.length > 20 ? "..." : "") : "-"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function StatusPage() {
  const { t } = useTranslation()
  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="space-y-4 text-center">
        <h1 className="text-3xl font-bold tracking-tight">{t("common.scanStatus")}</h1>
        <p className="text-muted-foreground">{t("common.scanStatusDescription")}</p>
      </div>

      <Tabs defaultValue="adstxt" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px] mx-auto">
          <TabsTrigger value="adstxt" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("scanStatusPage.tabs.adstxt")}
          </TabsTrigger>
          <TabsTrigger value="sellers" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            {t("scanStatusPage.tabs.sellers")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="adstxt">
          <AdsTxtScanStatus />
        </TabsContent>
        <TabsContent value="sellers">
          <SellersJsonStatus />
        </TabsContent>
      </Tabs>
    </div>
  )
}
