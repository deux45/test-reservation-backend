import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ResourceAvailability } from './resource-availability.entity';
import { ResourceBlock } from './resource-block.entity';
import { ResourceType } from './resource-type.entity';

@Entity('resource')
export class Resource {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'resource_type_id', type: 'uuid' })
  resourceTypeId: string;

  @ManyToOne(() => ResourceType, (type) => type.resources, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'resource_type_id' })
  resourceType: ResourceType;

  @Column({ type: 'varchar', length: 60, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @Column({ type: 'varchar', length: 160, nullable: true })
  location: string | null;

  /**
   * IANA zone, e.g. Europe/Madrid.
   *
   * Operating hours are wall-clock in this zone while instants are stored in
   * UTC. Keeping the zone on the resource is what makes "09:00 to 18:00 on
   * weekdays" mean the same thing on both sides of a daylight saving change.
   */
  @Column({ name: 'time_zone', type: 'varchar', length: 64, default: 'UTC' })
  timeZone: string;

  /** Validated against resourceType.attributesSchema on every write. */
  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  attributes: Record<string, unknown>;

  /**
   * Soft delete. A resource with historical reservations is never removed,
   * only deactivated -- a hard delete would orphan them, and the RESTRICT on
   * the foreign key would refuse it anyway.
   */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt: Date | null;

  @OneToMany(() => ResourceAvailability, (window) => window.resource)
  availability: ResourceAvailability[];

  @OneToMany(() => ResourceBlock, (block) => block.resource)
  blocks: ResourceBlock[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
