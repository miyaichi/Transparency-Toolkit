import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.toString()

  // Backend Containerへプロキシ (Dockerネットワーク内通信)
  // ローカル開発時は localhost:3000 、Docker内からは http://backend:3000
  // Next.jsがホスト側で動いている場合は localhost:3000 でOK（ポート転送されているため）
  // Use 127.0.0.1 instead of localhost to avoid Node 18+ IPv6 issues
  const backendUrl = process.env.BACKEND_URL || "http://127.0.0.1:8080"

  try {
    const res = await fetch(`${backendUrl}/api/sellers?${query}`, {
      cache: "no-store"
    })
    const data = await res.json()

    return NextResponse.json(data)
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 })
  }
}
