import psl from 'psl';

export { mapPool } from '../lib/concurrency';

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/;

/**
 * Normalize a raw seller_domain to its registrable root (e.g. www.sub.example.com ->
 * example.com), matching how ssp-inventory treats domains. Returns null for invalid or
 * non-registrable inputs.
 */
export function toRootDomain(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/:\d+$/, '');
  if (!raw || !raw.includes('.')) return null;
  const root = psl.get(raw);
  if (!root) return null;
  return DOMAIN_RE.test(root) ? root : null;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
