"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2 } from "lucide-react"
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
  total_sellers?: number
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
  const [page, setPage] = useState(1)

  // 1. Trigger Fetch/Update (Pseudo-background) - Keep this to ensure data is fresh but don't use its result for the heavy table
  // Using a key that doesn't change with page to avoid re-triggering fetch on pagination
  const {
    data: fetchMetadata,
    error: fetchError,
    isLoading: isFetching
  } = useSWR<SellersJsonResponse>(domain ? `/api/proxy/sellers/fetch?domain=${domain}&save=true` : null, fetcher, {
    revalidateOnFocus: false,
    shouldRetryOnError: false
  })

  // 2. Fetch Paginated Data from Search API
  const {
    data: searchData,
    error: searchError,
    isLoading: isSearching
  } = useSWR(domain ? `/api/proxy/sellers?domain=${domain}&page=${page}&limit=50&q=${filter}` : null, fetcher)

  const handleDownload = () => {
    // Download currently only fetches the current page or needs a dedicated export endpoint.
    // For now, we'll disable it or show a toast that export is limited.
    // Ideally, call a backend endpoint for CSV stream.
    alert("Exporting full dataset is not yet supported for large files.")
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= (searchData?.meta?.pages || 1)) {
      setPage(newPage)
    }
  }

  if (!domain) {
    return (
      <div className="text-muted-foreground text-center py-20 bg-muted/20 rounded-lg">
        {t("sellersPage.messages.enterDomain")}
      </div>
    )
  }

  // Initial Fetching State
  if (isFetching && !searchData) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">{t("sellersPage.messages.fetching", { domain })}</p>
      </div>
    )
  }

  if (fetchError || searchError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>{t("sellersPage.messages.failed")}</AlertTitle>
          <AlertDescription>{(fetchError || searchError)?.message}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const sellers = searchData?.data || []
  const meta = searchData?.meta || { total: 0, page: 1, pages: 1 }

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t("sellersPage.metadata")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {/* Use metadata from the fetch result if available */}
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("sellersPage.version")}:</span>
              <span className="font-mono">{fetchMetadata?.version || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("sellersPage.contactEmail")}:</span>
              <span>{fetchMetadata?.contact_email || "-"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("sellersPage.contactAddress")}:</span>
              <span className="truncate max-w-[200px]" title={fetchMetadata?.contact_address}>
                {fetchMetadata?.contact_address || "-"}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{t("sellersPage.stats")}</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Show Total Count from Search Metadata which is accurate from DB */}
            <div className="text-center">
              <div className="text-4xl font-bold">{fetchMetadata?.total_sellers || meta.total}</div>
              <div className="text-sm text-muted-foreground">{t("sellersPage.totalSellers")}</div>
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
            onChange={(e) => {
              setFilter(e.target.value)
              setPage(1)
            }}
            className="pl-8"
          />
        </div>
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
                <TableHead>{t("sellersPage.headers.identifiers")}</TableHead>
                <TableHead>{t("sellersPage.headers.confidential")}</TableHead>
                <TableHead>{t("sellersPage.headers.passthrough")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sellers.length ? (
                sellers.map((seller: any, i: number) => (
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
                          {seller.identifiers.map((id: any, idx: number) => (
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
                      {/* Note: backend searchSellers might not return is_passthrough unless added to query */}-
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

      {/* Pagination Controls */}
      <div className="flex items-center justify-between py-4">
        <div className="text-sm text-muted-foreground">
          Page {meta.page} of {meta.pages}
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page - 1)}
            disabled={page <= 1 || isSearching}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(page + 1)}
            disabled={page >= meta.pages || isSearching}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="text-xs text-muted-foreground text-right">
        {t("common.sourceUrl")}:{" "}
        <a
          href={fetchMetadata?.sellers_json_url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-primary"
        >
          {fetchMetadata?.sellers_json_url}
        </a>
      </div>
    </div>
  )
}
