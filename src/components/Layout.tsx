import { useEffect, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLobby } from '../context/LobbyContext'
import { initials } from '../lib/utils'
import { Invites } from './Invites'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

export function Layout({ children }: { children: ReactNode }) {
  const { session, name, profile, signOut } = useAuth()
  const { lobby, members } = useLobby()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/')
  }

  return (
    <div className="site">
      <ScrollToTop />
      <header className="site-header">
        <div className="container header-inner">
          <Link to="/" className="logo">
            <span className="logo-mark">👾</span>
            <span>
              Pixel<span className="logo-accent">Pit</span>
            </span>
          </Link>

          <nav className="nav-links">
            <NavLink to="/" end className="nav-link">
              Arcade
            </NavLink>
            <NavLink to="/friends" className="nav-link">
              Friends
            </NavLink>
            {lobby && (
              <Link to={`/lobby/${lobby.code}`} className="nav-room">
                <span className="live-dot" />
                Room {lobby.code}
                <span className="nav-room-count">{members.length}</span>
              </Link>
            )}
          </nav>

          <div className="header-user">
            {session ? (
              <>
                <span className="user-chip" title={session.user.email ?? name}>
                  <span
                    className="avatar avatar-sm"
                    style={{ background: profile?.avatar_color ?? '#b8ff3d' }}
                  >
                    {initials(name)}
                  </span>
                  <span className="user-chip-name">{name}</span>
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void handleSignOut()}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/signin" className="btn btn-sm">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>

      <main>{children}</main>

      <footer className="site-footer">
        <div className="container footer-inner">
          <span className="mono">Pixel Pit</span>
          <span className="muted">Local build · no accounts needed to play</span>
        </div>
      </footer>

      <Invites />
    </div>
  )
}
