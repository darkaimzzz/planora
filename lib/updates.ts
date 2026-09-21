/**
 * Is there a newer build on the website?
 *
 * The app is distributed as a direct APK download, not through a store, so
 * nothing tells anyone that a new version exists. This is the replacement:
 * the release page publishes a small JSON file, and the app compares its own
 * version against it.
 *
 * Deliberately not an auto-updater. It reads one static file and, at most,
 * shows a banner — no background service, no install permissions, nothing
 * that runs when the app is closed.
 *
 * The caller passes its own version rather than this module reading
 * expo-constants: anything importing an Expo package can't be loaded by the
 * test runner under plain node. That rule has broken `npm test` twice.
 */
const BASE = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, '');

export type AvailableUpdate = { version: string; url: string };

/** Numeric compare of dotted versions: 1.10.0 is newer than 1.9.0. */
export function isNewer(candidate: string, current: string): boolean {
  const parts = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0);
  const a = parts(candidate);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

export async function checkForUpdate(current: string | undefined): Promise<AvailableUpdate | null> {
  if (!BASE || !current) return null;
  try {
    // A short timeout: this is a nicety, and it must never hold up the screen.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${BASE}/release.json`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const release = (await res.json()) as { version?: string };
    if (!release.version || !isNewer(release.version, current)) return null;
    return { version: release.version, url: BASE };
  } catch {
    // Offline, or the site is down. Silence is the right answer.
    return null;
  }
}
