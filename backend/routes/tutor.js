const express = require('express')
const { requireTutor } = require('../middleware/auth')
const pool = require('../db')

// Everything the tutor dashboard needs. Mounted at /api/tutor and every
// route requires a logged-in tutor (req.user.id is the tutor's id).
// Every query filters by req.user.id, so tutors only ever see or change
// their own data.
//
//   GET    /api/tutor/courses             courses I tutor
//   DELETE /api/tutor/courses/:courseId   stop tutoring a course
//   GET    /api/tutor/availability        my upcoming time slots
//   POST   /api/tutor/availability        add a slot { starts_at, ends_at }
//   DELETE /api/tutor/availability/:id    remove a slot
//   GET    /api/tutor/requests            pending student requests
//   PATCH  /api/tutor/requests/:id        { status: 'ACCEPTED' | 'DECLINED' }
//   GET    /api/tutor/sessions?from&to    accepted sessions in a time range
//
// See migrations/001_tutor_scheduling.sql for how slots/requests relate.
const router = express.Router()

router.use(requireTutor)

// Longest single block a tutor can open, to catch typos like 9am-9pm the next day
const MAX_SLOT_HOURS = 8

// Turns a URL param like "12" into 12, or null if it isn't a positive integer
function parseId(value) {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

// Turns an ISO string like "2026-10-29T18:00:00.000Z" into a Date, or null
function parseDate(value) {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

// ---------- Courses ----------

// Courses the logged-in tutor teaches
router.get('/courses', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.course_id, c.code, c.title
       FROM tutor_courses tc
       JOIN courses c ON c.course_id = tc.course_id
       WHERE tc.tutor_id = $1
       ORDER BY c.code`,
      [req.user.id]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Fetching tutor courses failed:', error.message)
    res.status(500).json({ message: 'Unable to load your courses.' })
  }
})

// Adding a course uses the existing POST /api/tutor-courses route

// Stop tutoring a course
router.delete('/courses/:courseId', async (req, res) => {
  try {
    const courseId = parseId(req.params.courseId)

    if (!courseId) {
      return res.status(400).json({ message: 'A valid course id is required.' })
    }

    const result = await pool.query(
      `DELETE FROM tutor_courses
       WHERE tutor_id = $1 AND course_id = $2`,
      [req.user.id, courseId]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'You are not assigned to this course.' })
    }

    res.json({ message: 'Course removed from your tutor profile.' })
  } catch (error) {
    console.error('Removing tutor course failed:', error.message)
    res.status(500).json({ message: 'Unable to remove course. Please try again.' })
  }
})

// ---------- Availability ----------

// Upcoming availability slots, with who (if anyone) has booked each one
router.get('/availability', async (req, res) => {
  try {
    // LEFT JOINs keep slots with no booking (booked_by comes back null).
    // At most one ACCEPTED request per slot, so this can't duplicate rows.
    // The subquery counts pending requests so the UI can warn before deleting.
    // ends_at > NOW() hides slots that are already over.
    const result = await pool.query(
      `SELECT
         s.id,
         s.starts_at,
         s.ends_at,
         booked.username AS booked_by,
         (SELECT COUNT(*)::int
          FROM session_requests p
          WHERE p.slot_id = s.id AND p.status = 'PENDING') AS pending_requests
       FROM availability_slots s
       LEFT JOIN session_requests a
         ON a.slot_id = s.id AND a.status = 'ACCEPTED'
       LEFT JOIN users booked ON booked.id = a.student_id
       WHERE s.tutor_id = $1 AND s.ends_at > NOW()
       ORDER BY s.starts_at`,
      [req.user.id]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Fetching availability failed:', error.message)
    res.status(500).json({ message: 'Unable to load your availability.' })
  }
})

// Open up a new tutoring time
router.post('/availability', async (req, res) => {
  try {
    const startsAt = parseDate(req.body.starts_at)
    const endsAt = parseDate(req.body.ends_at)

    if (!startsAt || !endsAt) {
      return res.status(400).json({ message: 'A valid start and end time are required.' })
    }

    if (endsAt <= startsAt) {
      return res.status(400).json({ message: 'End time must be after the start time.' })
    }

    if (startsAt < new Date()) {
      return res.status(400).json({ message: 'You can only add times in the future.' })
    }

    if (endsAt - startsAt > MAX_SLOT_HOURS * 60 * 60 * 1000) {
      return res.status(400).json({
        message: `A single block can be at most ${MAX_SLOT_HOURS} hours.`,
      })
    }

    // Two ranges overlap when each one starts before the other ends.
    // Touching ranges (one ends at 3:00, the next starts at 3:00) are allowed.
    const overlap = await pool.query(
      `SELECT 1 FROM availability_slots
       WHERE tutor_id = $1 AND starts_at < $3 AND ends_at > $2`,
      [req.user.id, startsAt, endsAt]
    )

    if (overlap.rows.length > 0) {
      return res.status(409).json({ message: 'This overlaps a time you already added.' })
    }

    const result = await pool.query(
      `INSERT INTO availability_slots (tutor_id, starts_at, ends_at)
       VALUES ($1, $2, $3)
       RETURNING id, starts_at, ends_at`,
      [req.user.id, startsAt, endsAt]
    )

    // Same shape as GET /availability so the frontend can add it to its list
    res.status(201).json({
      ...result.rows[0],
      booked_by: null,
      pending_requests: 0,
    })
  } catch (error) {
    console.error('Adding availability failed:', error.message)
    res.status(500).json({ message: 'Unable to add this time. Please try again.' })
  }
})

// Remove a tutoring time. Pending requests for it are removed with it,
// but a time a student has already been accepted for can't be deleted.
router.delete('/availability/:id', async (req, res) => {
  try {
    const slotId = parseId(req.params.id)

    if (!slotId) {
      return res.status(400).json({ message: 'A valid slot id is required.' })
    }

    const booked = await pool.query(
      `SELECT 1 FROM session_requests
       WHERE slot_id = $1 AND status = 'ACCEPTED'`,
      [slotId]
    )

    if (booked.rows.length > 0) {
      return res.status(409).json({
        message: 'A student is booked for this time, so it can\'t be deleted.',
      })
    }

    // tutor_id check means you can't delete another tutor's slot;
    // it just comes back as "not found"
    const result = await pool.query(
      `DELETE FROM availability_slots
       WHERE id = $1 AND tutor_id = $2`,
      [slotId, req.user.id]
    )

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Time slot not found.' })
    }

    res.json({ message: 'Time removed.' })
  } catch (error) {
    console.error('Deleting availability failed:', error.message)
    res.status(500).json({ message: 'Unable to remove this time. Please try again.' })
  }
})

// ---------- Requests ----------

// Shared SELECT for requests and sessions, since a session is just an
// accepted request. Each row comes back with the slot's times, the
// student's name/email, and the course (null if none was picked).
const REQUEST_FIELDS = `
  r.id,
  r.status,
  r.note,
  r.created_at,
  s.id AS slot_id,
  s.starts_at,
  s.ends_at,
  student.username AS student_name,
  student.email AS student_email,
  c.code AS course_code,
  c.title AS course_title
`

const REQUEST_JOINS = `
  FROM session_requests r
  JOIN availability_slots s ON s.id = r.slot_id
  JOIN users student ON student.id = r.student_id
  LEFT JOIN courses c ON c.course_id = r.course_id
`

// Pending requests for upcoming times, soonest first
router.get('/requests', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ${REQUEST_FIELDS}
       ${REQUEST_JOINS}
       WHERE s.tutor_id = $1
         AND r.status = 'PENDING'
         AND s.starts_at > NOW()
       ORDER BY s.starts_at, r.created_at`,
      [req.user.id]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Fetching requests failed:', error.message)
    res.status(500).json({ message: 'Unable to load requests.' })
  }
})

