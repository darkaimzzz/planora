// Minimal .env.local reader. The dev scripts need the secret key (to create
// confirmed test users via the auth admin API), and that key must never be
// hardcoded into a committed file.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function parse(file) {
  let text;
  try {
    text = readFileSync(join(root, file), 'utf8');
  } catch {
    return {};
  }
  const out = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = { ...parse('.env.local'), ...process.env };

export function required(name) {
  const value = env[name];
  if (!value) {
    console.error(
      `Missing ${name}. Copy .env.example to .env.local and fill it in.`,
    );
    process.exit(1);
  }
  return value;
}

export const BASE = required('EXPO_PUBLIC_SUPABASE_URL');
export const PUBLISHABLE = required('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
export const SECRET = required('SUPABASE_SECRET_KEY');

/** Fetch against the project as a given user (or the secret key). */
export async function api(path, { token = PUBLISHABLE, method = 'GET', body, prefer } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      apikey: token === SECRET ? SECRET : PUBLISHABLE,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(prefer ? { prefer } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (res.status >= 400) {
    throw new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(json).slice(0, 200)}`);
  }
  return json;
}

/** Create (or reuse) a confirmed test account and sign in as it. */
export async function testUser(email, displayName, avatarColor) {
  await fetch(`${BASE}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: SECRET, authorization: `Bearer ${SECRET}`, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD, email_confirm: true }),
  });
  const res = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: PUBLISHABLE, 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: TEST_PASSWORD }),
  });
  const session = await res.json();
  if (!session.access_token) throw new Error(`could not sign in as ${email}: ${JSON.stringify(session)}`);

  await api(`/rest/v1/profiles?id=eq.${session.user.id}`, {
    token: session.access_token,
    method: 'PATCH',
    body: { display_name: displayName, avatar_color: avatarColor, onboarded: true },
  });
  return { email, token: session.access_token, id: session.user.id };
}

export const TEST_PASSWORD = 'Password123!';
/** Every seeded account uses this domain so `npm run reset` can find them. */
export const TEST_DOMAIN = 'planora.test';
