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

-- Indexes for Sellers Catalog
CREATE INDEX IF NOT EXISTS idx_sellers_catalog_domain ON sellers_catalog(domain);
CREATE INDEX IF NOT EXISTS idx_sellers_catalog_seller_id ON sellers_catalog(seller_id);
CREATE INDEX IF NOT EXISTS idx_sellers_catalog_name_trgm ON sellers_catalog USING GIN (name gin_trgm_ops);

-- 3. Ads.txt Scans Table
CREATE TABLE IF NOT EXISTS ads_txt_scans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain TEXT NOT NULL,
    url TEXT NOT NULL,
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    status_code INT,
    content TEXT,
    error_message TEXT,
    records_count INT DEFAULT 0,
    valid_count INT DEFAULT 0,
    warning_count INT DEFAULT 0,
    file_type VARCHAR(20) DEFAULT 'ads.txt'
);

-- Indexes for Ads.txt Scans
CREATE INDEX IF NOT EXISTS idx_ads_txt_scans_domain_scanned ON ads_txt_scans(domain, scanned_at DESC);

-- 4. Monitored Domains Table
CREATE TABLE IF NOT EXISTS monitored_domains (
    domain TEXT,
    file_type TEXT DEFAULT 'ads.txt',
    added_at TIMESTAMPTZ DEFAULT NOW(),
    last_scanned_at TIMESTAMPTZ,
    next_scan_at TIMESTAMPTZ,
    scan_interval_minutes INT DEFAULT 60,
    is_active BOOLEAN DEFAULT true,
    PRIMARY KEY (domain, file_type)
);
