import psl from 'psl';

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,}$/;

/**
 * Normalize a raw seller_domain to its registrable root (e.g. www.sub.example.com ->
 * example.com), matching how ssp-inventory treats domains. Returns null for invalid or
 * non-registrable inputs. `.jp` is intentionally excluded upstream, but we also drop it
 * here as a safety net.
 */
export function toRootDomain(input: string): string | null {
  const raw = input.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/:\d+$/, '');
  if (!raw || !raw.includes('.')) return null;
  if (raw.endsWith('.jp')) return null;
  const root = psl.get(raw);
  if (!root) return null;
  return DOMAIN_RE.test(root) ? root : null;
}

/** Run `worker` over `items` with a bounded number of concurrent executions. */
export async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function run(): Promise<void> {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await worker(items[idx]);
    }
  }
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, run);
  await Promise.all(runners);
  return results;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
