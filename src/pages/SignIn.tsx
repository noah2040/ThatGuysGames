import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { SetupNotice } from '../components/SetupNotice'

export default function SignIn() {
  const { session, configured, name } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('next') || '/'

  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase) return
    setBusy(true)
    setError(null)
    setInfo(null)

    try {
      if (mode === 'signup') {
        if (!/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
          setError('Username needs 3–16 letters, numbers or underscores.')
          return
        }
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username, display_name: username } },
        })
        if (signUpError) {
          setError(signUpError.message)
          return
        }
        if (data.session) {
          navigate(next)
        } else {
          setInfo('Account created. Confirm your email, then sign in.')
          setMode('signin')
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          setError(signInError.message)
          return
        }
        navigate(next)
      }
    } finally {
      setBusy(false)
    }
  }

  if (!configured) {
    return <SetupNotice title="Sign-in needs Supabase" />
  }

  if (session) {
    return (
      <div className="container narrow auth-page">
        <div className="panel setup">
          <p className="eyebrow">Signed in</p>
          <h1>You’re in, {name}.</h1>
          <p className="muted">
            Friends and rooms are saved to your account. Games stay free for guests.
          </p>
          <div className="panel-actions">
            <Link to={next} className="btn btn-primary">
              Continue
            </Link>
            <Link to="/" className="btn btn-ghost">
              Arcade
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container narrow auth-page">
      <div className="panel auth-card">
        <p className="eyebrow">{mode === 'signin' ? 'Welcome back' : 'New player'}</p>
        <h1>{mode === 'signin' ? 'Sign in' : 'Create an account'}</h1>
        <p className="muted">
          {mode === 'signin'
            ? 'Only needed for friends and rooms. The games never ask.'
            : 'Your username is how friends find you. You can change the display name later.'}
        </p>

        <div className="mode-switch">
          <button
            type="button"
            className={mode === 'signin' ? 'active' : ''}
            onClick={() => {
              setMode('signin')
              setError(null)
              setInfo(null)
            }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => {
              setMode('signup')
              setError(null)
              setInfo(null)
            }}
          >
            Sign up
          </button>
        </div>

        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && (
            <label className="field">
              <span>Username</span>
              <input
                className="input"
                autoComplete="username"
                placeholder="pixelhero"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
                minLength={3}
                maxLength={16}
              />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              className="input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              className="input"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />
          </label>

          {error && <p className="form-error">{error}</p>}
          {info && <p className="notice">{info}</p>}

          <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="tiny muted auth-alt">
          Just here to play? <Link to="/">Head back to the arcade</Link> — no account
          needed.
        </p>
      </div>
    </div>
  )
}
