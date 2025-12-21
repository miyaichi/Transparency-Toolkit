import { NextRequest, NextResponse } from "next/server"

// Helper generic proxy handler to handle paths not covered by specific routes
// but we want consistent logging/handling.
// NOTE: This acts as a manual proxy for /api/proxy/insite/... since rewrites might be failing in some encironments
// or we want explicit control.

async function proxyRequest(request: NextRequest, subpath: string) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.toString()
  const backendUrl = process.env.BACKEND_URL || "http://localhost:8080"

  // Construct destination URL: BACKEND_URL/api/insite/publisher?...
  // subpath should be "insite/publisher" or similar.
  // The incoming request is /api/proxy/insite/publisher

  // Extract the path after /api/proxy/
  const path = request.nextUrl.pathname.replace(/^\/api\/proxy\//, "")
  const url = `${backendUrl}/api/${path}?${query}`

  console.log(`[Proxy] Forwarding ${request.method} request to: ${url}`)

  try {
    const fetchOptions: RequestInit = {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      const body = await request.text()
      // Only attach body if it's not empty
      if (body) {
        fetchOptions.body = body
      }
    }

    const res = await fetch(url, fetchOptions)

    console.log(`[Proxy] Re-fetch status: ${res.status}`)

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
    console.error(`[Proxy] Error: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request, "")
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, "")
}
