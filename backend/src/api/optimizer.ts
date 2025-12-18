import { OpenAPIHono, z } from '@hono/zod-openapi';
import { zValidator } from '@hono/zod-validator';
import { query } from '../db/client';
import { parseAdsTxtContent } from '../lib/adstxt/validator';

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
    fixOwnerDomain: z.boolean().default(false),
    fixRelationship: z.boolean().default(false), // New
    fixManagerDomain: z.boolean().default(false),
    managerAction: z.enum(['remove', 'comment']).default('remove'),
    verifySellers: z.boolean().default(false),
    sellersAction: z.enum(['remove', 'comment']).default('remove'),
  }),
});

optimizerApp.post('/process', zValidator('json', optimizerSchema), async (c) => {
  const { content, domain, ownerDomain, steps } = c.req.valid('json');

  // Initial stats
  const originalLines = content.split('\n').length;
  let optimizedContent = content;
  let removedCount = 0;
  let commentedCount = 0;
  let modifiedCount = 0;
  let errorsFound = 0;

  // Step 1: Clean Up (Remove Errors & Duplicates)
  if (steps.removeErrors) {
    const parsedEntries = parseAdsTxtContent(content, domain);
    const validLines: string[] = [];
    errorsFound = parsedEntries.filter((e) => !e.is_valid && !e.is_variable).length;

    const seen = new Set<string>();
    const lines = content.split('\n');
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
    const hasOwnerDomain = optimizedContent.split('\n').some((line) => {
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
    const lines = optimizedContent.split('\n');
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
    const dbLines = optimizedContent.split('\n');
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

                  const expectedRel = sellerType === 'PUBLISHER' || sellerType === 'BOTH' ? 'DIRECT' : 'RESELLER';

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

  // Return result
  return c.json({
    optimizedContent,
    stats: {
      originalLines,
      finalLines: optimizedContent.split('\n').length,
      removedCount,
      commentedCount,
      modifiedCount,
      errorsFound,
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
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AdsTxtManager/2.0 (Compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      return c.json({ error: `Failed to fetch from ${url}: ${response.status} ${response.statusText}` }, 502);
    }

    const text = await response.text();
    return c.json({ content: text });
  } catch (error: any) {
    console.error(`Error fetching ${fileType} from ${domain}:`, error);
    return c.json({ error: `Fetch error: ${error.message}` }, 500);
  }
});

export default optimizerApp;
