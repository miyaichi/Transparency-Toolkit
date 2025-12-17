# Improvement Plan (Private Beta Phase)

## Feature Roadmap

### 🚀 Next Priorities

1.  **Publish the Validation Codes / Warning Page**
    - Publish a page to display detailed messages (errors/warnings) from `adstxt-validator`.
    - Content should be derived from the validation keys and messages package.
    - Purpose: Help users understand how to fix their ads.txt errors.

2.  **Enhance Insite Analytics**
    - Expand integration with OpenSincera's API.
    - Display more detailed publisher insights and reputation metrics.
    - Add graphical visualizations for trends.

### 🔄 In Progress / Continuous Improvement

-   **UI/UX Polishing**:
    - Improve mobile responsiveness for data tables.
    - Add more helpful tooltips and onboarding guides for new users.
    - Refine error handling and loading states.

-   **Feedback Integration**:
    - embed a feedback form (likely Google Forms or Typeform) for beta testers.

### ✅ Completed Features

-   **Implement Internationalization (i18n) Support**
    - Full Japanese/English support integration.

-   **ads.txt/app-ads.txt Optimizer**
    - Clean up (duplicates/errors)
    - Relationship Correction (DIRECT/RESELLER fix based on sellers.json)
    - Owner Domain management
    - Sellers Verification

-   **Integrate adstxt-validator package**
    - Unified validation logic using external package.
    - Published and versioned on GitHub Packages.

## Technical Tasks

### Security & Operations

-   **Secret Management**:
    - Move sensitive DB credentials and API keys to GCP Secret Manager.
    - Ensure API keys are not exposed in client-side bundles (already handled via proxy, but double check).

-   **Observability**:
    - Add structured logging to Cloud Logging.
    - Set up alerts for critical failures (e.g., Scheduler stopped, DB connection lost).

### Testing

-   **Backend Testing**: Increase unit test coverage for complex logic like `optimizer.ts`.
-   **E2E Testing**: Set up Playwright for critical user flows (Validation -> Optimization).