-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Raw Files Table (Data Lake)
CREATE TABLE IF NOT EXISTS raw_sellers_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    file_content_gzip BYTEA, -- Store compressed content if needed
    etag TEXT,
    http_status INT,
    
    CONSTRAINT unq_raw_files_domain_fetched UNIQUE(domain, fetched_at)
);

-- 2. Normalized Catalog Table (Data Mart for Search)
CREATE TABLE IF NOT EXISTS sellers_catalog (
    seller_id TEXT NOT NULL,
    domain TEXT NOT NULL,
    seller_type TEXT,                -- PUBLISHER, INTERMEDIARY, BOTH
    name TEXT,
    is_confidential boolean DEFAULT false,
    
    -- Additional attributes stored as JSONB for flexibility
    attributes JSONB, 
    
    -- Link to raw file source
    raw_file_id UUID REFERENCES raw_sellers_files(id) ON DELETE CASCADE,
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    PRIMARY KEY (domain, seller_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sellers_catalog_domain ON sellers_catalog(domain);
CREATE INDEX IF NOT EXISTS idx_sellers_catalog_seller_id ON sellers_catalog(seller_id);
-- Partial search index for seller name
CREATE INDEX IF NOT EXISTS idx_sellers_catalog_name_trgm ON sellers_catalog USING GIN (name gin_trgm_ops);
