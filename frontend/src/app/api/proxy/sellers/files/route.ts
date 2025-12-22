import { proxyRequest } from "@/lib/proxy-utils"

export async function GET(request: Request) {
  // Legacy default was 3001
  return proxyRequest(request, "/api/sellers/files", {
    defaultBackendUrl: "http://localhost:3001"
  })
}
