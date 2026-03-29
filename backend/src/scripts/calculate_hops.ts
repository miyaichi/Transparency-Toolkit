#!/usr/bin/env ts-node

/**
 * Supply Chain Hop Calculation Script
 * 
 * Computes hop counts for all ads.txt records by traversing
 * INTERMEDIARY seller_domain references.
 * 
 * Usage:
 *   ts-node src/scripts/calculate_hops.ts
 */

import { HopCalculatorService } from '../services/hop_calculator_service';

async function main() {
  console.log('=== Supply Chain Hop Calculation ===\n');

  const calculator = new HopCalculatorService();

  try {
    // Run the calculation
    const result = await calculator.calculateAllHops();

    console.log('\n=== Calculation Complete ===');
    console.log(`Total processed: ${result.processed}`);
    console.log(`Resolved: ${result.resolved} (${((result.resolved / result.processed) * 100).toFixed(1)}%)`);
    console.log(`Unresolved: ${result.unresolved} (${((result.unresolved / result.processed) * 100).toFixed(1)}%)`);

    // Get statistics
    console.log('\n=== Statistics ===');
    const stats = await calculator.getStatistics();
    console.log(`Total hops in DB: ${stats.total}`);
    console.log(`Resolved: ${stats.resolved}`);
    console.log(`Unresolved: ${stats.unresolved}`);

    console.log('\n=== Hop Distribution ===');
    for (const dist of stats.hop_distribution) {
      const hopLabel = dist.hop_count === -1 ? 'NULL (unresolved)' : `${dist.hop_count} hops`;
      console.log(`${hopLabel}: ${dist.count}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error during hop calculation:', error);
    process.exit(1);
  }
}

main();
