import { supabase } from './supabase';

/**
 * Nudge the server to move the plan along (open a poll, close one, confirm).
 * Safe to call after any user action, the function decides whether anything
 * is actually due. Failures are swallowed: the 24h cron sweep is the backstop.
 */
export async function advancePlan(planId: string) {
  try {
    await supabase.functions.invoke('advance-plan', { body: { plan_id: planId } });
  } catch (err) {
    console.warn('advance-plan failed; the cron sweep will catch it', err);
  }
}
