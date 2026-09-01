import { atLeast, type Interval, subtractIntervals } from './intervals.util';

const at = (time: string): Date => new Date(`2026-09-15T${time}:00Z`);
const range = (from: string, to: string): Interval => ({ start: at(from), end: at(to) });

/** `09:00-11:00, 13:00-14:00` — readable enough to assert against directly. */
const show = (intervals: Interval[]): string =>
  intervals
    .map((i) => `${i.start.toISOString().slice(11, 16)}-${i.end.toISOString().slice(11, 16)}`)
    .join(', ');

describe('subtractIntervals', () => {
  const day = [range('09:00', '18:00')];

  it('returns the whole window when nothing is busy', () => {
    expect(show(subtractIntervals(day, []))).toBe('09:00-18:00');
  });

  it('splits the window around a booking in the middle', () => {
    expect(show(subtractIntervals(day, [range('12:00', '13:00')]))).toBe(
      '09:00-12:00, 13:00-18:00',
    );
  });

  it('trims the front when a booking starts at the window start', () => {
    expect(show(subtractIntervals(day, [range('09:00', '10:00')]))).toBe('10:00-18:00');
  });

  it('trims the back when a booking ends at the window end', () => {
    expect(show(subtractIntervals(day, [range('17:00', '18:00')]))).toBe('09:00-17:00');
  });

  it('returns nothing when a booking fills the window', () => {
    expect(subtractIntervals(day, [range('09:00', '18:00')])).toEqual([]);
  });

  it('returns nothing when a booking covers more than the window', () => {
    expect(subtractIntervals(day, [range('08:00', '19:00')])).toEqual([]);
  });

  it('ignores bookings entirely outside the window', () => {
    expect(show(subtractIntervals(day, [range('06:00', '07:00'), range('20:00', '21:00')]))).toBe(
      '09:00-18:00',
    );
  });

  it('leaves no gap between back-to-back bookings', () => {
    // The half-open payoff: 10:00-11:00 and 11:00-12:00 are contiguous, so
    // there is no zero-length slot at 11:00 to offer anyone.
    expect(show(subtractIntervals(day, [range('10:00', '11:00'), range('11:00', '12:00')]))).toBe(
      '09:00-10:00, 12:00-18:00',
    );
  });

  it('merges overlapping bookings rather than double-counting them', () => {
    // Two overlapping busy ranges must not produce a phantom free slice
    // between them.
    expect(show(subtractIntervals(day, [range('10:00', '12:00'), range('11:00', '13:00')]))).toBe(
      '09:00-10:00, 13:00-18:00',
    );
  });

  it('handles a booking wholly inside another', () => {
    expect(show(subtractIntervals(day, [range('10:00', '14:00'), range('11:00', '12:00')]))).toBe(
      '09:00-10:00, 14:00-18:00',
    );
  });

  it('does not depend on the order the bookings arrive in', () => {
    const forwards = subtractIntervals(day, [range('10:00', '11:00'), range('14:00', '15:00')]);
    const backwards = subtractIntervals(day, [range('14:00', '15:00'), range('10:00', '11:00')]);
    expect(show(forwards)).toBe(show(backwards));
  });

  it('subtracts across several windows', () => {
    // A resource open mornings and afternoons, with one booking in each.
    const split = [range('09:00', '13:00'), range('15:00', '19:00')];
    expect(show(subtractIntervals(split, [range('10:00', '11:00'), range('16:00', '17:00')]))).toBe(
      '09:00-10:00, 11:00-13:00, 15:00-16:00, 17:00-19:00',
    );
  });

  it('returns nothing when there are no windows at all', () => {
    expect(subtractIntervals([], [range('10:00', '11:00')])).toEqual([]);
  });
});

describe('atLeast', () => {
  it('keeps gaps of exactly the minimum', () => {
    expect(show(atLeast([range('09:00', '09:30')], 30))).toBe('09:00-09:30');
  });

  it('drops gaps shorter than the minimum', () => {
    // A fifteen-minute hole between two meetings is not worth offering as a
    // one-hour slot, and offering it would produce a 422 on booking.
    expect(atLeast([range('09:00', '09:15')], 30)).toEqual([]);
  });
});
