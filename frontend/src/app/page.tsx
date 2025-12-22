"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ValidatorResult } from "@/components/validator/validator-result"
import { Search } from "lucide-react"
import { useState } from "react"

import { extractRootDomain } from "@/lib/domain-utils"
import { useTranslation } from "@/lib/i18n/language-context"

export default function DomainSearchPage() {
  const { t } = useTranslation()
  const [searchInput, setSearchInput] = useState("")
  const [activeDomain, setActiveDomain] = useState("")
  const [searchType, setSearchType] = useState("ads.txt")

  // Robust domain normalization & validation
  const normalizeDomain = (input: string): string => {
    return extractRootDomain(input)
  }

  const isValidDomain = (domain: string) =>
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/.test(domain) &&
    !domain.includes("localhost") &&
    !domain.includes("127.0.0.1")

  const handleSearch = () => {
    const normalized = normalizeDomain(searchInput)
    if (normalized && isValidDomain(normalized)) {
      setActiveDomain(normalized)
    }
  }

  const normalizedInput = normalizeDomain(searchInput)
  const isSearchDisabled = !searchInput || !normalizedInput || !isValidDomain(normalizedInput)

  return (
    <div className="container mx-auto py-10 space-y-8 max-w-6xl">
      {/* Hero / Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
          {t("common.title")}
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{t("common.validatorDescription")}</p>
      </div>

      {/* Search Bar */}
      <div className="flex w-full max-w-2xl mx-auto items-center space-x-2 p-2 bg-white rounded-xl shadow-lg border transition-all focus-within:ring-2 focus-within:ring-primary/20">
        <div className="w-[180px] shrink-0">
          <Select value={searchType} onValueChange={setSearchType}>
            <SelectTrigger className="h-12 border-0 bg-transparent focus:ring-0 shadow-none text-base">
              <SelectValue placeholder={t("common.type")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ads.txt">ads.txt</SelectItem>
              <SelectItem value="app-ads.txt">app-ads.txt</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-px h-8 bg-border" />
        <Input
          placeholder={t("common.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !isSearchDisabled && handleSearch()}
          className="border-0 shadow-none focus-visible:ring-0 text-lg h-12"
        />
        <Button size="lg" onClick={handleSearch} disabled={isSearchDisabled} className="h-12 px-8 rounded-lg shadow-sm">
          <Search className="mr-2 h-5 w-5" /> {t("common.search")}
        </Button>
      </div>

      {/* Results Area */}
      {activeDomain ? (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">
              {t("common.resultsFor")} <span className="text-primary">{activeDomain}</span>
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActiveDomain("")
                setSearchInput("")
              }}
            >
              {t("common.clear")}
            </Button>
          </div>

          <div className="mt-6">
            {searchType === "ads.txt" && <ValidatorResult domain={activeDomain} type="ads.txt" />}
            {searchType === "app-ads.txt" && <ValidatorResult domain={activeDomain} type="app-ads.txt" />}
          </div>
        </div>
      ) : (
        <div className="text-center py-20 opacity-50">
          <div className="inline-block p-6 rounded-full bg-muted mb-4">
            <Search className="h-12 w-12 text-muted-foreground" />
          </div>

          <p className="text-lg font-medium text-muted-foreground">{t("common.enterDomain")}</p>
        </div>
      )}
    </div>
  )
}
