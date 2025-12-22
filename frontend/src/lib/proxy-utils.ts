import { NextResponse } from "next/server"

export const DEFAULT_BACKEND_URL = "http://127.0.0.1:8080"

export function getBackendUrl(defaultUrl: string = DEFAULT_BACKEND_URL): string {
  // In production outside of Vercel/Next dev, rely on env var
  // process.env.BACKEND_URL should be set in Cloud Run
  if (process.env.NODE_ENV === "production" && !process.env.BACKEND_URL) {
    console.error("CRITICAL: BACKEND_URL not set in production")
  }
  return process.env.BACKEND_URL || defaultUrl
}

interface ProxyOptions {
  timeoutMs?: number
  defaultBackendUrl?: string
}

export async function proxyRequest(request: Request, targetPath: string, options: ProxyOptions = {}) {
  const { timeoutMs = 30000, defaultBackendUrl = DEFAULT_BACKEND_URL } = options

  const backendUrl = getBackendUrl(defaultBackendUrl)

  // Basic Path Sanitization
  if (targetPath.includes("..")) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 })
  }

  const urlObj = new URL(request.url)
  const searchParams = urlObj.search

  // Ensure leading slash
  const cleanPath = targetPath.startsWith("/") ? targetPath : `/${targetPath}`
  const finalUrl = `${backendUrl}${cleanPath}${searchParams}`

  console.log(`[Proxy] Forwarding ${request.method} to: ${finalUrl}`)

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: {
        "Content-Type": "application/json"
      },
      signal: controller.signal,
      cache: "no-store"
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      const body = await request.text()
      if (body) {
        fetchOptions.body = body
      }
    }

    const res = await fetch(finalUrl, fetchOptions)
    clearTimeout(timeoutId)

    // Pass through status code if not OK
    if (!res.ok) {
      const text = await res.text()
      try {
        // Try to parse error as JSON to keep structure if possible
        const jsonError = JSON.parse(text)
        return NextResponse.json(jsonError, { status: res.status })
      } catch {
        return new NextResponse(text, { status: res.status })
      }
    }

    const text = await res.text()
    const contentType = res.headers.get("content-type")

    // Attempt to parse as JSON if content-type suggests it or if it looks like JSON
    if (contentType && contentType.includes("application/json")) {
      try {
        const data = JSON.parse(text)
        return NextResponse.json(data)
      } catch (e) {
        console.error(`[Proxy] Failed to parse JSON from backend: ${e}`)
        // Fallback to text if parsing fails but it was supposed to be JSON
        return new NextResponse(text, {
          status: 500, // Or maybe keep original status?
          headers: { "Content-Type": "text/plain" }
        })
      }
    } else {
      // Return as text/html/etc directly
      return new NextResponse(text, {
        status: res.status,
        headers: {
          "Content-Type": contentType || "text/plain"
        }
      })
    }
  } catch (error: any) {
    clearTimeout(timeoutId)
    if (error.name === "AbortError") {
      console.error(`[Proxy] Timeout: ${finalUrl}`)
      return NextResponse.json({ error: "Upstream timeout" }, { status: 504 })
    }

    // Check for connection refused (common in dev/deploy misconfig)
    if (error.cause?.code === "ECONNREFUSED") {
      console.error(`[Proxy] Connection Refused to ${finalUrl}. Check BACKEND_URL or if backend is running.`)
      return NextResponse.json({ error: "Backend unavailable" }, { status: 503 })
    }

    console.error(`[Proxy] Error: ${error.message}`)
    return NextResponse.json({ error: "Internal Proxy Error" }, { status: 500 })
  }
}
