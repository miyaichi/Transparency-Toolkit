import { fetcher } from "@/lib/api-utils"
import { ValidationRecord, ValidationResponse } from "@/types"
import { useState } from "react"
import useSWR from "swr"

export function isExchangeEntry(r: ValidationRecord): boolean {
  return !!r.domain && !!r.account_id && !r.variable_type
}

export function isFoundInSellers(r: ValidationRecord): boolean {
  return r.seller_type !== undefined || r.seller_name !== undefined
}

export function useAdsTxtData(domain: string, type: "ads.txt" | "app-ads.txt", lang: string = "en") {
  const [filter, setFilter] = useState("")
  const [validOnly, setValidOnly] = useState(false)

  const { data, error, isLoading } = useSWR<ValidationResponse>(
    domain ? `/api/proxy/validator?domain=${domain}&type=${type}&save=true&lang=${lang}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false
    }
  )

  const filteredRecords = data?.records
    .filter((r) => {
      // valid-only: hide exchange entries not found in sellers.json
      if (validOnly && isExchangeEntry(r) && !isFoundInSellers(r)) return false
      if (!filter) return true
      const term = filter.toLowerCase()
      return (
        (r.domain?.toLowerCase().includes(term) ?? false) ||
        (r.account_id?.toLowerCase().includes(term) ?? false) ||
        (r.relationship?.toLowerCase().includes(term) ?? false) ||
        (r.seller_name?.toLowerCase().includes(term) ?? false)
      )
    })
    .sort((a, b) => a.line_number - b.line_number)

  return {
    data,
    error,
    isLoading,
    filter,
    setFilter,
    validOnly,
    setValidOnly,
    filteredRecords
  }
}
