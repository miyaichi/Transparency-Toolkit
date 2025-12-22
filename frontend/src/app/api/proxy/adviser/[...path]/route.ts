import { NextRequest, NextResponse } from "next/server"

// Explicit proxy for /api/proxy/adviser/... -> Backend /api/adviser/...
async function proxyRequest(request: NextRequest) {
  // Use 127.0.0.1 instead of localhost to avoid Node 18+ IPv6 issues
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8080"

  const urlObj = request.nextUrl
  const pathname = urlObj.pathname

  // Remove /api/proxy/adviser/ prefix (handling optional trailing slash)
  const subpath = pathname.replace(/^\/api\/proxy\/adviser\/?/, "")
  const query = urlObj.search

  // Construct target URL
  // Ensure we don't have double slashes if subpath is empty or starts with slash (though regex handles prefix)
  const cleanSubpath = subpath.startsWith("/") ? subpath.substring(1) : subpath
  const targetUrl = `${backendUrl}/api/adviser/${cleanSubpath}${query}`

  console.log(`[Proxy Adviser] Forwarding ${request.method} to: ${targetUrl}`)

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
    console.error(`[Proxy Adviser] Error: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return proxyRequest(request)
}

export async function POST(request: NextRequest) {
  return proxyRequest(request)
}
