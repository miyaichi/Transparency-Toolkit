"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircle, CheckCircle2, FileText, XCircle } from "lucide-react"
import { useState } from "react"

type ValidationRecord = {
  line_number: number
  raw_line: string
  is_valid: boolean
  domain?: string
  account_id?: string
  account_type?: string
  relationship?: string
  has_warning?: boolean
  validation_key?: string
  warning_message?: string
  variable_type?: string
  value?: string
}

type ValidationResponse = {
  domain: string
  ads_txt_url: string
  records: ValidationRecord[]
  stats: {
    total: number
    valid: number
    invalid: number
    warnings: number
  }
  scan_id?: string
}

export default function ValidatorPage() {
  const [domain, setDomain] = useState("")
  const [result, setResult] = useState<ValidationResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleValidate = async (shouldSave = false) => {
    if (!domain) return
    setLoading(true)
    setError("")
    setResult(null)

    try {
      const res = await fetch(`/api/proxy/validator?domain=${domain}&save=${shouldSave}`)
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || "Failed to validate")
      }
      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Ads.txt Validator</h1>
        <p className="text-muted-foreground">Ads.txtをフェッチし、Sellers.json(Catalog)とクロスチェックします。</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Validation Target</CardTitle>
          <CardDescription>Enter the publisher domain (e.g., nytimes.com)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex w-full max-w-sm items-center space-x-2">
            <Input
              placeholder="example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleValidate(false)}
            />
            <Button variant="secondary" onClick={() => handleValidate(false)} disabled={loading}>
              {loading ? "Checking..." : "Check Only"}
            </Button>
            <Button onClick={() => handleValidate(true)} disabled={loading}>
              {loading ? "Saving..." : "Save & Check"}
            </Button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </CardContent>
      </Card>

      {result && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Validation Results</h2>
              {result.scan_id && (
                <Badge variant="outline" className="font-mono">
                  Scan ID: {result.scan_id.substring(0, 8)}
                </Badge>
              )}
            </div>
            <Button variant="outline" onClick={() => (window.location.href = `/history?domain=${result.domain}`)}>
              View Scan History
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Records</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{result.stats?.total || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valid</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{result.stats?.valid || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Warnings</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{result.stats?.warnings || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Invalid</CardTitle>
                <XCircle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{result.stats?.invalid || 0}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
              <CardDescription>Fetched from {result.ads_txt_url}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">Line</TableHead>
                      <TableHead>Row Content / Analysis</TableHead>
                      <TableHead className="w-[100px]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {result.records?.map((rec, i) => (
                      <TableRow key={i} className={!rec.is_valid ? "bg-red-50" : rec.has_warning ? "bg-yellow-50" : ""}>
                        <TableCell className="font-mono text-xs">{rec.line_number}</TableCell>
                        <TableCell>
                          <div className="font-mono text-xs text-muted-foreground mb-1">{rec.raw_line}</div>
                          {rec.warning_message && (
                            <div className="flex items-center text-yellow-700 text-xs">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              {rec.warning_message}
                            </div>
                          )}
                          {!rec.is_valid && rec.warning_message && (
                            <div className="flex items-center text-red-600 text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              {rec.warning_message}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {!rec.is_valid ? (
                            <Badge variant="destructive">Invalid</Badge>
                          ) : rec.has_warning ? (
                            <Badge variant="outline" className="border-yellow-500 text-yellow-700 bg-yellow-100">
                              Warning
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                              OK
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
