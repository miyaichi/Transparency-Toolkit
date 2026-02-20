"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { useTranslation } from "@/lib/i18n/language-context"
import { AlertCircle, CheckCircle2, Loader2, Play, Upload } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

type Stats = {
  total: string
  active: string
  unscanned: string
  scanned: string
}

type ScanResult = {
  processed: number
  succeeded: number
  failed: number
  remaining: number
}

export default function BulkImportPage() {
  const { language } = useTranslation()
  const ja = language === "ja"

  const [fileType, setFileType] = useState<"ads.txt" | "app-ads.txt">("ads.txt")
  const [domainText, setDomainText] = useState("")
  const [importing, setImporting] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [importResult, setImportResult] = useState<{ added: number; total: number } | null>(null)
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef(false)

  const domainCount = domainText.split("\n").filter((l) => l.trim().length > 0).length

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`/api/proxy/monitor?file_type=${fileType}`)
      if (res.ok) {
        setStats(await res.json())
      }
    } catch {
      // ignore
    }
  }, [fileType])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setDomainText(text)
    }
    reader.readAsText(file)
  }, [])

  const handleImport = useCallback(async () => {
    setImporting(true)
    setError(null)
    setImportResult(null)

    try {
      const domains = domainText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0)

      if (domains.length === 0) {
        setError(ja ? "ドメインが入力されていません" : "No domains provided")
        return
      }

      // Send in chunks of 10000
      let totalAdded = 0
      const chunkSize = 10000
      for (let i = 0; i < domains.length; i += chunkSize) {
        const chunk = domains.slice(i, i + chunkSize)
        const res = await fetch("/api/proxy/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domains: chunk, file_type: fileType })
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: res.statusText }))
          throw new Error(data.error || `HTTP ${res.status}`)
        }
        const data = await res.json()
        totalAdded += data.added
      }

      setImportResult({ added: totalAdded, total: domains.length })
      await fetchStats()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setImporting(false)
    }
  }, [domainText, fileType, ja, fetchStats])

  const handleBulkScan = useCallback(async () => {
    setScanning(true)
    setScanResults([])
    abortRef.current = false

    try {
      // Keep calling bulk-scan until no remaining or aborted
      let iteration = 0
      while (!abortRef.current) {
        iteration++
        const res = await fetch("/api/proxy/monitor/bulk-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            file_type: fileType,
            batch_size: 50,
            delay_ms: 1000
          })
        })

        if (!res.ok) {
          const data = await res.json().catch(() => ({ error: res.statusText }))
          throw new Error(data.error || `HTTP ${res.status}`)
        }

        const data: ScanResult = await res.json()
        setScanResults((prev) => [...prev, data])

        if (data.remaining === 0 || data.processed === 0) {
          break
        }

        // Small pause between batches
        await new Promise((r) => setTimeout(r, 500))
      }

      await fetchStats()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setScanning(false)
    }
  }, [fileType, fetchStats])

  const handleStop = useCallback(() => {
    abortRef.current = true
  }, [])

  // Calculate totals from scan results
  const scanTotals = scanResults.reduce(
    (acc, r) => ({
      processed: acc.processed + r.processed,
      succeeded: acc.succeeded + r.succeeded,
      failed: acc.failed + r.failed
    }),
    { processed: 0, succeeded: 0, failed: 0 }
  )

  const lastResult = scanResults[scanResults.length - 1]

  // Fetch stats on mount
  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  return (
    <div className="container mx-auto py-10 space-y-8 max-w-4xl">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">{ja ? "バルクインポート" : "Bulk Import"}</h1>
        <p className="text-muted-foreground">
          {ja
            ? "ドメインリストを一括でモニタリング対象に登録し、ads.txtをスキャンします。"
            : "Import a list of domains for monitoring and scan their ads.txt files."}
        </p>
      </div>

      {/* Stats Card */}
      {stats && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              {ja ? "モニタリング状況" : "Monitor Status"}
              <span className="ml-2 text-sm font-normal text-muted-foreground">{fileType}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-xs text-muted-foreground">{ja ? "合計" : "Total"}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">{stats.scanned}</div>
                <div className="text-xs text-muted-foreground">{ja ? "スキャン済" : "Scanned"}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{stats.unscanned}</div>
                <div className="text-xs text-muted-foreground">{ja ? "未スキャン" : "Unscanned"}</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">{stats.active}</div>
                <div className="text-xs text-muted-foreground">{ja ? "アクティブ" : "Active"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Import Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{ja ? "ドメインリスト" : "Domain List"}</CardTitle>
              <CardDescription className="mt-1.5">
                {ja
                  ? "1行に1ドメイン。テキスト入力またはファイルアップロード。"
                  : "One domain per line. Paste or upload a file."}
              </CardDescription>
            </div>
            <div className="flex rounded-md border overflow-hidden shrink-0">
              {(["ads.txt", "app-ads.txt"] as const).map((ft) => (
                <button
                  key={ft}
                  onClick={() => {
                    setFileType(ft)
                    setImportResult(null)
                    setScanResults([])
                  }}
                  disabled={importing || scanning}
                  className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                    fileType === ft
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {ft}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input ref={fileInputRef} type="file" accept=".txt,.csv" className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="h-4 w-4" />
              {ja ? "ファイル選択" : "Upload File"}
            </Button>
            {domainCount > 0 && (
              <span className="text-sm text-muted-foreground self-center">
                {domainCount.toLocaleString()} {ja ? "ドメイン" : "domains"}
              </span>
            )}
          </div>

          <Textarea
            value={domainText}
            onChange={(e) => setDomainText(e.target.value)}
            placeholder={ja ? "example.jp\nexample.co.jp\n..." : "example.com\nexample.org\n..."}
            rows={10}
            className="font-mono text-sm"
          />

          <div className="flex gap-2">
            <Button onClick={handleImport} disabled={importing || domainCount === 0} className="gap-2">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {ja ? "インポート" : "Import"}
            </Button>
          </div>

          {importResult && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-md">
              <CheckCircle2 className="h-5 w-5" />
              <span>
                {ja
                  ? `${importResult.added.toLocaleString()} / ${importResult.total.toLocaleString()} ドメインを登録しました`
                  : `Imported ${importResult.added.toLocaleString()} / ${importResult.total.toLocaleString()} domains`}
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Scan Card */}
      <Card>
        <CardHeader>
          <CardTitle>{ja ? "バルクスキャン" : "Bulk Scan"}</CardTitle>
          <CardDescription>
            {ja
              ? "未スキャンのドメインを一括でスキャンします。バッチ単位で実行し、進捗をリアルタイム表示します。"
              : "Scan unscanned domains in batches with real-time progress."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button onClick={handleBulkScan} disabled={scanning} className="gap-2">
              {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              {scanning ? (ja ? "スキャン中..." : "Scanning...") : ja ? "スキャン開始" : "Start Scan"}
            </Button>
            {scanning && (
              <Button variant="destructive" onClick={handleStop}>
                {ja ? "停止" : "Stop"}
              </Button>
            )}
          </div>

          {scanResults.length > 0 && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-center bg-muted/50 p-4 rounded-md">
                <div>
                  <div className="text-xl font-bold">{scanTotals.processed.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{ja ? "処理済" : "Processed"}</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-green-600">{scanTotals.succeeded.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{ja ? "成功" : "Succeeded"}</div>
                </div>
                <div>
                  <div className="text-xl font-bold text-red-600">{scanTotals.failed.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">{ja ? "失敗" : "Failed"}</div>
                </div>
              </div>

              {lastResult && (
                <div className="text-sm text-muted-foreground">
                  {ja ? "残り" : "Remaining"}: {lastResult.remaining.toLocaleString()} {ja ? "ドメイン" : "domains"} ・{" "}
                  {ja ? "バッチ" : "Batch"} #{scanResults.length}
                </div>
              )}

              {/* Progress bar */}
              {stats && lastResult && (
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary rounded-full h-2 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        ((parseInt(stats.unscanned) - lastResult.remaining) / Math.max(1, parseInt(stats.unscanned))) *
                          100
                      )}%`
                    }}
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
