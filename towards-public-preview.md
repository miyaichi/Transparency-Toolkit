
# Summary

  - Next.js 16 app offering ads.txt/app-ads.txt validation, data explorer,
    optimizer, and analytics with bilingual UI; documentation is still the
    default create-next-app content (README.md:1-36).

# Beta-Readiness Tasks

  - [x] Replace the placeholder README with product-level setup (backend
    BACKEND_URL, required endpoints, data sources, and language switching) so
    testers know how to run and what to expect (README.md:1-36).
  - [x] Harden proxy routes: sanitize forwarded paths, add timeouts, and align
    backend defaults (optimizer/insite/adviser proxies vs sellers files still
    defaulting to http://localhost:3001) to avoid SSRF-style path injection and
    environment drift (src/app/api/proxy/optimizer/(...path)/route.ts:11-18,
    src/app/api/proxy/sellers/files/route.ts:3-10).
  - [x] Tame optimizer traffic: the page auto-posts to /api/proxy/optimizer/process
    on every content/step change with no cancellation or user feedback beyond
    alert, which can flood the backend; add abortable debouncing, surfaced
    errors, and guardrails on background fetch triggers (src/app/optimizer/
    page.tsx:62-154).
  - [x] Improve resilience of status views: the shared fetcher blindly res.json()s
    even on non-200 responses, and missing translation imports are buried mid-
    file; add error handling/loading states and move imports to the top for
    clarity (src/app/status/page.tsx:30-135, src/app/status/page.tsx:203-230).
  - [x] Close i18n gaps before public users arrive: explorer CSV headers and
    analytics detail labels are hard-coded English with TODO notes—fill
    translations and reuse t(...) so JP mode is consistent (src/components/
    explorer/explorer-result.tsx:26-37, src/components/analytics/detailed-data-
    section.tsx:23-68).
  - [x] Rate-limit or queue background scan triggers to avoid accidental hammering
    of upstream validators/sellers fetches when users retry searches (src/lib/
    api-utils.ts:14-41).
