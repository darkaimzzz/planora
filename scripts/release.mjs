// Point the website at the latest finished Android build. Run: npm run release
//
// This used to download the 57 MB artifact and re-upload it at deploy time.
// Expo's CDN throttles this machine to ~20 KB/s (Vercel gets 690 KB/s from the
// same connection), so that took the best part of an hour. Now the only thing
// recorded here is *which* build to publish; Vercel's build fetches it, checks
// it, and derives the size and checksum — see scripts/vercel-build.mjs.
//
// After this, run `npm run deploy`.
import { readFileSync, writeFileSync } from 'node:fs';

import { required } from './env.mjs';

const SOURCE = 'landing/release.source.json';
const token = required('EXPO_TOKEN');
const appConfig = JSON.parse(readFileSync('app.json', 'utf8')).expo;
const projectId = appConfig.extra?.eas?.projectId;

const gql = async (query, variables = {}) => {
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors.map((e) => e.message).join('; '));
  return json.data;
};

// ------------------------------------------------- the build to publish
const data = await gql(
  `query($appId: String!) {
    app { byId(appId: $appId) { builds(limit: 10, offset: 0, filter: { platform: ANDROID }) {
      id status appVersion appBuildVersion artifacts { applicationArchiveUrl }
    } } }
  }`,
  { appId: projectId },
);
const build = (data?.app?.byId?.builds ?? []).find(
  (b) => b.status === 'FINISHED' && b.artifacts?.applicationArchiveUrl,
);
if (!build) {
  console.error('No finished Android build with an artifact. Run `npm run build:apk` first.');
  process.exit(1);
}

// --------------------------------------------------- the signing fingerprint
// Read from EAS rather than the APK: builds are signed with the v2/v3 scheme
// only, so there is no v1 block in the file to read a certificate out of.
const creds = await gql(
  `query($appId: String!) {
    app { byId(appId: $appId) { androidAppCredentials {
      androidAppBuildCredentialsList { isDefault androidKeystore { sha256CertificateFingerprint } }
    } } }
  }`,
  { appId: projectId },
);
const list = creds?.app?.byId?.androidAppCredentials?.[0]?.androidAppBuildCredentialsList ?? [];
const hex = (list.find((c) => c.isDefault) ?? list[0])?.androidKeystore?.sha256CertificateFingerprint;
const fingerprint = hex ? hex.toUpperCase().match(/../g).join(':') : null;

// --------------------------------------------------------------- record it
const source = JSON.parse(readFileSync(SOURCE, 'utf8'));
const next = {
  ...source,
  version: build.appVersion ?? appConfig.version,
  build: build.appBuildVersion ?? source.build,
  released: new Date().toISOString().slice(0, 10),
  artifactUrl: build.artifacts.applicationArchiveUrl,
  supabaseRef: new URL(required('EXPO_PUBLIC_SUPABASE_URL')).hostname.split('.')[0],
  signingCertSha256: fingerprint ?? source.signingCertSha256,
};
writeFileSync(SOURCE, JSON.stringify(next, null, 2) + '\n');

// App Links only verify if the site publishes the signing fingerprint.
if (next.signingCertSha256) {
  writeFileSync(
    'landing/.well-known/assetlinks.json',
    JSON.stringify(
      [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: appConfig.android.package,
            sha256_cert_fingerprints: [next.signingCertSha256],
          },
        },
      ],
      null,
      2,
    ) + '\n',
  );
}

console.log(`build ${build.id.slice(0, 8)} — v${next.version} (${next.build})`);
console.log(`wrote ${SOURCE}`);
console.log('\nnext: npm run deploy');
