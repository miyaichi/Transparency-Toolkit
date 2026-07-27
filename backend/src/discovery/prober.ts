import http from '../lib/http';
import { parseAdsTxtContent, isAdsTxtRecord } from '../lib/adstxt/validator';
import { query } from '../db/client';
import { detectLanguageFromHtml } from '../services/language_detector';
import { mapPool } from './util';

const REQUEST_TIMEOUT = 12000;
const FAILED_RETRY_DAYS = 3;

/** Run a write, retrying a few times on connection-level failures (proxy blips). */
async function updateWithRetry(sql: string, params: any[], attempts = 4): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      await query(sql, params);
      return;
    } catch (e: any) {
      const msg = String(e?.message || e).toLowerCase();
      const transient = msg.includes('connection') || msg.includes('timeout') || msg.includes('terminated');
      if (!transient || i === attempts) throw e;
      await new Promise((r) => setTimeout(r, i * 1500));
    }
  }
}

interface Candidate {
  domain: string;
  discovered_ssp: string | null;
  seller_id: string | null;
}

interface FetchResult {
  status: number;
  data: string;
  headers: Record<string, string>;
}

/** Fetch a URL, returning the response (any status) or null on a network-level failure. */
async function fetchUrl(url: string): Promise<FetchResult | null> {
  try {
    const res = await http.get(url, {
      timeout: REQUEST_TIMEOUT,
      responseType: 'text',
      maxRedirects: 5,
      validateStatus: () => true,
      // Discovery probes millions of mostly-junk domains; the shared client's 3 retries
      // would dominate runtime on dead hosts. One retry is enough for transient blips.
      'axios-retry': { retries: 1 },
    } as any);
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(res.headers || {})) {
      headers[k.toLowerCase()] = Array.isArray(v) ? v.join(', ') : String(v);
    }
    return { status: res.status, data: typeof res.data === 'string' ? res.data : String(res.data), headers };
  } catch {
    return null;
  }
}

/** Try candidate URLs in order, returning the first 2xx response, else the last response seen. */
async function fetchFirst(urls: string[]): Promise<FetchResult | null> {
  let last: FetchResult | null = null;
  for (const url of urls) {
    const r = await fetchUrl(url);
    if (r) {
      last = r;
      if (r.status >= 200 && r.status < 300) return r;
    }
  }
  return last;
}

/** Does the ads.txt content declare the (ssp, seller_id) relationship? */
function adsTxtDeclares(content: string, domain: string, ssp: string | null, sellerId: string | null): boolean {
  if (!ssp || !sellerId) return false;
  const entries = parseAdsTxtContent(content, domain);
  const wantSsp = ssp.trim().toLowerCase();
  const wantId = sellerId.trim();
  for (const entry of entries) {
    if (isAdsTxtRecord(entry) && entry.domain?.trim().toLowerCase() === wantSsp && entry.account_id?.trim() === wantId) {
      return true;
    }
  }
  return false;
}

interface JpVerdict {
  isJapanese: boolean;
  method: string;
  confidence: number;
}

interface Probe {
  adsTxtValid: boolean;
  httpStatus: number | null;
  jp: JpVerdict;
  reached: boolean;
}

const NO_JP: JpVerdict = { isJapanese: false, method: 'none', confidence: 0 };

async function probeOne(c: Candidate): Promise<Probe> {
  // --- ads.txt ---
  const adsRes = await fetchFirst([`https://${c.domain}/ads.txt`, `http://${c.domain}/ads.txt`]);
  let adsTxtValid = false;
  const httpStatus = adsRes?.status ?? null;
  if (adsRes && adsRes.status >= 200 && adsRes.status < 300 && adsRes.data && !adsRes.data.trimStart().startsWith('<')) {
    adsTxtValid = adsTxtDeclares(adsRes.data, c.domain, c.discovered_ssp, c.seller_id);
  }

  // --- homepage / language detection ---
  // Uses the shared detector, which weighs actual page script (kana) ABOVE declared
  // metadata. That ordering matters here: many Japanese publishers on gTLDs ship a
  // template default of lang="en", and trusting the attribute would reject exactly the
  // population this pipeline exists to find.
  const homeRes = await fetchFirst([`https://${c.domain}`, `http://${c.domain}`, `https://www.${c.domain}`]);
  let jp = NO_JP;
  if (homeRes && homeRes.status >= 200 && homeRes.status < 300 && homeRes.data) {
    const signal = detectLanguageFromHtml(homeRes.data, homeRes.headers['content-language']);
    jp = {
      isJapanese: signal.content_lang === 'ja',
      method: signal.lang_source ?? 'none',
      confidence: signal.lang_confidence ?? 0,
    };
  }

  return { adsTxtValid, httpStatus, jp, reached: !!(adsRes || homeRes) };
}

/**
 * Probe up to `limit` pending (or due-for-retry) candidates and write verdicts back.
 * Returns counts for logging.
 */
export async function probePending(
  limit: number,
  concurrency = 20,
): Promise<{ probed: number; jpValid: number; failed: number }> {
  const res = await query(
    `SELECT domain, discovered_ssp, seller_id
     FROM publisher_discovery
     WHERE status = 'pending'
        OR (status = 'failed' AND (next_probe_at IS NULL OR next_probe_at <= NOW()))
     ORDER BY queued_at
     LIMIT $1`,
    [limit],
  );
  const candidates = res.rows as Candidate[];
  if (candidates.length === 0) return { probed: 0, jpValid: 0, failed: 0 };

  let probed = 0;
  let jpValid = 0;
  let failed = 0;

  let skipped = 0;

  await mapPool(candidates, concurrency, async (c) => {
    // Isolate each candidate: a transient DB drop (the Cloud SQL proxy token expires
    // ~hourly) must only skip the in-flight row — which stays 'pending' for the next
    // run — instead of aborting the whole batch.
    try {
      let p: Probe;
      try {
        p = await probeOne(c);
      } catch (e: any) {
        await updateWithRetry(
          `UPDATE publisher_discovery
           SET status = 'failed', retry_count = retry_count + 1,
               next_probe_at = NOW() + ($2 || ' days')::interval, error_message = $3
           WHERE domain = $1`,
          [c.domain, FAILED_RETRY_DAYS, String(e?.message || e).slice(0, 500)],
        );
        failed++;
        return;
      }

      if (!p.reached) {
        await updateWithRetry(
          `UPDATE publisher_discovery
           SET status = 'failed', retry_count = retry_count + 1,
               next_probe_at = NOW() + ($2 || ' days')::interval, error_message = 'unreachable'
           WHERE domain = $1`,
          [c.domain, FAILED_RETRY_DAYS],
        );
        failed++;
        return;
      }

      await updateWithRetry(
        `UPDATE publisher_discovery
         SET status = 'probed', probed_at = NOW(), error_message = NULL,
             ads_txt_valid = $2, http_status = $3,
             is_japanese = $4, jp_method = $5, jp_confidence = $6
         WHERE domain = $1`,
        [c.domain, p.adsTxtValid, p.httpStatus, p.jp.isJapanese, p.jp.method, p.jp.confidence],
      );
      probed++;
      if (p.jp.isJapanese && p.adsTxtValid) jpValid++;
    } catch {
      // DB write still failing after retries — leave the row pending and move on.
      skipped++;
    }
  });

  if (skipped) console.warn(`Skipped ${skipped} row(s) after DB write failures (left pending).`);
  return { probed, jpValid, failed };
}
