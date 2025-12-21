import { fetcher } from "@/lib/api-utils"
import { ValidationResponse } from "@/types"
import { useState } from "react"
import useSWR from "swr"

export function useAdsTxtData(domain: string, type: "ads.txt" | "app-ads.txt") {
  const [filter, setFilter] = useState("")

  const { data, error, isLoading } = useSWR<ValidationResponse>(
    domain ? `/api/proxy/validator?domain=${domain}&type=${type}&save=true` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false
    }
  )

  const filteredRecords = data?.records
    .filter((r) => {
      if (!filter) return true
      const term = filter.toLowerCase()
      return (
        (r.domain?.toLowerCase().includes(term) ?? false) ||
        (r.account_id?.toLowerCase().includes(term) ?? false) ||
        (r.relationship?.toLowerCase().includes(term) ?? false)
      )
    })
    .sort((a, b) => a.line_number - b.line_number)

  return {
    data,
    error,
    isLoading,
    filter,
    setFilter,
    filteredRecords
  }
}
