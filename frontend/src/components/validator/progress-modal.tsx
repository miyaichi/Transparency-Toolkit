"use client"

import { useEffect, useState, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Loader2, CheckCircle2, AlertCircle, Zap } from "lucide-react"
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

  // Polling logic
  const fetchProgress = useCallback(async () => {
    if (!progressId) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/adstxt/progress/${progressId}`)

      if (response.status === 404) {
        setError("Progress tracking expired. Please try validation again.")
        return
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data: ProgressResponse = await response.json()
      setProgress(data)

      // Auto-close when completed
      if (data.overall_status === "completed" && !hasCompleted) {
        setHasCompleted(true)
        // Delay closing to let user see completion
        setTimeout(() => {
          onComplete?.()
          onClose()
        }, 1500)
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch progress"
      )
    } finally {
      setLoading(false)
    }
  }, [progressId, onClose, onComplete, hasCompleted])

  // Auto-poll every 500ms
  useEffect(() => {
    if (!isOpen || !progressId) return

    // Fetch immediately on open
    fetchProgress()

    // Then poll every 500ms
    const interval = setInterval(fetchProgress, 500)

    return () => clearInterval(interval)
  }, [isOpen, progressId, fetchProgress])

  if (!progress && loading && !error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("validator.fetchingProgress") || "Fetching sellers.json..."}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (error) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {t("common.error") || "Error"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
          ((progress.summary.completed + progress.summary.failed) /
            totalDomains) *
            100
        )
      : 0

  const isCompleted = progress.overall_status === "completed"

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCompleted ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                {t("validator.completionTitle") || "Sellers.json Fetching Complete"}
              </>
            ) : (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                {t("validator.fetchingProgress") || "Fetching sellers.json..."}
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {progress.summary.completed + progress.summary.failed}/
                {totalDomains}{" "}
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
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <h3 className="font-semibold text-sm">
                  {t("validator.processing") || "Processing"} (
                  {progress.summary.processing})
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {progress.domains.processing.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center gap-2 text-sm p-2 bg-blue-50 dark:bg-blue-950 rounded"
                  >
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse" />
                    <span className="text-muted-foreground">{domain}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Completed Domains */}
          {progress.summary.completed > 0 && (
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <h3 className="font-semibold text-sm">
                  {t("validator.completed") || "Completed"} (
                  {progress.summary.completed})
                </h3>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {progress.domains.completed.map((domain) => (
                  <div
                    key={domain}
                    className="flex items-center gap-2 text-sm p-2 bg-green-50 dark:bg-green-950 rounded"
                  >
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="text-muted-foreground">{domain}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Failed Domains */}
          {progress.summary.failed > 0 && (
            <Card className="p-4 border-amber-200 bg-amber-50 dark:bg-amber-950 dark:border-amber-900">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <h3 className="font-semibold text-sm">
                  {t("validator.failed") || "Failed"} (
                  {progress.summary.failed})
                </h3>
              </div>
              <div className="space-y-2">
                {progress.domains.failed.map((item) => (
                  <div
                    key={item.domain}
                    className="flex items-start gap-2 text-sm p-2 bg-white dark:bg-background rounded border border-amber-200 dark:border-amber-900"
                  >
                    <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div className="font-medium text-foreground">
                        {item.domain}
                      </div>
                      {item.error && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {item.error}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Status Message */}
          {isCompleted && (
            <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-900">
              <Zap className="h-5 w-5 text-green-600" />
              <p className="text-sm text-green-800 dark:text-green-200">
                {t("validator.fetchComplete") ||
                  "All sellers.json fetching completed! Your validation results are now updated."}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