// Accept or decline a request. Accepting books the slot and
// declines any other pending requests for the same time.
router.patch('/requests/:id', async (req, res) => {
  const requestId = parseId(req.params.id)
  const { status } = req.body

  if (!requestId) {
    return res.status(400).json({ message: 'A valid request id is required.' })
  }

  if (status !== 'ACCEPTED' && status !== 'DECLINED') {
    return res.status(400).json({ message: 'Status must be ACCEPTED or DECLINED.' })
  }

  // Use one client for the whole transaction: BEGIN/COMMIT only apply to
  // queries on the same connection, and pool.query() may use a different one.
  // Every return path must ROLLBACK or COMMIT, and finally releases the client.
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // Lock the request so two clicks can't both go through. The join on
    // tutor_id makes sure this request is for one of *this* tutor's slots.
    const found = await client.query(
      `SELECT r.id, r.status, r.slot_id, s.starts_at
       FROM session_requests r
       JOIN availability_slots s ON s.id = r.slot_id
       WHERE r.id = $1 AND s.tutor_id = $2
       FOR UPDATE OF r`,
      [requestId, req.user.id]
    )

    const request = found.rows[0]

    if (!request) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Request not found.' })
    }

    if (request.status !== 'PENDING') {
      await client.query('ROLLBACK')
      return res.status(409).json({
        message: `This request was already ${request.status.toLowerCase()}.`,
      })
    }

    if (status === 'ACCEPTED' && new Date(request.starts_at) < new Date()) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'This time has already started.' })
    }

    await client.query(
      `UPDATE session_requests
       SET status = $1, responded_at = NOW()
       WHERE id = $2`,
      [status, requestId]
    )

    // The slot is taken now, so turn down everyone else who asked for it.
    // The count is returned so the UI could tell the tutor if it wants to.
    let autoDeclined = 0

    if (status === 'ACCEPTED') {
      const others = await client.query(
        `UPDATE session_requests
         SET status = 'DECLINED', responded_at = NOW()
         WHERE slot_id = $1 AND status = 'PENDING' AND id <> $2`,
        [request.slot_id, requestId]
      )
      autoDeclined = others.rowCount
    }

    await client.query('COMMIT')

    res.json({
      message: status === 'ACCEPTED' ? 'Request accepted.' : 'Request declined.',
      auto_declined: autoDeclined,
    })
  } catch (error) {
    await client.query('ROLLBACK')

    // Unique index: another request for this slot was accepted first
    if (error.code === '23505') {
      return res.status(409).json({ message: 'This time is already booked.' })
    }

    console.error('Responding to request failed:', error.message)
    res.status(500).json({ message: 'Unable to update this request. Please try again.' })
  } finally {
    client.release()
  }
})

// ---------- Schedule ----------

// Accepted sessions between `from` and `to` (ISO timestamps). The frontend
// sends the start and end of the tutor's local day so "today" matches
// their timezone (the server's clock/timezone may differ).
// Uses the same overlap check as adding a slot, so a session that started
// before midnight still shows up on the day it ends.
// Example: /api/tutor/sessions?from=2026-10-29T04:00:00.000Z&to=2026-10-30T04:00:00.000Z
router.get('/sessions', async (req, res) => {
  try {
    const from = parseDate(req.query.from)
    const to = parseDate(req.query.to)

    if (!from || !to || to <= from) {
      return res.status(400).json({ message: 'Valid from and to times are required.' })
    }

    const result = await pool.query(
      `SELECT ${REQUEST_FIELDS}
       ${REQUEST_JOINS}
       WHERE s.tutor_id = $1
         AND r.status = 'ACCEPTED'
         AND s.starts_at < $3
         AND s.ends_at > $2
       ORDER BY s.starts_at`,
      [req.user.id, from, to]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Fetching sessions failed:', error.message)
    res.status(500).json({ message: 'Unable to load your schedule.' })
  }
})

module.exports = router
