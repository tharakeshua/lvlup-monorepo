/**
 * `mapWithConcurrency` — run an async mapper over items with a bounded number of
 * in-flight tasks. Used by the live extraction pipeline (Pass-2 rubric batches)
 * and (later) the Map & Snipe grader/scout fan-outs.
 *
 * Order-preserving: results[i] corresponds to items[i]. Does NOT swallow errors —
 * a rejecting mapper rejects the whole call; callers that need per-item failure
 * isolation should catch inside the mapper and return a settled result object.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  const cap = Math.max(1, Math.floor(limit));
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await mapper(items[i] as T, i);
    }
  }

  const workers = Array.from({ length: Math.min(cap, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/** Split a list into fixed-size chunks (the last chunk may be smaller). */
export function chunkList<T>(items: readonly T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n));
  return out;
}
