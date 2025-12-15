import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const query = searchParams.toString()

  const backendUrl = process.env.BACKEND_URL || "http://localhost:3001"
  try {
    const res = await fetch(`${backendUrl}/api/analytics?${query}`, {
      cache: "no-store"
    })

    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: "Domain not found" }, { status: 404 })
      }
      const errorText = await res.text()
      return NextResponse.json({ error: errorText }, { status: res.status })
    }

    const data = await res.json()
    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
