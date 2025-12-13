"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Clock, ShieldCheck, Trash2 } from "lucide-react"
import { useState } from "react"
import useSWR from "swr"

type MonitoredDomain = {
  id: string
  domain: string
  is_active: boolean
  last_scanned_at: string | null
  scan_interval_minutes: number
}

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function MonitorPage() {
  const { data, mutate } = useSWR<MonitoredDomain[]>("/api/proxy/monitor", fetcher)
  const [newDomain, setNewDomain] = useState("")
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    if (!newDomain) return
    setAdding(true)
    try {
      await fetch("/api/proxy/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain })
      })
      setNewDomain("")
      mutate()
    } finally {
      setAdding(false)
    }
  }

  const handleDelete = async (domain: string) => {
    if (!confirm(`Are you sure you want to stop monitoring ${domain}?`)) return
    await fetch(`/api/proxy/monitor?domain=${domain}`, {
      method: "DELETE"
    })
    mutate()
  }

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Monitored Domains</h1>
        <p className="text-muted-foreground">Manage domains for scheduled Ads.txt scanning.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Domain</CardTitle>
          <CardDescription>Start monitoring a new domain for ads.txt updates.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex w-full max-w-sm items-center space-x-2">
            <Input
              placeholder="example.com"
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={adding}>
              {adding ? "Adding..." : "Add Domain"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Active Monitors</CardTitle>
        </CardHeader>
        <CardContent>
          {!data ? (
            <div>Loading...</div>
          ) : !Array.isArray(data) || data.length === 0 ? (
            <div className="text-muted-foreground">No domains monitored yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Last Scanned</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center">
                        <ShieldCheck className="mr-2 h-4 w-4 text-green-600" />
                        {item.domain}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center text-muted-foreground">
                        <Clock className="mr-2 h-4 w-4" />
                        {item.last_scanned_at ? new Date(item.last_scanned_at).toLocaleString() : "Pending"}
                      </div>
                    </TableCell>
                    <TableCell>{item.scan_interval_minutes} min</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(item.domain)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
