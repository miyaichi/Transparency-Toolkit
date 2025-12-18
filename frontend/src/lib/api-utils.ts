/**
 * Utility functions for API interactions
 */

/**
 * Triggers a background scan for the specified domain.
 * This function fires a request to the backend to fetch and save the ads.txt/app-ads.txt/sellers.json file,
 * effectively adding it to the background scan queue.
 * It does NOT await the result to avoid blocking the UI (fire-and-forget).
 *
 * @param domain The domain to scan
 * @param type The type of file to scan ('ads.txt', 'app-ads.txt', 'sellers.json')
 */
export const triggerBackgroundScan = (domain: string, type: "ads.txt" | "app-ads.txt" | "sellers.json") => {
  if (!domain) return

  // Fire and forget
  const fire = async () => {
    try {
      let url = ""
      if (type === "sellers.json") {
        url = `/api/proxy/sellers/fetch?domain=${domain}&save=true`
      } else {
        url = `/api/proxy/validator?domain=${domain}&type=${type}&save=true`
      }

      await fetch(url, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache"
        },
        priority: "low"
      } as any) // Priority is not yet in all TS definitions
    } catch (e) {
      // Ignore errors for background trigger
      console.warn("Background scan trigger failed:", e)
    }
  }

  fire()
}
