/**
 * Wall-clock position of an instant inside a given IANA zone.
 *
 * Operating hours are stored as wall-clock times ("09:00 to 18:00 on
 * weekdays") while instants are stored in UTC. Comparing them means asking
 * what the clock on the wall said in the resource's own zone at that instant,
 * which is what this answers.
 *
 * Uses Intl rather than a date library: it is built in, correct across
 * daylight saving transitions, and needs no extra dependency in the booking
 * path.
 */
export interface ZonedWallClock {
  /** 0 = Sunday .. 6 = Saturday, matching Date#getDay(). */
  dayOfWeek: number;
  /** Minutes since local midnight. */
  minutesOfDay: number;
}

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function wallClockIn(instant: Date, timeZone: string): ZonedWallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(instant);

  const get = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  // Intl renders midnight as "24" in some locales' hour12:false output.
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));

  return {
    dayOfWeek: WEEKDAY_INDEX[get('weekday')] ?? 0,
    minutesOfDay: hour * 60 + minute,
  };
}

/** Parses "09:30" or "09:30:00" into minutes since midnight. */
export function timeToMinutes(time: string): number {
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) * 60 + Number(minutes);
}
