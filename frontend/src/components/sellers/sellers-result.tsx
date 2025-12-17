"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, Info, Loader2 } from "lucide-react"
import { useState } from "react"
import useSWR from "swr"

// Define specific type for Sellers.json Response
// Note: Backend API implementation pending. Assuming standard structure.
type SellersJsonResponse = {
  domain: string
  sellers_json_url: string
  contact_email?: string
  contact_address?: string
  version?: string
  sellers: {
    seller_id: string
    name: string
    domain: string
    identifiers?: { name: string; value: string }[]
    seller_type: string
    is_confidential?: number | boolean // valid spec uses 0 or 1, but some use bool
    is_passthrough?: number | boolean
    comment?: string
  }[]
  stats?: {
    total: number
    publishers: number
    intermediaries: number
    both: number
  }
  fetched_at?: string
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    try {
      const errorData = JSON.parse(text)
      throw new Error(errorData.error || errorData.message || `Error ${res.status}: ${res.statusText}`)
    } catch (e) {
      throw new Error(`Error ${res.status}: ${res.statusText} - ${text.substring(0, 100)}`)
    }
  }
  return res.json()
}

type Props = {
  domain: string
}

import { useTranslation } from "@/lib/i18n/language-context"

export function SellersResult({ domain }: Props) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState("")

  // Fetch logic: Backend API endpoint needed for fetching a specific domain's sellers.json on demand
  // Using a hypothetical endpoint based on plan
  const { data, error, isLoading } = useSWR<SellersJsonResponse>(
    domain ? `/api/proxy/sellers/fetch?domain=${domain}&save=true` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false
    }
  )

  const filteredSellers = data?.sellers.filter((s) => {
    if (!filter) return true
    const term = filter.toLowerCase()
    return (
      (s.name?.toLowerCase().includes(term) ?? false) ||
      (s.seller_id?.toLowerCase().includes(term) ?? false) ||
      (s.domain?.toLowerCase().includes(term) ?? false)
    )
  })

  const handleDownload = () => {
    if (!data?.sellers) return
    const headers = [
      t("sellersPage.headers.sellerId"),
      t("sellersPage.headers.name"),
      t("sellersPage.headers.type"),
      t("sellersPage.headers.domain"),
      "Identifiers",
      t("sellersPage.headers.confidential"),
      t("sellersPage.headers.passthrough")
    ]
    const csvContent = [
      headers.join(","),
      ...data.sellers.map((s) =>
        [
          s.seller_id,
          s.name,
          s.seller_type,
          s.domain || "",
          s.identifiers ? JSON.stringify(s.identifiers) : "",
          s.is_confidential ? "1" : "0",
          s.is_passthrough ? "1" : "0"
        ]
          .map((f) => `"${String(f).replace(/"/g, '""')}"`)
          .join(",")
      )
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `${domain}_sellers.csv`
    link.click()
  }

  if (!domain) {
    return (
      <div className="text-muted-foreground text-center py-20 bg-muted/20 rounded-lg">
        {t("sellersPage.messages.enterDomain")}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">{t("sellersPage.messages.fetching", { domain })}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>{t("sellersPage.messages.failed")}</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        {/* Fallback to global search hint */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>{t("sellersPage.messages.noteTitle")}</AlertTitle>
          <AlertDescription>{t("sellersPage.messages.noteDescription")}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t("sellersPage.metadata")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version:</span>
              <span className="font-mono">{data.version || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contact Email:</span>
              <span>{data.contact_email || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Contact Address:</span>
              <span className="truncate max-w-[200px]" title={data.contact_address}>
                {data.contact_address || "-"}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t("sellersPage.stats")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{data.sellers.length}</div>
                <div className="text-xs text-muted-foreground">{t("sellersPage.totalSellers")}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {data.sellers.filter((s) => s.seller_type === "PUBLISHER").length}
                </div>
                <div className="text-xs text-muted-foreground">{t("sellersPage.publishers")}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {data.sellers.filter((s) => s.seller_type === "INTERMEDIARY").length}
                </div>
                <div className="text-xs text-muted-foreground">{t("sellersPage.intermediaries")}</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{data.sellers.filter((s) => s.seller_type === "BOTH").length}</div>
                <div className="text-xs text-muted-foreground">{t("sellersPage.both")}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Input
            placeholder={t("sellersPage.filterPlaceholder")}
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={handleDownload} className="shrink-0">
          <Download className="mr-2 h-4 w-4" /> {t("common.downloadCsv")}
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>{t("sellersPage.headers.sellerId")}</TableHead>
                <TableHead>{t("sellersPage.headers.name")}</TableHead>
                <TableHead>{t("sellersPage.headers.type")}</TableHead>
                <TableHead>{t("sellersPage.headers.domain")}</TableHead>
                <TableHead>Identifiers</TableHead>
                <TableHead>{t("sellersPage.headers.confidential")}</TableHead>
                <TableHead>{t("sellersPage.headers.passthrough")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSellers?.length ? (
                filteredSellers.map((seller, i) => (
                  <TableRow key={i} className="hover:bg-muted/50">
                    <TableCell className="font-mono text-xs text-muted-foreground">{seller.seller_id}</TableCell>
                    <TableCell className="font-medium max-w-[200px] truncate" title={seller.name}>
                      {seller.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={seller.seller_type === "PUBLISHER" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {seller.seller_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{seller.domain || "-"}</TableCell>
                    <TableCell className="text-xs">
                      {seller.identifiers && seller.identifiers.length > 0 ? (
                        <div className="space-y-1">
                          {seller.identifiers.map((id, idx) => (
                            <div key={idx} className="flex gap-1">
                              <span className="font-semibold">{id.name}:</span>
                              <span className="font-mono">{id.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {seller.is_confidential ? (
                        <Badge variant="destructive" className="text-[10px]">
                          {t("sellersPage.confidential")}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {seller.is_passthrough ? "Yes" : "-"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    {t("sellersPage.messages.noSellers")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="text-xs text-muted-foreground text-right">
        {t("common.sourceUrl")}:{" "}
        <a
          href={data.sellers_json_url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-primary"
        >
          {data.sellers_json_url}
        </a>
      </div>
    </div>
  )
}
