const INTERVAL_MS = 60 * 60 * 1000;

let started = false;
export function startSelfPing(): void {
  if (started) return;
  if (!process.env.CIES_SELF_PING_URL) return;
  started = true;
  const url = process.env.CIES_SELF_PING_URL;
  setInterval(() => {
    fetch(url).catch((err) => console.warn('[self-ping] failed:', (err as Error).message));
  }, INTERVAL_MS);
}
