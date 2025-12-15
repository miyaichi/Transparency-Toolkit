"use client"

import { createContext, ReactNode, useContext, useEffect, useState } from "react"
import { Language, translations } from "./translations" // Adjust import path

type TranslationKey = keyof typeof translations.common

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: string, params?: Record<string, string>) => string
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en")

  // Load language from local storage or browser preference
  useEffect(() => {
    const savedLanguage = localStorage.getItem("language") as Language
    if (savedLanguage && (savedLanguage === "en" || savedLanguage === "ja")) {
      setLanguageState(savedLanguage)
    } else {
      const browserLang = navigator.language.startsWith("ja") ? "ja" : "en"
      setLanguageState(browserLang)
    }
  }, [])

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("language", lang)
  }

  /**
   * Translate function
   * Supports dot notation e.g. 'common.title' or 'warnings.invalidFormat.title'
   */
  const t = (path: string, params?: Record<string, string>): string => {
    const keys = path.split(".")
    let current: any = translations

    for (const key of keys) {
      if (current[key] === undefined) {
        console.warn(`Translation key not found: ${path}`)
        return path
      }
      current = current[key]
    }

    if (current && typeof current === "object" && current[language]) {
      let text = current[language]
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          text = text.replace(`{{${key}}}`, value)
        })
      }
      return text
    }

    // Fallback?
    return path
  }

  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>
}

export function useTranslation() {
  const context = useContext(LanguageContext)
  if (context === undefined) {
    throw new Error("useTranslation must be used within a LanguageProvider")
  }
  return context
}
