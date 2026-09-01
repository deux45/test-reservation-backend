/**
 * Runs before every test module is loaded.
 *
 * The timezone must be pinned here rather than in a beforeAll: Node caches the
 * zone on first use, so setting it after a date has been constructed has no
 * effect. Everything in this system is stored and compared in UTC.
 */
process.env.TZ = 'UTC';
