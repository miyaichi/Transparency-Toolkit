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
  let errorsFound = 0;

  // Step 1: Clean Up (Remove Errors & Duplicates)
  if (steps.removeErrors) {
    const parsedEntries = parseAdsTxtContent(content, domain);
    const validLines: string[] = [];
    errorsFound = parsedEntries.filter((e) => !e.is_valid && !e.is_variable).length;

    // Filter valid entries
    const seen = new Set<string>();

    // Sort logic to keep comments or structure?
    // Current parseAdsTxtContent splits by line. We can reconstruct.
    // However, parseAdsTxtContent returns 'entries'. Comments that are separate lines might be lost if we only use entries.
    // But parseAdsTxtContent logic: "if (!trimmedLine || trimmedLine.startsWith('#')) return null;" -> Comments are lost in entries!

    // To preserve comments, we might need a different approach or modify parseAdsTxtContent to return comments.
    // For now, let's stick to a simpler line-based approach for comments, and use parser for validation.

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

      // Check if valid using parser (parse single line)
      // We can use the already parsed entries if we map them back, or re-parse line by line.
      // parseAdsTxtContent already did the work, but mapping back to original line index is key.
      const entry = parsedEntries.find((e) => e.line_number === i + 1);

      if (entry) {
        // Invalid Record Handling
        if (!entry.is_valid) {
          if (steps.invalidAction === 'comment') {
            newLines.push(`# INVALID: ${line} (${entry.error || 'Unknown Error'})`);
          } else {
            removedCount++; // Removed
          }
          continue;
        }

        // Duplicate Check
        // Construct a key for uniqueness: domain, account_id, relationship, account_type
        // Variables are also entries
        let key = '';
        if (entry.is_variable) {
          key = `${entry.variable_type}=${entry.value} `;
        } else {
          // @ts-expect-error: entry types are mixed
          key = `${entry.domain},${entry.account_id},${entry.account_type},${entry.relationship} `.toLowerCase();
        }

        if (seen.has(key)) {
          // Duplicate Handling
          if (steps.duplicateAction === 'comment') {
            newLines.push(`# DUPLICATE: ${line} `);
          } else {
            removedCount++; // Removed
          }
          continue;
        }

        seen.add(key);
        newLines.push(line);
      } else {
        // Should ideally not be reached if parser matches lines
        // If parser failed to return entry, assume invalid?
        // For safety, keep it? or treat as invalid?
        // Treat as invalid for now if we strictly trust parser
        if (steps.invalidAction === 'comment') {
          newLines.push(`# INVALID_PARSE: ${line} `);
        } else {
          removedCount++;
        }
      }
    }

    optimizedContent = newLines.join('\n');
  }

  // Step 2: Owner Domain Verification
  // Logic: If OWNERDOMAIN is missing, add it to the top.
  // Use provided ownerDomain or fallback to publisher domain
  const targetOwnerDomain = ownerDomain || domain;

  if (steps.fixOwnerDomain && targetOwnerDomain) {
    const hasOwnerDomain = optimizedContent.split('\n').some((line) => {
      const trimmed = line.trim();
      return trimmed.toUpperCase().startsWith('OWNERDOMAIN=');
    });

    if (!hasOwnerDomain) {
      optimizedContent =
        `# OWNERDOMAIN = ${targetOwnerDomain} \nOWNERDOMAIN = ${targetOwnerDomain} \n` + optimizedContent;
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
          newLines.push(`# DISABLED_MANAGERDOMAIN: ${line} `);
        } else {
          // Only count as removed if we remove it completely
          removedManagerDomains++;
        }
        // If remove, don't push anything
      } else {
        newLines.push(line);
      }
    }

    optimizedContent = newLines.join('\n');
    removedCount += removedManagerDomains; // Add to stats
  }

  // Step 4: Sellers.json Verification
  if (steps.verifySellers) {
    const dbLines = optimizedContent.split('\n');
    const pairsToCheck: { domain: string; id: string; lineIndex: number }[] = [];
    const distinctDomains = new Set<string>();

    // First pass: Collect valid lines to check
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

      // Parse CSV line loosely: domain, id, type, certId
      const parts = line.split(',').map((s) => s.trim());
      if (parts.length >= 2) {
        const d = parts[0].toLowerCase();
        const id = parts[1]; // Keep case or normalize? Usually ID is case sensitive or insensitive depending on SSP. Keep original for now but usually IDs in sellers.json are strings.

        if (d && id) {
          pairsToCheck.push({ domain: d, id, lineIndex: i });
          distinctDomains.add(d);
        }
      }
    }

    if (pairsToCheck.length > 0) {
      const domainList = Array.from(distinctDomains);

      // 1. Check which domains exist in sellers_catalog
      // Using ANY($1) for array
      const domainRes = await query(`SELECT DISTINCT domain FROM sellers_catalog WHERE domain = ANY($1:: text[])`, [
        domainList,
      ]);
      const knownDomains = new Set(domainRes.rows.map((r: any) => r.domain));

      // 2. For known domains, check valid IDs
      // We can't easily do WHERE (domain, seller_id) IN (...) with different pairs in one query efficiently without building a huge query or temp table.
      // However, we can fetch ALL seller_ids for the known domains if the number of domains is small?
      // No, sellers_catalog is huge.

      // Better approach: simpler query or use UNNEST/VALUES
      // Let's use UNNEST with matching
      // Or just check each pair? Checking 100 pairs is 100 queries -> too slow.

      // Recommended: JOIN with VALUES
      // PostgreSQL: SELECT * FROM (VALUES ('d1', 'id1'), ('d2', 'id2')...) AS t(domain, seller_id) JOIN sellers_catalog sc ON ...

      if (knownDomains.size > 0) {
        // Filter pairs that are in knownDomains
        const candidates = pairsToCheck.filter((p) => knownDomains.has(p.domain));

        if (candidates.length > 0) {
          // Construct values list securely
          // $1, $2, ... is hard with variable length tuple list
          // Use unnest approach: passed as two arrays (domains, ids)
          const cDomains = candidates.map((c) => c.domain);
          const cIds = candidates.map((c) => c.id);

          const validRes = await query(
            `SELECT sc.domain, sc.seller_id 
                         FROM UNNEST($1:: text[], $2:: text[]) AS t(domain, seller_id) 
                         JOIN sellers_catalog sc ON sc.domain = t.domain AND sc.seller_id = t.seller_id`,
            [cDomains, cIds],
          );

          const validSet = new Set(validRes.rows.map((r: any) => `${r.domain}| ${r.seller_id} `));

          // Mark invalid lines
          // A line is invalid if:
          //   1. Its domain is in knownDomains (so we have its sellers.json)
          //   2. BUT the pair (domain, id) is NOT in validSet

          const newLines = [...dbLines];
          let removedSellers = 0;

          for (const cand of candidates) {
            const key = `${cand.domain}| ${cand.id} `;
            if (!validSet.has(key)) {
              // Invalid!
              const originalLine = newLines[cand.lineIndex];
              if (steps.sellersAction === 'comment') {
                newLines[cand.lineIndex] = `# INVALID_SELLER_ID: ${originalLine} `;
              } else {
                // Mark for removal (we will filter later or just set to null/empty string to avoid index shift issues during loop?)
                // Better: Set to null or special marker
                newLines[cand.lineIndex] = ''; // Will filter out empty lines later if we want strict removal
                removedSellers++;
              }
            }
          }

          if (steps.sellersAction === 'remove') {
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
