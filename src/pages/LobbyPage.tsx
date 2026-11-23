import { useState, type CSSProperties, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { games } from '../games'
import { useAuth } from '../context/AuthContext'
import { useLobby } from '../context/LobbyContext'
import { SetupNotice } from '../components/SetupNotice'
import { SignInPrompt } from '../components/SignInPrompt'
import { initials } from '../lib/utils'

export default function LobbyPage() {
  const { session, configured } = useAuth()
  const { code, lobby, members, loading, error, switchGame, leaveLobby, joinLobby } =
    useLobby()
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [manualCode, setManualCode] = useState('')

  const copyRoom = async () => {
    if (!lobby) return
    try {
      await navigator.clipboard.writeText(lobby.code)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      setNotice(`Room code: ${lobby.code}`)
    }
  }

  const pickGame = async (slug: string) => {
    setBusy(true)
    setNotice(null)
    const result = await switchGame(slug)
    if (!result.ok) setNotice(result.error ?? 'Could not start that game.')
    setBusy(false)
  }

  const tryJoin = async (event: FormEvent) => {
    event.preventDefault()
    if (!manualCode.trim()) return
    setBusy(true)
    setNotice(null)
    const result = await joinLobby(manualCode)
    if (!result.ok) setNotice(result.error ?? 'Could not join that room.')
    setBusy(false)
  }

  if (!configured) {
    return <SetupNotice title="Rooms need Supabase" />
  }

  if (!session) {
    return (
      <SignInPrompt
        next={`/lobby/${code ?? ''}`}
        message={
          code
            ? `Sign in to join room ${code}. Your friends will see you in the roster.`
            : undefined
        }
      />
    )
  }

  if (loading) {
    return (
      <div className="container narrow">
        <div className="panel setup">
          <p className="eyebrow">Loading</p>
          <h1>Opening the room…</h1>
          <p className="muted">Syncing the roster and the current game.</p>
        </div>
      </div>
    )
  }

  if (!lobby) {
    return (
      <div className="container narrow">
        <div className="panel setup">
          <p className="eyebrow">No room</p>
          <h1>{error ?? 'That room is not open'}</h1>
          <p className="muted">
            Double-check the code. Rooms close when the host leaves.
          </p>
          <form className="join-form" onSubmit={tryJoin}>
            <input
              className="input mono"
              placeholder="ABCDE"
              maxLength={6}
              value={manualCode}
              onChange={(event) => setManualCode(event.target.value.toUpperCase())}
              aria-label="Room code"
            />
            <button type="submit" className="btn btn-primary" disabled={busy}>
              Join room
            </button>
          </form>
          {notice && <p className="form-error">{notice}</p>}
          <div className="panel-actions">
            <Link to="/" className="btn btn-ghost">
              Back to the arcade
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const isHost = lobby.host_id === session.user.id

  return (
    <div className="container lobby-page">
      <header className="lobby-head">
        <div>
          <p className="eyebrow">{isHost ? 'You are hosting' : 'Waiting room'}</p>
          <h1>Room {lobby.code}</h1>
          <p className="muted">
            Everyone here moves to the same game at once. Share the code to add players.
          </p>
        </div>
        <button type="button" className="code-chip" onClick={() => void copyRoom()}>
          {copied ? 'Copied!' : lobby.code}
        </button>
      </header>

      {notice && <p className="form-error">{notice}</p>}

      <div className="lobby-grid">
        <section className="panel">
          <div className="section-row">
            <h2>In the room</h2>
            <span className="pill">
              {members.length} player{members.length === 1 ? '' : 's'}
            </span>
          </div>
          <ul className="roster">
            {members.map((member) => (
              <li key={member.user_id} className="roster-row">
                <span className="avatar" style={{ background: member.color }}>
                  {initials(member.name)}
                </span>
                <span className="roster-name">
                  {member.name}
                  {member.user_id === session.user.id ? ' (you)' : ''}
                  {member.isHost && <span className="host-tag">host</span>}
                </span>
                {member.user_id === session.user.id && (
                  <span className="tiny muted">ready</span>
                )}
              </li>
            ))}
          </ul>
          {members.length === 1 && (
            <p className="empty">
              No one else yet. Invite a friend or send them the code.
            </p>
          )}
          <div className="panel-actions">
            <Link to="/friends" className="btn btn-sm">
              Invite friends
            </Link>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void leaveLobby()}
            >
              {isHost ? 'Close room' : 'Leave room'}
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="section-row">
            <h2>{isHost ? 'Pick the first game' : 'Waiting for the host'}</h2>
          </div>
          <p className="muted">
            {isHost
              ? 'The whole room launches together, then you can switch from the side panel.'
              : 'The room will move as soon as the host starts a game.'}
          </p>
          <div className="pick-grid">
            {games.map((game) => (
              <button
                key={game.slug}
                type="button"
                className={`game-pick${isHost ? '' : ' locked'}`}
                style={{ '--accent': game.accent } as CSSProperties}
                onClick={() => void pickGame(game.slug)}
                disabled={!isHost || busy}
              >
                <span className="game-pick-emoji">{game.emoji}</span>
                <span className="game-pick-name">{game.name}</span>
                <span className="game-pick-go">{isHost ? '→' : '·'}</span>
              </button>
            ))}
          </div>
          {!isHost && (
            <p className="tiny muted">Only the host can start a game.</p>
          )}
        </section>
      </div>
    </div>
  )
}
