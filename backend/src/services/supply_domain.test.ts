import { normalizeSupplyDomain } from './adstxt_scanner';

describe('normalizeSupplyDomain', () => {
  it('accepts plain hostnames', () => {
    expect(normalizeSupplyDomain('pubmatic.com')).toBe('pubmatic.com');
    expect(normalizeSupplyDomain('ads.example.co.jp')).toBe('ads.example.co.jp');
  });

  it('lowercases and trims', () => {
    expect(normalizeSupplyDomain('  PubMatic.COM  ')).toBe('pubmatic.com');
  });

  // Every case below was found in supply_domain_refs after the initial backfill,
  // where it became an unresolvable sellers.json fetch target.
  it('strips a UTF-8 BOM, including repeated ones', () => {
    expect(normalizeSupplyDomain('﻿flashb.id')).toBe('flashb.id');
    expect(normalizeSupplyDomain('﻿﻿pubmatic.com')).toBe('pubmatic.com');
  });

  it('strips stray quotes and autolink brackets', () => {
    expect(normalizeSupplyDomain('"criteo.com')).toBe('criteo.com');
    expect(normalizeSupplyDomain('?viously.com')).toBe('viously.com');
    expect(normalizeSupplyDomain('<smartadserver.com>')).toBe('smartadserver.com');
  });

  it('rejects embedded whitespace', () => {
    expect(normalizeSupplyDomain('39\tappnexus.com')).toBeNull();
    expect(normalizeSupplyDomain('10 indexexchange.com')).toBeNull();
  });

  it('rejects fragments that are not hostnames', () => {
    expect(normalizeSupplyDomain('11.1%')).toBeNull();
    expect(normalizeSupplyDomain('{"baseurl":"https://s.w.org/images/"')).toBeNull();
    expect(normalizeSupplyDomain('pubmatic.com<http://pubmatic.com>')).toBeNull();
    expect(normalizeSupplyDomain('ad_stir.com')).toBeNull();
    expect(normalizeSupplyDomain('nodot')).toBeNull();
    expect(normalizeSupplyDomain('')).toBeNull();
    expect(normalizeSupplyDomain('-leading.com')).toBeNull();
  });
});
