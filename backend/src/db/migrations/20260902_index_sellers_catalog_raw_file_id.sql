-- Index the CASCADE path from raw_sellers_files into sellers_catalog.
--
-- sellers_catalog.raw_file_id references raw_sellers_files(id) ON DELETE
-- CASCADE, but the referencing column was never indexed. Postgres does not
-- index a foreign key automatically, so every parent row deleted forced a
-- sequential scan of sellers_catalog to find its children -- 1.7M rows, once
-- per deleted row.
--
-- Measured in production: the nightly retention DELETE, removing 204 parent
-- rows from a 2,676-row table, was still running after 2m11s with a wait event
-- of IO/DataFileRead. It had presumably been this slow for a long time; the
-- cleanup runs unattended at 03:00 and swallows its own errors, so nothing ever
-- surfaced.
--
-- CONCURRENTLY so writes are not blocked while it builds. This cannot run
-- inside a transaction block.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sellers_catalog_raw_file_id
    ON sellers_catalog (raw_file_id);
