"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clock, Database } from "lucide-react"
import { useEffect, useState } from "react"
import useSWR from "swr"

type SellersFile = {
  id: string
  domain: string
  fetched_at: string
  http_status: number
  etag: string | null
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
    <div className="flex items-center text-muted-foreground">
      <Clock className="mr-2 h-4 w-4" />
      {formatted}
    </div>
  )
}

export default function SellersStatusPage() {
  const { data, isLoading } = useSWR<SellersFile[]>("/api/proxy/sellers/files", fetcher)

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Sellers.json Scan Status</h1>
        <p className="text-muted-foreground">
          Recent scan results for sellers.json files. This data is automatically fetched based on Ads.txt contents.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Scans</CardTitle>
          <CardDescription>
            List of recently fetched sellers.json files.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center p-8">Loading...</div>
          ) : !data || data.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center">No scans found yet.</div>
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
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${file.http_status === 200
                        ? 'bg-green-50 text-green-700 ring-green-600/20'
                        : 'bg-red-50 text-red-700 ring-red-600/20'
                        }`}>
                        {file.http_status || 'N/A'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {file.etag ? file.etag.substring(0, 20) + (file.etag.length > 20 ? '...' : '') : '-'}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div >
  )
}
