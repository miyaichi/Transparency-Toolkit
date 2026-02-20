import dotenv from 'dotenv';
import path from 'path';
import { StreamImporter } from './stream_importer';

// Load environment variables (assumes .env file exists in backend root)
dotenv.config({ path: path.join(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5433/adstxt_v2';

// Import targets
const TARGETS = [
  { domain: 'google.com', url: 'https://realtimebidding.google.com/sellers.json' },
  // { domain: 'rubiconproject.com', url: 'https://rubiconproject.com/sellers.json' }
];

async function main() {
  console.log('Connecting to database:', DATABASE_URL);
  const importer = new StreamImporter();

  try {
    for (const target of TARGETS) {
      console.time(`Import ${target.domain}`);
      await importer.importSellersJson(target);
      console.timeEnd(`Import ${target.domain}`);
    }
  } catch (error) {
    console.error('Import failed:', error);
  } finally {
    await importer.close();
  }
}

main().catch(console.error);
