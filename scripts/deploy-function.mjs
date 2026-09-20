// Deploys the advance-plan Edge Function through the Management API.
//
//   npm run deploy:function
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

const ENTRY = 'supabase/functions/advance-plan/index.ts';
// The function imports the app's pure slot logic, so that file ships with it —
// one source of truth for the tie-break across client and server.
const FILES = [ENTRY, 'lib/availability.ts'];

const form = new FormData();
form.append(
  'metadata',
  new Blob(
    [JSON.stringify({ entrypoint_path: ENTRY, name: 'advance-plan', verify_jwt: false })],
    { type: 'application/json' },
  ),
);
for (const path of FILES) {
  form.append('file', new Blob([readFileSync(path)], { type: 'application/typescript' }), path);
}

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT}/functions/deploy?slug=advance-plan`,
  { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: form },
);
const body = await res.json();

if (!res.ok) {
  console.error(`Deploy failed (${res.status}):`, body);
  process.exit(1);
}
console.log(`Deployed advance-plan v${body.version} — ${body.status}`);
