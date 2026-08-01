-- Record how many ads.txt records a candidate actually publishes.
--
-- Enrollment previously required ads_txt_valid — that the ads.txt declared the one
-- (SSP, seller_id) pair the candidate happened to be generated from. That gate turned out
-- to be the dominant constraint: of 765 .jp candidates serving a real ads.txt, only 161
-- (21%) declared the specific SSP we checked, because Japanese publishers are typically
-- listed by domestic SSPs whose sellers.json entries go stale.
--
-- The pipeline exists to widen ads.txt crawl coverage, so the criterion that matters is
-- "publishes a real ads.txt", not "this particular seller relationship is still live".
-- ads_txt_valid is still recorded — it remains a useful signal — it just no longer gates.

ALTER TABLE publisher_discovery
    ADD COLUMN IF NOT EXISTS ads_txt_records INT;

COMMENT ON COLUMN publisher_discovery.ads_txt_records IS
    'Number of parseable ads.txt records served by the domain. NULL = not measured (probed before this column existed). Enrollment requires >= 1.';

CREATE INDEX IF NOT EXISTS idx_pd_enrollable_records
    ON publisher_discovery (status, ads_txt_records);
