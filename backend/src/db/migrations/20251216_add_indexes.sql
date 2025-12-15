
-- Migration: Add Indexes for Performance
-- Date: 2025-12-16

-- 1. Trigram Indexes for sellers_catalog (for fuzzy search)
CREATE INDEX IF NOT EXISTS idx_sellers_catalog_domain_trgm ON sellers_catalog USING GIN (domain gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_sellers_catalog_seller_id_trgm ON sellers_catalog USING GIN (seller_id gin_trgm_ops);

-- 2. Index for raw_sellers_files (Latest file check optimization)
CREATE INDEX IF NOT EXISTS idx_raw_files_domain_fetched_desc ON raw_sellers_files (domain, fetched_at DESC);
