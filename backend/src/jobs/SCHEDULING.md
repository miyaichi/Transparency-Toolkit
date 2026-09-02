# Background job scheduling

All periodic work is driven by **Cloud Scheduler over HTTP**, not by in-process timers.

| Job | Trigger | Schedule |
|---|---|---|
| ads.txt scan + sellers.json sync | `POST /api/jobs/scan` | `*/15 * * * *` (`ttkit-scan-job`) |
| data retention cleanup | `POST /api/jobs/cleanup` | `0 3 * * *` |

## Why not in-process cron

Cloud Run throttles CPU to near zero outside of request processing unless the
service is deployed with `--no-cpu-throttling`. Work started by `node-cron` runs
outside a request, so it is starved.

This was not theoretical. Both the in-process cron and Cloud Scheduler were
firing on `*/15`. The timer won the race by a few hundred milliseconds every
time and took the `isJobRunning` lock, so the Cloud Scheduler request — the one
that would have had CPU — was rejected in ~2 ms:

```
07:45:05.779  Starting scheduled jobs...        <- in-process cron, no CPU
07:45:06.034  Job is already running, skipping...  <- Cloud Scheduler, has CPU
```

Starved of CPU, opening a connection through the Cloud SQL auth proxy exceeded
`connectionTimeoutMillis`, so every run logged `Connection terminated due to
connection timeout` while CPU, memory and connection counts all looked idle.

`setupCronJobs()` therefore returns early when `K_SERVICE` is set (Cloud Run).
Locally there is no scheduler, so the timers still run. `ENABLE_INTERNAL_CRON=true`
forces them on in either environment.

## Adding the cleanup schedule

`ttkit-scan-job` already exists. Cleanup needs its own job:

```bash
gcloud scheduler jobs create http ttkit-cleanup-job \
  --project=apti-ttkit --location=asia-northeast1 \
  --schedule="0 3 * * *" --time-zone=UTC \
  --uri="https://<service-url>/api/jobs/cleanup" --http-method=POST
```

Until it exists, retention cleanup does not run. That is safe to leave briefly —
`raw_sellers_files` only grows — but it should not be left indefinitely.

## The alternative

Deploying with `--no-cpu-throttling` would also fix the starvation and let the
timers stay. It bills CPU for the full lifetime of the always-on instance
(`minScale: 1`), which is why the scheduler-driven approach was taken instead.
