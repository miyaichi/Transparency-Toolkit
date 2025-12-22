import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.toString()

  // Use 127.0.0.1 instead of localhost to avoid Node 18+ IPv6 issues
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8080"
  const url = `${backendUrl}/api/analytics?${query}`
  console.log(`[Proxy] Forwarding request to: ${url}`)

  try {
    const res = await fetch(url, {
      cache: "no-store"
    })

    console.log(`[Proxy] Backend response status: ${res.status}`)

    if (!res.ok) {
      if (res.status === 404) {
        console.warn(`[Proxy] Domain not found by backend`)
        return NextResponse.json({ error: "Domain not found" }, { status: 404 })
      }
      const errorText = await res.text()
      console.error(`[Proxy] Backend error: ${res.status} - ${errorText}`)
      return NextResponse.json({ error: errorText }, { status: res.status })
    }

    const data = await res.json()
    console.log(`[Proxy] Successfully retrieved data from backend`)
    return NextResponse.json(data)
  } catch (error: any) {
    console.error(`[Proxy] Internal Server Error: ${error.message}`)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
