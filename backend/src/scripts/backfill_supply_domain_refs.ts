// One-off backfill for supply_domain_refs (migration 20260902).
//
// Runs entirely inside Postgres. Pulling the corpus into Node to parse it is
// exactly what OOMed the sellers.json sync in the first place, so the extraction
// is done in SQL and in batches over publisher domains.
//
// The SQL split is looser than parseAdsTxtContent (it just takes field 1 of each
// non-comment line), which is fine for an initial value: every subsequent scan
// replaces a publisher's rows with authoritative ones.
//
// Usage: npx ts-node src/scripts/backfill_supply_domain_refs.ts [batchSize]
import dotenv from 'dotenv';
import path from 'path';

// ENV_FILE lets this be pointed at another checkout's .env, which is how it gets
// run against Cloud SQL through a local auth proxy.
dotenv.config({ path: process.env.ENV_FILE ?? path.join(__dirname, '../../.env') });

// db/client only reads DATABASE_URL, but the proxy-based setups configure the
// parts separately. Compose it here so neither form needs the credentials
// written out anywhere.
if (!process.env.DATABASE_URL && process.env.DB_HOST) {
  const { DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME } = process.env;
  process.env.DATABASE_URL =
    `postgres://${encodeURIComponent(DB_USER ?? '')}:${encodeURIComponent(DB_PASSWORD ?? '')}` +
    `@${DB_HOST}:${DB_PORT ?? 5432}/${DB_NAME}`;
}

const BATCH = Number(process.argv[2] ?? 500);

async function main() {
  // Imported after DATABASE_URL is settled, since the pool is built at module load.
  const { pool, query } = await import('../db/client');
  const { rows: countRows } = await query(
    `SELECT COUNT(DISTINCT domain) AS n FROM ads_txt_scans WHERE content IS NOT NULL AND content <> ''`,
  );
  const total = Number(countRows[0].n);
  console.log(`Backfilling supply_domain_refs from ${total.toLocaleString()} publisher domains...`);

  let after = '';
  let processed = 0;

  for (;;) {
    const { rows } = await query(
      `SELECT DISTINCT domain FROM ads_txt_scans
       WHERE content IS NOT NULL AND content <> '' AND domain > $1
       ORDER BY domain LIMIT $2`,
      [after, BATCH],
    );
    if (rows.length === 0) break;

    const domains = rows.map((r: { domain: string }) => r.domain);

    await query(
      `INSERT INTO supply_domain_refs (publisher_domain, file_type, supply_domain)
       SELECT s.domain, s.file_type,
              lower(btrim(split_part(split_part(line, '#', 1), ',', 1), E' \t\r\n\uFEFF\"''<>?'))
       FROM (
         SELECT DISTINCT ON (domain, file_type) domain, file_type, content
         FROM ads_txt_scans
         WHERE domain = ANY($1::text[]) AND content IS NOT NULL AND content <> ''
         ORDER BY domain, file_type, scanned_at DESC
       ) s,
       LATERAL unnest(string_to_array(s.content, E'\\n')) AS line
       WHERE array_length(string_to_array(split_part(line, '#', 1), ','), 1) >= 3
         -- Mirrors normalizeSupplyDomain(). btrim() alone leaves tabs, BOMs and
         -- stray quotes attached, and those reached the sync as unresolvable
         -- fetch targets that burned whole runs on DNS retries.
         AND lower(btrim(split_part(split_part(line, '#', 1), ',', 1), E' \t\r\n\uFEFF\"''<>?'))
             ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'
       ON CONFLICT DO NOTHING`,
      [domains],
    );

    after = domains[domains.length - 1];
    processed += domains.length;
    const { rows: sofar } = await query(`SELECT COUNT(DISTINCT supply_domain) AS n FROM supply_domain_refs`);
    console.log(
      `  ${processed.toLocaleString()}/${total.toLocaleString()} publishers -> ${Number(sofar[0].n).toLocaleString()} supply domains`,
    );
  }

  const { rows: final } = await query(
    `SELECT COUNT(*) AS refs, COUNT(DISTINCT supply_domain) AS supply FROM supply_domain_refs`,
  );
  console.log(
    `Done. ${Number(final[0].refs).toLocaleString()} refs / ${Number(final[0].supply).toLocaleString()} distinct supply domains.`,
  );
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
