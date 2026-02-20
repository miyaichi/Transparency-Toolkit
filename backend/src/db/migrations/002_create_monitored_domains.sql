CREATE TABLE IF NOT EXISTS
    monitored_domains (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
        domain TEXT NOT NULL UNIQUE,
        is_active BOOLEAN DEFAULT TRUE,
        last_scanned_at TIMESTAMPTZ,
        scan_interval_minutes INT DEFAULT 1440,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

CREATE INDEX IF NOT EXISTS idx_monitored_domains_next_scan ON monitored_domains (last_scanned_at, is_active);