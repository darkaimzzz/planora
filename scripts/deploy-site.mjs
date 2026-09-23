// Deploy the website, then prove the deployment is actually serving the
// release. Run with: npm run deploy
//
// Why this exists: the APK is uploaded from disk at deploy time and is not in
// the repository. The Vercel project is linked to GitHub, so for a while every
// `git push` also triggered a deployment, built from the repo, therefore with
// no APK, which silently replaced a working production deployment and turned
// the download button into a 404. It was live and verified at 21:53 and gone
// by 21:54, taken out by a push of the very commit that shipped it.
//
// Two defences, because one wasn't enough:
//   1. `git.deploymentEnabled` in vercel.json turns the push-triggered path off
//      so there is exactly one way to deploy.
//   2. This script checks the live URL afterwards and fails loudly if the APK
//      is missing or does not match its published checksum. A deploy that
//      claims success without serving the release is not a success.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';

import { required } from './env.mjs';

const SITE = process.env.SITE_URL ?? 'https://planorafun.vercel.app';
const APK = 'landing/planora.apk';
const token = required('VERCEL_TOKEN');

// ---------------------------------------------------------- preflight
//
// The APK is fetched by Vercel's build (scripts/vercel-build.mjs), not
// uploaded from here, so there is nothing local to check. What matters is what
// the site ends up serving, which is verified below against the release.json
// the build itself wrote.
const source = JSON.parse(readFileSync('landing/release.source.json', 'utf8'));
console.log(`releasing v${source.version} (${source.build}) from ${source.artifactUrl}`);

// ------------------------------------------------------------- deploy
console.log('deploying…');
const out = execFileSync(
  'npx',
  ['--yes', 'vercel@latest', 'deploy', '--prod', '--yes', `--token=${token}`],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, shell: true, stdio: ['ignore', 'pipe', 'inherit'] },
);
const alias = out.match(/https:\/\/[^\s"]+/g)?.pop() ?? '(unknown)';
console.log('deployed:', alias);

// ------------------------------------------------------------- verify
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) failures++;
};

console.log('\nverifying the live site:');
for (const path of ['/', '/privacy', '/download', '/release.json', '/.well-known/assetlinks.json']) {
  const res = await fetch(SITE + path);
  check(path, res.ok, String(res.status));
}

// The one that actually matters.
//
// Retried with a cache-buster: an edge node can still be handing out the
// previous deployment's file for a few seconds after the alias moves, and a
// stale hit here looks identical to a failed upload.
const release = await (await fetch(`${SITE}/release.json?cb=${Date.now()}`)).json();
check('release.json is the version we just built', release.version === source.version, release.version);

let res;
let served = Buffer.alloc(0);
for (let attempt = 1; attempt <= 6; attempt++) {
  res = await fetch(`${SITE}/planora.apk?cb=${Date.now()}`);
  if (res.ok) {
    served = Buffer.from(await res.arrayBuffer());
    if (served.length === release.bytes) break;
    console.log(`  …edge still on the previous file (${served.length}), retrying`);
  }
  await new Promise((r) => setTimeout(r, 5000));
}
check('/planora.apk responds', res.ok, String(res.status));
if (res.ok) {
  check('served size matches', served.length === release.bytes, `${served.length} vs ${release.bytes}`);
  check('served sha256 matches', createHash('sha256').update(served).digest('hex') === release.sha256);
  check('is a zip/apk', served.subarray(0, 2).toString() === 'PK');
  check(
    'content-type is an apk',
    (res.headers.get('content-type') ?? '').includes('android.package-archive'),
    res.headers.get('content-type') ?? '',
  );
}

  check(
    'the app config is baked in',
    served.includes(Buffer.from(source.supabaseRef, 'latin1')),
    'else it crashes on launch',
  );
  const eocd = served.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  check('complete zip (not truncated)', eocd > 0);

console.log(failures ? `\n${failures} check(s) failed, the site is NOT serving the release.` : '\nall checks passed.');
process.exit(failures ? 1 : 0);
