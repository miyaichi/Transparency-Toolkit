import { query } from '../db/client';
import { MonitoredDomainsService } from '../services/monitored_domains';

const monitored = new MonitoredDomainsService();

export interface EnrollOptions {
  /** Max domains to enroll in this wave (report-safety throttle). */
  max: number;
  /**
   * Conservative wave: only enroll high-confidence detections. The shared detector
   * scores hard script evidence (kana) at 0.95 and merely-declared metadata at 0.5-0.7,
   * so this gates on confidence rather than on a particular signal.
   */
  highConfidenceOnly?: boolean;
}

/** Confidence at or above which a detection counts as hard evidence (kana script). */
const HIGH_CONFIDENCE = 0.9;

/**
 * Qualifies as Japanese inventory.
 *
 * A `.jp` registration is sufficient on its own — the market, not the page language, is
 * what makes inventory Japanese. japantimes.co.jp publishes in English for residents of
 * Japan and carries Japanese advertisers' spend; gating it on kana would drop it. For
 * every other TLD there is no such signal, so content detection decides.
 */
const IS_JP_INVENTORY = `(domain LIKE '%.jp' OR is_japanese = true)`;

/**
 * Enroll probed, ads.txt-valid Japanese inventory into monitored_domains (tagged
 * source='discovery'), then mark the rest of the probed batch as rejected so they are
 * not re-probed.
 */
export async function enroll(opts: EnrollOptions): Promise<{ enrolled: number; rejected: number }> {
  // `.jp` counts as hard evidence too, so it is never held back by the conservative wave.
  const confFilter = opts.highConfidenceOnly
    ? `AND (jp_confidence >= ${HIGH_CONFIDENCE} OR domain LIKE '%.jp')`
    : '';

  const res = await query(
    `SELECT domain
     FROM publisher_discovery
     WHERE status = 'probed' AND ads_txt_valid = true AND ${IS_JP_INVENTORY}
     ${confFilter}
     ORDER BY jp_confidence DESC NULLS LAST
     LIMIT $1`,
    [opts.max],
  );
  const domains = (res.rows as { domain: string }[]).map((r) => r.domain);

  let enrolled = 0;
  if (domains.length > 0) {
    await monitored.bulkAddDomains(domains, 'ads.txt', 'discovery');
    const upd = await query(
      `UPDATE publisher_discovery SET status = 'enrolled'
       WHERE domain = ANY($1::text[]) RETURNING domain`,
      [domains],
    );
    enrolled = upd.rows.length;
  }

  // Retire probed candidates that will never be enrolled (not Japanese inventory, or
  // ads.txt invalid) so future probe passes skip them. This must use the same predicate
  // as the selection above, or an English-language `.jp` site would be rejected here
  // instead of waiting for the next batch.
  const rej = await query(
    `UPDATE publisher_discovery SET status = 'rejected'
     WHERE status = 'probed' AND (NOT ${IS_JP_INVENTORY} OR ads_txt_valid = false)
     RETURNING domain`,
  );

  return { enrolled, rejected: rej.rows.length };
}

/**
 * Re-queue candidates that were rejected purely on a language verdict while their
 * ads.txt was valid. Needed after a detector change: those rows carry a verdict from the
 * old logic, and 'rejected' otherwise permanently suppresses re-probing. Rows rejected
 * for an invalid ads.txt are left alone — the language call never mattered for them.
 */
export async function resetLanguageRejections(): Promise<{ requeued: number }> {
  const res = await query(
    `UPDATE publisher_discovery
     SET status = 'pending', probed_at = NULL, error_message = NULL,
         is_japanese = NULL, jp_method = NULL, jp_confidence = NULL
     WHERE status = 'rejected' AND ads_txt_valid = true AND is_japanese = false
     RETURNING domain`,
  );
  return { requeued: res.rows.length };
}
