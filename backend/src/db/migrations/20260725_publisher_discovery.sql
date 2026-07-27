-- Publisher discovery pipeline
-- Automates what was previously a manual "jp_publisher_extractor CSV -> bulk-import" loop:
-- find publisher domains referenced in sellers_catalog that we do NOT yet crawl,
-- probe their ads.txt + detect Japanese content, and enroll the qualifying ones.
--
-- Scope note: `.jp` ccTLD publishers are handled by a separate crawler, so this
-- pipeline deliberately targets gTLD (mainly .com) Japanese publishers, which are
-- only identifiable by CONTENT, not by TLD.

CREATE TABLE IF NOT EXISTS publisher_discovery (
    domain          TEXT PRIMARY KEY,      -- registrable root domain (psl-normalized)
    discovered_ssp  TEXT,                  -- an SSP whose sellers.json referenced this domain
    seller_id       TEXT,                  -- the seller_id used to validate the ads.txt relationship
    match_type      TEXT NOT NULL DEFAULT 'direct',  -- 'direct' | 'ownerdomain'

    -- probe results (all verdicts stored, JP and non-JP, for reporting / re-probe suppression)
    ads_txt_valid   BOOLEAN,               -- ads.txt declares (discovered_ssp, seller_id)
    http_status     INT,                   -- ads.txt fetch status
    is_japanese     BOOLEAN,
    jp_method       TEXT,                  -- html_lang / og_locale / content_language / kana
    jp_confidence   REAL,
    jp_char_ratio   REAL,                  -- Japanese (kana+cjk) character ratio of homepage text

    status          TEXT NOT NULL DEFAULT 'pending',  -- pending / probed / enrolled / rejected / failed
    probed_at       TIMESTAMPTZ,
    next_probe_at   TIMESTAMPTZ,           -- retry gate for failed rows
    retry_count     INT NOT NULL DEFAULT 0,
    error_message   TEXT,
    queued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pd_status ON publisher_discovery (status, next_probe_at);
CREATE INDEX IF NOT EXISTS idx_pd_enrollable
    ON publisher_discovery (status, is_japanese, ads_txt_valid);

COMMENT ON TABLE publisher_discovery IS
    'Discovery queue + verdict store for uncrawled publisher domains (gTLD Japanese focus). Feeds monitored_domains via the enroller.';

-- Tag existing and future monitored_domains with their origin so monthly reports can
-- segment organic vs discovery-sourced cohorts (avoids distorting historical comparisons).
ALTER TABLE monitored_domains
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'organic';
