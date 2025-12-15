"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AlertTriangle, CheckCircle2, Clock, Database, FileText } from "lucide-react"
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

const fetcher = (url: string) => fetch(url).then((res) => res.json())

const ClientDate = ({ date }: { date: string }) => {
  const [formatted, setFormatted] = useState<string>("")

  useEffect(() => {
    if (date) {
      setFormatted(new Date(date).toLocaleString())
    }
  }, [date])

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
  const { data, isLoading } = useSWR<AdsTxtScan[]>("/api/proxy/history", fetcher)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Ads.txt / App-ads.txt Scans</CardTitle>
        <CardDescription>Latest scan results from Data Explorer and automated monitoring.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8">Loading...</div>
        ) : !data || !Array.isArray(data) || data.length === 0 ? (
          <div className="text-muted-foreground p-8 text-center">
            {data && !Array.isArray(data) ? "Failed to load data." : "No scans found yet."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scanned At</TableHead>
                <TableHead>Stats</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((scan) => (
                <TableRow key={scan.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center">{scan.domain}</div>
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">
                      {scan.file_type || "ads.txt"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <ClientDate date={scan.scanned_at} />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-3 text-xs">
                      <div className="flex items-center" title="Total Records">
                        <FileText className="mr-1 h-3 w-3 text-muted-foreground" />
                        {scan.records_count}
                      </div>
                      <div className="flex items-center text-green-600" title="Valid Records">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {scan.valid_count}
                      </div>
                      {scan.warning_count > 0 && (
                        <div className="flex items-center text-yellow-600" title="Warnings">
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
                            ? "bg-green-50 text-green-700 ring-green-600/20"
                            : "bg-red-50 text-red-700 ring-red-600/20"
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
        )}
      </CardContent>
    </Card>
  )
}

function SellersJsonStatus() {
  const { data, isLoading } = useSWR<SellersFile[]>("/api/proxy/sellers/files", fetcher)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Sellers.json Scans</CardTitle>
        <CardDescription>List of recently fetched sellers.json files.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-8">Loading...</div>
        ) : !data || !Array.isArray(data) || data.length === 0 ? (
          <div className="text-muted-foreground p-8 text-center">
            {data && !Array.isArray(data) ? "Failed to load data." : "No scans found yet."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead>Fetched At</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead className="w-[200px]">ETag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center">
                      <Database className="mr-2 h-4 w-4 text-blue-600" />
                      {file.domain}
                    </div>
                  </TableCell>
                  <TableCell>
                    <ClientDate date={file.fetched_at} />
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                        file.http_status === 200
                          ? "bg-green-50 text-green-700 ring-green-600/20"
                          : "bg-red-50 text-red-700 ring-red-600/20"
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
        )}
      </CardContent>
    </Card>
  )
}

import { useTranslation } from "@/lib/i18n/language-context"

export default function StatusPage() {
  const { t } = useTranslation()
  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Scan Status</h1>
        <p className="text-muted-foreground">{t("common.scanStatusDescription")}</p>
      </div>

      <Tabs defaultValue="adstxt" className="space-y-4">
        <TabsList>
          <TabsTrigger value="adstxt">Ads.txt Scans</TabsTrigger>
          <TabsTrigger value="sellers">Sellers.json Scans</TabsTrigger>
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
