-- Runs once, on first initialisation of the data volume.
--
-- The migrations create these too (a fresh database in CI or on a colleague's
-- machine must not depend on this file). Having them here as well means the
-- extensions exist from second zero, before any migration runs.

-- Required to combine equality (resource_id) and overlap (period) in a single
-- GiST index -- which is what the reservation_no_overlap EXCLUDE constraint is.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;
