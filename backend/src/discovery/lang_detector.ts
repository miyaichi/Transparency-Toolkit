/**
 * Multi-dimensional Japanese content detection.
 *
 * Ported and improved from the Python `jp_publisher_extractor` tool. Because this
 * pipeline targets gTLD (.com etc.) publishers, the TLD gives no signal — the verdict
 * must come from the page itself. We combine several signals rather than relying on any
 * single one:
 *
 *   1. <html lang="ja"> attribute            (strongest, explicit author intent)
 *   2. og:locale = ja_JP meta                 (strong)
 *   3. Content-Language header / http-equiv   (supporting)
 *   4. Kana ratio of visible text             (decisive discriminator vs. Chinese)
 *
 * Improvement over the Python version: kana (hiragana/katakana) is scored SEPARATELY
 * from kanji. Chinese pages are full of CJK ideographs but contain no kana, so requiring
 * kana presence makes the detector robust against Chinese false positives without needing
 * a probabilistic language model.
 */

export interface JpVerdict {
  isJapanese: boolean;
  method: 'html_lang' | 'og_locale' | 'content_language' | 'kana' | 'none';
  confidence: number; // 0..1
  charRatio: number; // (kana + kanji) / visible chars
  kanaRatio: number; // kana / visible chars
}

const HIRAGANA_KATAKANA = /[぀-ゟ゠-ヿ]/g;
const KANJI = /[一-鿿㐀-䶿]/g;

// Thresholds. Mirror the Python tool's char-ratio gate but add a kana-presence gate.
const MIN_KANA_COUNT = 12; // absolute floor so tiny snippets don't trigger
const MIN_KANA_RATIO = 0.02; // kana must be a real fraction of the text
const MIN_CJK_RATIO = 0.1; // total Japanese-script density (matches Python MIN_RATIO)

function langIsJa(value: string | undefined | null): boolean {
  return !!value && value.trim().toLowerCase().startsWith('ja');
}

/** Extract the value of an attribute from a raw tag string. */
function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*["']?\\s*([^"'>\\s]+)`, 'i'));
  return m?.[1];
}

/** Strip scripts/styles/tags and collapse whitespace to approximate visible text. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Detect whether an HTML document is Japanese.
 *
 * @param html    Raw HTML of the homepage.
 * @param headers Optional response headers (lowercased keys) for Content-Language.
 */
export function detectJapanese(html: string, headers?: Record<string, string>): JpVerdict {
  const empty: JpVerdict = {
    isJapanese: false,
    method: 'none',
    confidence: 0,
    charRatio: 0,
    kanaRatio: 0,
  };
  if (!html) return empty;

  const head = html.slice(0, 8000);

  // --- Signal 1: <html lang> ---
  const htmlTag = head.match(/<html\b[^>]*>/i)?.[0];
  const htmlLang = htmlTag ? attr(htmlTag, 'lang') : undefined;

  // --- Signal 2: og:locale ---
  let ogLocale: string | undefined;
  for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    if (/property\s*=\s*["']?\s*og:locale/i.test(tag)) {
      ogLocale = attr(tag, 'content');
      break;
    }
  }

  // --- Signal 3: Content-Language (header or http-equiv meta) ---
  let contentLang = headers?.['content-language'];
  if (!contentLang) {
    for (const m of head.matchAll(/<meta\b[^>]*>/gi)) {
      const tag = m[0];
      if (/http-equiv\s*=\s*["']?\s*content-language/i.test(tag)) {
        contentLang = attr(tag, 'content');
        break;
      }
    }
  }

  // --- Signal 4: script-character density ---
  const text = visibleText(html).slice(0, 8000);
  const totalChars = Math.max(text.replace(/\s/g, '').length, 1);
  const kanaCount = (text.match(HIRAGANA_KATAKANA) || []).length;
  const kanjiCount = (text.match(KANJI) || []).length;
  const kanaRatio = kanaCount / totalChars;
  const charRatio = (kanaCount + kanjiCount) / totalChars;

  const hasKana = kanaCount >= MIN_KANA_COUNT && kanaRatio >= MIN_KANA_RATIO;

  // Explicit non-Japanese declaration is a negative signal, but real Japanese kana
  // content overrides a mislabeled tag.
  const declaredOther =
    (htmlLang && !langIsJa(htmlLang)) || (ogLocale && !langIsJa(ogLocale));

  // Decision, most-confident signal first.
  if (langIsJa(htmlLang)) {
    return { isJapanese: true, method: 'html_lang', confidence: 0.99, charRatio, kanaRatio };
  }
  if (langIsJa(ogLocale)) {
    return { isJapanese: true, method: 'og_locale', confidence: 0.95, charRatio, kanaRatio };
  }
  if (langIsJa(contentLang) && (hasKana || charRatio >= MIN_CJK_RATIO)) {
    return { isJapanese: true, method: 'content_language', confidence: 0.9, charRatio, kanaRatio };
  }
  if (hasKana && charRatio >= MIN_CJK_RATIO && !declaredOther) {
    // Confidence scales with how dense the Japanese script is.
    const confidence = Math.min(0.6 + charRatio, 0.95);
    return { isJapanese: true, method: 'kana', confidence, charRatio, kanaRatio };
  }

  return { ...empty, charRatio, kanaRatio };
}
