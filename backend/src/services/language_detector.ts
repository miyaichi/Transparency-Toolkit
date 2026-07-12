import psl from 'psl';
import { query } from '../db/client';
import client from '../lib/http';

export interface LanguageDetection {
  domain: string;
  content_lang: string | null;
  lang_confidence: number | null;
  lang_source: string | null;
  country_hint: string | null;
  fetch_status: number;
  error_message: string | null;
}

// Re-detect successful results after ~180 days, failures after ~30 days.
const SUCCESS_TTL_DAYS = 180;
const FAILURE_TTL_DAYS = 30;
const JITTER_DAYS = 14;

// Only analyze the head of the document; language signals (html lang, og:locale,
// navigation text) are concentrated there and this caps regex work on huge pages.
const ANALYZE_MAX_CHARS = 200_000;

/**
 * Detects the content language of a domain's root page and persists it to
 * domain_metadata. Designed to piggyback on batch ads.txt scans: callers invoke
 * detectIfDue() right after a scan, and it no-ops when a fresh result exists.
 */
export class LanguageDetector {
  /**
   * Run detection only if there is no fresh result for the domain.
   * Never throws; failures are recorded in domain_metadata and logged.
   * Returns the detection result, or null when skipped (fresh result exists).
   */
  async detectIfDue(domain: string): Promise<LanguageDetection | null> {
    const normalized = domain.toLowerCase().trim();
    try {
      const due = await query(`SELECT 1 FROM domain_metadata WHERE domain = $1 AND next_detect_at > NOW()`, [
        normalized,
      ]);
      if (due.rows.length > 0) return null;

      const result = await this.detect(normalized);
      await this.save(result);
      return result;
    } catch (e: any) {
      console.error(`[lang] Detection failed for ${normalized}: ${e.message}`);
      return null;
    }
  }

  /**
   * Fetch the root page and detect its language. Does not touch the DB.
   */
  async detect(domain: string): Promise<LanguageDetection> {
    const base: LanguageDetection = {
      domain,
      content_lang: null,
      lang_confidence: null,
      lang_source: null,
      country_hint: countryHintFromTld(domain),
      fetch_status: 0,
      error_message: null,
    };

    let html = '';
    let contentLanguageHeader: string | undefined;
    try {
      const res = await this.fetchRootPage(domain);
      html = res.html;
      contentLanguageHeader = res.contentLanguage;
      base.fetch_status = res.status;
    } catch (e: any) {
      base.fetch_status = e.response?.status || 0;
      base.error_message = String(e.message).slice(0, 500);
      return base;
    }

    const detected = detectLanguageFromHtml(html, contentLanguageHeader);
    return { ...base, ...detected };
  }

  private async fetchRootPage(domain: string): Promise<{ html: string; status: number; contentLanguage?: string }> {
    const options = {
      timeout: 8000,
      maxRedirects: 5,
      maxContentLength: 2 * 1024 * 1024,
      responseType: 'text' as const,
      // Neutral Accept-Language so multilingual sites serve their default locale
      // (the shared client sends en-US, which would bias geo-serving sites to English).
      headers: { 'Accept-Language': '*' },
      // Don't burn axios-retry attempts on 4xx; treat them as a definitive answer.
      validateStatus: (s: number) => s >= 200 && s < 400,
      // Language detection is best-effort and piggybacks on scans; a slow root page
      // must not stretch the batch. Disable the shared client's retries so a single
      // detection is bounded to ~timeout, not timeout x (1 + retries).
      'axios-retry': { retries: 0 },
    };

    try {
      const res = await client.get(`https://${domain}/`, options);
      return {
        html: typeof res.data === 'string' ? res.data : '',
        status: res.status,
        contentLanguage: res.headers?.['content-language'],
      };
    } catch (e: any) {
      const res = await client.get(`http://${domain}/`, options);
      return {
        html: typeof res.data === 'string' ? res.data : '',
        status: res.status,
        contentLanguage: res.headers?.['content-language'],
      };
    }
  }

  private async save(result: LanguageDetection): Promise<void> {
    const success = result.fetch_status >= 200 && result.fetch_status < 400;
    const ttlDays = success ? SUCCESS_TTL_DAYS : FAILURE_TTL_DAYS;
    const jitterMinutes = Math.floor(Math.random() * JITTER_DAYS * 24 * 60);

    await query(
      `INSERT INTO domain_metadata
         (domain, content_lang, lang_confidence, lang_source, country_hint,
          fetch_status, error_message, detected_at, next_detect_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(),
               NOW() + make_interval(days => $8, mins => $9), NOW())
       ON CONFLICT (domain) DO UPDATE SET
         content_lang = EXCLUDED.content_lang,
         lang_confidence = EXCLUDED.lang_confidence,
         lang_source = EXCLUDED.lang_source,
         country_hint = EXCLUDED.country_hint,
         fetch_status = EXCLUDED.fetch_status,
         error_message = EXCLUDED.error_message,
         detected_at = EXCLUDED.detected_at,
         next_detect_at = EXCLUDED.next_detect_at,
         updated_at = NOW()`,
      [
        result.domain,
        result.content_lang,
        result.lang_confidence,
        result.lang_source,
        result.country_hint,
        result.fetch_status,
        result.error_message,
        ttlDays,
        jitterMinutes,
      ],
    );
  }
}

/**
 * ccTLD → ISO 3166-1 alpha-2 country hint ('example.co.jp' → 'JP').
 * Returns null for gTLDs (.com, .net, ...).
 */
