import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Makes every resource attribute optional, and drops hasProjector.
 *
 * Two changes, one intent: lower the cost of adding a resource.
 *
 * Requiring a serial number or a number plate up front assumes whoever
 * registers the equipment has it to hand. Often they do not -- the laptop is
 * in a drawer, the van is out -- and a required field turns "add it now,
 * complete it later" into "do not add it at all". The schemas still describe
 * and validate every attribute; they simply no longer refuse a resource for
 * lacking one.
 *
 * This does not weaken the system's real invariant. Non-overlapping
 * reservations are enforced by an EXCLUDE constraint in the database and owe
 * nothing to these schemas.
 *
 * Existing resources are untouched: relaxing a schema cannot invalidate data
 * that already satisfied a stricter one.
 */
export class RelaxResourceAttributes1756700000007 implements MigrationInterface {
  name = 'RelaxResourceAttributes1756700000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // `- 'required'` deletes the top-level key. An absent `required` means
    // nothing is mandatory, which is JSON Schema's own default -- clearer than
    // carrying an empty array around.
    await queryRunner.query(`
      UPDATE resource_type
         SET attributes_schema = attributes_schema - 'required'
       WHERE attributes_schema ? 'required'
    `);

    // #- removes a nested path.
    await queryRunner.query(`
      UPDATE resource_type
         SET attributes_schema = attributes_schema #- '{properties,hasProjector}'
       WHERE code = 'meeting-room'
    `);

    // The attribute is gone from the schema, so leaving the value behind on
    // existing rooms would be data no schema describes -- and
    // additionalProperties:false would reject the next edit that resubmitted
    // it.
    await queryRunner.query(`
      UPDATE resource
         SET attributes = attributes - 'hasProjector'
       WHERE attributes ? 'hasProjector'
    `);
  }

  public async down(): Promise<void> {
    // Deliberately empty. Restoring `required` would reject resources created
    // while it was relaxed, so the rollback would fail on exactly the rows this
    // change was made to allow.
  }
}
