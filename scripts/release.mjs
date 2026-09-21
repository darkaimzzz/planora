// Publish a build: fetch the finished APK from EAS, describe it, and stage it
// for the website. Run with: npm run release
//
// The site is deliberately dumb — one APK at a fixed path plus a small JSON
// file of facts about it — so shipping a version is "run this, then deploy",
// with nothing to edit by hand.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { X509Certificate } from 'node:crypto';

import { required } from './env.mjs';

const APK = 'landing/planora.apk';
// Same place as every other credential: .env.local, never committed.
const token = required('EXPO_TOKEN');

// ------------------------------------------------------------ find the build
const raw = execFileSync(
  'npx',
  ['--yes', 'eas-cli@latest', 'build:list', '--platform', 'android', '--limit', '10', '--json', '--non-interactive'],
  { env: { ...process.env, EXPO_TOKEN: token }, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, shell: true },
);
const builds = JSON.parse(raw.slice(raw.indexOf('[')));
const build = builds.find((b) => b.status === 'FINISHED' && b.artifacts?.applicationArchiveUrl);
if (!build) {
  console.error('No finished Android build with an artifact. Statuses:', builds.map((b) => b.status).join(', '));
  process.exit(1);
}
console.log(`build ${build.id}  ${build.status}  ${build.appVersion} (${build.appBuildVersion})`);

// ---------------------------------------------------------------- download it
const res = await fetch(build.artifacts.applicationArchiveUrl);
if (!res.ok) {
  console.error('download failed', res.status);
  process.exit(1);
}
writeFileSync(APK, Buffer.from(await res.arrayBuffer()));
const bytes = statSync(APK).size;
const file = readFileSync(APK);
const sha256 = createHash('sha256').update(file).digest('hex');
console.log(`${APK}  ${(bytes / 1048576).toFixed(1)} MB  sha256 ${sha256.slice(0, 16)}…`);

/**
 * Signing certificate fingerprint, for .well-known/assetlinks.json.
 *
 * Asked of EAS directly: it holds the keystore, and modern builds are signed
 * with the v2/v3 scheme only, so there is no META-INF/*.RSA in the APK to read
 * and no keytool on this machine either. `signingFingerprint()` below is the
 * fallback for a v1-signed build.
 */
async function fingerprintFromEas(projectId) {
  const query = `query($appId: String!) {
    app { byId(appId: $appId) { androidAppCredentials {
      androidAppBuildCredentialsList { isDefault androidKeystore { sha256CertificateFingerprint } }
    } } }
  }`;
  try {
    const res = await fetch('https://api.expo.dev/graphql', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ query, variables: { appId: projectId } }),
    });
    const json = await res.json();
    const creds = json?.data?.app?.byId?.androidAppCredentials?.[0]?.androidAppBuildCredentialsList ?? [];
    const hex = (creds.find((c) => c.isDefault) ?? creds[0])?.androidKeystore?.sha256CertificateFingerprint;
    if (!hex) return null;
    // Android wants colon-separated uppercase pairs, not a bare hex string.
    return hex.toUpperCase().match(/../g).join(':');
  } catch {
    return null;
  }
}

/**
 * Fallback: pull the certificate out of the APK's own v1 (JAR) signature.
 * Only works if the build was signed with the v1 scheme.
 */
function signingFingerprint(buf) {
  // Walk the zip's central directory from the end-of-central-directory record.
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) return null;
  let off = buf.readUInt32LE(eocd + 16);
  const count = buf.readUInt16LE(eocd + 10);

  for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) return null;
    const method = buf.readUInt16LE(off + 10);
    const compressed = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.toString('utf8', off + 46, off + 46 + nameLen);
    off += 46 + nameLen + extraLen + commentLen;

    if (!/^META-INF\/.*\.(RSA|EC|DSA)$/i.test(name)) continue;

    const lnLen = buf.readUInt16LE(local + 26);
    const leLen = buf.readUInt16LE(local + 28);
    const start = local + 30 + lnLen + leLen;
    const blob = buf.subarray(start, start + compressed);
    const der = method === 8 ? inflateRawSync(blob) : blob;

    // PKCS#7 SignedData: the certificate set is context tag [0] (0xA0). The
    // first SEQUENCE inside it is the signing certificate.
    for (let j = 0; j < der.length - 4; j++) {
      if (der[j] === 0xa0 && der[j + 1] === 0x82 && der[j + 4] === 0x30 && der[j + 5] === 0x82) {
        const certLen = der.readUInt16BE(j + 6) + 4;
        try {
          const cert = new X509Certificate(der.subarray(j + 4, j + 4 + certLen));
          return cert.fingerprint256;
        } catch {
          /* not the cert; keep scanning */
        }
      }
    }
  }
  return null;
}

const appConfig = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const fingerprint =
  (await fingerprintFromEas(appConfig.extra?.eas?.projectId)) ?? signingFingerprint(file);
console.log('signing cert sha256:', fingerprint ?? 'unavailable — App Links will not verify');

// --------------------------------------------------------------- describe it
const release = {
  version: build.appVersion ?? appConfig.version,
  build: build.appBuildVersion ?? null,
  size: `${(bytes / 1048576).toFixed(1)} MB`,
  bytes,
  // Expo SDK 57's minSdkVersion is 24.
  minAndroid: '7.0',
  released: new Date().toISOString().slice(0, 10),
  sha256,
  signingCertSha256: fingerprint,
};
writeFileSync('landing/release.json', JSON.stringify(release, null, 2) + '\n');
console.log('wrote landing/release.json');

// App Links only verify if the site publishes the signing fingerprint.
if (fingerprint) {
  const path = 'landing/.well-known/assetlinks.json';
  const links = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: appConfig.android.package,
        sha256_cert_fingerprints: [fingerprint],
      },
    },
  ];
  writeFileSync(path, JSON.stringify(links, null, 2) + '\n');
  console.log(`wrote ${path}`);
}

console.log('\nnext: npx vercel deploy --prod');
