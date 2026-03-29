#!/usr/bin/env ts-node

/**
 * Cleanup Invalid Domains from Discovery Queue
 * 
 * Removes domains that failed with "Invalid domain name format" error.
 * Run this before re-executing discovery with improved filters.
 */

import { query } from '../db/client';

async function main() {
  console.log('=== Cleanup Invalid Discovery Queue Entries ===\n');

  try {
    // Count invalid entries
    const countSql = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE error_message = 'Invalid domain name format') as invalid_format,
        COUNT(*) FILTER (WHERE status = 'failed') as all_failed
      FROM supply_chain_discovery_queue
    `;

    const countRes = await query(countSql);
    const stats = countRes.rows[0];

    console.log('Current Queue Status:');
    console.log(`  Total entries: ${stats.total}`);
    console.log(`  Failed entries: ${stats.all_failed}`);
    console.log(`  Invalid format: ${stats.invalid_format}`);

    if (parseInt(stats.invalid_format) === 0) {
      console.log('\n✅ No invalid format entries to clean up.');
      process.exit(0);
    }

    // Delete invalid entries
    console.log('\n🗑️  Deleting invalid format entries...');
    const deleteSql = `
      DELETE FROM supply_chain_discovery_queue
      WHERE error_message = 'Invalid domain name format'
      RETURNING domain
    `;

    const deleteRes = await query(deleteSql);
    const deletedCount = deleteRes.rowCount ?? 0;

    console.log(`✅ Deleted ${deletedCount} invalid entries.`);

    // Show updated stats
    const updatedCountRes = await query(countSql);
    const updatedStats = updatedCountRes.rows[0];

    console.log('\nUpdated Queue Status:');
    console.log(`  Total entries: ${updatedStats.total}`);
    console.log(`  Failed entries: ${updatedStats.all_failed}`);

    process.exit(0);
  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

main();
