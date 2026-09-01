import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The core of the system.
 *
 * Everything else in this project exists to serve one invariant, and this
 * migration is where that invariant actually lives: two CONFIRMED reservations
 * can never overlap on the same resource. Not "the service checks" -- the
 * database refuses.
 */
export class Reservations1756700000004 implements MigrationInterface {
  name = 'Reservations1756700000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE reservation_status AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED')
    `);

    await queryRunner.query(`
      CREATE TABLE reservation (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        resource_id         uuid NOT NULL REFERENCES resource(id) ON DELETE RESTRICT,
        user_id             text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
        title               varchar(160) NOT NULL,
        start_at            timestamptz NOT NULL,
        end_at              timestamptz NOT NULL,

        -- Generated, so the range can never drift out of sync with the two
        -- columns it derives from -- not even via a direct UPDATE.
        --
        -- '[)' is half-open: 10:00-11:00 and 11:00-12:00 are adjacent, not
        -- conflicting. This single character is the difference between a
        -- booking system people can use and one that rejects back-to-back
        -- meetings.
        period              tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED,

        status              reservation_status NOT NULL DEFAULT 'CONFIRMED',
        attendees           int,
        notes               text,
        cancelled_at        timestamptz,
        cancelled_by        text REFERENCES "user"("id") ON DELETE SET NULL,
        cancellation_reason varchar(300),
        idempotency_key     varchar(80),
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now(),

        CONSTRAINT reservation_valid_range CHECK (end_at > start_at),
        CONSTRAINT reservation_attendees_positive CHECK (attendees IS NULL OR attendees > 0),
        CONSTRAINT reservation_cancellation_consistent CHECK (
          (status = 'CANCELLED') = (cancelled_at IS NOT NULL)
        ),

        -- ------------------------------------------------------------------
        -- THE rule from the brief, as a physical invariant of the database.
        --
        -- The WHERE clause is what makes cancellation work: a CANCELLED
        -- reservation leaves the index, so its slot is immediately free again.
        --
        -- Requires btree_gist (migration 1) to mix = on a uuid with && on a
        -- range inside one GiST index.
        -- ------------------------------------------------------------------
        CONSTRAINT reservation_no_overlap EXCLUDE USING gist (
          resource_id WITH =,
          period      WITH &&
        ) WHERE (status = 'CONFIRMED')
      )
    `);

    // A retried request must not create a second reservation. Partial, so the
    // many rows without a key do not collide with each other.
    await queryRunner.query(`
      CREATE UNIQUE INDEX reservation_idempotency_uq
        ON reservation (user_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL
    `);

    // Serves the availability query: walk one resource's confirmed ranges.
    await queryRunner.query(`
      CREATE INDEX reservation_resource_period_idx
        ON reservation USING gist (resource_id, period)
        WHERE status = 'CONFIRMED'
    `);

    // Serve the filtered, paginated listings.
    await queryRunner.query(
      `CREATE INDEX reservation_user_start_idx ON reservation (user_id, start_at DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX reservation_status_start_idx ON reservation (status, start_at DESC)`,
    );

    // Keeps updated_at honest without every writer having to remember.
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);

    for (const table of ['resource_type', 'resource', 'reservation', 'user_profile']) {
      await queryRunner.query(`
        CREATE TRIGGER ${table}_set_updated_at
          BEFORE UPDATE ON ${table}
          FOR EACH ROW EXECUTE FUNCTION set_updated_at()
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of ['resource_type', 'resource', 'reservation', 'user_profile']) {
      await queryRunner.query(`DROP TRIGGER IF EXISTS ${table}_set_updated_at ON ${table}`);
    }
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_updated_at()`);
    await queryRunner.query(`DROP TABLE IF EXISTS reservation`);
    await queryRunner.query(`DROP TYPE IF EXISTS reservation_status`);
  }
}
