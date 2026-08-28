/** Max concurrent SMS sends / per-recipient operations (env RESULTS_SMS_CONCURRENCY, default 10, max 50). */
export const SMS_CONCURRENCY = (() => {
  const n = Number.parseInt(process.env.RESULTS_SMS_CONCURRENCY || '10', 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 10;
})();

/** Runs `worker` over `items` with at most `limit` in flight, preserving input order. */
export async function mapBounded<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  limit = SMS_CONCURRENCY,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runners = Array.from(
    { length: Math.min(limit, Math.max(items.length, 1)) },
    async () => {
      while (true) {
        const index = next;
        next += 1;
        if (index >= items.length) break;
        results[index] = await worker(items[index]);
      }
    },
  );
  await Promise.all(runners);
  return results;
}