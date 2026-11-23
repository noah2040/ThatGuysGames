import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Friendship, Profile } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { useLobby } from '../context/LobbyContext'
import { initials } from '../lib/utils'
import { SetupNotice } from '../components/SetupNotice'
import { SignInPrompt } from '../components/SignInPrompt'

export default function Friends() {
  const { session, profile, configured } = useAuth()
  const { lobby, inviteFriend } = useLobby()
  const userId = session?.user.id

  const [relationships, setRelationships] = useState<Friendship[]>([])
  const [people, setPeople] = useState<Map<string, Profile>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Profile[]>([])
  const [searched, setSearched] = useState(false)
  const [searching, setSearching] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!supabase || !userId) return
    setLoading(true)
    const { data, error: loadError } = await supabase
      .from('friendships')
      .select('*')
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`)

    if (loadError) {
      setError(loadError.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as Friendship[]
    const ids = [
      ...new Set(
        rows.map((row) =>
          row.requester_id === userId ? row.addressee_id : row.requester_id,
        ),
      ),
    ]

    let profiles: Profile[] = []
    if (ids.length > 0) {
      const { data: profileRows } = await supabase
        .from('profiles')
        .select('*')
        .in('id', ids)
      profiles = (profileRows ?? []) as Profile[]
    }

    setRelationships(rows)
    setPeople(new Map(profiles.map((person) => [person.id, person])))
    setLoading(false)
  }, [userId])

  useEffect(() => {
    if (userId) void load()
  }, [userId, load])

  const otherId = (row: Friendship) =>
    row.requester_id === userId ? row.addressee_id : row.requester_id

  const respond = async (row: Friendship, accept: boolean) => {
    if (!supabase || !userId) return
    setBusyId(otherId(row))
    setNotice(null)
    if (accept) {
      const { error: updateError } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', row.id)
        .eq('addressee_id', userId)
      if (updateError) setNotice(updateError.message)
      else setNotice('Friend added. Open a room to bring them in.')
    } else {
      await supabase.from('friendships').delete().eq('id', row.id)
    }
    await load()
    setBusyId(null)
  }

  const sendRequest = async (person: Profile) => {
    if (!supabase || !userId) return
    setBusyId(person.id)
    setNotice(null)
    const existing = relationships.find((row) => otherId(row) === person.id)

    if (existing?.status === 'accepted') {
      setNotice('You are already friends.')
      setBusyId(null)
      return
    }
    if (existing?.status === 'pending' && existing.addressee_id === userId) {
      await respond(existing, true)
      setBusyId(null)
      return
    }
    if (existing) {
      setNotice('That request is already pending.')
      setBusyId(null)
      return
    }

    const { error: insertError } = await supabase
      .from('friendships')
      .insert({ requester_id: userId, addressee_id: person.id })

    setNotice(
      insertError ? insertError.message : `Request sent to ${person.display_name}.`,
    )
    await load()
    setBusyId(null)
  }

  const removeFriend = async (row: Friendship) => {
    if (!supabase) return
    await supabase.from('friendships').delete().eq('id', row.id)
    await load()
  }

  const invite = async (person: Profile) => {
    setBusyId(person.id)
    setNotice(null)
    const result = await inviteFriend(person.id)
    setNotice(
      result.ok ? `Invite sent to ${person.display_name}.` : (result.error ?? 'Could not invite.'),
    )
    setBusyId(null)
  }

  const search = async (event: FormEvent) => {
    event.preventDefault()
    if (!supabase || !userId) return
    const term = query.trim()
    if (!term) {
      setResults([])
      setSearched(false)
      return
    }
    setSearching(true)
    setNotice(null)
    const { data, error: searchError } = await supabase
      .from('profiles')
      .select('*')
      .ilike('username', `%${term}%`)
      .neq('id', userId)
      .limit(8)
    if (searchError) setError(searchError.message)
    setResults((data ?? []) as Profile[])
    setSearched(true)
    setSearching(false)
  }

  if (!configured) {
    return <SetupNotice title="Friends need Supabase" />
  }

  if (!session) {
    return <SignInPrompt next="/friends" />
  }

  const accepted = relationships.filter((row) => row.status === 'accepted')
  const incoming = relationships.filter(
    (row) => row.status === 'pending' && row.addressee_id === userId,
  )
  const outgoing = relationships.filter(
    (row) => row.status === 'pending' && row.requester_id === userId,
  )

  return (
    <div className="container friends-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">Your crew</p>
          <h1>Friends</h1>
          <p className="muted">
            Add players once, then pull them into any room. Your username is{' '}
            <span className="mono">@{profile?.username ?? '…'}</span>.
          </p>
        </div>
        {lobby && (
          <Link to={`/lobby/${lobby.code}`} className="btn btn-sm">
            Room {lobby.code}
          </Link>
        )}
      </header>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="friends-grid">
        <section className="panel">
          <div className="section-row">
            <h2>Friends</h2>
            <span className="pill">{accepted.length}</span>
          </div>
          {loading ? (
            <p className="muted">Loading…</p>
          ) : accepted.length === 0 ? (
            <p className="empty">
              No friends saved yet. Search a username to send your first request.
            </p>
          ) : (
            <ul className="people">
              {accepted.map((row) => {
                const person = people.get(otherId(row))
                if (!person) return null
                return (
                  <li key={row.id} className="person">
                    <span className="avatar" style={{ background: person.avatar_color }}>
                      {initials(person.display_name)}
                    </span>
                    <div className="person-main">
                      <strong>{person.display_name}</strong>
                      <span className="mono tiny">@{person.username}</span>
                    </div>
                    <div className="person-actions">
                      {lobby && lobby.host_id === userId && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => void invite(person)}
                          disabled={busyId === person.id}
                        >
                          Invite
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => void removeFriend(row)}
                      >
                        Remove
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {!lobby && accepted.length > 0 && (
            <p className="tiny muted">Open a room to invite friends into it.</p>
          )}
        </section>

        <section className="panel">
          <div className="section-row">
            <h2>Requests</h2>
            <span className="pill">{incoming.length + outgoing.length}</span>
          </div>
          {incoming.length === 0 && outgoing.length === 0 && (
            <p className="empty">No pending requests.</p>
          )}

          {incoming.map((row) => {
            const person = people.get(otherId(row))
            if (!person) return null
            return (
              <div key={row.id} className="person">
                <span className="avatar" style={{ background: person.avatar_color }}>
                  {initials(person.display_name)}
                </span>
                <div className="person-main">
                  <strong>{person.display_name}</strong>
                  <span className="tiny muted">wants to be friends</span>
                </div>
                <div className="person-actions">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => void respond(row, true)}
                    disabled={busyId === person.id}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void respond(row, false)}
                  >
                    Ignore
                  </button>
                </div>
              </div>
            )
          })}

          {outgoing.length > 0 && (
            <p className="eyebrow request-divider">Waiting on them</p>
          )}
          {outgoing.map((row) => {
            const person = people.get(otherId(row))
            if (!person) return null
            return (
              <div key={row.id} className="person">
                <span className="avatar" style={{ background: person.avatar_color }}>
                  {initials(person.display_name)}
                </span>
                <div className="person-main">
                  <strong>{person.display_name}</strong>
                  <span className="mono tiny">@{person.username}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void respond(row, false)}
                >
                  Cancel
                </button>
              </div>
            )
          })}
        </section>

        <section className="panel">
          <h2>Find players</h2>
          <form className="search-form" onSubmit={search}>
            <input
              className="input"
              placeholder="username"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-label="Search by username"
            />
            <button type="submit" className="btn" disabled={searching}>
              {searching ? '…' : 'Search'}
            </button>
          </form>
          <p className="tiny muted">
            Usernames are unique. Ask a friend for theirs if you cannot find them.
          </p>

          {results.length > 0 && (
            <ul className="people">
              {results.map((person) => {
                const relation = relationships.find((row) => otherId(row) === person.id)
                const label = !relation
                  ? 'Add'
                  : relation.status === 'accepted'
                    ? 'Friends'
                    : 'Pending'
                return (
                  <li key={person.id} className="person">
                    <span className="avatar" style={{ background: person.avatar_color }}>
                      {initials(person.display_name)}
                    </span>
                    <div className="person-main">
                      <strong>{person.display_name}</strong>
                      <span className="mono tiny">@{person.username}</span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => void sendRequest(person)}
                      disabled={Boolean(relation) || busyId === person.id}
                    >
                      {label}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {searched && results.length === 0 && !searching && (
            <p className="empty">No players matched “{query}”.</p>
          )}
        </section>
      </div>
    </div>
  )
}
