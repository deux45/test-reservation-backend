import 'reflect-metadata';
import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

// The TypeORM CLI runs outside Nest, so it loads .env itself.
loadEnv();

/**
 * DataSource used by the TypeORM CLI for migrations.
 *
 * `synchronize` is false and stays false: the schema is owned by explicit
 * migrations. Auto-synchronise cannot express the generated `period` column
 * or the EXCLUDE constraint, and it would silently drop them.
 */
// Exactly one DataSource export: the TypeORM CLI refuses a file that exports
// the same instance twice (named plus default).
export const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [`${__dirname}/../**/entities/*.entity.{ts,js}`],
  migrations: [`${__dirname}/migrations/*.{ts,js}`],
  synchronize: false,
  migrationsRun: false,
  logging: process.env.NODE_ENV === 'development' ? ['error', 'warn', 'migration'] : ['error'],
});
