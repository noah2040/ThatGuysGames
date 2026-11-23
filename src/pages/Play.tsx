import { useCallback, useState, type CSSProperties, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { gameBySlug, games } from '../games'
import { useAuth } from '../context/AuthContext'
import { useLobby } from '../context/LobbyContext'
import { getHighScore, initials, saveHighScore } from '../lib/utils'

export default function Play() {
  const { slug } = useParams()
  const game = gameBySlug(slug)
  const { session, configured } = useAuth()
  const {
    lobby,
    members,
    scores,
    submitScore,
    switchGame,
    openRoom,
    leaveLobby,
    createLobby,
    joinLobby,
  } = useLobby()

  const [lastScore, setLastScore] = useState<number | null>(null)
  const [best, setBest] = useState(() => getHighScore(slug ?? ''))
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [joinCode, setJoinCode] = useState('')

  const handleGameOver = useCallback(
    (value: number) => {
      setLastScore(value)
      if (slug) setBest(saveHighScore(slug, value))
      submitScore(slug ?? '', value)
    },
    [slug, submitScore],
  )

  if (!game) {
    return (
      <div className="container narrow">
        <div className="panel setup">
          <p className="eyebrow">404</p>
          <h1>That cabinet is empty</h1>
          <p>The game you asked for does not exist.</p>
          <Link to="/" className="btn btn-primary">
            Back to the arcade
          </Link>
        </div>
      </div>
    )
  }

  const Game = game.component
  const isHost = Boolean(lobby && session && lobby.host_id === session.user.id)

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

  const handleSwitch = async (nextSlug: string) => {
    setBusy(true)
    setNotice(null)
    const result = await switchGame(nextSlug)
    if (!result.ok) setNotice(result.error ?? 'Could not switch games.')
    setBusy(false)
  }

  const handleOpenRoom = async () => {
    setNotice(null)
    const result = await openRoom()
    if (!result.ok) setNotice(result.error ?? 'Could not return to the room.')
  }

  return (
    <div className="container play-page">
      <header className="play-head">
        <div>
          <Link to="/" className="crumb">
            ← All games
          </Link>
          <h1>
            <span
              className="play-emoji"
              style={{ '--accent': game.accent } as CSSProperties}
            >
              {game.emoji}
            </span>
            {game.name}
          </h1>
          <p className="muted play-blurb">{game.blurb}</p>
        </div>
        <div className="play-stats">
          <div className="score-box">
            <span className="hud-label">Best</span>
            <strong>{best}</strong>
          </div>
          <div className="score-box">
            <span className="hud-label">Last run</span>
            <strong>{lastScore ?? '—'}</strong>
          </div>
        </div>
      </header>

      <div className={`play-layout${lobby ? '' : ' solo'}`}>
        <section
          className="stage"
          style={{ '--accent': game.accent } as CSSProperties}
        >
          <Game onGameOver={handleGameOver} />
        </section>

        <aside className="play-aside">
          {lobby ? (
            <div className="panel room-panel">
              <div className="room-panel-head">
                <div>
                  <p className="eyebrow">Room</p>
                  <Link to={`/lobby/${lobby.code}`} className="room-code-line mono">
                    {lobby.code}
                  </Link>
                </div>
                <span className="pill">{members.length} in</span>
              </div>

              <ul className="roster compact">
                {members.map((member) => (
                  <li key={member.user_id} className="roster-row">
                    <span
                      className="avatar avatar-sm"
                      style={{ background: member.color }}
                    >
                      {initials(member.name)}
                    </span>
                    <span className="roster-name">
                      {member.name}
                      {member.user_id === session?.user.id ? ' (you)' : ''}
                      {member.isHost && <span className="host-tag">host</span>}
                    </span>
                    {scores[member.user_id] && (
                      <span className="roster-score mono">
                        {scores[member.user_id].score}
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {isHost ? (
                <>
                  <p className="eyebrow room-switch-label">Switch the room</p>
                  <div className="switch-grid">
                    {games.map((item) => (
                      <button
                        key={item.slug}
                        type="button"
                        className={`switch-btn${item.slug === game.slug ? ' current' : ''}`}
                        onClick={() => void handleSwitch(item.slug)}
                        disabled={busy || item.slug === game.slug}
                      >
                        <span>{item.emoji}</span>
                        {item.name}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-block"
                    onClick={() => void handleOpenRoom()}
                  >
                    Back to the waiting room
                  </button>
                </>
              ) : (
                <p className="tiny muted">
                  The host picks the next game — you move with the room.
                </p>
              )}

              <button
                type="button"
                className="btn btn-ghost btn-sm btn-block"
                onClick={() => void leaveLobby()}
              >
                Leave room
              </button>
              {notice && <p className="form-error">{notice}</p>}
            </div>
          ) : (
            <div className="panel">
              <p className="eyebrow">Play with friends</p>
              <h2>
                {!configured
                  ? 'Rooms need Supabase'
                  : session
                    ? 'Open a room'
                    : 'Sign in to host'}
              </h2>
              <p className="muted">
                {!configured
                  ? 'Add your project URL and anon key to unlock friends and rooms.'
                  : session
                    ? 'One room, one code. Everyone moves when the host picks a new game.'
                    : 'Solo play is always free. An account saves friends and rooms.'}
              </p>

              {!configured ? (
                <Link to="/signin" className="btn btn-block">
                  Setup steps
                </Link>
              ) : !session ? (
                <Link
                  to={`/signin?next=${encodeURIComponent(`/play/${game.slug}`)}`}
                  className="btn btn-primary btn-block"
                >
                  Sign in or sign up
                </Link>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={() => void handleCreate()}
                    disabled={busy}
                  >
                    {busy ? 'Opening…' : 'Create room'}
                  </button>
                  <div className="divider">
                    <span>or join a room</span>
                  </div>
                  <form className="join-form" onSubmit={handleJoin}>
                    <input
                      className="input mono"
                      placeholder="CODE"
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

              <div className="aside-block">
                <p className="eyebrow">Controls</p>
                <p className="tiny">{game.controls}</p>
              </div>

              <div className="aside-block">
                <p className="eyebrow">Next up</p>
                <div className="mini-games">
                  {games
                    .filter((item) => item.slug !== game.slug)
                    .map((item) => (
                      <Link
                        key={item.slug}
                        to={`/play/${item.slug}`}
                        className="mini-game"
                      >
                        <span>{item.emoji}</span>
                        {item.name}
                        <span className="mini-arrow">→</span>
                      </Link>
                    ))}
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
