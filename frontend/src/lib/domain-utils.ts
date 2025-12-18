import psl from "psl"

export function extractRootDomain(input: string): string {
  if (!input) return ""

  let domain = input.trim()

  // Remove protocol
  domain = domain.replace(/^https?:\/\//i, "")

  // Remove path, query, fragment
  const slashIndex = domain.indexOf("/")
  if (slashIndex !== -1) {
    domain = domain.substring(0, slashIndex)
  }

  // Remove port if present (e.g., localhost:3000 or example.com:8080)
  // Note: IPv6 uses colons, but usually inside brackets for URLs.
  // Simple regex for :port at the end of the domain part
  domain = domain.replace(/:\d+$/, "")

  const parsed = psl.parse(domain)

  if (parsed.error) {
    // If PSL parsing fails (e.g. internal domain or invalid), return the sanitized input as fallback
    // checking if it looks like a domain at least?
    return domain
  }

  return parsed.domain || domain
}
