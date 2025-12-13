"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { Loader2, Search } from "lucide-react"
import { useState } from "react"
import useSWR from "swr"

// 型定義
type Seller = {
  seller_id: string
  domain: string
  seller_type: string
  name: string
  is_confidential: boolean
  updated_at: string
}

type APIResponse = {
  data: Seller[]
  meta: {
    total: number
    page: number
    limit: number
    pages: number
  }
}

// Fetcher
const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function SellersPage() {
  const [keyword, setKeyword] = useState("")
  // Debounce処理は簡易的に実装（本来は専用フック推奨）
  const [debouncedKeyword, setDebouncedKeyword] = useState("")

  const handleSearch = () => {
    setDebouncedKeyword(keyword)
  }

  const { data, error, isLoading } = useSWR<APIResponse>(`/api/proxy/sellers?q=${debouncedKeyword}&limit=20`, fetcher)

  const columns: ColumnDef<Seller>[] = [
    {
      accessorKey: "domain",
      header: "Domain",
      cell: ({ row }) => <div className="font-medium">{row.getValue("domain")}</div>
    },
    {
      accessorKey: "seller_id",
      header: "Seller ID",
      cell: ({ row }) => <div className="font-mono text-xs">{row.getValue("seller_id")}</div>
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <div className="max-w-[300px] truncate" title={row.getValue("name")}>
          {row.getValue("name") || <span className="text-muted-foreground italic">(No Name)</span>}
        </div>
      )
    },
    {
      accessorKey: "seller_type",
      header: "Type",
      cell: ({ row }) => {
        const type = row.getValue("seller_type") as string
        return <Badge variant={type === "PUBLISHER" ? "default" : "secondary"}>{type}</Badge>
      }
    },
    {
      accessorKey: "is_confidential",
      header: "Confidential",
      cell: ({ row }) =>
        row.getValue("is_confidential") ? (
          <Badge variant="destructive" className="text-[10px]">
            Confidential
          </Badge>
        ) : (
          <span className="text-muted-foreground text-xs">-</span>
        )
    }
  ]

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    // PaginationはServer Sideで行うため、ここでは表示用のみ
    manualPagination: true,
    pageCount: data?.meta?.pages || -1
  })

  return (
    <div className="container mx-auto py-10 space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Global Sellers Search</h1>
        <p className="text-muted-foreground">
          Ads.txt Manager V2 Data Lakeから 100万件超のセラー情報を瞬時に検索します。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Filters</CardTitle>
          <CardDescription>Enter domain, seller ID, or company name.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex w-full max-w-sm items-center space-x-2">
            <Input
              placeholder="Search..."
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border">
        {isLoading ? (
          <div className="h-24 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    return (
                      <TableHead key={header.id}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    )
                  })}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center">
                    No results.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {data?.meta && (
        <div className="text-xs text-muted-foreground text-right">
          Total: {data.meta.total.toLocaleString()} records / Page: {data.meta.page}
        </div>
      )}
    </div>
  )
}
