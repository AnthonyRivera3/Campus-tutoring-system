const express = require('express')
const { requireStudent } = require('../middleware/auth')
const pool = require('../db')

// Student side of booking. Mounted at /api.
// GET   /api/tutors/:id/availability       public, open times for one tutor
// POST  /api/session-requests              student requests a slot
// GET   /api/student/session-requests      student's own booking requests
// PATCH /api/student/session-requests/:id/cancel  student cancels own request
const router = express.Router()

// Open (not yet booked) upcoming times for one tutor
router.get('/tutors/:id/availability', async (req, res) => {
  try {
    const tutorId = Number(req.params.id)

    if (!Number.isInteger(tutorId) || tutorId <= 0) {
      return res.status(400).json({ message: 'A valid tutor id is required.' })
    }

    const result = await pool.query(
      `SELECT s.id, s.starts_at, s.ends_at
       FROM availability_slots s
       WHERE s.tutor_id = $1
         AND s.starts_at > NOW()
         AND NOT EXISTS (
           SELECT 1 FROM session_requests r
           WHERE r.slot_id = s.id AND r.status = 'ACCEPTED'
         )
       ORDER BY s.starts_at`,
      [tutorId]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Fetching tutor availability failed:', error.message)
    res.status(500).json({ message: 'Unable to load this tutor\'s availability.' })
  }
})

// Ask to book a tutor's time slot
router.post('/session-requests', requireStudent, async (req, res) => {
  try {
    const slotId = Number(req.body.slot_id)
    const courseId = req.body.course_id == null ? null : Number(req.body.course_id)
    // Notes are capped at 500 characters
    const note = typeof req.body.note === 'string' ? req.body.note.trim().slice(0, 500) : null

    if (!Number.isInteger(slotId) || slotId <= 0) {
      return res.status(400).json({ message: 'A valid slot_id is required.' })
    }

    if (courseId !== null && (!Number.isInteger(courseId) || courseId <= 0)) {
      return res.status(400).json({ message: 'course_id must be a valid id.' })
    }

    // Get the slot plus whether someone is already booked for it, in one query
    const slotResult = await pool.query(
      `SELECT s.tutor_id, s.starts_at,
         EXISTS (
           SELECT 1 FROM session_requests r
           WHERE r.slot_id = s.id AND r.status = 'ACCEPTED'
         ) AS booked
       FROM availability_slots s
       WHERE s.id = $1`,
      [slotId]
    )

    const slot = slotResult.rows[0]

    if (!slot) {
      return res.status(404).json({ message: 'Time slot not found.' })
    }

    if (new Date(slot.starts_at) < new Date()) {
      return res.status(409).json({ message: 'This time has already passed.' })
    }

    if (slot.booked) {
      return res.status(409).json({ message: 'This time is already booked.' })
    }

    // The course has to be one this tutor actually teaches
    if (courseId !== null) {
      const teaches = await pool.query(
        `SELECT 1 FROM tutor_courses
         WHERE tutor_id = $1 AND course_id = $2`,
        [slot.tutor_id, courseId]
      )

      if (teaches.rows.length === 0) {
        return res.status(400).json({ message: 'This tutor doesn\'t teach that course.' })
      }
    }

    const result = await pool.query(
      `INSERT INTO session_requests (slot_id, student_id, course_id, note)
       VALUES ($1, $2, $3, $4)
       RETURNING id, slot_id, course_id, note, status, created_at`,
      [slotId, req.user.id, courseId, note || null]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    // Unique index: this student already has a pending request for the slot
    if (error.code === '23505') {
      return res.status(409).json({ message: 'You already requested this time.' })
    }

    console.error('Creating session request failed:', error.message)
    res.status(500).json({ message: 'Unable to send request. Please try again.' })
  }
})

// Only the authenticated student's own requests. Includes upcoming and history.
router.get('/student/session-requests', requireStudent, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         r.id, r.slot_id, r.course_id, r.note, r.status,
         r.created_at, r.cancelled_at,
         s.starts_at, s.ends_at,
         tutor.id AS tutor_id, tutor.username AS tutor_name,
         c.code AS course_code, c.title AS course_title
       FROM session_requests r
       JOIN availability_slots s ON s.id = r.slot_id
       JOIN users tutor ON tutor.id = s.tutor_id
       LEFT JOIN courses c ON c.course_id = r.course_id
       WHERE r.student_id = $1
       ORDER BY
         CASE WHEN s.starts_at > NOW() THEN 0 ELSE 1 END,
         CASE WHEN s.starts_at > NOW() THEN s.starts_at END ASC NULLS LAST,
         CASE WHEN s.starts_at <= NOW() THEN s.starts_at END DESC NULLS LAST,
         r.created_at DESC`,
      [req.user.id]
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Fetching student session requests failed:', error.message)
    res.status(500).json({ message: 'Unable to load your booking requests.' })
  }
})

// The student can withdraw a PENDING request or cancel an ACCEPTED session,
// but only if the session hasn't started. Cancelled records are kept in history.
// A completed/past, declined, or previously cancelled request cannot be changed.
router.patch('/student/session-requests/:id/cancel', requireStudent, async (req, res) => {
  const requestId = Number(req.params.id)
  if (!Number.isInteger(requestId) || requestId <= 0) {
    return res.status(400).json({ message: 'A valid request id is required.' })
  }

  let client
  try {
    client = await pool.connect()
    await client.query('BEGIN')

    // Lock this exact request so accepting and cancelling can't both win.
    // The student_id filter also prevents users cancelling someone else's request.
    const result = await client.query(
      `SELECT r.id, r.status, s.starts_at
       FROM session_requests r
       JOIN availability_slots s ON s.id = r.slot_id
       WHERE r.id = $1 AND r.student_id = $2
       FOR UPDATE OF r`,
      [requestId, req.user.id]
    )

    const request = result.rows[0]
    if (!request) {
      await client.query('ROLLBACK')
      return res.status(404).json({ message: 'Booking request not found.' })
    }

    if (request.status !== 'PENDING' && request.status !== 'ACCEPTED') {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'This booking request can no longer be cancelled.' })
    }

    if (new Date(request.starts_at) <= new Date()) {
      await client.query('ROLLBACK')
      return res.status(409).json({ message: 'You cannot cancel a session after it has started.' })
    }

    const updated = await client.query(
      `UPDATE session_requests
       SET status = 'CANCELLED', cancelled_at = NOW()
       WHERE id = $1
       RETURNING id, slot_id, status, cancelled_at`,
      [requestId]
    )

    await client.query('COMMIT')
    res.json({ message: 'Booking request cancelled.', request: updated.rows[0] })
  } catch (error) {
    if (client) {
      try { await client.query('ROLLBACK') } catch (rollbackError) {
        console.error('Rolling back student cancellation failed:', rollbackError.message)
      }
    }
    console.error('Cancelling student booking failed:', error.message)
    res.status(500).json({ message: 'Unable to cancel this request. Please try again.' })
  } finally {
    if (client) client.release()
  }
})

module.exports = router
