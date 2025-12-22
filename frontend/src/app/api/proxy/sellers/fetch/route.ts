import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.toString()

  // Use 127.0.0.1 instead of localhost to avoid Node 18+ IPv6 issues
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8080"

  try {
    const res = await fetch(`${backendUrl}/api/sellers/fetch?${query}`, {
      cache: "no-store"
    })

    if (!res.ok) {
      try {
        const errorData = await res.json()
        return NextResponse.json(errorData, { status: res.status })
      } catch {
        return NextResponse.json({ error: "Upstream error" }, { status: res.status })
      }
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}
