// Deletes every seeded test account. Plans, polls, votes and messages go with
// them by cascade, so this empties the dev data without touching the schema.
//
//   npm run reset
//
// Only accounts on the test domain are touched — a real account with a real
// email address is never matched.
import { BASE, SECRET, TEST_DOMAIN } from './env.mjs';

export async function reset({ quiet = false } = {}) {
  const res = await fetch(`${BASE}/auth/v1/admin/users?per_page=200`, {
    headers: { apikey: SECRET, authorization: `Bearer ${SECRET}` },
  });
  const { users = [] } = await res.json();
  const testUsers = users.filter((u) => u.email?.endsWith(`@${TEST_DOMAIN}`));

  for (const u of testUsers) {
    await fetch(`${BASE}/auth/v1/admin/users/${u.id}`, {
      method: 'DELETE',
      headers: { apikey: SECRET, authorization: `Bearer ${SECRET}` },
    });
  }

  if (!quiet) {
    console.log(
      testUsers.length
        ? `Removed ${testUsers.length} test account(s) and everything they owned.`
        : 'Nothing to remove — no test accounts found.',
    );
  }
  return testUsers.length;
}

// Only run when invoked directly, not when seed.mjs imports it.
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  reset().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}
