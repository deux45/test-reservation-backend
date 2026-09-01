import { Injectable } from '@nestjs/common';

/**
 * The current time, as a dependency.
 *
 * A plain class rather than a token: NestJS substitutes classes in tests with
 * overrideProvider() just as it substitutes tokens, so the ceremony buys
 * nothing here.
 *
 * What it does buy is a deterministic NotInThePastRule. Freezing global time
 * with jest.useFakeTimers() reaches every timer in the process, including the
 * ones inside the database driver, and produces tests that fail for reasons
 * unrelated to what they assert.
 */
@Injectable()
export class ClockService {
  now(): Date {
    return new Date();
  }
}
