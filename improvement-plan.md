# Improvement Plan

## Feature Roadmap

1. **Internationalization (i18n) Support**
   - Implement i18n support to allow the application to support multiple languages (en and ja).
   - The page displays in the appropriate language based on the user's browser language and any language switching within the page.
   - Reference: adstxt-manager (v1) `frontend/src/i18n`.

2. **Publish the Validation Codes / Warning Page**
   - Publish a page to display detailed messages (errors/warnings) from `adstxt-validator`.
   - Content should be derived from the validation keys and messages (see `translations.ts` in v1).
   - **Note**: Need to confirm the exact URL used in v1 (e.g., `/warnings` or `/codes`). If not found, will use `/warnings`.

3. **Insite Analytics**
   - Using OpenSincera's API, retrieve data for the publisher's domain.
   - Collect data such as number of records in ads.txt/app-ads.txt and the ratio of DIRECT/RESELLER.
   - Display insights into how that publisher is perceived externally.
   - Reference: adstxt-manager (v1) `SiteAnalysisPage`.

4. **ads.txt/app-ads.txt Optimizer**
   - Optimizer for publishers who have published Ads.txt/app-ads.txt to improve step by step.
   - Steps include:
     1. Removing errors and duplicate records
     2. Setting ownerdomain and removing managerdomain that should not be used
     3. Removing entries that do not exist in the corresponding sellers.json

5. **Integrate adstxt-validator package (Deferred)**
   - Integrate the `@miyaichi/ads-txt-validator` package into the project.
   - Currently, we will proceed with the existing internal validator in `v2/backend` and switch to the package later to unify logic.
   - Repository: https://www.npmjs.com/package/adstxt-validator

## Technical Improvements & Fixes

Based on Architecture, Code, and DB evaluations.

### High Priority (Critical Fixes & Data Integrity)

- **Fix Scheduler Logic**: ✅ Completed
  - **Issue**: `isJobRunning` flag in `backend/src/jobs/scheduler.ts` is not reset in the `finally` block, causing the cron job to run only once and then skip forever.
  - **Action**: Move `isJobRunning = false` to the `finally` block.

- **Resolve Schema Drift**: ✅ Completed
  - **Issue**: Code expects `file_type` column in `monitored_domains` but it is missing in the DB schema.
  - **Action**: Add `file_type` column (default 'ads.txt') and update Unique constraints to `(domain, file_type)`.

- **Reliable Bulk Import**: ✅ Completed
  - **Issue**: `backend/src/ingest/stream_importer.ts` uses `COPY` for `sellers_catalog` which fails on Primary Key conflicts (`domain`, `seller_id`) if re-imported.
  - **Action**: Implement a staging table strategy or DELETE-then-INSERT / UPSERT logic to handle updates safely.

### Medium Priority (Performance & Reliability)

- **Database Indexing**: ✅ Completed
  - **Issue**: `sellers_catalog` lacks efficient indexes for search queries using `ILIKE`. `raw_sellers_files` lacks indexes for frequent access patterns.
  - **Action**:
    - Add Trigram indexes (GIN) for `domain` and `seller_id` in `sellers_catalog`.
    - Add index `(domain, fetched_at DESC)` for `raw_sellers_files` to speed up "latest file" checks.
    - Optimize `COUNT(*)` queries in `sellers.ts` (potentially use estimates or cached counts).

- **API Proxy Reliability**: ✅ Completed
  - **Issue**: `backend/src/api/analytics.ts` calls OpenSincera API without timeouts or retries.
  - **Action**: Add abortable timeouts (e.g., 5s), limited retries, and short-term caching to prevent worker exhaustion.

### Low Priority (Architecture & Operations)

- **Secret Management**:
  - **Recommendation**: Move sensitive DB credentials from environment variables to **GCP Secret Manager** (accessed via Volume Mount or SDK) for better security and rotation support.

- **Job Separation**:
  - **Recommendation**: Consider migrating the internal Cron Scheduler to **Cloud Scheduler + Cloud Run Jobs** to avoid reliability issues with long-running processes in the API service.