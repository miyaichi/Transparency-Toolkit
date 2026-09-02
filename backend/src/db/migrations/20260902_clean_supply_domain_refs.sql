-- Remove malformed supply domains and stop new ones from being stored.
--
-- The initial backfill (20260902_supply_domain_refs) split ads.txt lines in SQL
-- and only trimmed spaces, so anything else stuck to field 1 came through: UTF-8
-- BOMs, stray quotes, `<http://...>` autolinks, JSON and HTML fragments from
-- broken templates. 471 of 2,248 supply domains were junk, and the sellers.json
-- sync spent whole runs doing three DNS retries each for hosts that can never
-- resolve, such as "39<TAB>appnexus.com".
--
-- Application-side normalization now rejects these (normalizeSupplyDomain), and
-- the CHECK constraint makes the table refuse them regardless of who writes.

DELETE FROM supply_domain_refs
WHERE supply_domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
   OR length(supply_domain) > 253;

-- Same rows in raw_sellers_files: fetch attempts against domains that never
-- existed. They also count toward the consecutive-failure cap in
-- processMissingSellers, so leaving them skews that logic.
DELETE FROM raw_sellers_files
WHERE domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
   OR length(domain) > 253;

ALTER TABLE supply_domain_refs
  DROP CONSTRAINT IF EXISTS supply_domain_refs_supply_domain_format;

ALTER TABLE supply_domain_refs
  ADD CONSTRAINT supply_domain_refs_supply_domain_format
  CHECK (
    supply_domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
    AND length(supply_domain) <= 253
  );
