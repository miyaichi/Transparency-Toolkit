# Improvement Plan (Private Beta Phase)

## 🚨 Critical Priority (Must Fix for Public Release)
> These items pose immediate security risks or significant stability/cost issues and must be addressed before improving features.

1.  **Security Hardening**
    -   [x] **CORS Configuration**: Restrict `Access-Control-Allow-Origin` in production to the frontend domain only. Currently allows `*` with credentials (`backend/src/index.ts`).
    -   [x] **TLS Verification**: Enable TLS verification for all outbound fetches. Currently disabled, making scans vulnerable to MITM (`backend/src/lib/http.ts`).
    -   [x] **SSRF Protection**: Validate and sanitize user-provided domains before fetching to prevent internal network access (`backend/src/api/adstxt.ts`).
    -   [x] **Environment Validation**: Implement startup checks for required environment variables (`DATABASE_URL`, `OPENSINCERA_API_KEY`) to prevent runtime failures.

2.  **Infrastructure & Reliability**
    -   [x] **Cron Job Optimization**: Reduce scheduler frequency in production (currently runs every 1 minute). Suggest changing to 15+ minutes to save resources and DB connections (`backend/src/jobs/scheduler.ts`).
    -   [x] **Database Access**: Prevent creating new DB pools per request. Refactor to use a singleton or injected database client (`backend/src/api/sellers.ts`).
    -   [x] **GCP Routing & CORS Fixes**:
        -   Implemented explicit API Proxy routes in Next.js (`/api/proxy/insite`, `/api/proxy/optimizer`) to resolve `404` errors in Cloud Run.
        -   Removed unstable `rewrites()` from `next.config.ts`.
        -   Configured correct `BACKEND_URL` in Cloud Run environment variables.
        -   *Why*: Fixed 'Unexpected token' and '404' errors for Analytics and Optimizer pages in production.

## 🛠 High Priority (Architecture & Stability)
> Improvements necessary for maintainability, testing, and preventing future regressions.

1.  **Refactoring & Code Quality**
    -   [x] **Service Layer Extraction**: Decouple business logic from API route handlers (specifically `sellers.ts` and `adstxt.ts`). This is a prerequisite for effective unit testing.
    -   [x] **Type Safety**: Eliminate `any` casts and strengthen TypeScript definitions to catch schema drift early.
    -   [x] **Code Cleanup**: Replace long inline comments with self-documenting helper functions.

2.  **Frontend Stability**
    -   [x] **Dependency Stabilization**: Align Next.js and React versions to stable releases. Currently using unreleased/canary versions which risks build stability.
    -   [x] **Input Normalization**: Implement stricter domain validation (handling IDN/punycode, stripping ports) in the frontend before sending requests.

## 🚀 Feature Roadmap

### 🏁 Completed Phases

1.  **Optimizer Phase 1: Format Normalization**
    -   [x] Implemented `normalizer.ts` library.
    -   [x] Integrated into Optimizer Step 1.
    -   [x] Added UI toggle and i18n support.

2.  **Optimizer Phase 2: Certification Authority ID Verification**
    -   [x] **Database Schema**: Added `certification_authority_id` column to `sellers_catalog`.
    -   [x] **Self-Healing Data**: Updated `stream_importer.ts` to capture TAG-ID from `sellers.json` identifiers automatically.
    -   [x] **Backend Logic**: Implemented Step 6 (`verifyCertAuthority`) in `optimizer.ts`.
    -   [x] **Frontend UI**: Added Step 6 switch and results display in `optimizer/page.tsx`.
    -   [x] **Documentation**: Updated help files with Step 6 details.

### ⏭ Next Priorities

1.  **API Enhancements**
    -   [x] **Rate Limiting**: Implement Global and Per-IP rate limiting to prevent abuse.
    -   [x] **Sellers API**: Optimized fetching (paging support, correct metadata handling).

2.  **Observability**
    -   [x] **Structured Logging**: Implement JSON structured logging for Cloud Logging integration.
    -   [x] **Error Tracking**: Setup Sentry for production error monitoring (Frontend & Backend).

3.  **Testing**
    -   [x] **Unit Tests**: Increase coverage for complex logic (e.g., `optimizer.ts`).
    -   **E2E Testing**: Set up Playwright for critical user flows.

## ✅ Completed Features

-   **Implement Internationalization (i18n) Support**
    -   Full Japanese/English support integration.
-   **ads.txt/app-ads.txt Optimizer**
    -   Clean up (duplicates/errors)
    -   Relationship Correction (DIRECT/RESELLER fix based on sellers.json)
    -   Owner Domain management
    -   Sellers Verification
-   **Integrate adstxt-validator package**
    -   Unified validation logic using external package.
    -   Published and versioned on GitHub Packages.
-   **AI Adviser i18n & Enhancement**
    -   [x] Support multilingual prompts (English/Japanese) for AI Adviser.
    -   [x] Dynamic Benchmark fetching from OpenSincera API.
    -   [x] Integrated AI Advisor into Analytics page.
-   **Publish the Validation Codes / Warning Page**
    -   Migrated `adstxt-manager` v1 help files (`/doc` contents) to `frontend/public/help`.
    -   [x] Implemented Markdown rendering for `/warnings` page with deep linking support.
-   **Verification & Polish**
    -   [x] Manual verification of "Certification Authority ID Verification" feature.
    -   [x] Verified translation keys resolution.
-   **Enhance Insite Analytics**
    -   [x] Expanded integration with OpenSincera's API (Publisher & Benchmark data).
    -   [x] Displayed detailed publisher insights and reputation metrics.
    -   [x] Added visualizations (Metrics Cards & Detailed Data View).
