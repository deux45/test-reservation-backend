import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Extensions1756700000001 implements MigrationInterface {
  name = 'Extensions1756700000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Required to combine equality (resource_id) and overlap (period) inside a
    // single GiST index. Without it the EXCLUDE constraint in migration 4
    // cannot be created at all.
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS btree_gist`);

    // gen_random_uuid()
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  }

  public async down(): Promise<void> {
    // Deliberately empty. Dropping an extension would break any other schema
    // in the database that depends on it, and re-running `up` is idempotent.
  }
}
