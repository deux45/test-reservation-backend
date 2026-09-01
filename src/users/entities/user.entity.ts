import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Read-only projection over Better Auth's `user` table.
 *
 * This is a deliberate, contained coupling and it is worth naming. The
 * AuthProvider port covers *authenticating a request*; administering accounts
 * is a different concern, and widening the port to carry it would make the
 * seam larger for every implementation.
 *
 * So this module reads the identity schema directly instead. The cost is
 * bounded: swapping identity provider already requires a data migration for
 * these tables (see docs/IMPLEMENTATION-PLAN.md 3.10), and this module changes
 * with it. Nothing outside src/users/ depends on the shape.
 *
 * Never written through TypeORM: Better Auth owns these rows. The only
 * mutation this module performs is the role column, and it does it with an
 * explicit UPDATE.
 */
@Entity('user')
export class UserAccount {
  @PrimaryColumn({ type: 'text' })
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  email: string;

  /** Better Auth's own camelCase column. Quoted, because Postgres folds case. */
  @Column({ name: 'emailVerified', type: 'boolean' })
  emailVerified: boolean;

  /** Null until the admin plugin assigns one; treated as 'user'. */
  @Column({ type: 'text', nullable: true })
  role: string | null;

  @Column({ type: 'boolean', nullable: true })
  banned: boolean | null;

  @Column({ name: 'createdAt', type: 'timestamptz' })
  createdAt: Date;
}
