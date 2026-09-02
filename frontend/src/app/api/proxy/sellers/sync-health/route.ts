import { proxyRequest } from "@/lib/proxy-utils"

// Uses the standard DEFAULT_BACKEND_URL. The sibling sellers routes pin 3001,
// but that is a documented legacy default; new routes should not inherit it.
export async function GET(request: Request) {
  return proxyRequest(request, "/api/sellers/sync-health")
}
