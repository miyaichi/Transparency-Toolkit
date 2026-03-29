#!/usr/bin/env ts-node

/**
 * Run Supply Chain Discovery
 * 
 * Discovers new INTERMEDIARY/BOTH domains and adds them to the queue.
 * Then processes pending domains in batches.
 */

import { SupplyChainDiscoveryService } from '../services/supply_chain_discovery_service';

async function main() {
  const depth = parseInt(process.argv[2] || '0');
  const batchSize = parseInt(process.argv[3] || '50');

  console.log('=== Supply Chain Discovery ===');
  console.log(`Target depth: ${depth}`);
  console.log(`Batch size: ${batchSize}\n`);

  const service = new SupplyChainDiscoveryService();

  try {
    // Phase 1: Discover new domains
    console.log('Phase 1: Discovering new domains...');
    const discovered = await service.discoverIntermediaryDomains(depth);
    console.log(`✅ Discovered ${discovered} new domains\n`);

    // Phase 2: Process pending queue
    console.log('Phase 2: Processing pending queue...');
    const result = await service.processQueue(batchSize);
    console.log(`✅ Processed ${result.processed} domains`);
    console.log(`   Succeeded: ${result.succeeded}`);
    console.log(`   Failed: ${result.failed}\n`);

    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
