import 'reflect-metadata';
import { TZDate } from '@date-fns/tz';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { AUTH_PROVIDER, type AuthProvider } from '../../auth/ports/auth-provider.port';
import { RESERVATIONS, RESOURCES, SEED_PASSWORD, USERS } from './seed-data';

/**
 * Loads the demo dataset.
 *
 * Three decisions worth explaining.
 *
 * It boots a Nest application context instead of opening its own connection.
 * That costs a second at startup and buys the same wiring the API uses: the
 * seed cannot drift from the application's own configuration, because it is
 * the application's configuration.
 *
 * Users are created through AuthProvider, the port -- not by inserting rows
 * and not by importing Better Auth. Password hashing belongs to the identity
 * provider, and a "user" row without the matching "account" row looks fine in
 * the database but can never sign in, which is a confusing first five minutes
 * for anyone cloning this repository. Going through the port also means this
 * file keeps working if the provider is ever swapped.
 *
 * It is idempotent. Every step skips what is already there, so `make seed`
 * twice is the same as once. A seed that only works on an empty database is a
 * seed nobody dares run.
 */
async function main(): Promise<void> {
  refuseInProduction();

  // No HTTP server: the context gives dependency injection without a port.
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const db = app.get(DataSource);
    const auth = app.get<AuthProvider>(AUTH_PROVIDER);

    const userIds = await seedUsers(db, auth);
    const resourceIds = await seedResources(db);
    await seedReservations(db, userIds, resourceIds);

    console.log('\nDatos de demostración cargados.');
    console.log(`Entra con ${USERS[0]!.email} / ${SEED_PASSWORD}`);
  } finally {
    await app.close();
  }
}

/**
 * A seed inserts known passwords and is designed to be re-run. Both are fine
 * in development and neither is fine in production, so the guard lives here
 * rather than in a README nobody reads at 2am.
 */
function refuseInProduction(): void {
  if (process.env.NODE_ENV !== 'production') return;

  console.error(
    'Los datos de demostración no se cargan con NODE_ENV=production.\n' +
      'Contienen contraseñas conocidas.',
  );
  process.exit(1);
}

async function seedUsers(db: DataSource, auth: AuthProvider): Promise<Map<string, string>> {
  if (!auth.createAccount) {
    throw new Error(
      `El proveedor de identidad "${auth.name}" no permite crear cuentas, ` +
        'así que no se pueden sembrar usuarios.',
    );
  }

  const ids = new Map<string, string>();

  for (const user of USERS) {
    const existing = await db.query<{ id: string }[]>('SELECT id FROM "user" WHERE email = $1', [
      user.email,
    ]);

    if (existing.length > 0) {
      ids.set(user.email, existing[0]!.id);
      console.log(`Usuario ya existente: ${user.email}`);
      continue;
    }

    const created = await auth.createAccount({
      email: user.email,
      password: SEED_PASSWORD,
      name: user.name,
    });

    // The provider assigns the default role on sign-up; the elevated one is
    // applied afterwards, exactly as UserService does it.
    if (user.role !== 'user') {
      await db.query('UPDATE "user" SET role = $1 WHERE id = $2', [user.role, created.id]);
    }

    ids.set(user.email, created.id);
    console.log(`Usuario creado: ${user.email} (${user.role})`);
  }

  return ids;
}

async function seedResources(db: DataSource): Promise<Map<string, string>> {
  const ids = new Map<string, string>();

  for (const resource of RESOURCES) {
    const type = await db.query<{ id: string }[]>('SELECT id FROM resource_type WHERE code = $1', [
      resource.typeCode,
    ]);

    if (type.length === 0) {
      // The catalogue is reference data created by migration 5. Missing means
      // the migrations were not run, which is worth saying plainly.
      throw new Error(
        `No existe el tipo de recurso "${resource.typeCode}". ¿Se han ejecutado las migraciones?`,
      );
    }

    const inserted = await db.query<{ id: string }[]>(
      `INSERT INTO resource
         (resource_type_id, code, name, description, capacity, location, time_zone,
          is_active, deactivated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (code) DO NOTHING
       RETURNING id`,
      [
        type[0]!.id,
        resource.code,
        resource.name,
        resource.description,
        resource.capacity,
        resource.location,
        resource.timeZone,
        resource.isActive,
        resource.isActive ? null : new Date(),
      ],
    );

    if (inserted.length === 0) {
      // DO NOTHING returns no row, so an existing resource needs a lookup.
      const found = await db.query<{ id: string }[]>('SELECT id FROM resource WHERE code = $1', [
        resource.code,
      ]);
      ids.set(resource.code, found[0]!.id);
      console.log(`Recurso ya existente: ${resource.name}`);
      continue;
    }

    const id = inserted[0]!.id;
    ids.set(resource.code, id);

    for (const window of resource.schedule) {
      for (const day of window.days) {
        await db.query(
          `INSERT INTO resource_availability (resource_id, day_of_week, start_time, end_time)
           VALUES ($1, $2, $3, $4)`,
          [id, day, window.startTime, window.endTime],
        );
      }
    }

    console.log(`Recurso creado: ${resource.name}`);
  }

  return ids;
}

async function seedReservations(
  db: DataSource,
  userIds: Map<string, string>,
  resourceIds: Map<string, string>,
): Promise<void> {
  for (const reservation of RESERVATIONS) {
    const resourceId = resourceIds.get(reservation.resourceCode)!;
    const userId = userIds.get(reservation.userEmail)!;

    const zone = RESOURCES.find((entry) => entry.code === reservation.resourceCode)!.timeZone;
    const startAt = futureInstant(reservation.dayOffset, reservation.startTime, zone);
    const endAt = futureInstant(reservation.dayOffset, reservation.endTime, zone);

    // Checked by hand rather than with a unique constraint: the real table
    // deliberately allows two identical-looking reservations on different
    // resources, so the uniqueness this seed wants is not the table's.
    const existing = await db.query<{ id: string }[]>(
      'SELECT id FROM reservation WHERE resource_id = $1 AND title = $2 AND start_at = $3',
      [resourceId, reservation.title, startAt],
    );

    if (existing.length > 0) {
      console.log(`Reserva ya existente: ${reservation.title}`);
      continue;
    }

    await db.query(
      `INSERT INTO reservation
         (resource_id, user_id, title, start_at, end_at, status,
          cancelled_at, cancelled_by, cancellation_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        resourceId,
        userId,
        reservation.title,
        startAt,
        endAt,
        reservation.cancelled ? 'CANCELLED' : 'CONFIRMED',
        reservation.cancelled ? new Date() : null,
        reservation.cancelled ? userId : null,
        reservation.cancelled ? 'Datos de demostración' : null,
      ],
    );

    console.log(`Reserva creada: ${reservation.title}`);
  }
}

/**
 * "10:00, two days from now, in Europe/Madrid" as a UTC instant.
 *
 * The offset is applied to the calendar date in the resource's own zone, not
 * to the raw timestamp: adding 48 hours across a daylight saving change lands
 * on a different wall-clock hour, which would quietly move a seeded meeting.
 */
function futureInstant(dayOffset: number, time: string, timeZone: string): Date {
  const today = new TZDate(new Date(), timeZone);
  const [hours = '0', minutes = '0'] = time.split(':');

  return new Date(
    new TZDate(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + dayOffset,
      Number(hours),
      Number(minutes),
      0,
      0,
      timeZone,
    ).getTime(),
  );
}

main().catch((error: unknown) => {
  console.error('Fallo al cargar los datos de demostración:', error);
  process.exit(1);
});
