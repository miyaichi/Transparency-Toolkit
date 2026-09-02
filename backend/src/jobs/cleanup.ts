import { query } from '../db/client';

/**
 * Runs periodic data cleanup tasks:
 * - Deletes old ads.txt scan history (retains 90 days)
 * - Deletes old raw_sellers_files and associated catalog entries (retains 30 days,
 *   but never the newest successful file for a domain — see below)
 */
export async function runCleanup() {
  console.log('Running cleanup tasks...');

  try {
    // 1. Clean up old ads.txt scans (keep for 90 days)
    const scanKeepDays = 90;
    const scanRes = await query(`DELETE FROM ads_txt_scans WHERE scanned_at < NOW() - INTERVAL '${scanKeepDays} days'`);
    console.log(`Cleanup: Deleted ${scanRes.rowCount} old ads.txt scans.`);

    // 2. Clean up old raw_sellers_files (keep for 30 days).
    //
    // Deleting purely on age cascades into sellers_catalog, so a domain whose
    // sellers.json has not been re-fetched within the window loses its catalog
    // entries entirely and silently. That is not hypothetical: sellers.json
    // fetching stalled on 2026-08-25 (the job OOMed at the old 512Mi limit) while
    // this cleanup kept running nightly, and fout.jp — last fetched 2026-07-25 —
    // was wiped on 2026-08-24, disappearing from the SSP dashboards with no error
    // anywhere. Every other tracked SSP was 1-2 days from the same fate.
    //
    // Retention therefore only applies to superseded files: a row is deletable
    // only when a NEWER SUCCESSFUL fetch exists for the same domain. The newest
    // good copy is kept regardless of age, so a fetching outage can no longer
    // empty the catalog — it only makes the data stale, which is visible.
    const sellersKeepDays = 30;
    const filesRes = await query(
      `DELETE FROM raw_sellers_files r
       WHERE r.fetched_at < NOW() - INTERVAL '${sellersKeepDays} days'
         AND EXISTS (
           SELECT 1
           FROM raw_sellers_files newer
           WHERE newer.domain = r.domain
             AND newer.http_status = 200
             AND newer.fetched_at > r.fetched_at
         )`,
    );
    console.log(`Cleanup: Deleted ${filesRes.rowCount} superseded raw sellers files (and associated catalog entries).`);

    // Surface domains being kept past the retention window. A growing count here
    // means fetching is falling behind — the signal that was missing in August.
    const staleRes = await query(
      `SELECT COUNT(DISTINCT domain) AS stale_domains
       FROM raw_sellers_files
       WHERE fetched_at < NOW() - INTERVAL '${sellersKeepDays} days'`,
    );
    const staleDomains = Number(staleRes.rows[0]?.stale_domains ?? 0);
    if (staleDomains > 0) {
      console.warn(
        `Cleanup: ${staleDomains} domain(s) have no sellers.json fetch newer than ${sellersKeepDays} days; ` +
          'their catalog entries are being retained but are stale. Check that the sellers.json sync is running.',
      );
    }
  } catch (e: any) {
    console.error('Cleanup failed:', e.message);
  }
}
