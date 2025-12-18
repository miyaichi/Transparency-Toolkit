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

### Next Priorities (User Facing)
1.  **Publish the Validation Codes / Warning Page**
    -   Publish a page to display detailed messages (errors/warnings) from `adstxt-validator`.
    -   Content should be derived from the validation keys and messages package.
    -   Purpose: Help users understand how to fix their ads.txt errors.

2.  **Enhance Insite Analytics**
    -   Expand integration with OpenSincera's API.
    -   Display more detailed publisher insights and reputation metrics.
    -   Add graphical visualizations for trends.

### 🔄 In Progress / Continuous Improvement
-   **UI/UX Polishing**:
    -   Improve mobile responsiveness for data tables.
    -   Add more helpful tooltips and onboarding guides for new users.
    -   Refine error handling and loading states.
-   **Feedback Integration**:
    -   Embed a feedback form (likely Google Forms or Typeform) for beta testers.

## ⚙️ Medium Priority (Operations & Efficiency)

1.  **API Enhancements**
    -   **Rate Limiting**: Implement Global and Per-IP rate limiting to prevent abuse.
    -   **Sellers API**: Optimized fetching (paging support, correct metadata handling).

2.  **Observability**
    -   **Structured Logging**: Implement JSON structured logging for Cloud Logging integration.
    -   **Error Tracking**: Setup Sentry or similar for production error monitoring.

3.  **Testing**
    -   **Unit Tests**: Increase coverage for complex logic (e.g., `optimizer.ts`), enabled by the Service Layer refactoring.
    -   **E2E Testing**: Set up Playwright for critical user flows (Validation -> Optimization).

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
    -   Add links to detailed explanation pages for each optimization step (Risk/Benefit analysis).
    -   *Why*: builds trust in the optimization logic.