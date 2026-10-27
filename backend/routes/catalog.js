
const express = require('express')
const { requireTutor } = require('../middleware/auth')
const pool = require('../db')

const router = express.Router()

// Match the frontend's word-start search behavior.
// Spaces and capitalization are ignored.
function findMatch(text, query) {
    const q = query.toLowerCase().replace(/\s+/g, '')
    const lower = text.toLowerCase()

    if (!q) return false

    for (let start = 0; start < lower.length; start++) {
        const isWordStart =
            start === 0 || lower[start - 1] === ' '

        if (!isWordStart || lower[start] === ' ') continue

        let i = start
        let matched = 0

        while (i < lower.length && matched < q.length) {
            if (lower[i] === ' ') {
                i++
            } else if (lower[i] === q[matched]) {
                i++
                matched++
            } else {
                break
            }
        }

        if (matched === q.length) return true
    }

    return false
}

// Get the course catalog
router.get('/courses', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT course_id, code, title
      FROM courses
      ORDER BY code
    `)

        res.json(result.rows)
    } catch (error) {
        console.error('Failed to fetch courses:', error.message)
        res.status(500).json({
            message: 'Unable to retrieve courses.',
        })
    }
})

// Get tutors and the courses they teach
router.get('/tutors', async (req, res) => {
    try {
        const result = await pool.query(`
      SELECT
        u.id,
        u.username AS name,
        c.code AS course_code
      FROM users u
      LEFT JOIN tutor_courses tc ON tc.tutor_id = u.id
      LEFT JOIN courses c ON c.course_id = tc.course_id
      WHERE u.role = 'TUTOR'
      ORDER BY u.username, c.code
    `)

        const tutorsById = new Map()

        for (const row of result.rows) {
            if (!tutorsById.has(row.id)) {
                tutorsById.set(row.id, {
                    id: row.id,
                    name: row.name,
                    courses: [],
                    rating: null,
                })
            }

            if (row.course_code) {
                tutorsById.get(row.id).courses.push(row.course_code)
            }
        }

        res.json(Array.from(tutorsById.values()))
    } catch (error) {
        console.error('Failed to fetch tutors:', error.message)
        res.status(500).json({
            message: 'Unable to retrieve tutors.',
        })
    }
})

// Search courses and tutors
router.get('/search', async (req, res) => {
    try {
        const query =
            typeof req.query.q === 'string' ? req.query.q.trim() : ''

        if (!query) {
            return res.json({ courses: [], tutors: [] })
        }

        const [courseResult, tutorResult] = await Promise.all([
            pool.query(`
        SELECT course_id, code, title
        FROM courses
        ORDER BY code
      `),

            pool.query(`
        SELECT
          u.id,
          u.username AS name,
          c.code AS course_code
        FROM users u
        LEFT JOIN tutor_courses tc ON tc.tutor_id = u.id
        LEFT JOIN courses c ON c.course_id = tc.course_id
        WHERE u.role = 'TUTOR'
        ORDER BY u.username, c.code
      `),
        ])

        const courses = courseResult.rows
        const matchedCourses = courses.filter(
            course =>
                findMatch(course.code, query) ||
                findMatch(course.title, query)
        )

        const matchedCodes = new Set(
            matchedCourses.map(course => course.code)
        )

        const isCourseNumber = /\d/.test(query)
        const tutorsById = new Map()

        for (const row of tutorResult.rows) {
            if (!tutorsById.has(row.id)) {
                tutorsById.set(row.id, {
                    id: row.id,
                    name: row.name,
                    courses: [],
                    rating: null,
                })
            }

            if (row.course_code) {
                tutorsById.get(row.id).courses.push(row.course_code)
            }
        }

        const allTutors = Array.from(tutorsById.values())

        const matchedTutors = allTutors
            .filter(tutor =>
                findMatch(tutor.name, query) ||
                (
                    isCourseNumber &&
                    tutor.courses.some(code => matchedCodes.has(code))
                )
            )
            .sort((a, b) => a.name.localeCompare(b.name))

        res.json({
            courses: matchedCourses.map(({ code, title }) => ({
                code,
                title,
            })),
            tutors: matchedTutors,
        })
    } catch (error) {
        console.error('Search failed:', error.message)
        res.status(500).json({
            message: 'Unable to search courses and tutors.',
        })
    }
})

// Assign an existing course to the logged-in tutor
router.post('/tutor-courses', requireTutor, async (req, res) => {
    try {
        const courseId = Number(req.body.course_id)

        if (!Number.isInteger(courseId) || courseId <= 0) {
            return res.status(400).json({
                message: 'A valid course_id is required.',
            })
        }

        // Confirm that the course exists
        const courseResult = await pool.query(
            'SELECT course_id, code, title FROM courses WHERE course_id = $1',
            [courseId]
        )

        if (courseResult.rows.length === 0) {
            return res.status(404).json({
                message: 'Course not found.',
            })
        }

        // Avoid duplicate tutor-course assignments
        const existing = await pool.query(
            `SELECT 1
       FROM tutor_courses
       WHERE tutor_id = $1 AND course_id = $2`,
            [req.user.id, courseId]
        )

        if (existing.rows.length > 0) {
            return res.status(200).json({
                message: 'You are already assigned to this course.',
                course: courseResult.rows[0],
            })
        }

        await pool.query(
            `INSERT INTO tutor_courses (tutor_id, course_id)
       VALUES ($1, $2)`,
            [req.user.id, courseId]
        )

        return res.status(201).json({
            message: 'Course added to your tutor profile.',
            course: courseResult.rows[0],
        })
    } catch (error) {
        console.error('Adding tutor course failed:', error.message)

        return res.status(500).json({
            message: 'Unable to add course. Please try again.',
        })
    }
})

module.exports = router
