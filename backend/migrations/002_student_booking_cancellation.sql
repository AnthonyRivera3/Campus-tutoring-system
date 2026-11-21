-- CampusConnect: allow a student to cancel a pending request or accepted booking.
-- IMPORTANT: Run ONCE in your shared Neon PostgreSQL SQL editor after reviewing
-- the existing 001_tutor_scheduling.sql migration with your team.
-- This migration preserves all existing requests and leaves tutor routes intact.
-- Existing CHECK constraints with a different name are deliberately detected
-- so the migration fails safely instead of silently leaving conflicting rules.

BEGIN;

-- Preserve when a student chose to cancel (including cancellation after acceptance).
ALTER TABLE public.session_requests
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conrelid = 'public.session_requests'::regclass
      AND c.contype = 'c'
      AND c.conname <> 'session_requests_status_check'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  ) THEN
    RAISE EXCEPTION
      'A custom session_requests status CHECK constraint exists. Review it before enabling CANCELLED.';
  END IF;
END;
$$;

-- PostgreSQL's default name for CHECK(status IN (...)) is
-- session_requests_status_check. This allows the new status without dropping
-- unrelated constraints or changing any existing request status.
ALTER TABLE public.session_requests
  DROP CONSTRAINT IF EXISTS session_requests_status_check;

ALTER TABLE public.session_requests
  ADD CONSTRAINT session_requests_status_check
    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED'));

COMMIT;
