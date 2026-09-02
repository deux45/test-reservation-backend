/**
 * Proves the no-overlap rule under real concurrency, through the HTTP API.
 *
 * The SQL check in verify-overlap-constraint.sql proves the constraint exists.
 * This proves the whole stack behaves when 25 people press the button at the
 * same instant: exactly one reservation, twenty-four honest 409s, and no
 * fifth-hundredth response blaming the database.
 *
 * Self-contained on purpose -- it signs in, finds a resource, asks the API
 * which slot is free and cleans up after itself -- so that `make
 * verify-concurrency` is one word and not a ritual with copied cookies.
 */

const API = process.env.API_URL ?? 'http://localhost:3000';
const EMAIL = process.env.SEED_EMAIL ?? 'admin@reservas.dev';
const PASSWORD = process.env.SEED_PASSWORD ?? 'Reservas2026!';
const N = 25;

const fail = (message) => {
  console.error(`  ${message}`);
  process.exit(1);
};

// --- 1. Sign in -------------------------------------------------------------

const signIn = await fetch(`${API}/api/auth/sign-in/email`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // Better Auth refuses a sign-in with no Origin -- correctly: that is its
    // CSRF defence. A script is not a browser, so it has to say who it is.
    Origin: API,
  },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});

if (!signIn.ok) {
  fail(`No se pudo iniciar sesión como ${EMAIL} (${signIn.status}). ¿Has ejecutado "make seed"?`);
}

// getSetCookie keeps the cookies separate; joining them by hand would break on
// the commas inside an Expires date.
const cookie = signIn.headers
  .getSetCookie()
  .map((entry) => entry.split(';')[0])
  .join('; ');

// --- 2. Pick a resource -----------------------------------------------------

const resources = await fetch(`${API}/api/v1/resources?limit=50`, {
  headers: { Cookie: cookie },
}).then((r) => r.json());

const resource = (resources.data ?? []).find((entry) => entry.isActive);
if (!resource) fail('No hay recursos activos. Ejecuta "make seed".');

// --- 3. Ask which slot is free ----------------------------------------------

// A month out, so the slot is not affected by whatever the demo data occupies
// this week, and comfortably inside the NotInThePastRule.
const from = new Date(Date.now() + 30 * 86_400_000);
from.setUTCHours(0, 0, 0, 0);
const to = new Date(from.getTime() + 7 * 86_400_000);

const query = new URLSearchParams({
  from: from.toISOString(),
  to: to.toISOString(),
  minDurationMinutes: '60',
});

const slots = await fetch(`${API}/api/v1/resources/${resource.id}/availability?${query}`, {
  headers: { Cookie: cookie },
}).then((r) => r.json());

if (!Array.isArray(slots) || slots.length === 0) {
  fail(`No hay huecos libres en ${resource.name} durante la semana consultada.`);
}

const startAt = slots[0].startAt;
const endAt = new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString();

console.log(`  Recurso : ${resource.name}`);
console.log(`  Franja  : ${startAt} -> ${endAt}`);
console.log(`  Lanzando ${N} peticiones simultáneas...\n`);

// --- 4. The race ------------------------------------------------------------

// No Idempotency-Key: these are 25 genuinely distinct attempts racing for the
// same slot, not one request retried. With a key they would all collapse into
// the same reservation, which would prove something else entirely.
const responses = await Promise.all(
  Array.from({ length: N }, () =>
    fetch(`${API}/api/v1/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ resourceId: resource.id, title: 'Carrera', startAt, endAt }),
    }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) })),
  ),
);

const created = responses.filter((r) => r.status === 201);
const conflicts = responses.filter((r) => r.status === 409);
const other = responses.filter((r) => r.status !== 201 && r.status !== 409);

console.log(`  201 Created  : ${created.length}   (esperado 1)`);
console.log(`  409 Conflict : ${conflicts.length}   (esperado ${N - 1})`);
console.log(`  otros        : ${other.length}   (esperado 0)`);

if (other.length) console.log('  ', JSON.stringify(other[0]).slice(0, 300));

if (conflicts.length) {
  const problem = conflicts[0].body;
  console.log(`\n  codigo del 409 : ${problem?.code}`);
  console.log(`  conflicto      : ${JSON.stringify(problem?.conflict)}`);
}

// --- 5. Confirm the database agrees, then clean up --------------------------

const stored = await fetch(
  `${API}/api/v1/reservations?resourceId=${resource.id}&status=CONFIRMED&from=${startAt}&to=${endAt}`,
  { headers: { Cookie: cookie } },
).then((r) => r.json());

console.log(`\n  filas CONFIRMED en la franja : ${stored.meta?.total}   (esperado 1)`);

// Leaves no trace, so the check can be run again immediately.
for (const winner of created) {
  await fetch(`${API}/api/v1/reservations/${winner.body.id}/cancellation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ reason: 'Limpieza de la prueba de concurrencia' }),
  });
}

const passed = created.length === 1 && conflicts.length === N - 1 && stored.meta?.total === 1;
console.log(passed ? '\n  RESULTADO: correcto.' : '\n  RESULTADO: FALLO.');
process.exitCode = passed ? 0 : 1;
