import { proxyRequest } from "@/lib/proxy-utils"
export const maxDuration = 300 // 5 minutes

export async function GET(request: Request) {
  return proxyRequest(request, "/api/sellers/fetch", { timeoutMs: 300000 })
}
