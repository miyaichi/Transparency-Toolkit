"use client"

import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "@/lib/i18n/language-context"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import remarkGfm from "remark-gfm"

export default function WarningsPage() {
  const { language } = useTranslation()
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true)
      try {
        // Map language to supported folders (en, ja)
        const langFolder = language === "ja" ? "ja" : "en"
        const res = await fetch(`/help/${langFolder}/warnings.md`)

        if (!res.ok) {
          throw new Error(`Failed to load warning content: ${res.statusText}`)
        }

        const text = await res.text()
        setContent(text)
      } catch (error) {
        console.error("Error fetching warning content:", error)
        setContent("# Error\n\nFailed to load content. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [language])

  // Scroll to hash execution after content matches
  useEffect(() => {
    if (!loading && content && typeof window !== "undefined") {
      const hash = window.location.hash
      if (hash) {
        // Wait a tick for rendering
        setTimeout(() => {
          const id = hash.replace("#", "")
          const element = document.getElementById(id)
          if (element) {
            // Scroll with offset for fixed header if any (though scroll-mt usually handles it)
            element.scrollIntoView({ behavior: "smooth" })
          }
        }, 300) // Increase delay slightly to ensure markdown rendering
      }
    }
  }, [loading, content])

  if (loading) {
    return (
      <div className="flex h-[50vh] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10 max-w-4xl space-y-8">
      <Card>
        <CardContent className="pt-6 prose dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-a:scroll-mt-24">
          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
            {content}
          </ReactMarkdown>
        </CardContent>
      </Card>
    </div>
  )
}
