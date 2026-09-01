import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Backfills Spanish labels on the meeting-room attribute schema.
 *
 * The previous migration inserts the catalogue with ON CONFLICT DO NOTHING,
 * which is right -- it must not overwrite a schema someone tailored. The side
 * effect is that any environment where a type already existed keeps whatever
 * that row had, and the one created through the API while building this had no
 * `title` on its properties.
 *
 * The frontend falls back to the raw property key when a title is missing, so
 * the form showed "floor" and "hasProjector" to a Spanish-speaking user. The
 * fallback is deliberate -- a missing label should be visible rather than
 * guessed at -- but the data is what needs fixing.
 *
 * Guarded: it only rewrites a schema whose properties carry no title at all.
 * A schema that has been labelled, by this migration or by hand, is left
 * alone.
 */
export class MeetingRoomLabels1756700000006 implements MigrationInterface {
  name = 'MeetingRoomLabels1756700000006';

  private readonly schema = {
    type: 'object',
    required: ['floor'],
    properties: {
      floor: { type: 'integer', minimum: 0, title: 'Planta' },
      hasProjector: { type: 'boolean', title: 'Tiene proyector' },
      hasVideoconference: { type: 'boolean', title: 'Tiene videoconferencia' },
    },
    additionalProperties: false,
  };

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE resource_type
          SET attributes_schema = $1::jsonb
        WHERE code = 'meeting-room'
          AND NOT EXISTS (
            SELECT 1
              FROM jsonb_each(attributes_schema->'properties') AS property(key, value)
             WHERE property.value ? 'title'
          )`,
      [JSON.stringify(this.schema)],
    );
  }

  public async down(): Promise<void> {
    // Deliberately empty. Reverting would put untranslated labels back in front
    // of users, which is not a state worth restoring, and the previous schema
    // was never recorded anywhere to restore it from.
  }
}
