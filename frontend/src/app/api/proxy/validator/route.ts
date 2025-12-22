import { proxyRequest } from "@/lib/proxy-utils"

export async function GET(request: Request) {
  return proxyRequest(request, "/api/adstxt/validate")
}
