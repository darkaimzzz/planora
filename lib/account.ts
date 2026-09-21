import { supabase } from './supabase';

export type DeletionImpact = {
  plansCreated: number;
  plansJoined: number;
  messagesSent: number;
};

/**
 * What deleting the account takes with it.
 *
 * Deleting the creator of a plan deletes that plan for everyone in it, so the
 * confirmation names the number rather than springing it on them.
 */
export async function fetchDeletionImpact(): Promise<DeletionImpact> {
  const { data, error } = await supabase.rpc('account_deletion_impact');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    plansCreated: Number(row?.plans_created ?? 0),
    plansJoined: Number(row?.plans_joined ?? 0),
    messagesSent: Number(row?.messages_sent ?? 0),
  };
}

/**
 * Permanently delete the signed-in account.
 *
 * Required by both stores (Apple 5.1.1(v), Google Play's data deletion
 * policy). Irreversible — the caller is responsible for confirming first.
 */
export async function deleteOwnAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_own_account');
  if (error) throw error;
  // The row is gone, but this device still holds a token. Clear it so the app
  // doesn't sit in a signed-in state with nothing behind it.
  await supabase.auth.signOut().catch(() => {});
}
