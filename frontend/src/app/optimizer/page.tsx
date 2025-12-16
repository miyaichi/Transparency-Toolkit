"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useTranslation } from "@/lib/i18n/language-context"
import { AlertCircle, ArrowRight, Check, Download, FileText, Sparkles, Wand2 } from "lucide-react"
import { useEffect, useState } from "react"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function OptimizerPage() {
  const { t } = useTranslation()

  // State for inputs
  const [domain, setDomain] = useState("")
  const [inputType, setInputType] = useState<"text" | "url">("url")
  const [fileType, setFileType] = useState<"ads.txt" | "app-ads.txt">("ads.txt")
  const [inputContent, setInputContent] = useState("")
  const [isFetching, setIsFetching] = useState(false)
  const [ownerDomainInput, setOwnerDomainInput] = useState("")

  // State for optimization steps
  const [steps, setSteps] = useState({
    removeErrors: true,
    invalidAction: "remove" as "remove" | "comment",
    duplicateAction: "remove" as "remove" | "comment",
    fixOwnerDomain: false,
    fixManagerDomain: false,
    managerAction: "remove" as "remove" | "comment",
    verifySellers: false,
    sellersAction: "remove" as "remove" | "comment"
  })

  // State for results
  const [optimizedContent, setOptimizedContent] = useState("")
  const [stats, setStats] = useState({
    originalLines: 0,
    finalLines: 0,
    removedCount: 0,
    errorsFound: 0
  })

  // Reset owner input when domain changes if user hasn't typed anything custom?
  // For now, auto-fill it to match domain by default.
  useEffect(() => {
    setOwnerDomainInput(domain)
  }, [domain])

  const handleFetch = async () => {
    if (!domain) return
    setIsFetching(true)
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/optimizer/fetch`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain, fileType })
        }
      )

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || "Fetch failed")
      }

      const data = await response.json()
      setInputContent(data.content || "")
      // Keep inputType as URL
    } catch (e) {
      console.error("Fetch failed", e)
      alert("Failed to fetch ads.txt from domain. Please check the domain and try again.")
    } finally {
      setIsFetching(false)
    }
  }

  // Mock processing effect replaced with real backend call
  useEffect(() => {
    if (!inputContent) {
      setOptimizedContent("")
      setStats({ originalLines: 0, finalLines: 0, removedCount: 0, errorsFound: 0 })
      return
    }

    // Set initial optimized content to input content immediately so preview isn't empty while fetching
    if (!optimizedContent) {
      setOptimizedContent(inputContent)
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/optimizer/process`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: inputContent,
              domain: domain,
              ownerDomain: ownerDomainInput || domain, // Send explicit owner domain or fallback to publisher domain
              fileType: fileType,
              steps: {
                removeErrors: steps.removeErrors,
                invalidAction: steps.invalidAction,
                duplicateAction: steps.duplicateAction,
                fixOwnerDomain: steps.fixOwnerDomain,
                fixManagerDomain: steps.fixManagerDomain,
                managerAction: steps.managerAction,
                verifySellers: steps.verifySellers,
                sellersAction: steps.sellersAction
              }
            })
          }
        )

        if (!response.ok) {
          throw new Error("API Error")
        }

        const data = await response.json()
        setOptimizedContent(data.optimizedContent)
        setStats(data.stats)
      } catch (e) {
        console.error("Optimization failed", e)
        // Fallback or error state handling
      }
    }, 500) // 500ms debounce

    return () => clearTimeout(timer)
  }, [inputContent, steps, domain, fileType, ownerDomainInput])

  const handleDownload = () => {
    const contentToDownload = optimizedContent || inputContent
    const blob = new Blob([contentToDownload], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = fileType
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // Sample data for demo
  const loadSampleData = () => {
    const sample = `# ${fileType} from ${domain || "example.com"}
google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
google.com, pub-0000000000000000, DIRECT, f08c47fec0942fa0
appnexus.com, 12345, DIRECT
bad-line-here
rubiconproject.com, 9999, RESELLER, 1234abcd
# End of file`
    setInputContent(sample)
  }

  return (
    <div className="container mx-auto py-10 space-y-8 max-w-7xl">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-3">
          <div className="p-3 bg-blue-100 rounded-full dark:bg-blue-900/30">
            <Wand2 className="h-8 w-8 text-blue-600 dark:text-blue-400" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Ads.txt Optimizer
          </h1>
        </div>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Optimize your ads.txt reliability by removing errors and verifying against sellers.json.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Input & Configuration */}
        <div className="lg:col-span-5 space-y-6">
          {/* Input Card */}
          <Card className="border-muted/60 shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <FileText className="mr-2 h-5 w-5 text-muted-foreground" />
                Source
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Publisher Domain (Required)</Label>
                <Input
                  id="domain"
                  placeholder="e.g. nytimes.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-4">
                <Button
                  variant={inputType === "url" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInputType("url")}
                  className="w-1/2"
                >
                  Fetch URL
                </Button>
                <Button
                  variant={inputType === "text" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setInputType("text")}
                  className="w-1/2"
                >
                  Paste Text
                </Button>
              </div>

              {inputType === "url" ? (
                <div className="space-y-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Target File</Label>
                    <Select value={fileType} onValueChange={(v: "ads.txt" | "app-ads.txt") => setFileType(v)}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ads.txt">ads.txt</SelectItem>
                        <SelectItem value="app-ads.txt">app-ads.txt</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex space-x-2">
                    <Input
                      disabled
                      value={domain ? `https://${domain}/${fileType}` : `https://.../${fileType}`}
                      className="bg-muted font-mono text-sm"
                    />
                    <Button onClick={handleFetch} disabled={!domain || isFetching}>
                      {isFetching ? "Fetching..." : "Fetch"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    We will fetch the live {fileType} file from the domain above.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 animate-in fade-in zoom-in-95 duration-200">
                  <Textarea
                    placeholder="# Paste content here..."
                    className="min-h-[200px] font-mono text-sm"
                    value={inputContent}
                    onChange={(e) => setInputContent(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button variant="ghost" size="sm" onClick={loadSampleData} className="text-xs">
                      Load Sample
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Steps Card */}
          <Card className="border-muted/60 shadow-md bg-slate-50 dark:bg-slate-900/50">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-amber-500" />
                Optimization Steps
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Step 1 */}
              <div className="flex items-start space-x-4 p-3 rounded-lg hover:bg-white transition-colors dark:hover:bg-slate-800">
                <Switch
                  id="s1"
                  checked={steps.removeErrors}
                  onCheckedChange={(c) => setSteps((prev) => ({ ...prev, removeErrors: c }))}
                  className="mt-1"
                />
                <div className="space-y-4 w-full">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="s1" className="text-base font-medium cursor-pointer">
                      1. Clean Up
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Handle format errors, duplicate lines, and invalid comments.
                  </p>

                  {steps.removeErrors && (
                    <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                      {/* Invalid Records Action */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Invalid Records
                        </Label>
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center space-x-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="invalidAction"
                              value="remove"
                              checked={steps.invalidAction === "remove"}
                              onChange={() => setSteps((s) => ({ ...s, invalidAction: "remove" }))}
                              className="accent-blue-600"
                            />
                            <span>Remove</span>
                          </label>
                          <label className="flex items-center space-x-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="invalidAction"
                              value="comment"
                              checked={steps.invalidAction === "comment"}
                              onChange={() => setSteps((s) => ({ ...s, invalidAction: "comment" }))}
                              className="accent-blue-600"
                            />
                            <span>Comment out</span>
                          </label>
                        </div>
                      </div>

                      {/* Duplicates Action */}
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Duplicates
                        </Label>
                        <div className="flex items-center space-x-4">
                          <label className="flex items-center space-x-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="duplicateAction"
                              value="remove"
                              checked={steps.duplicateAction === "remove"}
                              onChange={() => setSteps((s) => ({ ...s, duplicateAction: "remove" }))}
                              className="accent-blue-600"
                            />
                            <span>Remove</span>
                          </label>
                          <label className="flex items-center space-x-2 text-sm cursor-pointer">
                            <input
                              type="radio"
                              name="duplicateAction"
                              value="comment"
                              checked={steps.duplicateAction === "comment"}
                              onChange={() => setSteps((s) => ({ ...s, duplicateAction: "comment" }))}
                              className="accent-blue-600"
                            />
                            <span>Comment out</span>
                          </label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex items-start space-x-4 p-3 rounded-lg hover:bg-white transition-colors dark:hover:bg-slate-800">
                <Switch
                  id="s2"
                  checked={steps.fixOwnerDomain}
                  onCheckedChange={(c) => setSteps((prev) => ({ ...prev, fixOwnerDomain: c }))}
                  className="mt-1"
                />
                <div className="space-y-4 w-full">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="s2" className="text-base font-medium cursor-pointer">
                      2. Owner Domain Verification
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Ensure OWNERDOMAIN matches the specified domain. If missing, it will be added.
                  </p>

                  {steps.fixOwnerDomain && (
                    <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Label
                        htmlFor="ownerDomain"
                        className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
                        Owner Domain
                      </Label>
                      <Input
                        id="ownerDomain"
                        placeholder={domain || "example.com"}
                        value={ownerDomainInput}
                        onChange={(e) => setOwnerDomainInput(e.target.value)}
                        className="h-9"
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave empty to use Publisher Domain ({domain || "example.com"}).
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 3: Manager Domain */}
              <div className="flex items-start space-x-4 p-3 rounded-lg hover:bg-white transition-colors dark:hover:bg-slate-800">
                <Switch
                  id="s3"
                  checked={steps.fixManagerDomain}
                  onCheckedChange={(c) => setSteps((prev) => ({ ...prev, fixManagerDomain: c }))}
                  className="mt-1"
                />
                <div className="space-y-4 w-full">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="s3" className="text-base font-medium cursor-pointer">
                      3. Manager Domain Optimization
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">Resolve old or unnecessary MANAGERDOMAIN entries.</p>

                  {steps.fixManagerDomain && (
                    <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Action
                      </Label>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="managerAction"
                            value="remove"
                            checked={steps.managerAction === "remove"}
                            onChange={() => setSteps((s) => ({ ...s, managerAction: "remove" }))}
                            className="accent-blue-600"
                          />
                          <span>Remove</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="managerAction"
                            value="comment"
                            checked={steps.managerAction === "comment"}
                            onChange={() => setSteps((s) => ({ ...s, managerAction: "comment" }))}
                            className="accent-blue-600"
                          />
                          <span>Comment out</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex items-start space-x-4 p-3 rounded-lg hover:bg-white transition-colors dark:hover:bg-slate-800">
                <Switch
                  id="s4"
                  checked={steps.verifySellers}
                  onCheckedChange={(c) => setSteps((prev) => ({ ...prev, verifySellers: c }))}
                  className="mt-1"
                />
                <div className="space-y-4 w-full">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="s4" className="text-base font-medium cursor-pointer">
                      4. Sellers.json Verification
                    </Label>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Remove entries that do not validate against upstream sellers.json files.
                  </p>

                  {steps.verifySellers && (
                    <div className="pl-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Action
                      </Label>
                      <div className="flex items-center space-x-4">
                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="sellersAction"
                            value="remove"
                            checked={steps.sellersAction === "remove"}
                            onChange={() => setSteps((s) => ({ ...s, sellersAction: "remove" }))}
                            className="accent-blue-600"
                          />
                          <span>Remove</span>
                        </label>
                        <label className="flex items-center space-x-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="sellersAction"
                            value="comment"
                            checked={steps.sellersAction === "comment"}
                            onChange={() => setSteps((s) => ({ ...s, sellersAction: "comment" }))}
                            className="accent-blue-600"
                          />
                          <span>Comment out</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Preview & Results */}
        <div className="lg:col-span-7 space-y-6">
          <Card className="h-full border-muted/60 shadow-lg flex flex-col">
            <CardHeader className="border-b bg-slate-50/50 dark:bg-slate-900/50">
              <div className="flex items-center justify-between">
                <CardTitle>Optimization Preview</CardTitle>
                <div className="flex items-center text-sm space-x-4">
                  <div className="flex flex-col items-end">
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">Before</span>
                    <span className="font-mono font-medium">{stats.originalLines} lines</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col items-end">
                    <span className="text-muted-foreground text-xs uppercase tracking-wider">After</span>
                    <span className="font-mono font-bold text-emerald-600">{stats.finalLines} lines</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0 relative">
              <div className="absolute inset-0 p-4">
                <div className="w-full h-full bg-slate-950 rounded-md p-4 overflow-auto border border-slate-800">
                  <pre className="font-mono text-sm text-slate-300 whitespace-pre">
                    {optimizedContent || inputContent || (
                      <span className="text-slate-600 italic">Preview will appear here...</span>
                    )}
                  </pre>
                </div>
              </div>
            </CardContent>
            <CardFooter className="border-t bg-slate-50/50 dark:bg-slate-900/50 p-4">
              <div className="w-full flex items-center justify-between">
                <div className="flex space-x-4 text-sm">
                  {stats.removedCount > 0 && (
                    <span className="flex items-center text-amber-600 font-medium">
                      <AlertCircle className="mr-1.5 h-4 w-4" />
                      {stats.removedCount} lines removed
                    </span>
                  )}
                  {stats.errorsFound > 0 && (
                    <span className="flex items-center text-red-600 font-medium">
                      <AlertCircle className="mr-1.5 h-4 w-4" />
                      {stats.errorsFound} format errors
                    </span>
                  )}
                  {stats.removedCount === 0 && inputContent && (
                    <span className="flex items-center text-emerald-600 font-medium">
                      <Check className="mr-1.5 h-4 w-4" />
                      No issues found
                    </span>
                  )}
                </div>
                <Button onClick={handleDownload} disabled={!inputContent} className="bg-blue-600 hover:bg-blue-700">
                  <Download className="mr-2 h-4 w-4" />
                  Download ads.txt / app-ads.txt
                </Button>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
