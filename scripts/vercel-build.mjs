// Fetch the release APK during Vercel's build, instead of uploading it from
// a laptop. Configured as `buildCommand` in vercel.json.
//
// Why: Expo's artifact CDN gives this machine a fast burst and then throttles
// to ~20 KB/s, so a 57 MB artifact took the best part of an hour to pull down
// before it could be re-uploaded. Vercel's builders sit next to it and fetch
// the same file in seconds.
//
// It also removes the trap that unpublished the download once already: the
// APK no longer has to exist on anyone's disk, so a deployment built from the
// repository is complete on its own.
//
// Everything about the release that a human chooses lives in
// landing/release.source.json (committed). Everything derived, size, hash,
// is computed here, so the two can never disagree.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, statSync } from 'node:fs';

const source = JSON.parse(readFileSync('landing/release.source.json', 'utf8'));
const OUT = 'landing/planora.apk';

console.log(`fetching ${source.artifactUrl}`);
const res = await fetch(source.artifactUrl, { redirect: 'follow' });
if (!res.ok) {
  console.error(`artifact fetch failed: ${res.status} ${res.statusText}`);
  process.exit(1);
}
const apk = Buffer.from(await res.arrayBuffer());
writeFileSync(OUT, apk);

// A truncated download must fail the build, not ship a file Android will
// refuse to parse. Check it is a complete zip, signed, and configured.
const eocd = apk.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
const fail = (why) => {
  console.error(`refusing to publish: ${why}`);
  process.exit(1);
};
if (apk.subarray(0, 2).toString() !== 'PK') fail('not a zip');
if (eocd < 0) fail('truncated, no end-of-central-directory record');

const centralDir = apk.readUInt32LE(eocd + 16);
if (!apk.subarray(centralDir - 40, centralDir).includes(Buffer.from('APK Sig Block 42', 'latin1'))) {
  fail('no v2/v3 signing block');
}
// The launch-crash guard: an APK built without EXPO_PUBLIC_* values installs
// fine and dies before its first frame.
if (!apk.includes(Buffer.from(source.supabaseRef, 'latin1'))) {
  fail(`Supabase project "${source.supabaseRef}" is not in the bundle, the app would crash on launch`);
}

const bytes = statSync(OUT).size;
const release = {
  version: source.version,
  build: source.build,
  size: `${(bytes / 1048576).toFixed(1)} MB`,
  bytes,
  minAndroid: source.minAndroid,
  released: source.released,
  sha256: createHash('sha256').update(apk).digest('hex'),
  signingCertSha256: source.signingCertSha256,
};
writeFileSync('landing/release.json', JSON.stringify(release, null, 2) + '\n');

console.log(`ok, ${release.size}, sha ${release.sha256.slice(0, 16)}…, signed, config baked in`);
