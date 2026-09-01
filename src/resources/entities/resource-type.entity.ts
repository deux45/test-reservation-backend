import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Resource } from './resource.entity';

/**
 * A family of bookable things: meeting rooms, vehicles, equipment.
 *
 * Types exist so resources can be grouped and filtered -- "every vehicle
 * booked this week" is one query rather than a list of names. They carry no
 * behaviour of their own.
 */
@Entity('resource_type')
export class ResourceType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Stable, human-readable key. Used in URLs and seeds. */
  @Column({ type: 'varchar', length: 60, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Resource, (resource) => resource.resourceType)
  resources: Resource[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
