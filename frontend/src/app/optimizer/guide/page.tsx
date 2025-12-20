"use client"

import { Card, CardContent } from "@/components/ui/card"
import { useTranslation } from "@/lib/i18n/language-context"
import { Loader2 } from "lucide-react"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import ReactMarkdown from "react-markdown"
import rehypeRaw from "rehype-raw"
import remarkGfm from "remark-gfm"

function OptimizerGuideContent() {
  const { language } = useTranslation()
  const searchParams = useSearchParams()
  const [content, setContent] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchContent = async () => {
      setLoading(true)
      try {
        const langFolder = language === "ja" ? "ja" : "en"
        const res = await fetch(`/help/${langFolder}/optimizer.md`)

        if (!res.ok) {
          throw new Error(`Failed to load content: ${res.statusText}`)
        }

        const text = await res.text()
        setContent(text)
      } catch (error) {
        console.error("Error fetching content:", error)
        setContent("# Error\n\nFailed to load content. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    fetchContent()
  }, [language])

  // Handle scrolling to anchor if present in URL hash or query param (if needed manually)
  // React-markdown renders ids, so browser's native hash navigation should work if hash is present.
  useEffect(() => {
    if (!loading && content) {
      // Check if there is a hash in the URL and scroll to it
      if (window.location.hash) {
        const id = window.location.hash.substring(1)
        const element = document.getElementById(id)
        if (element) {
          element.scrollIntoView({ behavior: "smooth" })
        }
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

export default function OptimizerGuidePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <OptimizerGuideContent />
    </Suspense>
  )
}
