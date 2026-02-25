import { proxyRequest } from "@/lib/proxy-utils"
import { NextRequest } from "next/server"

// Gemini report generation can take up to ~2 minutes for complex prompts
const ADVISER_TIMEOUT_MS = 120000

export async function GET(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params
  const path = params.path.join("/")
  return proxyRequest(request, `/api/adviser/${path}`, { timeoutMs: ADVISER_TIMEOUT_MS })
}

export async function POST(request: NextRequest, props: { params: Promise<{ path: string[] }> }) {
  const params = await props.params
  const path = params.path.join("/")
  return proxyRequest(request, `/api/adviser/${path}`, { timeoutMs: ADVISER_TIMEOUT_MS })
}
