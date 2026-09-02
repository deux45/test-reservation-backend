# Reservations API

An API for booking shared resources: meeting rooms, laptops, vehicles, and any
other type someone chooses to register.

The central rule is that **no two active reservations may overlap on the same
resource**. Everything else in this repository follows from taking that sentence
seriously.

- **Stack**: NestJS 11 · TypeScript 6 · PostgreSQL 18 · TypeORM · Better Auth
- **Web client**: [test-reservation-frontend](../test-reservation-frontend) (Next.js 16 + MUI)

---

## Getting started

Docker is the only requirement. No Node on the host, no `.env` to write, no
order of steps to remember.

```bash
make start
```

That builds the images, starts PostgreSQL, waits until it actually accepts
connections, applies the ten migrations, loads demo data and leaves the API
listening.

| Service | URL                            |                                                     |
| ------- | ------------------------------ | --------------------------------------------------- |
| API     | http://localhost:3000/api/v1   |                                                     |
| Swagger | http://localhost:3000/api/docs | interactive documentation                           |
| Adminer | http://localhost:8080          | server `postgres`, user and password `reservations` |

Demo accounts, all with the password `Reservas2026!`:

| Email                 | Role  |
| --------------------- | ----- |
| `admin@reservas.dev`  | admin |
| `carlos@reservas.dev` | user  |
| `marta@reservas.dev`  | user  |

For the full interface, start the frontend repository as well — its `make start`
starts this one if it is not already running.

### Without `make`

It is a wrapper, not a requirement. The same thing by hand:

```bash
docker compose up -d --build
docker compose exec api npm run migration:run:dev
docker compose exec api npm run seed:dev
```

On Windows, `make` installs with `winget install GnuWin32.Make`, with Chocolatey
(`choco install make`), or from WSL.

---

## Commands

`make` with no arguments lists everything. The ones used daily:

| Command                   | What it does                                   |
| ------------------------- | ---------------------------------------------- |
| `make start`              | Full bootstrap from nothing                    |
| `make reset`              | Wipe the database and start over               |
| `make logs-api`           | Follow the API logs                            |
| `make psql`               | SQL console                                    |
| `make test`               | Unit tests                                     |
| `make check`              | What CI validates: types, lint and tests       |
| `make verify-overlap`     | Proves the overlap constraint in SQL           |
| `make verify-concurrency` | 25 simultaneous bookings; exactly one must win |

---

## The central rule

The requirement is one sentence, but it admits many implementations and almost
all of them are wrong. This one uses **three layers**, and only the third is a
guarantee.

### 1. The `Period` value object — shape

[`src/reservations/period.vo.ts`](src/reservations/period.vo.ts)

An invalid range never comes into existence: the constructor is private, and
`create()` checks that the end is after the start, that the duration is within
bounds, and that the minutes fall on the allowed granularity. A malformed
`Period` is not something to be detected; it is something that cannot be built.

Intervals are **half-open**, `[start, end)`. A booking from 10:00 to 11:00 and
one from 11:00 to 12:00 do not overlap. This decision is repeated identically in
all three layers, and it is the only way the three can agree.

### 2. Lock and business rules — the useful message

[`src/reservations/services/reservation.service.ts`](src/reservations/services/reservation.service.ts)

Inside the transaction a `pg_advisory_xact_lock` is taken per resource. That
serialises bookings _for that resource_ without serialising the whole API, which
is what a `SERIALIZABLE` isolation level would do.

With the lock held, seven rules run, each in its own class, ordered cheapest
first:

```
ResourceIsActiveRule → NotInThePastRule → SufficientCapacityRule
→ WithinOperatingHoursRule → NoResourceBlockRule → NoOverlapRule
→ ActiveReservationLimitRule
```

Adding a rule is adding a class and one line in the module. The service is not
touched: the open/closed principle as something you can point at rather than
assert.

This layer is what produces a 409 that says _which_ range clashes. It is not
what guarantees anything.

### 3. The `EXCLUDE` constraint — the guarantee

[`src/database/migrations/1756700000004-Reservations.ts`](src/database/migrations/1756700000004-Reservations.ts)

```sql
period tstzrange GENERATED ALWAYS AS (tstzrange(start_at, end_at, '[)')) STORED,

CONSTRAINT reservation_no_overlap EXCLUDE USING gist (
  resource_id WITH =,
  period      WITH &&
) WHERE (status = 'CONFIRMED')
```

