
import { pool, query } from '../db/client';

async function checkGoogle() {
  try {
    const res = await query("SELECT count(*) FROM sellers_catalog WHERE domain = 'google.com'", []);
    console.log(`Row count for google.com: ${res.rows[0].count}`);

    const sample = await query("SELECT * FROM sellers_catalog WHERE domain = 'google.com' LIMIT 1", []);
    console.log('Sample row:', sample.rows[0]);
  } catch (e) {
    console.error(e);
  } finally {
    pool.end();
  }
}

checkGoogle();
