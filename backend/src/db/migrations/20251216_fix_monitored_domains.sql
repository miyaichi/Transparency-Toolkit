
-- Migration: Fix monitored_domains schema
-- Date: 2025-12-16

-- 1. Drop old primary key
ALTER TABLE monitored_domains DROP CONSTRAINT IF EXISTS monitored_domains_pkey;

-- 2. Add file_type column
ALTER TABLE monitored_domains ADD COLUMN IF NOT EXISTS file_type TEXT DEFAULT 'ads.txt';

-- 3. Add new composite primary key
ALTER TABLE monitored_domains ADD PRIMARY KEY (domain, file_type);