This is what makes the requirement hold always. It does not matter how many API
instances are running, whether someone inserts by hand through `psql`, or
whether a future refactor forgets to call the rules: PostgreSQL rejects the row.

Three details make it work:

- `WHERE (status = 'CONFIRMED')` makes it **partial**. Cancelling frees the slot
  in the same instant, and a cancelled reservation can coexist with the
  confirmed one now occupying its slot.
- `period` is a **generated** column owned by the database. It cannot drift from
  the two columns it derives from because nobody writes it.
- Mixing `=` on a `uuid` with `&&` on a range in a single GiST index requires
  the `btree_gist` extension, created by migration 1.

Error `23P01` is translated into `OverlappingReservationError` and from there
into a 409.

### How it is verified

Two checks, deliberately different:

```bash
make verify-overlap      # straight SQL, bypassing the API
make verify-concurrency  # 25 simultaneous POSTs over HTTP
```

The first matters precisely because it does **not** go through application code:
if the guarantee depended on the service, this test would prove nothing. It
covers seven boundary cases, including the contiguous one (`10-11` and `11-12`,
which must be accepted) and the cancellation case.

The second fires 25 requests at once for the same slot. The expected result is
exactly one `201` and twenty-four `409`s, with a single `CONFIRMED` row in the
table.

---

## Endpoints

