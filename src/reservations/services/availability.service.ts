import { Injectable } from '@nestjs/common';
import { TZDate } from '@date-fns/tz';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceAvailability } from '../../resources/entities/resource-availability.entity';
import { ResourceBlock } from '../../resources/entities/resource-block.entity';
import { ResourceRepository } from '../../resources/repositories/resource.repository';
import { type AvailabilityQueryDto, AvailabilitySlotDto } from '../dtos/availability.dto';
import { InvalidPeriodError, ResourceUnavailableError } from '../errors/reservation.errors';
import { ReservationRepository } from '../repositories/reservation.repository';
import { atLeast, type Interval, subtractIntervals } from '../utils/intervals.util';

/** Guards the query: a year of slots is a denial-of-service, not a request. */
const MAX_RANGE_DAYS = 60;
const MS_PER_DAY = 86_400_000;

@Injectable()
export class AvailabilityService {
  constructor(
    private readonly resources: ResourceRepository,
    private readonly reservations: ReservationRepository,
    @InjectRepository(ResourceAvailability)
    private readonly windows: Repository<ResourceAvailability>,
    @InjectRepository(ResourceBlock)
    private readonly blocks: Repository<ResourceBlock>,
  ) {}

  /**
   * The free slots for a resource in a range.
   *
   * Four steps, each simple on its own:
   *   1. build the operating windows for every day in the range,
   *   2. subtract maintenance blocks,
   *   3. subtract confirmed reservations,
   *   4. drop anything shorter than the requested duration.
   *
   * Steps 2 to 4 are one call to a pure function. Step 1 is the only part that
   * needs to know about time zones, and it is contained here.
   */
  async findSlots(resourceId: string, query: AvailabilityQueryDto): Promise<AvailabilitySlotDto[]> {
    const from = new Date(query.from);
    const to = new Date(query.to);

    if (to.getTime() <= from.getTime()) {
      throw new InvalidPeriodError('`to` debe ser posterior a `from`');
    }

    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * MS_PER_DAY) {
      throw new InvalidPeriodError(`El rango no puede superar ${MAX_RANGE_DAYS} días`);
    }

    const resource = await this.resources.findActiveById(resourceId);
    if (!resource) throw new ResourceUnavailableError(resourceId);

    const operating = await this.operatingWindows(resource.id, resource.timeZone, from, to);

    const [blocks, booked] = await Promise.all([
      this.blocksIn(resource.id, from, to),
      this.reservations.findConfirmedInRange(resource.id, from, to),
    ]);

    const busy: Interval[] = [
      ...blocks,
      ...booked.map((reservation) => ({ start: reservation.startAt, end: reservation.endAt })),
    ];

    const free = atLeast(subtractIntervals(operating, busy), query.minDurationMinutes ?? 15);

    return free.map((slot) => AvailabilitySlotDto.from(slot, resource.timeZone));
  }

  /**
   * Turns the weekly schedule into concrete instants for each day in range.
   *
   * A resource with no windows configured is available around the clock, so the
   * requested range itself is the only window. The absence of a restriction is
   * the absence of rows, not a row meaning "always".
   */
  private async operatingWindows(
    resourceId: string,
    timeZone: string,
    from: Date,
    to: Date,
  ): Promise<Interval[]> {
    const schedule = await this.windows.find({ where: { resourceId } });
    if (schedule.length === 0) return [{ start: from, end: to }];

    const windows: Interval[] = [];

    // Walk calendar days in the RESOURCE's zone. Iterating UTC days would drift
    // by one at each end for any resource east or west of Greenwich.
    for (let day = startOfDayIn(from, timeZone); day.getTime() < to.getTime();) {
      const local = new TZDate(day, timeZone);
      const dayOfWeek = local.getDay();

      for (const window of schedule.filter((entry) => entry.dayOfWeek === dayOfWeek)) {
        const start = wallClockToInstant(local, window.startTime, timeZone);
        const end = wallClockToInstant(local, window.endTime, timeZone);

        // Clip to the requested range so the caller never sees slots outside it.
        const clippedStart = new Date(Math.max(start.getTime(), from.getTime()));
        const clippedEnd = new Date(Math.min(end.getTime(), to.getTime()));

        if (clippedEnd.getTime() > clippedStart.getTime()) {
          windows.push({ start: clippedStart, end: clippedEnd });
        }
      }

      day = new Date(day.getTime() + MS_PER_DAY);
    }

    return windows;
  }

  private async blocksIn(resourceId: string, from: Date, to: Date): Promise<Interval[]> {
    const rows = await this.blocks
      .createQueryBuilder('block')
      .where('block.resource_id = :resourceId', { resourceId })
      .andWhere("block.period && tstzrange(:from, :to, '[)')", {
        from: from.toISOString(),
        to: to.toISOString(),
      })
      .getMany();

    return rows.map((block) => ({ start: block.startAt, end: block.endAt }));
  }
}

/** Midnight of the instant's calendar day, in the given zone. */
function startOfDayIn(instant: Date, timeZone: string): Date {
  const local = new TZDate(instant, timeZone);
  return new Date(
    new TZDate(
      local.getFullYear(),
      local.getMonth(),
      local.getDate(),
      0,
      0,
      0,
      0,
      timeZone,
    ).getTime(),
  );
}

/** "09:30" on the given local day, as a UTC instant. */
function wallClockToInstant(localDay: TZDate, time: string, timeZone: string): Date {
  const [hours = '0', minutes = '0'] = time.split(':');

  return new Date(
    new TZDate(
      localDay.getFullYear(),
      localDay.getMonth(),
      localDay.getDate(),
      Number(hours),
      Number(minutes),
      0,
      0,
      timeZone,
    ).getTime(),
  );
}
