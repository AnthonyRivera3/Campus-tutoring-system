
require('dotenv').config()

const catalogRoutes = require('./routes/catalog')
const express = require('express')
const cors = require('cors')
const pool = require('./db')
const authRoutes = require('./routes/auth')
const tutorRoutes = require('./routes/tutor')
const sessionRequestRoutes = require('./routes/sessionRequests')


const app = express()
const PORT = process.env.PORT || 5001

app.use(cors())
app.use(express.json())

// Main API route
app.get('/api', (req, res) => {
  res.json({
    message: 'School tutoring API is running!',
  })
})

// Test the Neon PostgreSQL connection
app.get('/api/db-test', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT current_database() AS database, NOW() AS time'
    )

    res.json({
      message: 'PostgreSQL connection successful!',
      database: result.rows[0].database,
      time: result.rows[0].time,
    })
  } catch (error) {
    console.error('Database test failed:', error.message)

    res.status(500).json({
      message: 'Database connection failed.',
    })
  }
})

// Authentication routes
app.use('/api/auth', authRoutes)

app.use('/api', catalogRoutes)

// Tutor dashboard (tutors only) and student booking routes.
// The tables these use come from `npm run migrate`.
app.use('/api/tutor', tutorRoutes)
app.use('/api', sessionRequestRoutes)

app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`)
})
