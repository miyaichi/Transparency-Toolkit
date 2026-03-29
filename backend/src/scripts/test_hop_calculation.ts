#!/usr/bin/env ts-node

/**
 * Test Hop Calculation on Sample Domains
 * 
 * Runs hop calculation on a small sample of domains to verify
 * the logic before running on the full dataset.
 */

import { HopCalculatorServiceV3 } from '../services/hop_calculator_service_v3';

async function main() {
  const sampleSize = parseInt(process.argv[2] || '10');
  
  console.log('=== Test Hop Calculation (V3) ===');
  console.log(`Sample size: ${sampleSize} domains\n`);

  const calculator = new HopCalculatorServiceV3();

  try {
    // Clear existing data for clean test
    console.log('🗑️  Clearing existing hop data...');
    const cleared = await calculator.clearAllHops();
    console.log(`   Cleared ${cleared} existing entries\n`);

    // Run sample calculation
    const result = await calculator.calculateSampleHops(sampleSize);

    console.log('\n=== Calculation Complete ===');
    console.log(`Total entries processed: ${result.processed}`);
    console.log(`Resolved: ${result.resolved} (${((result.resolved / result.processed) * 100).toFixed(1)}%)`);
    console.log(`Unresolved: ${result.unresolved} (${((result.unresolved / result.processed) * 100).toFixed(1)}%)`);

    // Get statistics
    console.log('\n=== Statistics ===');
    const stats = await calculator.getStatistics();
    console.log(`Total hops in DB: ${stats.total}`);
    console.log(`Resolved: ${stats.resolved}`);
    console.log(`Unresolved: ${stats.unresolved}`);
    console.log(`Max hop: ${stats.max_hop ?? 'N/A'}`);
    console.log(`Avg hop: ${stats.avg_hop ?? 'N/A'}`);

    if (stats.hop_distribution.length > 0) {
      console.log('\n=== Hop Distribution ===');
      for (const dist of stats.hop_distribution) {
        console.log(`  ${dist.hop_count} hops: ${dist.count} (${dist.percentage}%)`);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

main();
