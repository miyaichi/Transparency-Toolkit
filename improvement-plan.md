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