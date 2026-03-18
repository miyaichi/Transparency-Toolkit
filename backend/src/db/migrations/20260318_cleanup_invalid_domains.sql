-- Cleanup invalid domains from supply_chain_discovery_queue
-- Mark domains that don't meet validation criteria as 'failed'

UPDATE supply_chain_discovery_queue
SET 
  status = 'failed',
  error_message = 'Invalid domain name format (cleanup)',
  last_retry_at = NOW()
WHERE status = 'pending'
  AND (
    -- Length check
    LENGTH(domain) < 3 OR LENGTH(domain) > 253
    -- Contains protocol
    OR domain ~ '^https?://'
    -- Contains path/query/fragment
    OR domain ~ '[/?#]'
    -- Non-ASCII characters
    OR domain !~ '^[a-zA-Z0-9.-]+$'
    -- No dot (not a valid domain)
    OR domain !~ '\\.'
    -- Starts or ends with dot or hyphen
    OR domain ~ '^[.-]'
    OR domain ~ '[.-]$'
    -- Consecutive dots
    OR domain ~ '\\.\\.'
  );

-- Report the cleanup results
SELECT 
  'Cleanup complete' as message,
  COUNT(*) FILTER (WHERE error_message = 'Invalid domain name format (cleanup)') as cleaned_up_count,
  COUNT(*) FILTER (WHERE status = 'pending') as remaining_pending,
  COUNT(*) FILTER (WHERE status = 'failed') as total_failed
FROM supply_chain_discovery_queue;
