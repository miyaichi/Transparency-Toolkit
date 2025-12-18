import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.toString()

  const backendUrl = process.env.BACKEND_URL || "http://localhost:3000"

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
