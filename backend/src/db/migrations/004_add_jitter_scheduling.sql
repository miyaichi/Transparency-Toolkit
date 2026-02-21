-- Migration: Add jitter-based scheduling columns
-- Date: 2026-02-21
--
-- monitored_domains: next_scan_at is defined in init.sql but was never added via
-- migration, so production DBs may not have it. raw_sellers_files needs a new
-- next_fetch_at column. Both are backfilled with jittered values to spread the
-- existing fleet evenly across the refresh window from the first scheduler run.

-- ============================================================
-- 1. monitored_domains: add next_scan_at + backfill + index
-- ============================================================

ALTER TABLE monitored_domains
  ADD COLUMN IF NOT EXISTS next_scan_at TIMESTAMPTZ;

-- Backfill existing rows (idempotent via WHERE next_scan_at IS NULL).
-- Scanned rows: spread uniformly over [0.5T, 1.5T] from last_scanned_at.
-- Never-scanned rows: spread over [0, T] from NOW() to allow prompt processing.
UPDATE monitored_domains
SET next_scan_at = CASE
  WHEN last_scanned_at IS NOT NULL THEN
    last_scanned_at
    + ((scan_interval_minutes * (0.5 + random())) || ' minutes')::interval
  ELSE
    NOW()
    + ((scan_interval_minutes * random()) || ' minutes')::interval
  END
WHERE next_scan_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_monitored_domains_next_scan_at
  ON monitored_domains (next_scan_at)
  WHERE is_active = true;

-- ============================================================
-- 2. raw_sellers_files: add next_fetch_at + backfill + index
-- ============================================================

ALTER TABLE raw_sellers_files
  ADD COLUMN IF NOT EXISTS next_fetch_at TIMESTAMPTZ;

-- Backfill only the most recent row per domain (idempotent via WHERE next_fetch_at IS NULL).
-- Jitter range: [3h, 9h) centered at the 6-hour base interval.
WITH latest AS (
  SELECT DISTINCT ON (domain) id, fetched_at
  FROM raw_sellers_files
  ORDER BY domain, fetched_at DESC
)
UPDATE raw_sellers_files rsf
SET next_fetch_at =
  latest.fetched_at
  + ((360 * (0.5 + random())) || ' minutes')::interval
FROM latest
WHERE rsf.id = latest.id
  AND rsf.next_fetch_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_raw_sellers_files_next_fetch_at
  ON raw_sellers_files (domain, next_fetch_at DESC NULLS FIRST);
