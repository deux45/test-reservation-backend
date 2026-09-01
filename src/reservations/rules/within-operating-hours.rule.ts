import { Injectable } from '@nestjs/common';
import { type EntityManager } from 'typeorm';
import { ResourceAvailability } from '../../resources/entities/resource-availability.entity';
import { OutsideOperatingHoursError } from '../errors/reservation.errors';
import { timeToMinutes, wallClockIn } from '../utils/time-zone.util';
import { type ReservationContext, type ReservationRule } from './reservation-rule.interface';

/**
 * The booking must fall inside the resource's weekly operating window.
 *
 * A resource with no windows configured is available around the clock: the
 * absence of a restriction is the absence of rows, not a row meaning "always".
 *
 * The comparison happens in the resource's OWN time zone. A room in Madrid
 * open 09:00-18:00 is open at those wall-clock hours all year, which is a
 * different pair of UTC instants in summer and winter -- so converting the
 * window to UTC once and storing that would be wrong twice a year.
 */
@Injectable()
export class WithinOperatingHoursRule implements ReservationRule {
  readonly name = 'WITHIN_OPERATING_HOURS';

  async check(context: ReservationContext, manager: EntityManager): Promise<void> {
    const windows = await manager.find(ResourceAvailability, {
      where: { resourceId: context.resource.id },
    });

    if (windows.length === 0) return;

    const { timeZone, id } = context.resource;
    const start = wallClockIn(context.period.start, timeZone);

    // The end is exclusive, so a booking ending exactly at closing time is
    // inside the window. Stepping back one millisecond puts the instant on
    // the correct side of that boundary and, when the booking ends at
    // midnight, on the correct day as well.
    const lastInstant = new Date(context.period.end.getTime() - 1);
    const end = wallClockIn(lastInstant, timeZone);

    // A booking that crosses local midnight would need two windows to be
    // satisfied. Rejecting it is simpler than the alternative and matches
    // what an operating window means.
    if (start.dayOfWeek !== end.dayOfWeek) {
      throw new OutsideOperatingHoursError(id, timeZone);
    }

    const fits = windows.some(
      (window) =>
        window.dayOfWeek === start.dayOfWeek &&
        start.minutesOfDay >= timeToMinutes(window.startTime) &&
        end.minutesOfDay < timeToMinutes(window.endTime),
    );

    if (!fits) throw new OutsideOperatingHoursError(id, timeZone);
  }
}
