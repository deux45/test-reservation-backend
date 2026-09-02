/**
 * Writes the OpenAPI document to openapi.json.
 *
 * The web repository turns that file into TypeScript types, so a change to a
 * DTO here becomes a compile error there instead of an `undefined` at runtime.
 *
 * It fetches the document from the running API rather than booting a Nest
 * application context of its own. That is not laziness: building the document
 * in-process needs an INestApplication, which needs dependency injection,
 * which does not survive tsx or ts-node here (see appendix A of the plan). The
 * API already publishes the exact same document at /api/docs-json, and asking
 * the running service what its contract is has the pleasant property of being
 * the contract it actually serves.
 */

import { writeFile } from 'node:fs/promises';

const API = process.env.API_URL ?? 'http://localhost:3000';
const OUTPUT = process.env.OPENAPI_OUT ?? 'openapi.json';

const response = await fetch(`${API}/api/docs-json`);

if (!response.ok) {
  console.error(
    `No se pudo obtener el documento OpenAPI de ${API}/api/docs-json (${response.status}).\n` +
      'La API tiene que estar levantada: "make up".',
  );
  process.exit(1);
}

const document = await response.json();

// Pretty-printed with a trailing newline so the file diffs cleanly when an
// endpoint is added, instead of showing one enormous changed line.
await writeFile(OUTPUT, `${JSON.stringify(document, null, 2)}\n`);

const paths = Object.keys(document.paths ?? {}).length;
console.log(`${OUTPUT} escrito: ${paths} rutas.`);
