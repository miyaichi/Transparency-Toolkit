import { proxyPublicApiRequest } from "@/lib/proxy-utils"

export const maxDuration = 120

export async function GET(request: Request) {
  return proxyPublicApiRequest(request, "/v1/adstxt/validate", { timeoutMs: 120000 })
}
