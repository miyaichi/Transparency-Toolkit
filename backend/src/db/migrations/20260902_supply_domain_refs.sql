-- Supply domain index for the sellers.json sync.
--
-- processMissingSellers() used to rebuild its candidate set on every run by
-- selecting the latest ads.txt content for EVERY monitored domain and parsing
-- it in Node. At 26,738 domains that is 291 MB per run, every 15 minutes, and
-- node-pg buffers the whole result set. Held as V8 UTF-16 strings it exceeded
-- the 512Mi Cloud Run limit and the job died with SIGABRT, taking sellers.json
-- fetching down for over a week in August 2026 while ads.txt scanning kept
-- looking healthy.
--
-- The set is now maintained incrementally: scanAndSave() already parses each
-- ads.txt to compute records_count, so recording which exchange domains that
-- file references costs essentially nothing, and the sync just reads this
-- table. Rows for a publisher are replaced on each scan, so a supply domain
-- disappears automatically once nothing references it any more.

CREATE TABLE IF NOT EXISTS supply_domain_refs (
    publisher_domain TEXT NOT NULL,        -- the domain whose ads.txt/app-ads.txt declared it
    file_type        TEXT NOT NULL,        -- 'ads.txt' | 'app-ads.txt'
    supply_domain    TEXT NOT NULL,        -- exchange domain from field 1, lowercased
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (publisher_domain, file_type, supply_domain)
);

-- The sync only ever reads DISTINCT supply_domain; this keeps that a scan of
-- the index rather than of the table.
CREATE INDEX IF NOT EXISTS idx_supply_domain_refs_supply
    ON supply_domain_refs (supply_domain);
