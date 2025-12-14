"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ValidationResponse } from "@/types"
import { CheckCircle, Download, Loader2, XCircle } from "lucide-react"
import { useState } from "react"
import useSWR from "swr"

// Fetcher
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
  type: "ads.txt" | "app-ads.txt"
}

export function ValidatorResult({ domain, type }: Props) {
  // Client-side filtering
  const [filter, setFilter] = useState("")

  // Fetch data
  const { data, error, isLoading } = useSWR<ValidationResponse>(
    domain ? `/api/proxy/validator?domain=${domain}&type=${type}&save=true` : null,
    fetcher,
    {
      revalidateOnFocus: false, // Don't revalidate aggressively
      shouldRetryOnError: false
    }
  )

  // Filter records
  const filteredRecords = data?.records.filter((r) => {
    if (!filter) return true
    const term = filter.toLowerCase()
    return (
      (r.domain?.toLowerCase().includes(term) ?? false) ||
      (r.account_id?.toLowerCase().includes(term) ?? false) ||
      (r.relationship?.toLowerCase().includes(term) ?? false)
    )
  })

  // Download functionality
  const handleDownload = () => {
    if (!data?.records) return
    const headers = ["Line", "Domain", "Publisher Account ID", "Relationship", "Cert ID", "Status", "Message"]
    const csvContent = [
      headers.join(","),
      ...data.records.map((r) =>
        [
          r.line_number,
          r.domain || "",
          r.account_id || "",
          r.relationship || "",
          r.account_type || "", // Assuming account_type maps to Cert ID in parser
          r.is_valid ? "OK" : "ERROR",
          r.warning_message || r.validation_key || ""
        ]
          .map((f) => `"${String(f).replace(/"/g, '""')}"`)
          .join(",")
      )
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `${domain}_${type}_report.csv`
    link.click()
  }

  if (!domain) {
    return (
      <div className="text-muted-foreground text-center py-20 bg-muted/20 rounded-lg">
        Enter a domain above and press Search to view {type} report.
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">Fetching and analyzing {type}...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-500 bg-red-50 rounded-lg border border-red-200">
        <h3 className="font-semibold mb-2">Failed to load report</h3>
        <p>{error.message}</p>
        <p className="text-sm mt-2 text-muted-foreground">Backend URL: /api/proxy/validator</p>
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
            <CardTitle className="text-sm text-muted-foreground">Total Records</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold">{data.stats.total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-green-600">Valid Records</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-green-600">{data.stats.valid}</CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-red-600">Invalid Records</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-red-600">{data.stats.invalid}</CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm text-yellow-600">Warnings</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-2xl font-bold text-yellow-600">{data.stats.warnings}</CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm w-full">
          <Input
            placeholder="Filter by domain, ID..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="pl-8"
          />
          {/* Search icon could go here */}
        </div>
        <Button variant="outline" onClick={handleDownload} className="shrink-0">
          <Download className="mr-2 h-4 w-4" /> Download CSV
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-15">Line</TableHead>
                <TableHead>Advertising System</TableHead>
                <TableHead>Publisher Account ID</TableHead>
                <TableHead>Relationship</TableHead>
                <TableHead>Cert ID</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords?.length ? (
                filteredRecords.map((record, i) => (
                  <TableRow
                    key={i}
                    className={
                      !record.is_valid
                        ? "bg-red-50 hover:bg-red-100/50"
                        : record.has_warning
                          ? "bg-yellow-50 hover:bg-yellow-100/50"
                          : "hover:bg-muted/50"
                    }
                  >
                    <TableCell className="font-mono text-xs text-muted-foreground">{record.line_number}</TableCell>
                    <TableCell className="font-medium">
                      {record.domain || <span className="text-muted-foreground italic">-</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {record.account_id || <span className="text-muted-foreground italic">-</span>}
                    </TableCell>
                    <TableCell>
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
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {record.account_type || "-"}
                    </TableCell>
                    <TableCell>
                      {record.is_valid ? (
                        <div className="flex items-center text-green-600 font-medium text-xs">
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> OK
                        </div>
                      ) : (
                        <div className="flex items-center text-red-600 font-medium text-xs">
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Error
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs max-w-75">
                      {record.warning_message ? (
                        <span className="text-yellow-700">{record.warning_message}</span>
                      ) : record.validation_key && !record.is_valid ? (
                        <span className="text-red-600 font-mono">{record.validation_key}</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    No records found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      <div className="text-xs text-muted-foreground text-right">
        Source URL:{" "}
        <a href={data.ads_txt_url} target="_blank" rel="noopener noreferrer" className="underline hover:text-primary">
          {data.ads_txt_url}
        </a>
      </div>
    </div>
  )
}
