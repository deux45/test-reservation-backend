import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Resource } from './resource.entity';

/**
 * One weekly operating window for a resource.
 *
 * A resource with no rows here is available around the clock; the absence of
 * a restriction is the absence of rows, not a row meaning "always".
 */
@Entity('resource_availability')
export class ResourceAvailability {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'resource_id', type: 'uuid' })
  resourceId: string;

  @ManyToOne(() => Resource, (resource) => resource.availability, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'resource_id' })
  resource: Resource;

  /** 0 = Sunday .. 6 = Saturday, matching JavaScript's Date#getDay(). */
  @Column({ name: 'day_of_week', type: 'smallint' })
  dayOfWeek: number;

  /** Wall-clock in the resource's own time zone, not UTC. */
  @Column({ name: 'start_time', type: 'time' })
  startTime: string;

  @Column({ name: 'end_time', type: 'time' })
  endTime: string;
}
