-- Tables behind the tutor dashboard: availability, requests, and sessions.
-- Safe to run more than once (IF NOT EXISTS everywhere). Apply with:
--   cd backend && npm run migrate
--
-- How booking works:
--   1. A tutor adds an availability_slot (a dated block of free time).
--   2. A student creates a session_request for that slot -> status PENDING.
--      Several students can request the same slot.
--   3. The tutor accepts one -> ACCEPTED (now it's a "session"); the other
--      pending requests for that slot are automatically DECLINED.
--      Or the tutor declines it -> DECLINED.
-- There's no separate sessions table: a session is just an ACCEPTED request.

-- A block of time a tutor has opened up for tutoring.
-- Times are TIMESTAMPTZ (stored as UTC); the frontend converts to local time.
CREATE TABLE IF NOT EXISTS availability_slots (
  id SERIAL PRIMARY KEY,
  tutor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS availability_slots_tutor_start_idx
  ON availability_slots (tutor_id, starts_at);

-- A student asking to book a slot. Once the tutor accepts, it's a session.
-- Deleting a slot deletes its requests (ON DELETE CASCADE); the API refuses
-- to delete a slot that has an ACCEPTED request. course_id is optional.
CREATE TABLE IF NOT EXISTS session_requests (
  id SERIAL PRIMARY KEY,
  slot_id INTEGER NOT NULL REFERENCES availability_slots(id) ON DELETE CASCADE,
  student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(course_id) ON DELETE SET NULL,
  note TEXT,
  status VARCHAR(10) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ
);

-- A slot can only be booked by one student. This is a partial unique index:
-- it only applies to ACCEPTED rows, so any number of PENDING/DECLINED rows
-- can share a slot. It's the database's backstop if two accepts race.
CREATE UNIQUE INDEX IF NOT EXISTS session_requests_one_accepted_per_slot
  ON session_requests (slot_id) WHERE status = 'ACCEPTED';

-- A student can't stack up duplicate pending requests for the same slot
CREATE UNIQUE INDEX IF NOT EXISTS session_requests_one_pending_per_student
  ON session_requests (slot_id, student_id) WHERE status = 'PENDING';
