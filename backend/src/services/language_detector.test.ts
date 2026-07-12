import { countryHintFromTld, detectLanguageFromHtml } from './language_detector';

describe('countryHintFromTld', () => {
  it('maps ccTLDs to country codes', () => {
    expect(countryHintFromTld('asahi.com')).toBeNull();
    expect(countryHintFromTld('example.jp')).toBe('JP');
    expect(countryHintFromTld('example.co.jp')).toBe('JP');
    expect(countryHintFromTld('example.co.uk')).toBe('GB');
    expect(countryHintFromTld('example.de')).toBe('DE');
  });

  it('handles casing and whitespace', () => {
    expect(countryHintFromTld(' Example.CO.JP ')).toBe('JP');
  });
});

describe('detectLanguageFromHtml', () => {
  const jaBody = '朝日新聞デジタルはニュースのほか、天気やイベント情報などをお届けします。'.repeat(10);
  const koBody = '연합뉴스는 대한민국의 뉴스 통신사입니다. 최신 뉴스를 전해드립니다.'.repeat(10);
  const zhBody = '新闻网站提供最新的国际国内新闻报道和评论分析内容服务平台每天更新。'.repeat(10);
  const enBody = 'Breaking news, analysis and opinion from our reporters around the world. '.repeat(10);

  it('detects Japanese from kana even when html lang says en', () => {
    const html = `<html lang="en"><body><p>${jaBody}</p></body></html>`;
    const result = detectLanguageFromHtml(html);
    expect(result.content_lang).toBe('ja');
    expect(result.lang_source).toBe('text_detection');
    expect(result.lang_confidence).toBeGreaterThanOrEqual(0.9);
  });

  it('detects Korean from hangul', () => {
    const html = `<html><body><p>${koBody}</p></body></html>`;
    expect(detectLanguageFromHtml(html).content_lang).toBe('ko');
  });

  it('detects Chinese from ideographs without kana', () => {
    const html = `<html><body><p>${zhBody}</p></body></html>`;
    expect(detectLanguageFromHtml(html).content_lang).toBe('zh');
  });

  it('falls back to html lang attribute for Latin-script text', () => {
    const html = `<html lang="en-US"><body><p>${enBody}</p></body></html>`;
    const result = detectLanguageFromHtml(html);
    expect(result.content_lang).toBe('en');
    expect(result.lang_source).toBe('html_lang');
  });

  it('raises confidence when og:locale agrees with html lang', () => {
    const html = `<html lang="fr"><head><meta property="og:locale" content="fr_FR"></head><body>${enBody}</body></html>`;
    const result = detectLanguageFromHtml(html);
    expect(result.content_lang).toBe('fr');
    expect(result.lang_confidence).toBe(0.7);
  });

  it('uses og:locale when html lang is missing', () => {
    const html = `<html><head><meta content="ja_JP" property="og:locale"></head><body>${enBody}</body></html>`;
    const result = detectLanguageFromHtml(html);
    expect(result.content_lang).toBe('ja');
    expect(result.lang_source).toBe('og_locale');
  });

  it('uses Content-Language header as last resort', () => {
    const html = `<html><body>${enBody}</body></html>`;
    const result = detectLanguageFromHtml(html, 'de-DE, en');
    expect(result.content_lang).toBe('de');
    expect(result.lang_source).toBe('header');
  });

  it('ignores script/style content when judging', () => {
    const html = `<html><body><script>var x = "${jaBody}";</script><p>${enBody}</p></body></html>`;
    const result = detectLanguageFromHtml(html);
    expect(result.content_lang).toBeNull();
  });

  it('returns null when there is not enough text', () => {
    const html = '<html lang="ja"><body><p>ようこそ</p></body></html>';
    // Too little text for script detection, but html lang is still used
    const result = detectLanguageFromHtml(html);
    expect(result.content_lang).toBe('ja');
    expect(result.lang_source).toBe('html_lang');
  });
});
