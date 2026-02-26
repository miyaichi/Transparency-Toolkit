"use client"

import { useTranslation } from "@/lib/i18n/language-context"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import { useAdsTxtData } from "@/hooks/use-ads-txt-data"
import { ProgressModal } from "./progress-modal"

type Props = {
  domain: string
  type: "ads.txt" | "app-ads.txt"
}

export function ValidatorResult({ domain, type }: Props) {
  const { t, language } = useTranslation()

  const { data, error, isLoading, filter, setFilter, filteredRecords } = useAdsTxtData(domain, type)

  // Progress modal state
  const [showProgressModal, setShowProgressModal] = useState(false)
  const [progressId, setProgressId] = useState<string | null>(null)

  // Show progress modal when validation returns processing status
  useEffect(() => {
    if (data?.is_processing && data?.progress_id) {
      setProgressId(data.progress_id)
      setShowProgressModal(true)
    } else if (!data?.is_processing) {
      // Auto-close modal when processing is complete
      setShowProgressModal(false)
    }
  }, [data?.is_processing, data?.progress_id])

  // Download functionality
  const handleDownload = () => {
    if (!data?.records) return
    const headers = [
      t("common.line"),
      t("common.advertisingSystem"),
      t("common.publisherAccountId"),
      t("common.relationship"),
      t("common.certId"),
      t("common.status"),
      t("common.message")
    ]
    const csvContent = [
      headers.join(","),
      ...data.records.map((r) => {
        // Handle variable records where variable_type/value replaces domain/account_id
        const col1 = r.variable_type || r.domain || ""
        const col2 = r.value || r.account_id || ""

        return [
          r.line_number,
          col1,
          col2,
          r.relationship || "",
          r.certification_authority_id || "", // Fixed: use certification_authority_id instead of account_type
          r.is_valid ? "OK" : "ERROR",
          r.warning_message || r.validation_key || ""
        ]
          .map((f) => `"${String(f).replace(/"/g, '""')}"`)
          .join(",")
      })
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = `${domain}_${type}_report.csv`
    link.click()
  }

  // Helper to convert camelCase to kebab-case for anchor links
  const toKebabCase = (str: string) => {
    return str.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()
  }

  if (!domain) {
    return (
      <div className="text-muted-foreground text-center py-20 bg-muted/20 rounded-lg">{t("common.enterDomain")}</div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6 text-red-500 bg-red-50 rounded-lg border border-red-200">
        <h3 className="font-semibold mb-2">{t("common.failedToLoad")}</h3>
        <p>{error.message}</p>
        <p className="text-sm mt-2 text-muted-foreground">Backend URL: /api/proxy/validator</p>
      </div>
    )
  }

  if (!data) return null

  // Check if we have missing sellers.json warnings
  const hasMissingSellers = data.records.some((r) => r.validation_key === "noSellersJson")

  // Calculate stats safely
  const directCount = data.stats.direct_count || 0
  const resellerCount = data.stats.reseller_count || 0
  const totalExchangeEntries = directCount + resellerCount

  return (
    <div className="space-y-6">
      {/* Progress Modal */}
      {progressId && (
        <ProgressModal
          progressId={progressId}
          isOpen={showProgressModal}
          onClose={() => {
            setShowProgressModal(false)
            setProgressId(null)
          }}
          onComplete={() => {
            // Auto-refresh data after progress completes
            setProgressId(null)
          }}
        />
      )}
    </div>
  )
}
