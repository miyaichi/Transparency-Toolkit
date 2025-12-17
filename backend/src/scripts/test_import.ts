import { StreamImporter } from '../ingest/stream_importer';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5433/adstxt_v2';

async function run() {
  const importer = new StreamImporter();
  try {
    // Use a domain known to have sellers.json, e.g. google.com
    // Or a random one to force fresh fetch.
    // Let's try google.com but with a fresh check.
    // Actually StreamImporter just does what we tell it.
    await importer.importSellersJson({
      domain: 'google.com',
      url: 'https://realtimebidding.google.com/sellers.json',
    });
  } catch (err) {
    console.error(err);
  } finally {
    await importer.close();
  }
}

run();
