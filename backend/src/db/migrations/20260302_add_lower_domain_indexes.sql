-- Migration: Add functional indexes for LOWER(domain) comparison
-- Date: 2026-03-02
--
-- Background: db_sellers_provider.ts uses LOWER(domain) = LOWER($1) for
-- case-insensitive comparison (commit 2629e45). This prevents the standard
-- (domain) index from being used, causing full table scans (~2000ms/query).
-- A functional index on LOWER(domain) allows PostgreSQL to use an index
-- even with LOWER(domain) on the column side.

-- sellers_catalog: used by hasSellerJson() and batchGetSellers()
CREATE INDEX IF NOT EXISTS idx_sellers_catalog_lower_domain
  ON sellers_catalog (LOWER(domain));

-- raw_sellers_files: used by getCacheInfo()
CREATE INDEX IF NOT EXISTS idx_raw_sellers_files_lower_domain
  ON raw_sellers_files (LOWER(domain));
