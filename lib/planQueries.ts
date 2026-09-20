import { supabase } from './supabase';
import type { Plan } from './plans';

/** Every plan the signed-in user attends, newest first. RLS does the filtering. */
export async function fetchMyPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Plan[];
}
