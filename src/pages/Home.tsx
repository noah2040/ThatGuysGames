import { useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { games } from '../games'
import { useAuth } from '../context/AuthContext'
import { useLobby } from '../context/LobbyContext'
import { getHighScore } from '../lib/utils'

export default function Home() {
  const { session, configured } = useAuth()
  const { lobby, members, createLobby, joinLobby } = useLobby()
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const handleCreate = async () => {
    setBusy(true)
    setNotice(null)
    const result = await createLobby()
    if (!result.ok) setNotice(result.error ?? 'Could not open a room.')
    setBusy(false)
  }

  const handleJoin = async (event: FormEvent) => {
    event.preventDefault()
    if (!joinCode.trim()) return
    setBusy(true)
    setNotice(null)
    const result = await joinLobby(joinCode)
    if (!result.ok) setNotice(result.error ?? 'Could not join that room.')
    setBusy(false)
  }

  return (
    <div className="home">
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="live-dot" /> browser arcade · no installs
          </p>
          <h1>
            Four games.
            <br />
            <span className="grad">One room.</span>
            <br />
            Bring your crew.
          </h1>
          <p className="hero-lede">
            Jump straight into Snake, 2048, Memory Match and Breakout — no account
            needed. Sign in when you want a room that follows you from game to game.
          </p>
          <div className="hero-actions">
            <a href="#games" className="btn btn-primary">
              Pick a game
            </a>
            {session ? (
              <button
                type="button"
                className="btn"
                onClick={() => void handleCreate()}
                disabled={busy}
              >
                Open a room
              </button>
            ) : (
              <Link to="/signin" className="btn">
                Sign in for rooms
              </Link>
            )}
          </div>
          <div className="hero-stats">
            <div>
              <strong>4</strong>
              <span>games ready</span>
            </div>
            <div>
              <strong>1</strong>
              <span>room code</span>
            </div>
            <div>
              <strong>0</strong>
              <span>downloads</span>
            </div>
          </div>
        </div>

        <aside className="hero-panel panel">
          <div className="panel-topline">
            <span className="eyebrow">Play together</span>
            <span className={`status-dot${session ? ' ok' : ''}`}>
              {session ? 'Signed in' : 'Guest'}
            </span>
          </div>

          {lobby ? (
            <>
              <p className="panel-label">Your room is live</p>
              <Link to={`/lobby/${lobby.code}`} className="code-chip">
                {lobby.code}
              </Link>
              <p className="muted">
                {members.length} player{members.length === 1 ? '' : 's'} inside · everyone
                moves together
              </p>
              <Link to={`/lobby/${lobby.code}`} className="btn btn-primary btn-block">
                Back to room
              </Link>
            </>
          ) : !configured ? (
            <>
              <h2>Rooms need a database</h2>
              <p className="muted">
                Add your Supabase keys and run <code>supabase/schema.sql</code> to switch on
                friends, invites and rooms. Solo play is already on.
              </p>
              <Link to="/signin" className="btn btn-block">
                See setup steps
              </Link>
            </>
          ) : !session ? (
            <>
              <h2>Friends need a name</h2>
              <p className="muted">
                Signing in saves your friends and lets you open a room. Every game stays
                free to play as a guest.
              </p>
              <Link to="/signin" className="btn btn-primary btn-block">
                Sign in or sign up
              </Link>
              <p className="tiny muted">Email + password · nothing else required</p>
            </>
          ) : (
            <>
              <h2>Open a room</h2>
              <p className="muted">
                Pick a game once and everyone in the room lands on it together.
              </p>
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => void handleCreate()}
                disabled={busy}
              >
                {busy ? 'Opening…' : 'Create room'}
              </button>
              <div className="divider">
                <span>or join with a code</span>
              </div>
              <form className="join-form" onSubmit={handleJoin}>
                <input
                  className="input mono"
                  placeholder="ABCDE"
                  maxLength={6}
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  aria-label="Room code"
                />
                <button type="submit" className="btn" disabled={busy}>
                  Join
                </button>
              </form>
            </>
          )}

          {notice && <p className="form-error">{notice}</p>}
        </aside>
      </section>

      <section className="container section" id="games">
        <div className="section-head">
          <div>
            <p className="eyebrow">The cabinet</p>
            <h2>Pick your poison</h2>
          </div>
          <p className="muted section-blurb">
            High scores stay in this browser. No login, no tracking.
          </p>
        </div>

        <div className="games-grid">
          {games.map((game, index) => {
            const best = getHighScore(game.slug)
            return (
              <Link
                key={game.slug}
                to={`/play/${game.slug}`}
                className="game-card"
                style={{ '--accent': game.accent } as CSSProperties}
              >
                <div className="game-card-top">
                  <span className="game-emoji">{game.emoji}</span>
                  <span className="game-index mono">0{index + 1}</span>
                </div>
                <div className="game-card-body">
                  <h3>{game.name}</h3>
                  <p>{game.blurb}</p>
                </div>
                <div className="game-card-foot">
                  <span className="mono tiny">
                    {best > 0 ? `best ${best}` : 'not played yet'}
                  </span>
                  <span className="play-link">Play →</span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>

      <section className="container section">
        <div className="crew-panel">
          <div className="crew-copy">
            <p className="eyebrow">With friends</p>
            <h2>One code. Every game.</h2>
            <p className="muted">
              Save your friends once, invite them into a room, then switch games without
              sharing a new link. The host picks, the room follows.
            </p>
            <div className="crew-actions">
              {session ? (
                <Link to="/friends" className="btn btn-primary">
                  Friends & invites
                </Link>
              ) : (
                <Link to="/signin" className="btn btn-primary">
                  Create an account
                </Link>
              )}
              <Link to="/friends" className="btn btn-ghost">
                How friends work
              </Link>
            </div>
          </div>
          <ol className="crew-steps">
            <li>
              <span className="mono">01</span>
              <div>
                <strong>Sign in</strong>
                <p>Friends and rooms live on your account. Games never require it.</p>
              </div>
            </li>
            <li>
              <span className="mono">02</span>
              <div>
                <strong>Send a code or an invite</strong>
                <p>Friends join from the arcade, or straight from their invite pop-up.</p>
              </div>
            </li>
            <li>
              <span className="mono">03</span>
              <div>
                <strong>Hop games together</strong>
                <p>The host picks a game and the whole room switches instantly.</p>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </div>
  )
}
