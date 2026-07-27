import { detectJapanese } from './lang_detector';

describe('detectJapanese', () => {
  it('detects <html lang="ja"> with highest confidence', () => {
    const v = detectJapanese('<html lang="ja"><body>Hello</body></html>');
    expect(v.isJapanese).toBe(true);
    expect(v.method).toBe('html_lang');
    expect(v.confidence).toBeGreaterThan(0.9);
  });

  it('detects og:locale ja_JP', () => {
    const v = detectJapanese(
      '<html><head><meta property="og:locale" content="ja_JP"></head><body>x</body></html>',
    );
    expect(v.isJapanese).toBe(true);
    expect(v.method).toBe('og_locale');
  });

  it('detects Japanese via kana density when no lang tag is present', () => {
    const body = 'これは日本語のホームページです。'.repeat(10);
    const v = detectJapanese(`<html><body>${body}</body></html>`);
    expect(v.isJapanese).toBe(true);
    expect(v.method).toBe('kana');
    expect(v.kanaRatio).toBeGreaterThan(0);
  });

  it('does NOT flag Chinese (CJK without kana) as Japanese', () => {
    const body = '这是一个中文网站首页内容测试'.repeat(10);
    const v = detectJapanese(`<html lang="zh"><body>${body}</body></html>`);
    expect(v.isJapanese).toBe(false);
  });

  it('respects an explicit non-ja html lang when there is no kana', () => {
    const v = detectJapanese('<html lang="en"><body>Welcome to our site</body></html>');
    expect(v.isJapanese).toBe(false);
    expect(v.method).toBe('none');
  });

  it('kana content overrides a mislabeled non-ja tag only through explicit ja signals', () => {
    // Real Japanese kana present but tag says en -> declaredOther blocks the kana path,
    // which is the conservative behavior for wave 1.
    const body = 'ようこそ私たちのサイトへ。'.repeat(10);
    const v = detectJapanese(`<html lang="en"><body>${body}</body></html>`);
    expect(v.method).not.toBe('kana');
  });

  it('returns empty verdict for empty input', () => {
    expect(detectJapanese('').isJapanese).toBe(false);
  });
});
