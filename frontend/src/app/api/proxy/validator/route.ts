import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.toString()

  // Use 127.0.0.1 instead of localhost to avoid Node 18+ IPv6 issues
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8080"

  try {
    const res = await fetch(`${backendUrl}/api/adstxt/validate?${query}`, {
      cache: "no-store"
    })

    // Pass through status code
    // Pass through status code
    if (!res.ok) {
      const contentType = res.headers.get("content-type")
      if (contentType && contentType.includes("application/json")) {
        const errorData = await res.json()
        return NextResponse.json(errorData, { status: res.status })
      } else {
        const errorText = await res.text()
        console.error(`[Proxy] Backend error: ${res.status} - ${errorText}`)
        return NextResponse.json({ error: `Upstream error: ${res.status}`, details: errorText }, { status: res.status })
      }
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}