-   **Advanced Validation Logic**
    -   [x] **Enhance Validator Diagnostics**: Implemented `diagnoseLine` in `normalizer.ts` to detect full-width characters, invalid separators, and case errors.
    -   [x] **Specific Feedback**: Added translation keys for specific error messages (Code 11010, etc).
-   **UX Improvements (Requests)**
    -   [x] **Support ads.txt Variables**: Visualized `CONTACT`, `OWNERDOMAIN`, etc. in Validator results and CSV export.
    -   [x] **Delayed Sellers.json Message**: Added warning/hint when `sellers.json` is being fetched in the background.

## 📣 Private Beta Feedback (Prioritized)

### 1. UX & Usability (High Priority)
-   **Domain Input Normalization**:
    -   [x] Automatically extract root domain from inputs like `https://example.com` or `https://example.com/ads.txt` using PSL (Public Suffix List).
    -   *Why*: Reduces user errors (e.g., pasting full URLs).
-   **Optimizer Result Clarity**:
    -   [x] Fix "No issues found" message when lines are commented out but count hasn't changed.
    -   [x] Explicitly mention if lines were commented out or modified, even if line count is static.
    -   *Why*: Current message is misleading (false negative).
-   **Validator Scroll UI**:
    -   [x] Fix background color truncation on horizontal scroll in the Validator results.
    -   *Why*: Visual bug makes reading long lines difficult.

### 2. Workflow & Data Logic (Medium Priority)
-   **Optimizer Step Reordering**:
    -   [x] Change order to: 1. CleanUp -> 2. Owner Domain -> **3. Manager Domain Optimization** -> **4. Relationship Correction** -> 5. Sellers Verification.
    -   *Why*: Matches practical workflow better (fix manager domains before fixing relationships acting as manager).
-   **Unified Scan Targeting**:
    -   [x] Ensure domains entered in *any* tool (Data Explorer, Insite Analytics, Optimizer) are added to the background scan queue, not just the Validator.
    -   *Why*: Users expect the dashboard to track domains they have interest in.
-   **Validation Help Integration**:
    -   [x] Link Validator error messages (`helpUrl`) to the specific section in the "Validation Codes" page.
    -   [x] Highlight the target section upon navigation.
    -   *Why*: Makes the error codes explanation actually accessible and useful.
-   **Data Explorer Combined Export**:
    -   [x] Add CSV export option to combine `ads.txt` supply chain rows with `sellers.json` seller details.
    -   [x] Added "Seller Name", "Seller Type", "Seller Domain" columns to default view and CSV export (with BOM for Excel support).
    -   *Why*: Simplifies supply chain auditing.

### 3. Content & Documentation (Low Priority)
-   **Optimizer Step Explanations**:
    -   [x] Add links to detailed explanation pages for each optimization step (Risk/Benefit analysis).
    -   *Why*: builds trust in the optimization logic.

### 4. Bug Fixes (Critical)
-   **Validator Sellers.json Lookups**:
    -   [x] Auto-fetch `sellers.json` if missing during `ads.txt` validation.
    -   *Why*: Validator was reporting "sellers.json not found" for existing domains because they weren't in the local database.
-   **Validator Seller Domain Mapping**:
    -   [x] Fix `DbSellersProvider` to select `seller_domain` correctly instead of source `domain`.
    -   *Why*: Caused "Domain Mismatch" errors because the validator was comparing publisher domain against the ad system domain (e.g. ad-generation.jp) instead of the seller's domain (e.g. asahi.com).
-   **Validator User-Agent Update**:
    -   [x] Updated `User-Agent` to Chrome 131.
    -   *Why*: `media.net` and others may block requests from older or non-browser User-Agents.
-   **Validator Robust Import**:
    -   [x] Implemented transactional tracking (`processed_at`) for `sellers.json` imports.
    -   [x] Fixed `DbSellersProvider` to ignore failed (zombie) imports and fall back to the last successful snapshot.
    -   *Why*: `google.com` validation was failing because a recent large import failed mid-stream, leaving an empty record that shadowed older valid data.
    -   [x] **Fixed GCP Deployment Issues (Sellers.json not found)**:
        -   Fixed specialized URL fetching for Google (`storage.googleapis.com`).
        -   Replaced `stream-json` with `JSONStream` to resolve parsing issues with large streams in Cloud Run.
        -   Made auto-fetch asynchronous to prevent 504 Gateway Timeouts during validation.
        -   **Action Required**: Configure Cloud Run with `--no-cpu-throttling` and `2GiB` memory to ensure background fetch completion.
    -   *Why*: Users encountered timeout errors and missing data for Google on the production environment.
    -   [x] **Fix Legacy SSL Support (docomo.ne.jp)**:
        -   Updated `Optimizer` to use the shared `axios` client with relaxed SSL options (`SSL_OP_LEGACY_SERVER_CONNECT`).
        -   *Why*: `fetch` in Node 18+ failed for servers with legacy SSL renegotiation (e.g. `docomo.ne.jp`), causing 500 errors in Optimizer while Validator worked.
    -   [x] **Numerical Sorting for Line Numbers**:
        -   Updated Validator and Data Explorer to sort results numerically by Line number (1, 2, 10) instead of lexicographically (1, 10, 2).
        -   *Why*: Required for easier auditing of large files.
    -   [x] **Optimizer CRLF Handling**:
        -   Fixed `Optimizer` to handle `CRLF` (Windows-style) line endings correctly.
        -   *Why*: `\r` characters were causing comment prefixes (e.g., `# INVALID: `) to be overwritten when displaying results, appearing as corrupted text (e.g., starting with `(invalidDomain)`).