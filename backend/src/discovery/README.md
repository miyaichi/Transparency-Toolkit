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
