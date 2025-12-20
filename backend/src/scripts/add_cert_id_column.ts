import { pool, query } from '../db/client';

const KNOWN_CERT_AUTHORITIES: Record<string, string> = {
  'google.com': 'f08c47fec0942fa0',
  'rubiconproject.com': '0bfd66d529a55807',
  'openx.com': '6a698e2ec38604c6',
  'pubmatic.com': '5d62403b186f2ace',
  'appnexus.com': 'f5ab79cb980f11d1',
  'indexexchange.com': '50b1c356f2c5c8fc',
  'sovrn.com': 'fafdf38b16bf6b2b',
  'rhythmone.com': 'a670c89d4a324e47',
  'advertising.com': 'e1a5b5b6e3255540',
  'contextweb.com': '89ff185a4c4e857c',
  'smartadserver.com': '0c2eb22883395914',
  'freewheel.tv': '5f3c5b967a36c934',
  'improvedigital.com': 'd861d85025a07e0f',
  'spotx.com': '7842df1d2fe2db34',
  'spotxchange.com': '7842df1d2fe2db34',
  'teads.tv': '15a9c44f6d26cbe1',
  'yieldmo.com': '529573565987a051',
  'sharethrough.com': '4f33192f9d850242',
  'triplelift.com': '6da152919323f46f',
  '33across.com': '00155b172e29f349',
  'gumgum.com': '7a4ac81880429188',
  'media.net': '69213c4c82c3c54d',
  'unruly.co': '41f4866633783a6b',
  'smaato.com': '1f9855325c345f1b',
};

async function migrate() {
  try {
    console.log('Starting migration: Add certification_authority_id to sellers_catalog...');

    // 1. Add Column
    await query(`
      ALTER TABLE sellers_catalog 
      ADD COLUMN IF NOT EXISTS certification_authority_id TEXT;
    `);

    // Create index for performance
    await query(`
      CREATE INDEX IF NOT EXISTS idx_sellers_catalog_cert_auth 
      ON sellers_catalog(domain, certification_authority_id);
    `);

    console.log('Column added successfully.');

    // 2. Seed Data
    console.log('Seeding known certification authority IDs...');

    const domains = Object.keys(KNOWN_CERT_AUTHORITIES);

    for (const domain of domains) {
      const certId = KNOWN_CERT_AUTHORITIES[domain];
      const res = await query(
        `
        UPDATE sellers_catalog
        SET certification_authority_id = $1
        WHERE domain = $2 AND certification_authority_id IS NULL
      `,
        [certId, domain],
      );

      if (res.rowCount && res.rowCount > 0) {
        console.log(`Updated ${res.rowCount} rows for ${domain}`);
      }
    }

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

migrate();
