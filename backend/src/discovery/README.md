# Publisher discovery

Automates the previously-manual `jp_publisher_extractor CSV → bulk-import` loop: finds
publisher domains referenced in `sellers_catalog` that we do **not** yet crawl, probes
their `ads.txt` and detects Japanese content, and enrolls qualifying domains into
`monitored_domains` (tagged `source='discovery'`).

## What counts as Japanese inventory

Two different signals, because the market is what matters — not the page language:

- **`.jp` registration is sufficient on its own.** `japantimes.co.jp` publishes in English
  for residents of Japan and carries Japanese advertisers' spend; gating it on kana would
  drop it. Language is still detected and stored, just not used as a gate.
- **Every other TLD is decided by page content**, since the TLD carries no signal. This is
  where the bulk of the work is: Japanese publishers on `.com` are invisible to any
  TLD-based rule.

This pipeline originally excluded `.jp` because a separate crawler covered it. That
separation is no longer needed — one pipeline now handles both, so discovery logic is not
maintained twice and the `source` tag stops being a proxy for "which crawler found it".

## Pipeline

| Stage | File | What it does |
|---|---|---|
| refresh | `candidate_generator.ts` | `sellers_catalog` − `monitored_domains` − queued → `publisher_discovery` (pending). Domains normalized to registrable root via `psl`. |
| probe | `prober.ts` | Fetch `ads.txt` (validate the `(ssp, seller_id)` relationship) + fetch homepage → `services/language_detector.ts`. Writes verdict for **every** candidate (JP and non-JP). |
| enroll | `enroller.ts` | Japanese inventory (`.jp` **or** JP content) + ads.txt-valid → `bulkAddDomains(..., 'discovery')`, throttled by `--max`. Everything else probed → `rejected`. |

Statuses: `pending` → `probed` → `enrolled` / `rejected`; unreachable candidates go
`failed` (retried after 3 days) and then `dead` once they exhaust `MAX_RETRIES`. Probing
takes never-tried candidates first (`ORDER BY retry_count, queued_at`), so a batch is spent
on fresh domains rather than grinding the dead tail.

The sellers.json universe carries a large tail of long-dead publisher domains — measured on
the live queue, 39 of 40 hosts that failed to resolve also failed from a second network. The
retry cap keeps them from cycling through every retry window forever.

Language detection reuses the shared `services/language_detector.ts`
(`detectLanguageFromHtml`), which weighs actual page script (kana) **above** declared
metadata. That ordering is essential here: many Japanese publishers on gTLDs ship a
template default of `lang="en"`, and trusting the attribute would reject exactly the
population this pipeline exists to find. Kana is scored separately from kanji, so Chinese
pages are not misclassified as Japanese.

## Usage

```bash
npm run discovery -- refresh
npm run discovery -- probe  --limit 20000 --concurrency 20
npm run discovery -- enroll --max 1000 --wave1   # --wave1 = html_lang=ja only
npm run discovery -- stats

# after a detector change: re-queue rows rejected under the old language logic
npm run discovery -- reset-language-rejections
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

Run the **Schedule Discovery Probe** GitHub Action; it creates/updates the
`ttkit-discovery-probe-hourly` Cloud Scheduler job (inputs: schedule, limit, concurrency).

The schedule pins the runner arguments through Cloud Run `containerOverrides` instead of
inheriting the ones baked into the job. This is deliberate: an ad-hoc dispatch of *Deploy
Discovery Cloud Run Job* rewrites the baked arguments, so a schedule that inherited them
could silently begin running `enroll` — which changes the monthly-report base — instead of
`probe`.

Sizing: 20,000 domains at concurrency 40 takes ~36 min, so an hourly schedule should stay
near 10,000 per run. Runs are **not** mutually exclusive — the probe selects candidates
without claiming them, so two overlapping runs would pick the same rows. Keep each run
comfortably shorter than the interval.

Keep `enroll` manual, or on a much slower cadence with `--max` capped, so the
monthly-report base grows smoothly rather than in one step.
