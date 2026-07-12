-- Domain-level metadata (content language, country hint) for publisher analysis.
-- Keyed by domain (not domain + file_type) because these attributes belong to the
-- site itself, shared across ads.txt / app-ads.txt monitoring rows.
CREATE TABLE IF NOT EXISTS
    domain_metadata (
        domain TEXT PRIMARY KEY,
        content_lang TEXT, -- ISO 639-1 code ('ja', 'en', ...) or NULL if undetermined
        lang_confidence REAL, -- 0.0 - 1.0
        lang_source TEXT, -- 'text_detection' | 'html_lang' | 'og_locale' | 'header'
        country_hint TEXT, -- ISO 3166-1 alpha-2 derived from ccTLD ('JP', ...), NULL for gTLDs
        fetch_status INT, -- HTTP status of the root page fetch (0 = network error)
        error_message TEXT,
        detected_at TIMESTAMPTZ,
        next_detect_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_domain_metadata_lang ON domain_metadata (content_lang);

CREATE INDEX IF NOT EXISTS idx_domain_metadata_country ON domain_metadata (country_hint);

CREATE INDEX IF NOT EXISTS idx_domain_metadata_next_detect ON domain_metadata (next_detect_at);
