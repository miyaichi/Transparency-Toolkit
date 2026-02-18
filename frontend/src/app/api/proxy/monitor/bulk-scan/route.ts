import { proxyRequest } from "@/lib/proxy-utils"
import { NextRequest } from "next/server"

export async function POST(request: NextRequest) {
  // Long timeout since bulk scan can take minutes
  return proxyRequest(request, "/api/monitor/bulk-scan", { timeoutMs: 600000 })
}
