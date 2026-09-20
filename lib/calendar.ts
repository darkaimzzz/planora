// Pure calendar layout. No Supabase import — tests load this directly.
import { slotDay, type Plan } from './plans';

export type Day = {
  date: string; // YYYY-MM-DD
  inCurrentPeriod: boolean;
  isToday: boolean;
  plans: Plan[];
};

export function isoDate(d: Date): string {
  // Local date, not UTC: toISOString() would shift the day either side of midnight.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Only the signed-in user's own plans reach this function — the Home calendar
 * never shows other attendees' busy times (locked decision; v2 needs consent).
 * A plan lands on the day of its confirmed start, so unconfirmed plans don't
 * appear at all.
 */
export function plansByDay(plans: Plan[]): Map<string, Plan[]> {
  const map = new Map<string, Plan[]>();
  for (const p of plans) {
    if (!p.confirmed_start) continue;
    const key = slotDay(p.confirmed_start);
    map.set(key, [...(map.get(key) ?? []), p]);
  }
  return map;
}

/** Six Monday-first rows covering the month `anchor` falls in. */
export function monthGrid(anchor: Date, plans: Plan[], today = new Date()): Day[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday = 0
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return buildDays(start, 42, anchor.getMonth(), plans, today);
}

/** The Monday-first week `anchor` falls in. */
export function weekGrid(anchor: Date, plans: Plan[], today = new Date()): Day[] {
  const start = new Date(anchor);
  start.setDate(anchor.getDate() - ((anchor.getDay() + 6) % 7));
  return buildDays(start, 7, anchor.getMonth(), plans, today);
}

function buildDays(start: Date, count: number, month: number, plans: Plan[], today: Date): Day[] {
  const byDay = plansByDay(plans);
  const todayKey = isoDate(today);

  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const date = isoDate(d);
    return {
      date,
      inCurrentPeriod: d.getMonth() === month,
      isToday: date === todayKey,
      plans: byDay.get(date) ?? [],
    };
  });
}
