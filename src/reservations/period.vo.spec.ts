import { InvalidPeriodError } from './errors/reservation.errors';
import { Period } from './period.vo';

const at = (time: string): string => `2026-09-15T${time}:00Z`;
const period = (from: string, to: string): Period => Period.create(at(from), at(to));

describe('Period', () => {
  describe('construction', () => {
    it('accepts a well-formed range', () => {
      const p = period('10:00', '11:00');
      expect(p.durationMinutes).toBe(60);
      expect(p.toString()).toBe('[2026-09-15T10:00:00.000Z, 2026-09-15T11:00:00.000Z)');
    });

    it('rejects an end before the start', () => {
      expect(() => period('11:00', '10:00')).toThrow(InvalidPeriodError);
    });

    it('rejects a zero-length range', () => {
      // With '[)' this range is empty: it would overlap nothing and could be
      // booked an unlimited number of times on the same resource.
      expect(() => period('10:00', '10:00')).toThrow(InvalidPeriodError);
    });

    it('rejects a duration below the minimum', () => {
      expect(() => period('10:00', '10:10')).toThrow(/al menos 15 minutos/);
    });

    it('rejects a duration above the maximum', () => {
      expect(() => Period.create(at('08:00'), '2026-09-15T20:00:00Z')).toThrow(/8 horas/);
    });

    it('rejects a start off the 15-minute grid', () => {
      expect(() => period('10:07', '11:07')).toThrow(/múltiplos de 15/);
    });

    it('rejects a duration off the 15-minute grid', () => {
      expect(() => period('10:00', '10:50')).toThrow(/múltiplo de 15/);
    });

    it('rejects an unparseable date', () => {
      expect(() => Period.create('mañana por la tarde', at('11:00'))).toThrow(InvalidPeriodError);
    });

    it('is immutable once built', () => {
      const p = period('10:00', '11:00');
      expect(Object.isFrozen(p)).toBe(true);
    });

    it('does not alias the Date instances it was given', () => {
      // A caller mutating its own Date must not retroactively move a booking.
      const start = new Date(at('10:00'));
      const p = Period.create(start, at('11:00'));
      start.setUTCFullYear(2030);
      expect(p.start.getUTCFullYear()).toBe(2026);
    });
  });

  /**
   * The seven boundary cases, against a reference of 10:00-11:00.
   *
   * This is the same table verified at the database level by
   * scripts/verify-overlap-constraint.sql. Both must agree: the application
   * check exists to produce a useful 409, the constraint exists to guarantee
   * correctness, and a disagreement between them would be the worst kind of
   * bug -- one where the API says yes and the database says no.
   */
  describe('overlaps, against 10:00-11:00', () => {
    const reference = period('10:00', '11:00');

    it.each([
      ['a · justo antes', '09:00', '10:00', false],
      ['b · justo después', '11:00', '12:00', false],
      ['c · pisa el inicio', '09:30', '10:30', true],
      ['d · pisa el final', '10:30', '11:30', true],
      ['e · contenida', '10:15', '10:45', true],
      ['f · envolvente', '09:30', '11:30', true],
      ['g · idéntica', '10:00', '11:00', true],
    ])('%s', (_label, from, to, expected) => {
      expect(period(from, to).overlaps(reference)).toBe(expected);
    });

    it('is symmetric', () => {
      // If A conflicts with B then B conflicts with A. Asymmetry here would
      // make the outcome depend on which reservation was created first.
      const candidate = period('10:30', '11:30');
      expect(candidate.overlaps(reference)).toBe(reference.overlaps(candidate));
    });

    it('treats touching endpoints as adjacent in both directions', () => {
      // The whole reason for '[)'. Getting this wrong rejects every
      // back-to-back meeting, which is the most common booking pattern there is.
      expect(period('09:00', '10:00').overlaps(reference)).toBe(false);
      expect(period('11:00', '12:00').overlaps(reference)).toBe(false);
    });
  });

  describe('isWithin', () => {
    // An operating window is not a reservation: it routinely runs longer than
    // the 8-hour booking cap, so it is built with fromStored rather than
    // pushed through rules that were never meant to apply to it.
    const window = Period.fromStored(new Date(at('09:00')), new Date(at('18:00')));

    it('accepts a range inside the window', () => {
      expect(period('10:00', '11:00').isWithin(window)).toBe(true);
    });

    it('accepts a range that exactly fills the window', () => {
      const wholeWindow = Period.fromStored(new Date(at('09:00')), new Date(at('18:00')));
      expect(wholeWindow.isWithin(window)).toBe(true);
    });

    it('rejects a range that starts before the window', () => {
      expect(period('08:00', '10:00').isWithin(window)).toBe(false);
    });

    it('rejects a range that ends after the window', () => {
      expect(period('17:00', '19:00').isWithin(window)).toBe(false);
    });
  });

  describe('fromStored', () => {
    it('bypasses the business rules for values that came from the database', () => {
      // A slot booked under an older, laxer rule must still be readable. An
      // entity that cannot be loaded is worse than one that could not be
      // created today.
      const stored = Period.fromStored(new Date(at('10:07')), new Date(at('10:12')));
      expect(stored.durationMinutes).toBe(5);
    });
  });
});
