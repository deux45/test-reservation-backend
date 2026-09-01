import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes per-type attributes entirely.
 *
 * The schema-driven attribute system is gone: `resource.attributes` and
 * `resource_type.attributes_schema` both drop, along with the ajv validation
 * and the dynamic form that read them.
 *
 * Resource TYPES stay. A resource still belongs to one, and the catalogue --
 * meeting room, laptop, projector, car, van, motorcycle -- is unaffected. What
 * goes is the machinery that let each type declare its own extra fields.
 *
 * Migrations 5 through 9 still reference attributes_schema and still run
 * correctly against an empty database: they populate the column, and this drops
 * it afterwards. Rewriting them would be worse -- an applied migration is a
 * record of what happened, not a description of the current schema.
 */
export class DropResourceAttributes1756700000010 implements MigrationInterface {
  name = 'DropResourceAttributes1756700000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE resource DROP COLUMN IF EXISTS attributes`);
    await queryRunner.query(`ALTER TABLE resource_type DROP COLUMN IF EXISTS attributes_schema`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Restores the columns and their defaults, but not the values -- those are
    // gone. A rollback gets the shape back, not the data.
    await queryRunner.query(
      `ALTER TABLE resource ADD COLUMN attributes jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE resource_type ADD COLUMN attributes_schema jsonb NOT NULL DEFAULT '{"type":"object"}'::jsonb`,
    );
  }
}
