import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Removes hasVideoconference from the meeting-room schema.
 *
 * Same reasoning as hasProjector before it: an equipment checkbox nobody was
 * filling in. What a meeting room needs to be bookable is which floor it is
 * on; the rest is inventory detail that belongs wherever inventory is kept.
 *
 * That leaves meeting-room with a single attribute, which is the point. The
 * schema is meant to describe what distinguishes one resource of a type from
 * another, not everything that could be recorded about it.
 */
export class DropVideoconferenceAttribute1756700000008 implements MigrationInterface {
  name = 'DropVideoconferenceAttribute1756700000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE resource_type
         SET attributes_schema = attributes_schema #- '{properties,hasVideoconference}'
       WHERE code = 'meeting-room'
    `);

    // The value goes too. Left behind it would be data no schema describes,
    // and additionalProperties:false would reject the next edit that
    // resubmitted it -- turning a stale field into an unsaveable form.
    await queryRunner.query(`
      UPDATE resource
         SET attributes = attributes - 'hasVideoconference'
       WHERE attributes ? 'hasVideoconference'
    `);
  }

  public async down(): Promise<void> {
    // Deliberately empty, as with the equivalent hasProjector removal:
    // restoring the property would describe data that no longer exists.
  }
}
