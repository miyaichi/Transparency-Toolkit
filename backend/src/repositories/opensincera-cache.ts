import { query } from '../db/client';

export type OpenSinceraCacheStatus = 'success' | 'not_found' | 'error';

export interface OpenSinceraCacheRecord {
  id: string;
  domain: string | null;
  publisherId: string | null;
  status: OpenSinceraCacheStatus;
  rawResponse: any;
  normalizedMetadata: any;
  httpStatus: number | null;
  errorMessage: string | null;
  sourceUrl: string | null;
  fetchedAt: Date;
  expiresAt: Date;
}

export interface FindOpenSinceraCacheParams {
  domain?: string | null;
  publisherId?: string | null;
}

export interface UpsertOpenSinceraCacheParams extends FindOpenSinceraCacheParams {
  status: OpenSinceraCacheStatus;
  rawResponse?: any;
  normalizedMetadata?: any;
  httpStatus?: number | null;
  errorMessage?: string | null;
  sourceUrl?: string | null;
  ttlMs: number;
}

const CACHE_FIELDS = `
  id,
  domain,
  publisher_id AS "publisherId",
  status,
  raw_response AS "rawResponse",
  normalized_metadata AS "normalizedMetadata",
  http_status AS "httpStatus",
  error_message AS "errorMessage",
  source_url AS "sourceUrl",
  fetched_at AS "fetchedAt",
  expires_at AS "expiresAt"
`;

const parseCacheRow = (row: any): OpenSinceraCacheRecord => ({
  ...row,
  fetchedAt: row.fetchedAt instanceof Date ? row.fetchedAt : new Date(row.fetchedAt),
  expiresAt: row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt),
});

export const findOpenSinceraCache = async (
  params: FindOpenSinceraCacheParams,
): Promise<OpenSinceraCacheRecord | null> => {
  const { domain, publisherId } = params;
  if (!domain && !publisherId) {
    return null;
  }

  const conditions: string[] = [];
  const values: any[] = [];

  if (domain) {
    values.push(domain);
    conditions.push(`domain = $${values.length}`);
  }

  if (publisherId) {
    values.push(publisherId);
    conditions.push(`publisher_id = $${values.length}`);
  }

  const whereClause = conditions.join(' OR ');
  const res = await query(
    `SELECT ${CACHE_FIELDS}
     FROM opensincera_cache
     WHERE ${whereClause}
     ORDER BY fetched_at DESC
     LIMIT 1`,
    values,
  );

  return res.rows[0] ? parseCacheRow(res.rows[0]) : null;
};

export const upsertOpenSinceraCache = async (params: UpsertOpenSinceraCacheParams): Promise<OpenSinceraCacheRecord> => {
  const {
    domain = null,
    publisherId = null,
    status,
    rawResponse = null,
    normalizedMetadata = null,
    httpStatus = null,
    errorMessage = null,
    sourceUrl = null,
    ttlMs,
  } = params;

  if (!domain && !publisherId) {
    throw new Error('Either domain or publisherId must be provided for OpenSincera cache upsert');
  }

  // Use partial index inference instead of ON CONFLICT ON CONSTRAINT, because
  // opensincera_cache_domain_unique and opensincera_cache_publisher_id_unique are
  // created as unique indexes (CREATE UNIQUE INDEX), not named constraints in pg_constraint.
  // ON CONFLICT ON CONSTRAINT requires a named constraint; ON CONFLICT (col) WHERE predicate
  // is the correct syntax for partial unique indexes.
  const conflictClause = publisherId
    ? 'ON CONFLICT (publisher_id) WHERE publisher_id IS NOT NULL'
    : 'ON CONFLICT (domain) WHERE domain IS NOT NULL';

  const res = await query(
    `INSERT INTO opensincera_cache (
        domain,
        publisher_id,
        status,
        raw_response,
        normalized_metadata,
        http_status,
        error_message,
        source_url,
        fetched_at,
        expires_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW() + ($9::BIGINT) * INTERVAL '1 millisecond')
      ${conflictClause}
      DO UPDATE
        SET status = EXCLUDED.status,
            raw_response = EXCLUDED.raw_response,
            normalized_metadata = EXCLUDED.normalized_metadata,
            http_status = EXCLUDED.http_status,
            error_message = EXCLUDED.error_message,
            source_url = EXCLUDED.source_url,
            fetched_at = EXCLUDED.fetched_at,
            expires_at = EXCLUDED.expires_at
      RETURNING ${CACHE_FIELDS};`,
    [domain, publisherId, status, rawResponse, normalizedMetadata, httpStatus, errorMessage, sourceUrl, ttlMs],
  );

  return parseCacheRow(res.rows[0]);
};
