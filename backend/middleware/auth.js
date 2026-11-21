const jwt = require('jsonwebtoken')
const pool = require('../db')

// Builds middleware that only lets logged-in users with the given role through.
// The frontend sends the token from login as "Authorization: Bearer <token>".
// On success the user is attached as req.user = { id, role } for the route.
//
// Usage:
//   router.post('/something', requireTutor, handler)   // one route
//   router.use(requireTutor)                           // every route below it
function requireRole(role, forbiddenMessage) {
  return async function (req, res, next) {
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

      // Throws if the token was tampered with or has expired (see catch below)
      const decoded = jwt.verify(token, process.env.JWT_SECRET)

      // Look up the role in the database instead of trusting the token,
      // so a deleted account or changed role takes effect immediately
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

      if (user.role !== role) {
        return res.status(403).json({
          message: forbiddenMessage,
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

      console.error('Authentication failed:', error.message)

      return res.status(500).json({
        message: 'Unable to verify your account.',
      })
    }
  }
}

const requireTutor = requireRole('TUTOR', 'Only tutors can do this.')
const requireStudent = requireRole('STUDENT', 'Only students can do this.')

module.exports = { requireTutor, requireStudent }
