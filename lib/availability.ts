// Pure availability + overlap logic. No Supabase import — tests load this directly.

/** The grid covers the next week, 08:00–23:00, in one-hour cells. */
export const GRID_DAYS = 7;
export const FIRST_HOUR = 8;
export const LAST_HOUR = 23; // exclusive: the final cell is 22:00–23:00
export const HOURS = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);

export type Cell = `${string}|${number}`; // "2026-09-21|19"

export function cellKey(day: string, hour: number): Cell {
  return `${day}|${hour}`;
}

export function parseCell(cell: Cell): { day: string; hour: number } {
  const [day, hour] = cell.split('|');
  return { day, hour: Number(hour) };
}

/**
 * Calendar dates for the grid columns, starting today.
 *
 * Built from local date parts, not toISOString(): east of Greenwich local
 * midnight is still the previous day in UTC, which would label every column
 * one day early and store availability against the wrong dates.
 */
export function gridDays(from = new Date()): string[] {
  return Array.from({ length: GRID_DAYS }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + i);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const dayOfMonth = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${dayOfMonth}`;
  });
}

export type AvailabilityRow = { user_id: string; day: string; start_time: string; end_time: string };

/** DB rows -> the set of cells a grid should paint as selected. */
export function rowsToCells(rows: AvailabilityRow[]): Set<Cell> {
  const cells = new Set<Cell>();
  for (const r of rows) {
    const start = Number(r.start_time.slice(0, 2));
    const end = Number(r.end_time.slice(0, 2));
    for (let h = start; h < end; h++) cells.add(cellKey(r.day, h));
  }
  return cells;
}

/**
 * Selected cells -> one row per contiguous run, so a 6pm–11pm drag is one row
 * rather than five.
 */
export function cellsToRows(cells: Set<Cell>): { day: string; start_time: string; end_time: string }[] {
  const byDay = new Map<string, number[]>();
  for (const cell of cells) {
    const { day, hour } = parseCell(cell);
    byDay.set(day, [...(byDay.get(day) ?? []), hour]);
  }

  const rows: { day: string; start_time: string; end_time: string }[] = [];
  for (const [day, hours] of byDay) {
    hours.sort((a, b) => a - b);
    let runStart = hours[0];
    let prev = hours[0];
    for (const h of hours.slice(1)) {
      if (h !== prev + 1) {
        rows.push({ day, start_time: hh(runStart), end_time: hh(prev + 1) });
        runStart = h;
      }
      prev = h;
    }
    rows.push({ day, start_time: hh(runStart), end_time: hh(prev + 1) });
  }
  return rows;
}

function hh(hour: number) {
  return `${String(hour).padStart(2, '0')}:00:00`;
}

export type SlotCandidate = {
  day: string;
  hour: number;
  /** Distinct attendees free for this hour — also the tie-break value (PRD §9). */
  availabilityCount: number;
};

/**
 * Sortable "now" in the same wall-clock shape as a cell key, read in UTC for
 * the same reason formatSlot is: availability hours are wall-clock, and
 * reading them locally slides an evening slot into the next day east of
 * Greenwich.
 */
export function nowCell(now: Date = new Date()): { day: string; hour: number } {
  return { day: now.toISOString().slice(0, 10), hour: now.getUTCHours() };
}

/** Cell keys pack the hour unpadded, so "…|9" sorts after "…|10". Compare parts. */
function isPast(day: string, hour: number, floor: { day: string; hour: number }) {
  return day < floor.day || (day === floor.day && hour < floor.hour);
}

/**
 * The top N hours by how many attendees are free, earliest first on a tie.
 *
 * Slots that have already started are dropped: a stale client could post
 * availability for a day in the past, and the poll would then offer a time
 * nobody can attend. The grid only ever shows the next seven days, so this
 * only bites on bad input — which is exactly when it matters.
 *
 * ponytail: one-hour granularity, so a group free all evening gets three
 * adjacent hours offered rather than one merged block. Merge runs before
 * ranking if the options start looking repetitive.
 */
export function topSlots(
  rows: AvailabilityRow[],
  limit = 3,
  now: Date = new Date(),
): SlotCandidate[] {
  const floor = nowCell(now);
  const counts = new Map<Cell, Set<string>>();
  for (const r of rows) {
    const start = Number(r.start_time.slice(0, 2));
    const end = Number(r.end_time.slice(0, 2));
    for (let h = start; h < end; h++) {
      const key = cellKey(r.day, h);
      const users = counts.get(key) ?? new Set<string>();
      users.add(r.user_id);
      counts.set(key, users);
    }
  }

  return [...counts.entries()]
    .map(([cell, users]) => {
      const { day, hour } = parseCell(cell);
      return { day, hour, availabilityCount: users.size };
    })
    .filter((s) => !isPast(s.day, s.hour, floor))
    .sort(
      (a, b) =>
        b.availabilityCount - a.availabilityCount ||
        a.day.localeCompare(b.day) ||
        a.hour - b.hour,
    )
    .slice(0, limit);
}

export type Tally = { optionId: string; votes: number; availabilityCount: number; startsAt: string | null };

/**
 * Winner of a closed poll (PRD §9): most votes, then most availability marks,
 * then the earliest slot. Venue options carry no time, so the last tier is a
 * no-op for them and the option order decides.
 */
export function pickWinner(tallies: Tally[]): Tally | null {
  if (tallies.length === 0) return null;
  return [...tallies].sort(
    (a, b) =>
      b.votes - a.votes ||
      b.availabilityCount - a.availabilityCount ||
      (a.startsAt ?? '').localeCompare(b.startsAt ?? ''),
  )[0];
}
