# Improvement Plan

Implementation Order:

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