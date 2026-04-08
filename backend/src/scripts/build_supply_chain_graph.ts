/**
 * Build a supply chain graph starting from a publisher domain's ads.txt.
 *
 * Algorithm:
 *   1. Fetch the latest ads.txt scan for the publisher from DB.
 *   2. Parse to get all (ssp_domain, account_id, relationship) tuples.
 *   3. BFS: for each SSP domain, look up its sellers.json (sellers_catalog) for INTERMEDIARY entries.
 *      An INTERMEDIARY entry at ssp_domain whose account_id (seller_id) appears in the
 *      current frontier's ads.txt reference set means ssp_domain → seller_domain.
 *   4. Output adjacency list JSON.
 *
 * Usage:
 *   npx ts-node src/scripts/build_supply_chain_graph.ts asahi.com [max_depth] [output.json]
 */

import * as fs from 'fs';
import * as path from 'path';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { parseAdsTxtContent } from '../lib/adstxt/validator';

dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

interface GraphData {
  root: string;
  node_count: number;
  edge_count: number;
  nodes: string[];
  adjacency: Record<string, string[]>;
}

/**
 * Get the latest ads.txt scan content for a domain from the DB.
 */
async function getLatestAdsTxt(domain: string): Promise<string | null> {
  const res = await pool.query(
    `SELECT content FROM ads_txt_scans
     WHERE domain = $1 AND content IS NOT NULL AND content != ''
     ORDER BY scanned_at DESC LIMIT 1`,
    [domain.toLowerCase().trim()],
  );
  return res.rows[0]?.content ?? null;
}

/**
 * Parse ads.txt content and return set of SSP domains referenced.
 */
function extractSspDomains(content: string, publisherDomain: string): Set<string> {
  const entries = parseAdsTxtContent(content, publisherDomain);
  const domains = new Set<string>();
  for (const entry of entries) {
    if ('domain' in entry && entry.domain && entry.domain.includes('.')) {
      domains.add(entry.domain.toLowerCase().trim());
    }
  }
  return domains;
}

/**
 * For a given SSP domain, find all INTERMEDIARY seller_domains in its sellers.json.
 * These represent edges: sspDomain → seller_domain.
 */
async function getIntermediaryDomains(sspDomain: string): Promise<string[]> {
  const res = await pool.query(
    `SELECT DISTINCT seller_domain
     FROM sellers_catalog
     WHERE LOWER(domain) = $1
       AND seller_type = 'INTERMEDIARY'
       AND seller_domain IS NOT NULL
       AND seller_domain != ''`,
    [sspDomain.toLowerCase().trim()],
  );
  return res.rows
    .map((r: { seller_domain: string }) => r.seller_domain.toLowerCase().trim())
    .filter((d: string) => d.includes('.'));
}

/**
 * Check if a domain has sellers.json data in the DB.
 */
async function hasSellersJson(domain: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM sellers_catalog WHERE LOWER(domain) = $1 LIMIT 1`,
    [domain.toLowerCase().trim()],
  );
  return res.rowCount !== null && res.rowCount > 0;
}

async function buildGraph(publisherDomain: string, maxDepth: number): Promise<GraphData> {
  console.log(`Building supply chain graph for: ${publisherDomain} (max depth: ${maxDepth})`);

  // Step 1: Get ads.txt for publisher
  const content = await getLatestAdsTxt(publisherDomain);
  if (!content) {
    throw new Error(`No ads.txt scan found in DB for domain: ${publisherDomain}`);
  }
  console.log(`  ads.txt content: ${content.length} bytes`);

  // Step 2: Extract Level-1 SSP domains from ads.txt
  const level1Ssps = extractSspDomains(content, publisherDomain);
  console.log(`  Level-1 SSPs from ads.txt: ${level1Ssps.size}`);

  // Build graph using BFS
  const adjacency: Record<string, string[]> = {};
  const visited = new Set<string>([publisherDomain]);

  // Publisher → Level-1 SSPs
  const publisherNeighbors = Array.from(level1Ssps).sort();
  adjacency[publisherDomain] = publisherNeighbors;
  for (const ssp of publisherNeighbors) {
    visited.add(ssp);
  }

  // BFS frontier: current set of domains to expand
  let frontier = publisherNeighbors.slice();

  for (let depth = 1; depth <= maxDepth && frontier.length > 0; depth++) {
    console.log(`  Depth ${depth}: expanding ${frontier.length} domains...`);
    const nextFrontier: string[] = [];

    // Process frontier in parallel batches
    const BATCH = 20;
    for (let i = 0; i < frontier.length; i += BATCH) {
      const batch = frontier.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (sspDomain) => {
          const intermediaryDomains = await getIntermediaryDomains(sspDomain);
          if (intermediaryDomains.length > 0) {
            adjacency[sspDomain] = [...new Set(intermediaryDomains)].sort();
            for (const d of intermediaryDomains) {
              if (!visited.has(d)) {
                visited.add(d);
                nextFrontier.push(d);
              }
            }
          }
        }),
      );
    }

    frontier = nextFrontier;
  }

  // Collect all nodes
  const nodes = Array.from(visited).sort();

  // Count edges
  let edgeCount = 0;
  for (const neighbors of Object.values(adjacency)) {
    edgeCount += neighbors.length;
  }

  console.log(`  Graph built: ${nodes.length} nodes, ${edgeCount} edges`);

  return {
    root: publisherDomain,
    node_count: nodes.length,
    edge_count: edgeCount,
    nodes,
    adjacency,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const domain = args[0] || 'asahi.com';
  const maxDepth = parseInt(args[1] || '3', 10);
  const outputFile = args[2] || `${domain.replace(/\./g, '_')}_supply_chain_graph.json`;

  try {
    const graph = await buildGraph(domain, maxDepth);

    const outputPath = path.isAbsolute(outputFile)
      ? outputFile
      : path.join(process.cwd(), outputFile);

    fs.writeFileSync(outputPath, JSON.stringify(graph, null, 2), 'utf-8');
    console.log(`\nGraph saved to: ${outputPath}`);
    console.log(`  Nodes: ${graph.node_count}`);
    console.log(`  Edges: ${graph.edge_count}`);
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