export function countryHintFromTld(domain: string): string | null {
  const parsed = psl.parse(domain.toLowerCase().trim());
  if ('error' in parsed || !parsed.tld) return null;
  const lastLabel = parsed.tld.split('.').pop() || '';
  // ccTLDs are exactly two ASCII letters; 'uk' is the one ccTLD that differs
  // from its ISO code (GB).
  if (!/^[a-z]{2}$/.test(lastLabel)) return null;
  return lastLabel === 'uk' ? 'GB' : lastLabel.toUpperCase();
}

interface LangSignal {
  content_lang: string | null;
  lang_confidence: number | null;
  lang_source: string | null;
}

/**
 * Detect the primary content language of an HTML document.
 *
 * Priority:
 * 1. Script-based text detection (kana => ja, hangul => ko, ...) — hard evidence
 *    from the actual content, immune to template-default lang="en" attributes.
 * 2. <html lang> / og:locale / Content-Language header — declared metadata,
 *    moderate confidence because templates frequently leave defaults in place.
 */
export function detectLanguageFromHtml(html: string, contentLanguageHeader?: string): LangSignal {
  const head = html.slice(0, ANALYZE_MAX_CHARS);

  const text = extractVisibleText(head);
  const scriptLang = detectLanguageByScript(text);
  if (scriptLang) {
    return { content_lang: scriptLang.lang, lang_confidence: scriptLang.confidence, lang_source: 'text_detection' };
  }

  const htmlLang = normalizeLangCode(matchAttr(head, /<html[^>]*\slang\s*=\s*["']?([a-zA-Z_-]+)/i));
  const ogLocale = normalizeLangCode(matchOgLocale(head));

  if (htmlLang) {
    // Agreement between two declared sources raises confidence a notch.
    const confidence = ogLocale && ogLocale === htmlLang ? 0.7 : 0.6;
    return { content_lang: htmlLang, lang_confidence: confidence, lang_source: 'html_lang' };
  }
  if (ogLocale) {
    return { content_lang: ogLocale, lang_confidence: 0.6, lang_source: 'og_locale' };
  }

  const headerLang = normalizeLangCode(contentLanguageHeader?.split(',')[0]);
  if (headerLang) {
    return { content_lang: headerLang, lang_confidence: 0.5, lang_source: 'header' };
  }

  return { content_lang: null, lang_confidence: null, lang_source: null };
}

function matchAttr(html: string, re: RegExp): string | undefined {
  return re.exec(html)?.[1];
}

function matchOgLocale(html: string): string | undefined {
  // Attribute order varies: property before content and vice versa.
  return (
    /<meta[^>]+property\s*=\s*["']og:locale["'][^>]+content\s*=\s*["']([a-zA-Z_-]+)["']/i.exec(html)?.[1] ??
    /<meta[^>]+content\s*=\s*["']([a-zA-Z_-]+)["'][^>]+property\s*=\s*["']og:locale["']/i.exec(html)?.[1]
  );
}

/** 'ja-JP' / 'ja_JP' / 'JA' → 'ja' */
function normalizeLangCode(raw?: string | null): string | null {
  if (!raw) return null;
  const primary = raw.trim().toLowerCase().split(/[-_]/)[0];
  return /^[a-z]{2,3}$/.test(primary) ? primary : null;
}

function extractVisibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ');
}

/**
 * Detect language from character scripts in visible text. Only returns a result
 * for scripts that map (near-)unambiguously to a language; Latin-script text is
 * left to the declared-metadata fallbacks.
 */
function detectLanguageByScript(text: string): { lang: string; confidence: number } | null {
  const counts = {
    kana: countMatches(text, /[\u3040-\u30FF]/g), // hiragana + katakana
    hangul: countMatches(text, /[\uAC00-\uD7AF\u1100-\u11FF]/g),
    cjkIdeograph: countMatches(text, /[\u4E00-\u9FFF]/g),
    thai: countMatches(text, /[\u0E00-\u0E7F]/g),
    arabic: countMatches(text, /[\u0600-\u06FF]/g),
    hebrew: countMatches(text, /[\u0590-\u05FF]/g),
    cyrillic: countMatches(text, /[\u0400-\u04FF]/g),
    greek: countMatches(text, /[\u0370-\u03FF]/g),
    latin: countMatches(text, /[a-zA-Z\u00C0-\u024F]/g),
  };
  const totalLetters = Object.values(counts).reduce((a, b) => a + b, 0);
  if (totalLetters < 100) return null; // Not enough text to judge (SPA shells, error pages)

  const ratio = (n: number) => n / totalLetters;

  // Kana is unique to Japanese — even a modest share is decisive.
  if (ratio(counts.kana) >= 0.05) return { lang: 'ja', confidence: 0.95 };
  if (ratio(counts.hangul) >= 0.1) return { lang: 'ko', confidence: 0.95 };
  // CJK ideographs without kana → Chinese (Japanese body text without any kana is rare).
  if (ratio(counts.cjkIdeograph) >= 0.2 && ratio(counts.kana) < 0.01) {
    return { lang: 'zh', confidence: 0.8 };
  }
  if (ratio(counts.thai) >= 0.2) return { lang: 'th', confidence: 0.9 };
  if (ratio(counts.arabic) >= 0.2) return { lang: 'ar', confidence: 0.8 };
  if (ratio(counts.hebrew) >= 0.2) return { lang: 'he', confidence: 0.9 };
  if (ratio(counts.cyrillic) >= 0.3) return { lang: 'ru', confidence: 0.6 };
  if (ratio(counts.greek) >= 0.3) return { lang: 'el', confidence: 0.9 };

  return null;
}

function countMatches(text: string, re: RegExp): number {
  return text.match(re)?.length ?? 0;
}
