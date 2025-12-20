import { OpenAPIHono, z } from '@hono/zod-openapi';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/client';
import { parseAdsTxtContent } from '../lib/adstxt/validator';
import client from '../lib/http';

import { normalizeAdsTxt } from '../lib/adstxt/normalizer';

const optimizerApp = new OpenAPIHono();

const optimizerSchema = z.object({
  content: z.string(),
  domain: z.string().optional(),
  ownerDomain: z.string().optional(),
  fileType: z.enum(['ads.txt', 'app-ads.txt']).default('ads.txt'),
  steps: z.object({
    removeErrors: z.boolean().default(false),
    invalidAction: z.enum(['remove', 'comment']).default('remove'),
    duplicateAction: z.enum(['remove', 'comment']).default('remove'),
    normalizeFormat: z.boolean().default(false), // New
    fixOwnerDomain: z.boolean().default(false),
    fixRelationship: z.boolean().default(false), // New
    fixManagerDomain: z.boolean().default(false),
    managerAction: z.enum(['remove', 'comment']).default('remove'),
    verifySellers: z.boolean().default(false),
    sellersAction: z.enum(['remove', 'comment']).default('remove'),
    verifyCertAuthority: z.boolean().default(false), // New Step 6
  }),
});

optimizerApp.post('/process', zValidator('json', optimizerSchema), async (c) => {
  const { content, domain, ownerDomain, steps } = c.req.valid('json');

  console.log('Optimizer Process Request:', { domain, steps }); // Debug log

  // Initial stats
  const originalLines = content.split(/\r?\n/).length;
  let optimizedContent = content;
  let removedCount = 0;
  let commentedCount = 0;
  let modifiedCount = 0;
  let errorsFound = 0;
  let certAuthorityFixed = 0;

  // Step 1: Clean Up (Remove Errors & Duplicates & Normalize)
  if (steps.removeErrors) {
    // 1. Normalize first if requested (to catch duplicates easier)
    if (steps.normalizeFormat) {
      console.log('Applying normalization...'); // Debug log
      const beforeNorm = optimizedContent;
      optimizedContent = normalizeAdsTxt(optimizedContent);
      if (beforeNorm !== optimizedContent) {
        // Count modifications if needed, but for now just logging
        console.log('Normalization applied changes.');
      }
    }

    const parsedEntries = parseAdsTxtContent(optimizedContent, domain);
    const validLines: string[] = [];
    errorsFound = parsedEntries.filter((e) => !e.is_valid && !e.is_variable).length;

    const seen = new Set<string>();
    const lines = optimizedContent.split(/\r?\n/);
    const newLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Preserve existing comments and empty lines
      if (!trimmed || trimmed.startsWith('#')) {
        newLines.push(line);
        continue;
      }

      const entry = parsedEntries.find((e) => e.line_number === i + 1);

      if (entry) {
        // Invalid Record Handling
        if (!entry.is_valid) {
          if (steps.invalidAction === 'comment') {
            const newLine = `# INVALID: ${line} (${entry.error || 'Unknown Error'})`;
            if (newLine !== line) commentedCount++;
            newLines.push(newLine);
          } else {
            removedCount++; // Removed
          }
          continue;
        }

        // Duplicate Check
        let key = '';
        if (entry.is_variable) {
          key = `${entry.variable_type}=${entry.value}`;
        } else {
          key = `${entry.domain},${entry.account_id},${entry.account_type},${entry.relationship}`.toLowerCase();
        }

        if (seen.has(key)) {
          // Duplicate Handling
          if (steps.duplicateAction === 'comment') {
            const newLine = `# DUPLICATE: ${line} `;
            if (newLine !== line) commentedCount++;
            newLines.push(newLine);
          } else {
            removedCount++; // Removed
          }
          continue;
        }

        seen.add(key);
        newLines.push(line);
      } else {
        // Fallback for lines parser didn't map (should be rare/errors)
        if (steps.invalidAction === 'comment') {
          const newLine = `# INVALID_PARSE: ${line} `;
          if (newLine !== line) commentedCount++;
          newLines.push(newLine);
        } else {
          removedCount++;
        }
      }
    }

    optimizedContent = newLines.join('\n');
  }

  // Step 2: Owner Domain Verification
  const targetOwnerDomain = ownerDomain || domain;

  if (steps.fixOwnerDomain && targetOwnerDomain) {
    const hasOwnerDomain = optimizedContent.split(/\r?\n/).some((line) => {
      const trimmed = line.trim();
      return trimmed.toUpperCase().startsWith('OWNERDOMAIN=');
    });

    if (!hasOwnerDomain) {
      optimizedContent =
        `# OWNERDOMAIN = ${targetOwnerDomain} \nOWNERDOMAIN = ${targetOwnerDomain} \n` + optimizedContent;
      modifiedCount++;
    }
  }

  // Step 3: Manager Domain Optimization
  if (steps.fixManagerDomain) {
    const lines = optimizedContent.split(/\r?\n/);
    const newLines: string[] = [];
    let removedManagerDomains = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.toUpperCase().startsWith('MANAGERDOMAIN=')) {
        if (steps.managerAction === 'comment') {
          const newLine = `# DISABLED_MANAGERDOMAIN: ${line} `;
          if (newLine !== line) commentedCount++;
          newLines.push(newLine);
        } else {
          removedManagerDomains++;
        }
      } else {
        newLines.push(line);
      }
    }

    optimizedContent = newLines.join('\n');
    removedCount += removedManagerDomains; // Add to stats
  }

  // Step 4 & 5: Sellers.json Verification and Relationship Correction
  if (steps.verifySellers || steps.fixRelationship) {
    const dbLines = optimizedContent.split(/\r?\n/);
    const pairsToCheck: { domain: string; id: string; lineIndex: number }[] = [];
    const distinctDomains = new Set<string>();

    for (let i = 0; i < dbLines.length; i++) {
      const line = dbLines[i].trim();
      if (
        !line ||
        line.startsWith('#') ||
        line.toUpperCase().startsWith('OWNERDOMAIN=') ||
        line.toUpperCase().startsWith('MANAGERDOMAIN=')
      ) {
        continue;
      }

      const parts = line.split(',').map((s) => s.trim());
      if (parts.length >= 2) {
        let d = parts[0].toLowerCase();
        if (d.includes('#')) d = d.split('#')[0].trim();
        let id = parts[1];
        if (id.includes('#')) id = id.split('#')[0].trim();

        if (d && id) {
          pairsToCheck.push({ domain: d, id, lineIndex: i });
          distinctDomains.add(d);
        }
      }
    }

    if (pairsToCheck.length > 0) {
      const domainList = Array.from(distinctDomains);

      const domainRes = await query(`SELECT DISTINCT domain FROM sellers_catalog WHERE domain = ANY($1::text[])`, [
        domainList,
      ]);
      const knownDomains = new Set(domainRes.rows.map((r: any) => r.domain));

      if (knownDomains.size > 0) {
        const candidates = pairsToCheck.filter((p) => knownDomains.has(p.domain));

        if (candidates.length > 0) {
          const cDomains = candidates.map((c) => c.domain);
          const cIds = candidates.map((c) => c.id);

          const validRes = await query(
            `SELECT sc.domain, sc.seller_id, sc.seller_type
             FROM UNNEST($1::text[], $2::text[]) AS t(domain, seller_id) 
             JOIN sellers_catalog sc ON sc.domain = t.domain AND sc.seller_id = t.seller_id`,
            [cDomains, cIds],
          );

          const sellerInfoMap = new Map<string, string>();
          validRes.rows.forEach((r: any) => {
            sellerInfoMap.set(`${r.domain}|${r.seller_id}`, r.seller_type);
          });

          const newLines = [...dbLines];
          let removedSellers = 0;

          for (const cand of candidates) {
            const key = `${cand.domain}|${cand.id}`;
            const sellerType = sellerInfoMap.get(key);

            if (!sellerType) {
              if (steps.verifySellers) {
                const originalLine = newLines[cand.lineIndex];
                if (steps.sellersAction === 'comment') {
                  const newLine = `# INVALID_SELLER_ID: ${originalLine}`;
                  if (newLine !== originalLine) commentedCount++;
                  newLines[cand.lineIndex] = newLine;
                } else {
                  newLines[cand.lineIndex] = ''; // Mark for removal
                  removedSellers++;
                }
              }
            } else {
              if (steps.fixRelationship) {
                const line = newLines[cand.lineIndex];
                const parts = line.split(',');

                if (parts.length >= 2) {
                  let currentRel = 'DIRECT';
                  let hasRelField = false;

                  if (parts.length >= 3) {
                    const p3 = parts[2].trim();
                    if (!p3.startsWith('#')) {
                      currentRel = p3.toUpperCase();
                      hasRelField = true;
                    }
                  }

                  let expectedRel = currentRel;
                  if (sellerType === 'PUBLISHER') {
                    expectedRel = 'DIRECT';
                  } else if (sellerType === 'INTERMEDIARY') {
                    expectedRel = 'RESELLER';
                  } else if (sellerType === 'BOTH') {
                    if (currentRel !== 'DIRECT' && currentRel !== 'RESELLER') {
                      expectedRel = 'DIRECT';
                    }
                  }

                  if (currentRel !== expectedRel) {
                    if (hasRelField) {
                      const newParts = [...parts];
                      newParts[2] = newParts[2].replace(/^\s*(\w+)\s*$/, (match) => {
                        return match.replace(/\w+/, expectedRel);
                      });
                      if (!newParts[2].toUpperCase().includes(expectedRel)) {
                        newParts[2] = ` ${expectedRel} `;
                      }
                      const newLine = newParts.join(',');
                      if (newLine !== line) modifiedCount++;
                      newLines[cand.lineIndex] = newLine;
                    } else {
                      if (expectedRel === 'RESELLER') {
                        let newLine = '';
                        if (line.includes('#')) {
                          const [content, comment] = line.split('#', 2);
                          newLine = `${content.trim()}, ${expectedRel} # ${comment}`;
                        } else {
                          newLine = `${line.trim()}, ${expectedRel}`;
                        }
                        if (newLine !== line) modifiedCount++;
                        newLines[cand.lineIndex] = newLine;
                      }
                    }
                  }
                }
              }
            }
          }

          if (steps.verifySellers === true && steps.sellersAction === 'remove') {
            optimizedContent = newLines.filter((l) => l !== '').join('\n');
          } else {
            optimizedContent = newLines.join('\n');
          }
          removedCount += removedSellers;
        }
      }
    }
  }

  // Step 6: Certification Authority ID Verification
  if (steps.verifyCertAuthority) {
    const lines = optimizedContent.split(/\r?\n/);
    const newLines: string[] = [];
    const entriesToCheck: { domain: string; lineIndex: number }[] = [];
    const distinctDomains = new Set<string>();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip comments, empty lines, and variables
      if (!line || line.startsWith('#') || line.includes('=')) {
        newLines.push(lines[i]); // Keep original line
        continue;
      }

      const parts = line.split(',').map((s) => s.trim());
      if (parts.length >= 2) {
        let domain = parts[0].toLowerCase();
        // strip comment if parsed crudely above
        if (domain.includes('#')) domain = domain.split('#')[0].trim();

        if (domain) {
          entriesToCheck.push({ domain, lineIndex: i });
          distinctDomains.add(domain);
        }
      }
      newLines.push(lines[i]); // Push original first, will update by index later
    }

    if (entriesToCheck.length > 0) {
      const domainList = Array.from(distinctDomains);

      // Fetch Cert IDs from DB
      const certRes = await query(
        `SELECT DISTINCT domain, certification_authority_id 
             FROM sellers_catalog 
             WHERE domain = ANY($1::text[]) 
             AND certification_authority_id IS NOT NULL`,
        [domainList],
      );

      const certMap = new Map<string, string>();
      certRes.rows.forEach((row: any) => {
        if (row.certification_authority_id) {
          certMap.set(row.domain, row.certification_authority_id);
        }
      });

      for (const entry of entriesToCheck) {
        const correctCertId = certMap.get(entry.domain);
        if (!correctCertId) continue;

        const line = newLines[entry.lineIndex];
        // Split again to reconstruct
        // Be careful to preserve comments if possible, but standard reconstruction is safer for data integrity
        // Use simple comma split for detection
        let parts = line.split(',');

        // Handle potential comment in last part
        let commentSuffix = '';
        const lastPartIndex = parts.length - 1;
        if (parts[lastPartIndex].includes('#')) {
          const [val, ...com] = parts[lastPartIndex].split('#');
          parts[lastPartIndex] = val; // remove comment from value
          commentSuffix = ' #' + com.join('#');
        }

        parts = parts.map((s) => s.trim());

        // Ensure line is valid data line
        if (parts.length < 3) continue; // Skip malformed lines

        // Check 4th field (Cert ID)
        let currentCertId = '';
        let hasCertField = parts.length >= 4 && parts[3].length > 0;

        if (hasCertField) {
          currentCertId = parts[3];
        }

        if (currentCertId !== correctCertId) {
          // Fix it
          if (parts.length < 4) {
            parts.push(correctCertId);
          } else {
            parts[3] = correctCertId;
          }

          // Reconstruct
          let newLine = parts.join(', ');
          if (commentSuffix) newLine += commentSuffix;

          if (newLine !== line) {
            newLines[entry.lineIndex] = newLine;
            certAuthorityFixed++;
          }
        }
      }
      optimizedContent = newLines.join('\n');
      modifiedCount += certAuthorityFixed;
    }
  }

  // Return result
  return c.json({
    optimizedContent,
    stats: {
      originalLines,
      finalLines: optimizedContent.split(/\r?\n/).length,
      removedCount,
      commentedCount,
      modifiedCount,
      errorsFound,
      certAuthorityFixed, // New Stat
    },
  });
});

const fetchSchema = z.object({
  domain: z.string(),
  fileType: z.enum(['ads.txt', 'app-ads.txt']).default('ads.txt'),
});

optimizerApp.post('/fetch', zValidator('json', fetchSchema), async (c) => {
  const { domain, fileType } = c.req.valid('json');

  if (!domain) {
    return c.json({ error: 'Domain is required' }, 400);
  }

  try {
    const url = `https://${domain}/${fileType}`;
    // Simple fetch implementation
    // In production, might need retry logic, user-agent rotation, proxy, etc.
    // Use configured client to handle legacy SSL (docomo.ne.jp) and redirects
    const response = await client.get(url, {
      timeout: 10000,
    });

    const text = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    return c.json({ content: text });
  } catch (error: any) {
    console.error(`Error fetching ${fileType} from ${domain}:`, error);
    return c.json({ error: `Fetch error: ${error.message}` }, 500);
  }
});

export default optimizerApp;
