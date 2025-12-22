import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.toString()

  // Use 127.0.0.1 instead of localhost to avoid Node 18+ IPv6 issues
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8080"
  try {
    const res = await fetch(`${backendUrl}/api/adstxt/history?${query}`, {
      cache: "no-store"
    })

    if (!res.ok) {
      const errorText = await res.text()
      return NextResponse.json({ error: errorText }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