Everything under `/api/v1`. The live, executable reference is at
[http://localhost:3000/api/docs](http://localhost:3000/api/docs).

### Reservations

| Method  | Path                             |                                   |
| ------- | -------------------------------- | --------------------------------- |
| `POST`  | `/reservations`                  | Create. Accepts `Idempotency-Key` |
| `GET`   | `/reservations`                  | List with filters and pagination  |
| `GET`   | `/reservations/:id`              | Detail                            |
| `PATCH` | `/reservations/:id`              | Reschedule                        |
| `POST`  | `/reservations/:id/cancellation` | Cancel                            |

List filters: `resourceId`, `userId`, `status` (repeatable), `from`, `to`,
`page`, `limit`.

Cancellation is a `POST` that records a fact, not a `DELETE`. Nothing is
removed: who cancelled, when and why are all kept, and the slot is freed
instantly.

### Resources

| Method   | Path                          |                           |
| -------- | ----------------------------- | ------------------------- |
| `GET`    | `/resources`                  | List                      |
| `GET`    | `/resources/:id`              | Detail                    |
| `POST`   | `/resources`                  | Create                    |
| `PATCH`  | `/resources/:id`              | Update                    |
| `DELETE` | `/resources/:id`              | Deactivate                |
| `POST`   | `/resources/:id/activation`   | Reactivate                |
| `GET`    | `/resources/:id/availability` | **Free slots in a range** |

`DELETE` deactivates, it does not delete. A resource with historical
reservations is never removed: doing so would orphan them, and the foreign key's
`RESTRICT` would refuse it anyway.

`/availability` starts from the resource's operating hours and subtracts
maintenance blocks and confirmed reservations. It accepts `from`, `to` and
`minDurationMinutes`, and the range is capped at 60 days: asking for a year of
slots is a denial-of-service dressed as a query.

### Users and catalogue

| Method            | Path              |                     |
| ----------------- | ----------------- | ------------------- |
| `GET`             | `/users`          | List (admin)        |
| `POST`            | `/users`          | Create (admin)      |
| `PATCH`           | `/users/:id`      | Edit name and email |
| `PATCH`           | `/users/:id/role` | Change role         |
| `POST` / `DELETE` | `/users/:id/ban`  | Ban and unban       |
| `GET` / `POST`    | `/resource-types` | Type catalogue      |

---

## Structure

One directory per business module, and inside it the split by responsibility —
the same shape in all four:

```
src/
├── auth/                    Identity: port, adapters, guards
│   ├── ports/               AuthProvider: the entire coupling surface
│   ├── providers/           better-auth.provider.ts, fake-auth.provider.ts
│   ├── guards/              Authentication and authorisation, both global
│   └── decorators/          @Public(), @Roles(), @CurrentUser()
├── common/                  RFC 7807 errors, pagination, shared utilities
├── config/                  Environment validation with zod, Swagger
├── database/
│   ├── migrations/          Ten, numbered and ordered
│   └── seeds/               Demo data, idempotent
├── reservations/            controllers · dtos · entities · repositories
│   ├── rules/               One class per business rule
│   ├── services/            reservation · availability · lock · clock
│   ├── utils/               Interval arithmetic, pure
│   └── period.vo.ts         The value object
├── resources/               controllers · dtos · entities · repositories · services
├── users/                   controllers · dtos · entities · repositories · services
└── health/
```

### Why authentication sits behind a port

Better Auth solves a lot, but it is a young dependency in a part of the system
that is expensive to change. The entire coupling surface fits in one interface:

```ts
export interface AuthProvider {
  readonly name: string;
  authenticate(headers: Headers): Promise<AuthenticatedUser | null>;
  getRequestHandler(): RequestHandler | null;
  createAccount?(input: NewAccount): Promise<{ id: string }>;
}
```

Nothing outside `src/auth/` imports `better-auth` — enforced by an ESLint rule,
not by convention. Replacing it with Auth0, Keycloak or a corporate SSO means
writing one class and changing an environment variable.
`auth-provider.contract.ts` is a contract test any implementation must pass, so
the replacement is validated before being plugged in.

`createAccount` is optional on purpose: a provider backed by corporate SSO
cannot create accounts, and the API answers 501 rather than pretending the
attempt failed.

---

## Tests

```bash
make test    # 57 unit tests
make check   # types + lint + tests, the same as CI
```

Testcontainers is configured and `make test-e2e` exists, but **the end-to-end
suite is not written yet**: today that command runs no tests. The design is for
it to start its own PostgreSQL rather than reuse the development one, because a
test that depends on the state the previous one left behind is a test that fails
on Tuesdays.

In the meantime the central guarantee _is_ verified, two independent ways:
`make verify-overlap` and `make verify-concurrency`.

What is covered and why:

- **`Period`** — the boundary cases of half-openness, granularity and duration.
- **`subtractIntervals`** — the free-slot arithmetic, with overlapping busy
  intervals and the contiguous case that must not produce a phantom slot.
- **Every rule**, in isolation from the others.
- **The guards**, authentication and authorisation.
- **The `AuthProvider` contract**, against the real adapter and the fake one.

---

## Decisions worth explaining

**`synchronize` is `false` and will stay that way.** TypeORM's auto-synchronise
cannot express a generated column or an `EXCLUDE` constraint, and would drop
them without warning. The schema belongs to the migrations.

**Migrations do not run at boot.** `migrationsRun` is `false` in both data
sources, and there is a separate entry point
(`node dist/database/run-migrations.js`). Running them at boot would have every
replica racing to alter the same schema on every deploy, and a failed migration
would become a crash loop instead of a failed step.

**The `Idempotency-Key` belongs to the client, not the server.** Backed by a
partial unique index on `(user_id, idempotency_key)` — partial so the many rows
without a key do not collide with each other. A double click is a retry, and
returns the reservation already created instead of a 409.

**Errors follow RFC 7807.** `application/problem+json`, with the `x-request-id`
included, so an error a user reports can be found in the logs.

**The time zone lives on the resource.** Operating hours are wall-clock ("09:00
to 18:00 on weekdays") while instants are stored in UTC. Keeping the zone on the
resource is what makes that sentence mean the same thing on both sides of a
daylight saving change.

---

## Supply chain

A careless `npm install` is today the most likely vector of compromise, so there
are concrete measures:

- **`ignore-scripts=true`** in `.npmrc`. No `postinstall` runs on install: it is
  the number one vector of every npm worm.
- **`min-release-age=7`**. A version published less than a week ago is not
  installed. Most compromised packages are caught and pulled within hours.
- **Exact versions**, no `^` or `~`, and `npm ci` everywhere.
- **`make audit`** checks known vulnerabilities, registry signatures and the
  OSV.dev database.
- **GitHub Actions pinned by SHA**, not by tag: a tag can be repointed, a SHA
  cannot.
- The production image is multi-stage, runs as `node` (not root), with a
  read-only filesystem, no capabilities and `tini` as PID 1.

Current state: **0 vulnerabilities**.

---

## Versioning

Conventional commits validated by commitlint, `CHANGELOG.md` generated from them
and semantic versioning:

```bash
make release
```

The changelog is not edited by hand. If an entry reads badly, the problem is in
the commit message.

---

## Documentation

- [`docs/IMPLEMENTATION-PLAN.md`](docs/IMPLEMENTATION-PLAN.md) — the full plan,
  with the design decisions and an appendix of operational gotchas found while
  implementing. Written in Spanish, as agreed for the planning document.
- [http://localhost:3000/api/docs](http://localhost:3000/api/docs) — Swagger.
