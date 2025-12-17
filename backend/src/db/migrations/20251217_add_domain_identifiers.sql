-- Add seller_domain and identifiers columns
ALTER TABLE sellers_catalog ADD COLUMN IF NOT EXISTS seller_domain TEXT;
ALTER TABLE sellers_catalog ADD COLUMN IF NOT EXISTS identifiers JSONB;

-- Add index for seller_domain search
CREATE INDEX IF NOT EXISTS idx_sellers_catalog_seller_domain_trgm ON sellers_catalog USING GIN (seller_domain gin_trgm_ops);
