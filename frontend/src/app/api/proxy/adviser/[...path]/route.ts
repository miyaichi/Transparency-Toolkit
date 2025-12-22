import { proxyRequest } from "@/lib/proxy-utils"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params
  const path = params.path.join("/")
  return proxyRequest(request, `/api/adviser/${path}`)
}

export async function POST(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params
  const path = params.path.join("/")
  return proxyRequest(request, `/api/adviser/${path}`)
}
