// Deploys the Edge Functions through the Management API.
//
//   npm run deploy:function              # both
//   npm run deploy:function places-search # just one
//
// This exists because the Supabase CLI needs an interactive `supabase login`
// and this project's direct database host is IPv6-only. A personal access
// token is enough for this path.
import { readFileSync } from 'node:fs';
import { required } from './env.mjs';

const TOKEN = required('SUPABASE_ACCESS_TOKEN');
const PROJECT = required('EXPO_PUBLIC_SUPABASE_URL').match(/https:\/\/([^.]+)\./)?.[1];
if (!PROJECT) {
  console.error('Could not read the project ref out of EXPO_PUBLIC_SUPABASE_URL.');
  process.exit(1);
}

const FUNCTIONS = {
  'advance-plan': {
    entry: 'supabase/functions/advance-plan/index.ts',
    // Ships the app's pure slot logic alongside it, so the tie-break can't
    // drift between client and server.
    files: ['supabase/functions/advance-plan/index.ts', 'lib/availability.ts'],
    // Cron calls this with no session, so it can't require a JWT.
    verifyJwt: false,
  },
  'places-search': {
    entry: 'supabase/functions/places-search/index.ts',
    files: ['supabase/functions/places-search/index.ts'],
    // Only signed-in users may spend Google quota.
    verifyJwt: true,
  },
};

const only = process.argv[2];
if (only && !FUNCTIONS[only]) {
  console.error(`Unknown function "${only}". Try: ${Object.keys(FUNCTIONS).join(', ')}`);
  process.exit(1);
}
const slugs = only ? [only] : Object.keys(FUNCTIONS);

for (const slug of slugs) {
  const fn = FUNCTIONS[slug];

  const form = new FormData();
  form.append(
    'metadata',
    new Blob(
      [JSON.stringify({ entrypoint_path: fn.entry, name: slug, verify_jwt: fn.verifyJwt })],
      { type: 'application/json' },
    ),
  );
  for (const path of fn.files) {
    form.append('file', new Blob([readFileSync(path)], { type: 'application/typescript' }), path);
  }

  const url = `https://api.supabase.com/v1/projects/${PROJECT}/functions/deploy?slug=${slug}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}` },
    body: form,
  });
  const body = await res.json();

  if (!res.ok) {
    console.error(`${slug} failed (${res.status}):`, body);
    process.exit(1);
  }
  console.log(`Deployed ${slug} v${body.version}, ${body.status}`);
}
