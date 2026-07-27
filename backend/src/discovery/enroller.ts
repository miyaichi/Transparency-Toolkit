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
 * Enroll probed, Japanese, ads.txt-valid candidates into monitored_domains (tagged
 * source='discovery'), then mark the rest of the probed batch as rejected so they are
 * not re-probed.
 */
export async function enroll(opts: EnrollOptions): Promise<{ enrolled: number; rejected: number }> {
  const confFilter = opts.highConfidenceOnly ? `AND jp_confidence >= ${HIGH_CONFIDENCE}` : '';

  const res = await query(
    `SELECT domain
     FROM publisher_discovery
     WHERE status = 'probed' AND is_japanese = true AND ads_txt_valid = true
     ${confFilter}
     ORDER BY jp_confidence DESC
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

  // Retire probed candidates that will never be enrolled (not JP, or ads.txt invalid)
  // so future probe passes skip them.
  const rej = await query(
    `UPDATE publisher_discovery SET status = 'rejected'
     WHERE status = 'probed' AND (is_japanese = false OR ads_txt_valid = false)
     RETURNING domain`,
  );

  return { enrolled, rejected: rej.rows.length };
}
