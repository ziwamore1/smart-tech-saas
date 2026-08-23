const target = process.argv[2] || 'http://localhost:3001/api/v1/health';
const max = Number(process.argv[3] || 60);
(async () => {
  for (let i = 1; i <= max; i++) {
    try {
      const r = await fetch(target, { signal: AbortSignal.timeout(2500) });
      if (r.ok) { console.log(`HEALTHY after ${i} polls (${i * 0.9 | 0}s)`); process.exit(0); }
    } catch {}
    await new Promise(r => setTimeout(r, 900));
  }
  console.log('UNHEALTHY: gave up');
  process.exit(1);
})();
