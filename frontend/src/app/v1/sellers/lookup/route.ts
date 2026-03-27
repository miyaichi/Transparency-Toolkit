import { proxyPublicApiRequest } from "@/lib/proxy-utils"

export async function GET(request: Request) {
  return proxyPublicApiRequest(request, "/v1/sellers/lookup")
}
