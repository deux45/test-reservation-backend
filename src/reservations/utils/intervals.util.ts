/** A half-open instant range, `[start, end)`, matching Period and the database. */
export interface Interval {
  start: Date;
  end: Date;
}

/**
 * Removes every busy interval from a set of base intervals.
 *
 * This is the whole availability calculation. It is a pure function over
 * plain dates: no database, no time zones, no framework -- which is why it can
 * be tested exhaustively at the boundaries, and why the boundaries are where
 * this kind of code goes wrong.
 *
 * Chosen over PostgreSQL's range_agg and multirange operators deliberately.
 * The SQL would be shorter and considerably harder to prove correct; the query
 * that feeds this is a plain "confirmed reservations in this window", which is
 * already served by the partial GiST index.
 *
 * Half-open throughout: a busy interval ending exactly when a free one starts
 * removes nothing, because they share no instant.
 */
export function subtractIntervals(base: Interval[], busy: Interval[]): Interval[] {
  // Sorting lets a single pass carry a moving cursor instead of rescanning.
  const sortedBusy = [...busy].sort((a, b) => a.start.getTime() - b.start.getTime());

  return base.flatMap((window) => subtractFromOne(window, sortedBusy));
}

function subtractFromOne(window: Interval, sortedBusy: Interval[]): Interval[] {
  const free: Interval[] = [];
  let cursor = window.start.getTime();
  const windowEnd = window.end.getTime();

  for (const taken of sortedBusy) {
    const takenStart = taken.start.getTime();
    const takenEnd = taken.end.getTime();

    // Entirely before the cursor, or entirely after this window: no effect.
    if (takenEnd <= cursor) continue;
    if (takenStart >= windowEnd) break;

    if (takenStart > cursor) {
      free.push({ start: new Date(cursor), end: new Date(Math.min(takenStart, windowEnd)) });
    }

    // Busy intervals may overlap each other, so the cursor only moves forward.
    cursor = Math.max(cursor, takenEnd);
    if (cursor >= windowEnd) return free;
  }

  if (cursor < windowEnd) {
    free.push({ start: new Date(cursor), end: new Date(windowEnd) });
  }

  return free;
}

/** Drops the gaps too short to be worth offering. */
export function atLeast(intervals: Interval[], minutes: number): Interval[] {
  const ms = minutes * 60_000;
  return intervals.filter((slot) => slot.end.getTime() - slot.start.getTime() >= ms);
}
