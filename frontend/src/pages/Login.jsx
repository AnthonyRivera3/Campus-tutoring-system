
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './login.css'

function Login() {
  const navigate = useNavigate()
  const [activeForm, setActiveForm] = useState('login')

  const isLogin = activeForm === 'login'

  function handleSubmit(event) {
  event.preventDefault()

  if (!isLogin) {
    const password = event.target.password.value
    const confirmPassword = event.target.confirmPassword.value

    if (password !== confirmPassword) {
      alert('Passwords do not match.')
      return
    }

    alert('Account created successfully!')
  }

  navigate('/dashboard')
}

  return (
    <main className="login-page">
      <section className="login-card">
        <h1 className="login-title">
          {isLogin ? 'Welcome Back' : 'Create Your Account'}
        </h1>

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

          <label htmlFor="username">Username</label>
          <input
            id="username"
            name="username"
            type="text"
            placeholder="Enter your username"
            autoComplete="username"
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
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

          <button type="submit" className="submit-button">
            {isLogin ? 'Login' : 'Create Account'}
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
