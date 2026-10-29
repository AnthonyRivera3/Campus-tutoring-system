const express = require('express')
const { requireStudent } = require('../middleware/auth')
const pool = require('../db')

// Student side of booking. Mounted at /api.
// There's no booking page yet; these exist so tutors have requests to answer.
// Until there is, you can test with Postman:
//   1. GET  /api/tutors/:id/availability   -> pick a slot id
//   2. POST /api/session-requests           (logged in as a student)
//      body: { "slot_id": 1, "course_id": 2, "note": "Help with recursion" }
//      course_id and note are optional.
//   3. Log in as that tutor and the request shows on the Requests tab.
//
//   GET  /api/tutors/:id/availability   public, open times for one tutor
//   POST /api/session-requests          students only, request a slot
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

module.exports = router
