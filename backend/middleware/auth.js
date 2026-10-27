
const jwt = require('jsonwebtoken')
const pool = require('../db')

async function requireTutor(req, res, next) {
  try {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Please log in first.',
      })
    }

    const token = authHeader.slice(7)

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({
        message: 'Authentication is not configured.',
      })
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET)

    const result = await pool.query(
      'SELECT id, role FROM users WHERE id = $1',
      [decoded.userId]
    )

    const user = result.rows[0]

    if (!user) {
      return res.status(401).json({
        message: 'Account not found.',
      })
    }

    if (user.role !== 'TUTOR') {
      return res.status(403).json({
        message: 'Only tutors can manage their course assignments.',
      })
    }

    req.user = user
    next()
  } catch (error) {
    if (error.name === 'JsonWebTokenError' ||
        error.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Your login session is invalid or expired.',
      })
    }

    console.error('Tutor authentication failed:', error.message)

    return res.status(500).json({
      message: 'Unable to verify your account.',
    })
  }
}

module.exports = { requireTutor }
