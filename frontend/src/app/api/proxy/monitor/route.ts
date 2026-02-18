import { proxyRequest } from "@/lib/proxy-utils"
import { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  return proxyRequest(request, "/api/monitor/stats")
}

export async function POST(request: NextRequest) {
  return proxyRequest(request, "/api/monitor/bulk", { timeoutMs: 60000 })
}
