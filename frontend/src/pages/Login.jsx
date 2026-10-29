
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Login.css'

const API_URL = 'http://localhost:5001/api/auth'

// Account types for the Student / Tutor toggle. `value` matches the role
// stored in the users table on the backend.
const ROLE_OPTIONS = [
  { value: 'STUDENT', label: 'Student' },
  { value: 'TUTOR', label: 'Tutor' },
]

function Login() {
  const navigate = useNavigate()
  const [activeForm, setActiveForm] = useState('login')
  const [role, setRole] = useState('STUDENT')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const isLogin = activeForm === 'login'

  async function handleSubmit(event) {
    event.preventDefault()

    setError('')
    setMessage('')
    setLoading(true)

    const formData = new FormData(event.currentTarget)

    try {
      const email = formData.get('email').trim().toLowerCase()
      const password = formData.get('password')

      if (!isLogin) {
        const username = formData.get('username').trim()
        const confirmPassword = formData.get('confirmPassword')

        if (password !== confirmPassword) {
          setError('Passwords do not match.')
          return
        }

        const response = await fetch(`${API_URL}/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            email,
            password,
            role,
          }),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.message || 'Registration failed.')
        }

        setActiveForm('login')
        setMessage('Account created successfully! Please log in.')
        return
      }

      const response = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // The backend rejects the login if this doesn't match the account's role
        body: JSON.stringify({
          email,
          password,
          role,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Login failed.')
      }

      sessionStorage.setItem('token', data.token)
      sessionStorage.setItem('user', JSON.stringify(data.user))

      navigate(data.user.role === 'TUTOR' ? '/tutor-dashboard' : '/dashboard')
    } catch (err) {
      setError(
        err.message ||
        'Unable to connect to the backend. Please try again.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <h1 className="login-title">
          {isLogin ? 'Welcome Back' : 'Create Your Account'}
        </h1>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        {message && (
          <p className="auth-success" role="status">
            {message}
          </p>
        )}

        <div
          className="role-toggle"
          role="radiogroup"
          aria-label="Account type"
        >
          {ROLE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={role === option.value}
              className={role === option.value ? 'role-option active' : 'role-option'}
              onClick={() => {
                setRole(option.value)
                setError('')
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <>
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                placeholder="Enter your full name"
                autoComplete="name"
                required
              />
            </>
          )}

          {!isLogin && (
            <>
              <label htmlFor="username">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="Enter your username"
                autoComplete="username"
                minLength={3}
                maxLength={30}
                required
              />
            </>
          )}

          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Enter your email"
            autoComplete="email"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            minLength={isLogin ? undefined : 8}
            required
          />

          {!isLogin && (
            <>
              <label htmlFor="confirmPassword">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                autoComplete="new-password"
                required
              />
            </>
          )}

          {isLogin && (
            <p className="forgot-password">
              <a
                href="#"
                onClick={(event) => event.preventDefault()}
              >
                Forgot password?
              </a>
            </p>
          )}

          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading
              ? 'Please wait...'
              : isLogin
                ? `Login as ${role === 'TUTOR' ? 'Tutor' : 'Student'}`
                : `Create ${role === 'TUTOR' ? 'Tutor' : 'Student'} Account`}
          </button>
        </form>

        <p className="auth-switch">
          {isLogin
            ? "Don't have an account? "
            : 'Already have an account? '}

          <a
            href={isLogin ? '#signup' : '#login'}
            onClick={(event) => {
              event.preventDefault()
              setActiveForm(isLogin ? 'signup' : 'login')
              setError('')
              setMessage('')
            }}
          >
            {isLogin ? 'Create an Account' : 'Login'}
          </a>
        </p>
      </section>
    </main>
  )
}

export default Login
