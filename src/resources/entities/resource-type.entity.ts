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
 * `attributesSchema` is what makes the model generic without a table per
 * type. It holds a JSON Schema that every resource of this type must satisfy,
 * so adding "projector" is inserting a row rather than deploying code -- and
 * unlike inheritance, it keeps reservation queries across all types trivial.
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

  /** JSON Schema validated by ResourceAttributesService on every write. */
  @Column({ name: 'attributes_schema', type: 'jsonb', default: () => `'{"type":"object"}'::jsonb` })
  attributesSchema: Record<string, unknown>;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => Resource, (resource) => resource.resourceType)
  resources: Resource[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
