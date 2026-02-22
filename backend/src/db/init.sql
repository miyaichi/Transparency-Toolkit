-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 1. Raw Files Table (Data Lake)
CREATE TABLE IF NOT EXISTS
    raw_sellers_files (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        domain TEXT NOT NULL,
        fetched_at TIMESTAMPTZ DEFAULT NOW(),
        processed_at TIMESTAMPTZ,
        file_content_gzip BYTEA, -- Store compressed content if needed
        etag TEXT,
        http_status INT,
        CONSTRAINT unq_raw_files_domain_fetched UNIQUE(domain, fetched_at)
    );

-- 2. Normalized Catalog Table (Data Mart for Search)
CREATE TABLE IF NOT EXISTS
    sellers_catalog (
        seller_id TEXT NOT NULL,
        domain TEXT NOT NULL,
        seller_type TEXT, -- PUBLISHER, INTERMEDIARY, BOTH
        name TEXT,
        seller_domain TEXT, -- The domain property from the seller entry
        identifiers JSONB, -- The identifiers property from the seller entry
        is_confidential boolean DEFAULT false,
        -- Additional attributes stored as JSONB for flexibility
        attributes JSONB,
        -- New column for Optimizer Step 6
        certification_authority_id TEXT,
        -- Link to raw file source
        raw_file_id UUID REFERENCES raw_sellers_files (id) ON
        DELETE CASCADE,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (domain, seller_id)
    );

-- Indexes for Sellers Catalog
CREATE INDEX IF NOT EXISTS idx_sellers_catalog_domain ON sellers_catalog (domain);

CREATE INDEX IF NOT EXISTS idx_sellers_catalog_seller_id ON sellers_catalog (seller_id);

CREATE INDEX IF NOT EXISTS idx_sellers_catalog_name_trgm ON sellers_catalog USING GIN (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sellers_catalog_domain_trgm ON sellers_catalog USING GIN (domain gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sellers_catalog_seller_id_trgm ON sellers_catalog USING GIN (seller_id gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sellers_catalog_seller_domain_trgm ON sellers_catalog USING GIN (seller_domain gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_sellers_catalog_cert_auth ON sellers_catalog (domain, certification_authority_id);

-- 3. Ads.txt Scans Table
CREATE TABLE IF NOT EXISTS
    ads_txt_scans (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        domain TEXT NOT NULL,
        url TEXT NOT NULL,
        scanned_at TIMESTAMPTZ DEFAULT NOW(),
        status_code INT,
        content TEXT,
        error_message TEXT,
        records_count INT DEFAULT 0,
        valid_count INT DEFAULT 0,
        warning_count INT DEFAULT 0,
        file_type VARCHAR (20) DEFAULT 'ads.txt'
    );

-- Indexes for Ads.txt Scans
CREATE INDEX IF NOT EXISTS idx_ads_txt_scans_domain_scanned ON ads_txt_scans (domain, scanned_at DESC);

-- 4. Monitored Domains Table
CREATE TABLE IF NOT EXISTS
    monitored_domains (
        domain TEXT,
        file_type TEXT DEFAULT 'ads.txt',
        added_at TIMESTAMPTZ DEFAULT NOW(),
        last_scanned_at TIMESTAMPTZ,
        next_scan_at TIMESTAMPTZ,
        scan_interval_minutes INT DEFAULT 1440,
        is_active BOOLEAN DEFAULT true,
        PRIMARY KEY (domain, file_type)
    );

-- 5. OpenSincera Cache (raw responses + normalized metadata)
CREATE TABLE IF NOT EXISTS
    opensincera_cache (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        domain TEXT,
        publisher_id TEXT,
        status TEXT NOT NULL,
        raw_response JSONB,
        normalized_metadata JSONB,
        http_status INT,
        error_message TEXT,
        source_url TEXT,
        fetched_at TIMESTAMPTZ DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT opensincera_cache_domain_or_id CHECK (domain IS NOT NULL OR publisher_id IS NOT NULL),
        CONSTRAINT opensincera_cache_valid_status CHECK (status IN ('success', 'not_found', 'error'))
    );

CREATE UNIQUE INDEX IF NOT EXISTS opensincera_cache_domain_unique ON opensincera_cache (domain) WHERE domain IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS opensincera_cache_publisher_id_unique ON opensincera_cache (publisher_id) WHERE publisher_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS opensincera_cache_expires_at_idx ON opensincera_cache (expires_at);

CREATE INDEX IF NOT EXISTS opensincera_cache_status_idx ON opensincera_cache (status);
