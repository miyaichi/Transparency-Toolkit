import { NextRequest, NextResponse } from "next/server"

// Explicit proxy for /api/proxy/insite/... -> Backend /api/insite/...
async function proxyRequest(request: NextRequest) {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8080"

  // Extract path suffix. Request URL is like /api/proxy/insite/publisher
  // path should be "publisher" (or whatever follows insite/)

  const urlObj = new URL(request.url)
  const pathname = urlObj.pathname
  // Remove /api/proxy/insite/ prefix
  const subpath = pathname.replace(/^\/api\/proxy\/insite\//, "")
  const query = urlObj.search

  const targetUrl = `${backendUrl}/api/insite/${subpath}${query}`

  console.log(`[Proxy Insite] Forwarding ${request.method} to: ${targetUrl}`)

  try {
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: {
        "Content-Type": "application/json"
      },
      cache: "no-store"
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      const body = await request.text()
      if (body) {
        fetchOptions.body = body
      }
    }

    const res = await fetch(targetUrl, fetchOptions)

    if (!res.ok) {
      const text = await res.text()
      return new NextResponse(text, { status: res.status })
    }

    const contentType = res.headers.get("content-type")
    if (contentType && contentType.includes("application/json")) {
      const data = await res.json()
      return NextResponse.json(data)
    } else {
      const text = await res.text()
      return new NextResponse(text)
    }
  } catch (error: any) {
    console.error(`[Proxy Insite] Error: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request)
}

export async function POST(request: NextRequest) {
  return proxyRequest(request)
}
