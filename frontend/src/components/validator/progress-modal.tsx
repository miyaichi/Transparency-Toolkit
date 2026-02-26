"use client"

import { useEffect, useState, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, AlertCircle, Zap, X } from "lucide-react"
import { useTranslation } from "@/lib/i18n/language-context"

interface ProgressModalProps {
  progressId: string
  isOpen: boolean
  onClose: () => void
  onComplete?: () => void
}

interface ProgressResponse {
  progress_id: string
  overall_status: "processing" | "completed" | "partial"
  summary: {
    processing: number
    completed: number
    failed: number
  }
  domains: {
    processing: string[]
    completed: string[]
    failed: Array<{
      domain: string
      error?: string
    }>
  }
}

export function ProgressModal({
  progressId,
  isOpen,
  onClose,
  onComplete,
}: ProgressModalProps) {
  const { t } = useTranslation()
  const [progress, setProgress] = useState<ProgressResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasCompleted, setHasCompleted] = useState(false)
  const [shouldStopPolling, setShouldStopPolling] = useState(false)

  // Polling logic
  const fetchProgress = useCallback(async () => {
    if (!progressId || shouldStopPolling) return

    try {
      setLoading(true)

      const response = await fetch(`/api/adstxt/progress/${progressId}`)

      if (response.status === 404) {
        setError("Progress tracking expired. Please try validation again.")
        setShouldStopPolling(true)
        return
      }

      if (!response.ok) {
        setError(`HTTP ${response.status}`)
        setShouldStopPolling(true)
        return
      }

      setError(null)
      const data: ProgressResponse = await response.json()
      setProgress(data)

      // Auto-close when completed
      if (data.overall_status === "completed" && !hasCompleted) {
        setHasCompleted(true)
        setShouldStopPolling(true)
        // Delay closing to let user see completion
        setTimeout(() => {
          onComplete?.()
          onClose()
        }, 1500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch progress")
      setShouldStopPolling(true)
    } finally {
      setLoading(false)
    }
  }, [progressId, onClose, onComplete, hasCompleted, shouldStopPolling])

  // Auto-poll every 500ms
  useEffect(() => {
    if (!isOpen || !progressId || shouldStopPolling) return

    // Fetch immediately on open
    fetchProgress()

    // Then poll every 500ms
    const interval = setInterval(fetchProgress, 500)

    return () => clearInterval(interval)
  }, [isOpen, progressId, fetchProgress, shouldStopPolling])

  if (!isOpen) return null

  if (!progress && loading && !error) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6">
          <div className="flex flex-col items-center space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <h2 className="text-lg font-semibold">
              {t("validator.fetchingProgress") || "Fetching sellers.json..."}
            </h2>
            <p className="text-sm text-muted-foreground text-center">
              This may take a few moments...
            </p>
          </div>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6">
          <div className="flex items-start justify-between mb-4">
            <h2 className="text-lg font-semibold text-destructive">
              {t("common.error") || "Error"}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button onClick={onClose} className="w-full mt-4">
            Close
          </Button>
        </Card>
      </div>
    )
  }

  if (!progress) return null

  const totalDomains =
    progress.summary.processing +
    progress.summary.completed +
    progress.summary.failed
  const progressPercent =
    totalDomains > 0
      ? Math.round(
          ((progress.summary.completed + progress.summary.failed) / totalDomains) *
            100
        )
      : 0

  const isCompleted = progress.overall_status === "completed"

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-card border-b p-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isCompleted ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <h2 className="text-lg font-semibold">
                  {t("validator.completionTitle") || "Sellers.json Fetching Complete"}
                </h2>
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <h2 className="text-lg font-semibold">
                  {t("validator.fetchingProgress") || "Fetching sellers.json..."}
                </h2>
              </>
            )}
          </div>
          {!isCompleted && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {progress.summary.completed + progress.summary.failed}/{totalDomains}{" "}
                {t("validator.domainsProcessed") || "domains processed"}
              </span>
              <span className="text-muted-foreground">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {/* Processing Domains */}
          {progress.summary.processing > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <h3 className="font-semibold text-sm">
                  {t("validator.processing") || "Processing"} ({progress.summary.processing})
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {progress.domains.processing.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center gap-2 text-sm p-2 bg-blue-50 dark:bg-blue-950 rounded border border-blue-200 dark:border-blue-900"
                  >
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-muted-foreground truncate">{domain}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed Domains */}
          {progress.summary.completed > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h3 className="font-semibold text-sm">
                  {t("validator.completed") || "Completed"} ({progress.summary.completed})
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {progress.domains.completed.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center gap-2 text-sm p-2 bg-green-50 dark:bg-green-950 rounded border border-green-200 dark:border-green-900"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                    <span className="text-muted-foreground truncate">{domain}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failed Domains */}
          {progress.summary.failed > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <h3 className="font-semibold text-sm">
                  {t("validator.failed") || "Failed"} ({progress.summary.failed})
                </h3>
              </div>
              <div className="space-y-2">
                {progress.domains.failed.map((item) => (
                  <div
                    key={item.domain}
                    className="flex items-start gap-2 text-sm p-3 bg-amber-50 dark:bg-amber-950 rounded border border-amber-200 dark:border-amber-900"
                  >
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {item.domain}
                      </div>
                      {item.error && (
                        <div className="text-xs text-muted-foreground mt-1 break-words">
                          {item.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Message */}
          {isCompleted && (
            <Alert>
              <Zap className="h-4 w-4" />
              <AlertTitle>Complete</AlertTitle>
              <AlertDescription>
                {t("validator.fetchComplete") ||
                  "All sellers.json fetching completed! Your validation results are now updated."}
              </AlertDescription>
            </Alert>
          )}
        </div>
      </Card>
    </div>
  )
}
