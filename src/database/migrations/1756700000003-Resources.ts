import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Catalogue: what can be booked.
 *
 * The generic multi-type model lives in `resource_type.attributes_schema`, a
 * JSON Schema validated at write time. Adding "vehicle" or "projector" is
 * inserting a row, not deploying code -- and unlike a table per type, it keeps
 * cross-type reservation queries trivial.
 */
export class Resources1756700000003 implements MigrationInterface {
  name = 'Resources1756700000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE resource_type (
        id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code              varchar(60) NOT NULL UNIQUE,
        name              varchar(120) NOT NULL,
        description       text,
        -- JSON Schema the attributes of every resource of this type must satisfy.
        attributes_schema jsonb NOT NULL DEFAULT '{"type":"object"}'::jsonb,
        is_active         boolean NOT NULL DEFAULT true,
        created_at        timestamptz NOT NULL DEFAULT now(),
        updated_at        timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE resource (
        id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_type_id uuid NOT NULL REFERENCES resource_type(id) ON DELETE RESTRICT,
        code             varchar(60) NOT NULL UNIQUE,
        name             varchar(160) NOT NULL,
        description      text,
        capacity         int,
        location         varchar(160),
        -- IANA zone. Operating hours are wall-clock in THIS zone; instants are
        -- always stored in UTC. Keeping the zone on the resource is what makes
        -- "09:00 to 18:00 on weekdays" mean the same thing all year.
        time_zone        varchar(64) NOT NULL DEFAULT 'UTC',
        attributes       jsonb NOT NULL DEFAULT '{}'::jsonb,
        is_active        boolean NOT NULL DEFAULT true,
        deactivated_at   timestamptz,
        created_at       timestamptz NOT NULL DEFAULT now(),
        updated_at       timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT resource_capacity_positive CHECK (capacity IS NULL OR capacity > 0),
        -- Deactivation is a soft delete: a historical reservation must never
        -- be orphaned. The two columns cannot disagree.
        CONSTRAINT resource_deactivation_consistent CHECK (
          (is_active = false) = (deactivated_at IS NOT NULL)
        )
      )
    `);

    await queryRunner.query(`CREATE INDEX resource_type_idx ON resource (resource_type_id)`);
    await queryRunner.query(
      `CREATE INDEX resource_active_idx ON resource (is_active) WHERE is_active = true`,
    );

    await queryRunner.query(`
      CREATE TABLE resource_availability (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_id uuid NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
        -- 0 = Sunday .. 6 = Saturday, matching JavaScript's getDay().
        day_of_week smallint NOT NULL,
        start_time  time NOT NULL,
        end_time    time NOT NULL,

        CONSTRAINT availability_day_valid CHECK (day_of_week BETWEEN 0 AND 6),
        CONSTRAINT availability_range_valid CHECK (end_time > start_time),
        -- One window per day per resource keeps the availability maths simple.
        CONSTRAINT availability_unique_day UNIQUE (resource_id, day_of_week, start_time)
      )
    `);

    await queryRunner.query(
      `CREATE INDEX availability_resource_idx ON resource_availability (resource_id, day_of_week)`,
    );

    await queryRunner.query(`
      CREATE TABLE resource_block (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_id uuid NOT NULL REFERENCES resource(id) ON DELETE CASCADE,
        start_at    timestamptz NOT NULL,
        end_at      timestamptz NOT NULL,
        -- Same half-open semantics as reservations, for the same reason: a
        -- block ending at 11:00 leaves 11:00 bookable.
        period      tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED,
        reason      varchar(300) NOT NULL,
        created_at  timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT block_range_valid CHECK (end_at > start_at),
        -- Two overlapping maintenance windows on one resource are a data
        -- entry mistake, not a scenario worth supporting.
        CONSTRAINT resource_block_no_overlap EXCLUDE USING gist (
          resource_id WITH =,
          period      WITH &&
        )
      )
    `);

    await queryRunner.query(
      `CREATE INDEX resource_block_period_idx ON resource_block USING gist (resource_id, period)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS resource_block`);
    await queryRunner.query(`DROP TABLE IF EXISTS resource_availability`);
    await queryRunner.query(`DROP TABLE IF EXISTS resource`);
    await queryRunner.query(`DROP TABLE IF EXISTS resource_type`);
  }
}
