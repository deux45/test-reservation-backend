const API = 'http://localhost:3000';
const COOKIE = process.argv[2];
const RESOURCE = process.argv[3];
const N = 25;

const payload = {
  resourceId: RESOURCE,
  title: 'Comite semanal',
  startAt: '2026-12-15T10:00:00Z',
  endAt: '2026-12-15T11:00:00Z',
};

// No Idempotency-Key: these are 25 genuinely distinct attempts racing for the
// same slot, not one request retried.
const responses = await Promise.all(
  Array.from({ length: N }, () =>
    fetch(`${API}/api/v1/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: COOKIE },
      body: JSON.stringify(payload),
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
  const c = conflicts[0].body;
  console.log(`\n  codigo del 409 : ${c?.code}`);
  console.log(`  conflicto      : ${JSON.stringify(c?.conflict)}`);
}
process.exitCode = created.length === 1 && conflicts.length === N - 1 ? 0 : 1;
