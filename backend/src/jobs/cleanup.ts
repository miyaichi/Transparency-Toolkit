import { query } from '../db/client';

/**
 * Runs periodic data cleanup tasks:
 * - Deletes old ads.txt scan history (retains 90 days)
 * - Deletes old raw_sellers_files and associated catalog entries (retains 30 days)
 */
export async function runCleanup() {
  console.log('Running cleanup tasks...');

  try {
    // 1. Clean up old ads.txt scans (keep for 90 days)
    const scanKeepDays = 90;
    const scanRes = await query(`DELETE FROM ads_txt_scans WHERE scanned_at < NOW() - INTERVAL '${scanKeepDays} days'`);
    console.log(`Cleanup: Deleted ${scanRes.rowCount} old ads.txt scans.`);

    // 2. Clean up old raw_sellers_files (keep for 30 days)
    // Note: This will cascade delete records in sellers_catalog due to foreign key constraint
    const sellersKeepDays = 30;
    const filesRes = await query(
      `DELETE FROM raw_sellers_files WHERE fetched_at < NOW() - INTERVAL '${sellersKeepDays} days'`,
    );
    console.log(`Cleanup: Deleted ${filesRes.rowCount} old raw sellers files (and associated catalog entries).`);
  } catch (e: any) {
    console.error('Cleanup failed:', e.message);
  }
}
