import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Identity schema.
 *
 * The four Better Auth tables below are NOT hand-written: they are the exact
 * output of `@better-auth/cli generate` for this project's auth config
 * (email/password + the admin plugin), copied here verbatim.
 *
 * Why copy instead of running the Better Auth CLI as part of setup: two
 * migration systems over one database is a reliable source of surprises. One
 * `migration:run` builds the whole schema, and the foreign keys from
 * `reservation` to `user` are guaranteed by migration order.
 *
 * The CLI itself is not a dependency of this project. It bundles a nested
 * copy of better-auth <= 1.6.21, which carries ten advisories including
 * critical ones; it was used once and removed. Regenerate by installing it
 * temporarily if the auth config's plugins ever change.
 *
 * Note the quoted camelCase identifiers: that is Better Auth's own naming and
 * it owns these tables. Application tables use snake_case.
 */
export class Identity1756700000002 implements MigrationInterface {
  name = 'Identity1756700000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "user" (
        "id"            text NOT NULL PRIMARY KEY,
        "name"          text NOT NULL,
        "email"         text NOT NULL UNIQUE,
        "emailVerified" boolean NOT NULL,
        "image"         text,
        "createdAt"     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"     timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "role"          text,
        "banned"        boolean,
        "banReason"     text,
        "banExpires"    timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "session" (
        "id"             text NOT NULL PRIMARY KEY,
        "expiresAt"      timestamptz NOT NULL,
        "token"          text NOT NULL UNIQUE,
        "createdAt"      timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"      timestamptz NOT NULL,
        "ipAddress"      text,
        "userAgent"      text,
        "userId"         text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
        "impersonatedBy" text
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "account" (
        "id"                    text NOT NULL PRIMARY KEY,
        "accountId"             text NOT NULL,
        "providerId"            text NOT NULL,
        -- Added in better-auth 1.7: account identity is scoped by issuer.
        -- The CLI that generated the rest of this file bundles better-auth
        -- 1.6.21 and therefore omits it. Taken from getMigrations() run
        -- against the version this project actually depends on, 1.7.1.
        "issuer"                text NOT NULL,
        "userId"                text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
        "accessToken"           text,
        "refreshToken"          text,
        "idToken"               text,
        "accessTokenExpiresAt"  timestamptz,
        "refreshTokenExpiresAt" timestamptz,
        "scope"                 text,
        "password"              text,
        "createdAt"             timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"             timestamptz NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "verification" (
        "id"         text NOT NULL PRIMARY KEY,
        "identifier" text NOT NULL,
        "value"      text NOT NULL,
        "expiresAt"  timestamptz NOT NULL,
        "createdAt"  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt"  timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await queryRunner.query(`CREATE INDEX "session_userId_idx" ON "session" ("userId")`);
    await queryRunner.query(`CREATE INDEX "account_userId_idx" ON "account" ("userId")`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "account_issuer_accountId_uidx" ON "account" ("issuer", "accountId")`,
    );
    await queryRunner.query(
      `CREATE INDEX "verification_identifier_idx" ON "verification" ("identifier")`,
    );

    // Our own extension of the identity, kept in a separate table so Better
    // Auth's schema can be regenerated without losing application data.
    await queryRunner.query(`
      CREATE TABLE user_profile (
        user_id                  text PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
        active_reservation_limit int NOT NULL DEFAULT 10,
        department               varchar(120),
        created_at               timestamptz NOT NULL DEFAULT now(),
        updated_at               timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT user_profile_limit_positive CHECK (active_reservation_limit > 0)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS user_profile`);
    await queryRunner.query(`DROP TABLE IF EXISTS "verification"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "account"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "session"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user"`);
  }
}
