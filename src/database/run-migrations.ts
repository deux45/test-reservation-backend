import 'reflect-metadata';
import { dataSource } from './data-source';

/**
 * Runs pending migrations and exits.
 *
 * In development the TypeORM CLI does this straight from TypeScript. In a
 * production image there is no CLI and no TypeScript: the runtime stage ships
 * `dist` and production dependencies only, so migrating needs a compiled
 * entry point of its own. This is it -- `node dist/database/run-migrations.js`.
 *
 * It is a separate process from the API on purpose. Running migrations at boot
 * would mean every replica racing to alter the same schema on every deploy,
 * and a failed migration would turn into a crash loop instead of a failed
 * step. `migrationsRun` is false in both data sources for that reason.
 */
async function main(): Promise<void> {
  await dataSource.initialize();

  try {
    const applied = await dataSource.runMigrations({ transaction: 'each' });

    if (applied.length === 0) {
      console.log('No hay migraciones pendientes.');
      return;
    }

    for (const migration of applied) {
      console.log(`Aplicada: ${migration.name}`);
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('Fallo al aplicar las migraciones:', error);
  // A non-zero exit is what makes a deploy stop here rather than starting an
  // API against a schema that is half-migrated.
  process.exit(1);
});
