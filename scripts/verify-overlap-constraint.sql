-- Proves reservation_no_overlap at the database level, bypassing the
-- application entirely. If this passes, the invariant holds even against a
-- second API instance, a migration script or a psql session.
--
-- Run: docker compose exec -T postgres psql -U reservations -d reservations \
--        -f /scripts/verify-overlap-constraint.sql

\set ON_ERROR_STOP on
-- NOTICE, not WARNING: the PASS/FAIL lines below are RAISE NOTICE.
SET client_min_messages TO NOTICE;

BEGIN;

-- Fixtures ------------------------------------------------------------------
INSERT INTO "user" ("id", "name", "email", "emailVerified", "role")
VALUES ('u-test', 'Tester', 'tester@example.com', true, 'user');

-- A code of its own, not one from the catalogue seeded by migration 5: the
-- fixture must not collide with real reference data, and a unique constraint
-- violation here would look like a failure of the thing being tested.
INSERT INTO resource_type (id, code, name)
VALUES ('11111111-1111-1111-1111-111111111111',
        'verify-overlap-fixture', 'Fixture de verificacion');

INSERT INTO resource (id, resource_type_id, code, name, capacity, time_zone)
VALUES ('22222222-2222-2222-2222-222222222222',
        '11111111-1111-1111-1111-111111111111',
        'verify-overlap-room', 'Sala de verificacion', 12, 'Europe/Madrid');

-- The reference booking: 2026-09-15, 10:00 to 11:00 UTC.
INSERT INTO reservation (resource_id, user_id, title, start_at, end_at)
VALUES ('22222222-2222-2222-2222-222222222222', 'u-test', 'Referencia',
        '2026-09-15T10:00:00Z', '2026-09-15T11:00:00Z');

-- The seven boundary cases --------------------------------------------------
DO $$
DECLARE
  cases CONSTANT text[][] := ARRAY[
    ['a - justo antes',    '09:00', '10:00', 'accept'],
    ['b - justo despues',  '11:00', '12:00', 'accept'],
    ['c - pisa el inicio', '09:30', '10:30', 'reject'],
    ['d - pisa el final',  '10:30', '11:30', 'reject'],
    ['e - contenida',      '10:15', '10:45', 'reject'],
    ['f - envolvente',     '09:30', '11:30', 'reject'],
    ['g - identica',       '10:00', '11:00', 'reject']
  ];
  c          text[];
  actual     text;
  failures   int := 0;
BEGIN
  FOREACH c SLICE 1 IN ARRAY cases LOOP
    BEGIN
      INSERT INTO reservation (resource_id, user_id, title, start_at, end_at)
      VALUES ('22222222-2222-2222-2222-222222222222', 'u-test', c[1],
              ('2026-09-15T' || c[2] || ':00Z')::timestamptz,
              ('2026-09-15T' || c[3] || ':00Z')::timestamptz);
      actual := 'accept';
      -- Undo the accepted row so later cases still face only the reference.
      RAISE EXCEPTION 'rollback_accepted' USING ERRCODE = 'raise_exception';
    EXCEPTION
      WHEN exclusion_violation THEN actual := 'reject';
      WHEN raise_exception THEN actual := 'accept';
    END;

    IF actual = c[4] THEN
      RAISE NOTICE '  PASS  % -> %', rpad(c[1], 18), actual;
    ELSE
      failures := failures + 1;
      RAISE WARNING '  FAIL  % -> got %, expected %', rpad(c[1], 18), actual, c[4];
    END IF;
  END LOOP;

  IF failures > 0 THEN
    RAISE EXCEPTION '% of 7 boundary cases failed', failures;
  END IF;
  RAISE NOTICE '';
  RAISE NOTICE '  7/7 boundary cases behave correctly.';
END $$;

-- Cancelling frees the slot -------------------------------------------------
DO $$
BEGIN
  UPDATE reservation
     SET status = 'CANCELLED', cancelled_at = now(), cancellation_reason = 'test'
   WHERE title = 'Referencia';

  -- The partial WHERE on the constraint means a cancelled row leaves the
  -- index, so the exact same slot must now be free.
  INSERT INTO reservation (resource_id, user_id, title, start_at, end_at)
  VALUES ('22222222-2222-2222-2222-222222222222', 'u-test', 'Tras cancelar',
          '2026-09-15T10:00:00Z', '2026-09-15T11:00:00Z');

  RAISE NOTICE '  PASS  cancelacion libera el hueco';
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION '  FAIL  a cancelled reservation still blocks its slot';
END $$;

-- The generated column cannot be desynchronised -----------------------------
DO $$
DECLARE stored text;
BEGIN
  SELECT period::text INTO stored FROM reservation WHERE title = 'Tras cancelar';
  IF stored <> '["2026-09-15 10:00:00+00","2026-09-15 11:00:00+00")' THEN
    RAISE EXCEPTION '  FAIL  unexpected period: %', stored;
  END IF;
  RAISE NOTICE '  PASS  period is half-open [start, end): %', stored;
END $$;

ROLLBACK;
