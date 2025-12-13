"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Download, ExternalLink, Info, Loader2 } from "lucide-react"
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

const fetcher = (url: string) =>
  fetch(url).then((res) => {
    if (!res.ok) throw new Error("Failed to fetch")
    return res.json()
  })

type Props = {
  domain: string
}

export function SellersResult({ domain }: Props) {
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
    const headers = ["Seller ID", "Name", "Type", "Domain", "Is Confidential", "Is Passthrough"]
    const csvContent = [
      headers.join(","),
      ...data.sellers.map((s) =>
        [
          s.seller_id,
          s.name,
          s.seller_type,
          s.domain || "",
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
        Enter a domain to fetch sellers.json.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Fetching sellers.json from {domain}...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTitle>Failed to fetch sellers.json</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
        {/* Fallback to global search hint */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Note</AlertTitle>
          <AlertDescription>
            This feature fetches the live sellers.json from the domain. If the domain does not host a sellers.json file,
            this will fail.
          </AlertDescription>
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
            <CardTitle className="text-lg">Metadata</CardTitle>
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
            <CardTitle className="text-lg">Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{data.sellers.length}</div>
                <div className="text-xs text-muted-foreground">Total Sellers</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {data.sellers.filter((s) => s.seller_type === "PUBLISHER").length}
                </div>
                <div className="text-xs text-muted-foreground">Publishers</div>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {data.sellers.filter((s) => s.seller_type === "INTERMEDIARY").length}
                </div>
                <div className="text-xs text-muted-foreground">Intermediaries</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{data.sellers.filter((s) => s.seller_type === "BOTH").length}</div>
                <div className="text-xs text-muted-foreground">Both</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Input
            placeholder="Filter sellers..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button variant="outline" onClick={handleDownload} className="shrink-0">
          <Download className="mr-2 h-4 w-4" /> Download CSV
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Seller ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Confidential</TableHead>
                <TableHead>Passthrough</TableHead>
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
                    <TableCell className="font-mono text-xs">
                      {seller.domain ? (
                        <a
                          href={`https://${seller.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center hover:underline hover:text-primary"
                        >
                          {seller.domain} <ExternalLink className="ml-1 w-3 h-3 opacity-50" />
                        </a>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {seller.is_confidential ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Confidential
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
                  <TableCell colSpan={6} className="h-24 text-center">
                    No sellers found matching filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="text-xs text-muted-foreground text-right">
        Source URL:{" "}
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
