# Publisher discovery

Automates the previously-manual `jp_publisher_extractor CSV → bulk-import` loop: finds
publisher domains referenced in `sellers_catalog` that we do **not** yet crawl, probes
their `ads.txt` and detects Japanese content, and enrolls qualifying domains into
`monitored_domains` (tagged `source='discovery'`).

## Why gTLD-focused

`.jp` ccTLD publishers are already covered by a separate crawler, so this pipeline targets
**gTLD (mainly `.com`) Japanese publishers**, which are only identifiable by page content —
not by TLD. Candidate generation excludes `*.jp`.

## Pipeline

| Stage | File | What it does |
|---|---|---|
| refresh | `candidate_generator.ts` | `sellers_catalog` − `monitored_domains` − queued → `publisher_discovery` (pending). Domains normalized to registrable root via `psl`. |
| probe | `prober.ts` | Fetch `ads.txt` (validate the `(ssp, seller_id)` relationship) + fetch homepage → `lang_detector.ts`. Writes verdict for **every** candidate (JP and non-JP). |
| enroll | `enroller.ts` | JP + ads.txt-valid → `bulkAddDomains(..., 'discovery')`, throttled by `--max`. Non-JP / invalid probed rows → `rejected`. |

`lang_detector.ts` is a dependency-free port of the Python tool's multi-dimensional JP
detection (`<html lang>`, `og:locale`, `Content-Language`, kana density). Kana is scored
separately from kanji so Chinese pages are not misclassified as Japanese.

## Usage

```bash
npm run discovery -- refresh
npm run discovery -- probe  --limit 20000 --concurrency 20
npm run discovery -- enroll --max 1000 --wave1   # --wave1 = html_lang=ja only
npm run discovery -- stats
```

## Report safety

Enrollment is throttled (`--max`) so the monthly-report base grows smoothly — matching the
historical manual cadence rather than dumping the whole backlog at once. `--wave1` restricts
the first wave to the highest-confidence `html_lang=ja` detections. The `source` column on
`monitored_domains` lets reports segment `organic` vs `discovery` cohorts.

## Schema

`db/migrations/20260725_publisher_discovery.sql` — creates `publisher_discovery` and adds
`monitored_domains.source` (default `organic`).

## Running in GCP (Cloud Run Job)

A 300k-domain crawl must **not** run against a local Cloud SQL auth-proxy: the proxy's
access token expires ~hourly (aborting long runs) and a flood of DNS lookups gets the local
resolver rate-limited (mass false `ENOTFOUND`). In GCP both problems disappear — Cloud SQL
is reached over a Unix socket and DNS is GCP's resolver. The job also sets
`UV_THREADPOOL_SIZE=64` so concurrent `getaddrinfo` calls don't queue on the default 4
libuv threads.

Deploy/run via the `Deploy Discovery Cloud Run Job` GitHub Action (`workflow_dispatch`) —
pick `command` (`refresh`/`probe`/`enroll`/`stats`) and `extra_args`. Or with gcloud:

```bash
# one probe chunk
gcloud run jobs execute ttkit-discovery --region asia-northeast1 --project apti-ttkit --wait

# widened enroll wave (report-safe throttle)
gcloud run jobs update ttkit-discovery --region asia-northeast1 --project apti-ttkit \
  --args dist/discovery/runner.js,enroll,--max,1000
gcloud run jobs execute ttkit-discovery --region asia-northeast1 --project apti-ttkit --wait
```

### Recurring schedule (Cloud Scheduler → Job)

```bash
# probe a chunk hourly until the queue drains (job's baked args = probe)
gcloud scheduler jobs create http ttkit-discovery-probe \
  --location=asia-northeast1 --schedule="0 * * * *" \
  --uri="https://asia-northeast1-run.googleapis.com/apis/run.googleapis.com/v1/namespaces/apti-ttkit/jobs/ttkit-discovery:run" \
  --http-method=POST \
  --oauth-service-account-email=<run-invoker-sa>@apti-ttkit.iam.gserviceaccount.com
```

Keep `enroll` on a slower cadence (e.g. daily, `--max` capped) so the monthly-report base
grows smoothly rather than in one step.
