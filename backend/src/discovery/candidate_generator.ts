import { query } from '../db/client';
import { chunk, toRootDomain } from './util';

const INSERT_CHUNK = 5000;

/**
 * Populate publisher_discovery with publisher domains that are referenced in
 * sellers_catalog but not yet crawled.
 *
 * Filters:
 *   - seller_type PUBLISHER/BOTH (actual publishers, not pure intermediaries)
 *   - not already in monitored_domains (ads.txt)
 *   - not already queued in publisher_discovery
 *
 * Domains are normalized to their registrable root so that www / subdomain variants
 * collapse to a single ads.txt target.
 */
export async function generateCandidates(): Promise<{ scanned: number; inserted: number }> {
  // Pull distinct referenced publisher domains. ~330k short strings — a few MB in memory.
  const res = await query(
    `SELECT DISTINCT ON (lower(seller_domain))
        lower(seller_domain) AS raw,
        domain               AS ssp,
        seller_id            AS seller_id
     FROM sellers_catalog
     WHERE seller_domain LIKE '%.%'
       AND seller_domain NOT LIKE '% %'
       AND seller_type IN ('PUBLISHER', 'BOTH')
     ORDER BY lower(seller_domain)`,
  );

  // Normalize to registrable root, keeping the first (ssp, seller_id) seen per root.
  const byRoot = new Map<string, { ssp: string; sellerId: string }>();
  for (const row of res.rows as { raw: string; ssp: string; seller_id: string }[]) {
    const root = toRootDomain(row.raw);
    if (!root) continue;
    if (!byRoot.has(root)) byRoot.set(root, { ssp: row.ssp, sellerId: row.seller_id });
  }

  const entries = [...byRoot.entries()];
  let inserted = 0;

  for (const batch of chunk(entries, INSERT_CHUNK)) {
    const domains = batch.map(([d]) => d);
    const ssps = batch.map(([, v]) => v.ssp);
    const sellerIds = batch.map(([, v]) => v.sellerId);

    // Anti-join against monitored_domains inside the insert so we never re-queue a
    // domain we already crawl. ON CONFLICT handles rows already in the queue.
    const ins = await query(
      `INSERT INTO publisher_discovery (domain, discovered_ssp, seller_id, match_type)
       SELECT c.domain, c.ssp, c.seller_id, 'direct'
       FROM unnest($1::text[], $2::text[], $3::text[]) AS c(domain, ssp, seller_id)
       WHERE NOT EXISTS (
         SELECT 1 FROM monitored_domains m
         WHERE lower(m.domain) = c.domain AND m.file_type = 'ads.txt'
       )
       ON CONFLICT (domain) DO NOTHING
       RETURNING domain`,
      [domains, ssps, sellerIds],
    );
    inserted += ins.rows.length;
  }

  return { scanned: res.rows.length, inserted };
}
