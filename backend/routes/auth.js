
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const pool = require('../db')

const router = express.Router()

// REGISTER a new student account
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body

    // Validate required fields
    if (!username || !email || !password) {
      return res.status(400).json({
        message: 'Username, email, and password are required.',
      })
    }

    const cleanUsername = username.trim()
    const cleanEmail = email.trim().toLowerCase()

    if (cleanUsername.length < 3 || cleanUsername.length > 30) {
      return res.status(400).json({
        message: 'Username must be between 3 and 30 characters.',
      })
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must be at least 8 characters.',
      })
    }

    // Check whether username or email is already registered
    const existingUser = await pool.query(
      `SELECT id FROM users
       WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)`,
      [cleanUsername, cleanEmail]
    )

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        message: 'That username or email is already registered.',
      })
    }

    // Hash the password before storing it
    const passwordHash = await bcrypt.hash(password, 12)

    // Public registration always creates a student account
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role)
       VALUES ($1, $2, $3, 'STUDENT')
       RETURNING id, username, email, role, created_at`,
      [cleanUsername, cleanEmail, passwordHash]
    )

    const user = result.rows[0]

    return res.status(201).json({
      message: 'Account created successfully.',
      user,
    })
  } catch (error) {
    console.error('Registration failed:', error.message)

    return res.status(500).json({
      message: 'Unable to create account. Please try again.',
    })
  }
})

// LOGIN to an existing account
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.',
      })
    }

    const cleanEmail = email.trim().toLowerCase()

    const result = await pool.query(
      `SELECT id, username, email, password_hash, role
       FROM users
       WHERE LOWER(email) = LOWER($1)`,
      [cleanEmail]
    )

    const user = result.rows[0]

    // Use the same response for an unknown email and wrong password
    if (!user) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    )

    if (!passwordMatches) {
      return res.status(401).json({
        message: 'Invalid email or password.',
      })
    }

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET is missing from backend environment.')
      return res.status(500).json({
        message: 'Login is not configured correctly.',
      })
    }

    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    )

    return res.json({
      message: 'Login successful.',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    console.error('Login failed:', error.message)

    return res.status(500).json({
      message: 'Unable to log in. Please try again.',
    })
  }
})

module.exports = router
