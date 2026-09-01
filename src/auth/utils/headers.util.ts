import { type IncomingHttpHeaders } from 'node:http';

/**
 * Converts Node's header bag into the Web `Headers` the port expects.
 *
 * The port speaks the Web standard rather than Express's shape so an adapter
 * is not forced to depend on Express. Node repeats a header as an array; the
 * Web API models that as a comma-joined value.
 */
export function toWebHeaders(incoming: IncomingHttpHeaders): Headers {
  const headers = new Headers();

  for (const [name, value] of Object.entries(incoming)) {
    if (value === undefined) continue;
    headers.set(name, Array.isArray(value) ? value.join(', ') : value);
  }

  return headers;
}
