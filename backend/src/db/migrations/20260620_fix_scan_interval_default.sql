-- Migration: Fix scan_interval_minutes default and repair affected rows
-- Date: 2026-06-20
--
-- Root cause: The production DB column default was 1440 (1 day) instead of
-- 20160 (14 days). Domains added between 2026-03-25 and 2026-06-02 inherited
-- the wrong default, causing next_scan_at to cluster in short windows (12h-1.5d
-- intervals via updateLastScanned) instead of spreading over the 14-day window.

-- 1. Restore correct column default
ALTER TABLE monitored_domains
  ALTER COLUMN scan_interval_minutes SET DEFAULT 20160;

-- 2. Fix existing rows that have the wrong interval and re-jitter their next_scan_at
--    - Already scanned: spread over [0.5T, 1.5T] from last_scanned_at (same as updateLastScanned)
--    - Never scanned: spread over [0, T] from NOW()
UPDATE monitored_domains
SET
  scan_interval_minutes = 20160,
  next_scan_at = CASE
    WHEN last_scanned_at IS NOT NULL THEN
      last_scanned_at + ((20160 * (0.5 + random())) || ' minutes')::interval
    ELSE
      NOW() + ((20160 * random()) || ' minutes')::interval
  END
WHERE scan_interval_minutes = 1440;
