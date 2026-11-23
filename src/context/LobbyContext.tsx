import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Lobby, LobbyMemberRow, Profile } from '../lib/types'
import { randomRoomCode } from '../lib/utils'
import { useAuth } from './AuthContext'

export interface RoomMember {
  user_id: string
  name: string
  username: string
  color: string
  isHost: boolean
}

export interface ScoreEntry {
  game: string
  score: number
  name: string
  color: string
}

interface ActionResult {
  ok: boolean
  error?: string
}

interface LobbyValue {
  code: string | null
  lobby: Lobby | null
  members: RoomMember[]
  scores: Record<string, ScoreEntry>
  loading: boolean
  error: string | null
  createLobby: () => Promise<ActionResult>
  joinLobby: (roomCode: string) => Promise<ActionResult>
  switchGame: (slug: string) => Promise<ActionResult>
  openRoom: () => Promise<ActionResult>
  leaveLobby: () => Promise<void>
  inviteFriend: (userId: string) => Promise<ActionResult>
  submitScore: (game: string, score: number) => void
}

const LobbyContext = createContext<LobbyValue | null>(null)

function roomCodeFromLocation(pathname: string, search: string): string | null {
  const query = new URLSearchParams(search).get('lobby')
  if (query) return query.toUpperCase()
  const match = pathname.match(/^\/lobby\/([^/]+)/)
  return match ? decodeURIComponent(match[1]).toUpperCase() : null
}

const ROOM_STORAGE_KEY = 'pixelpit.activeRoom'

function readStoredRoom(): string | null {
  try {
    return sessionStorage.getItem(ROOM_STORAGE_KEY)?.toUpperCase() ?? null
  } catch {
    return null
  }
}

function storeRoom(code: string | null) {
  try {
    if (code) sessionStorage.setItem(ROOM_STORAGE_KEY, code)
    else sessionStorage.removeItem(ROOM_STORAGE_KEY)
  } catch {
    // storage can be unavailable; the URL keeps the room alive for this visit
  }
}

interface ScorePayload {
  userId: string
  game: string
  score: number
  name: string
  color: string
}

export function LobbyProvider({ children }: { children: ReactNode }) {
  const { session, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const urlCode = roomCodeFromLocation(location.pathname, location.search)
  const userId = session?.user.id ?? null

  // The room stays active while browsing elsewhere (friends, arcade), so the
  // room chip and friend invites keep working outside /lobby and /play.
  const [roomCode, setRoomCode] = useState<string | null>(
    () => urlCode ?? readStoredRoom(),
  )

  useEffect(() => {
    if (!urlCode) return
    setRoomCode(urlCode)
    storeRoom(urlCode)
  }, [urlCode])

  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [members, setMembers] = useState<RoomMember[]>([])
  const [scores, setScores] = useState<Record<string, ScoreEntry>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    if (!supabase || !roomCode || !userId) {
      setLobby(null)
      setMembers([])
      setScores({})
      setLoading(false)
      setError(null)
      return
    }

    let active = true
    setLoading(true)
    setError(null)
    setLobby(null)
    setMembers([])
    setScores({})

    const loadMembers = async (lobbyId: string, hostId: string) => {
      if (!supabase) return
      const { data: rows } = await supabase
        .from('lobby_members')
        .select('*')
        .eq('lobby_id', lobbyId)
      const memberRows = (rows ?? []) as LobbyMemberRow[]
      const ids = memberRows.map((row) => row.user_id)
      let profiles: Profile[] = []
      if (ids.length > 0) {
        const { data } = await supabase.from('profiles').select('*').in('id', ids)
        profiles = (data ?? []) as Profile[]
      }
      const byId = new Map(profiles.map((person) => [person.id, person]))
      if (!active) return
      setMembers(
        memberRows.map((row) => {
          const person = byId.get(row.user_id)
          return {
            user_id: row.user_id,
            name: person?.display_name ?? 'Player',
            username: person?.username ?? '',
            color: person?.avatar_color ?? '#b8ff3d',
            isHost: row.user_id === hostId,
          }
        }),
      )
    }

    const connect = async () => {
      if (!supabase) return
      const { data: row, error: fetchError } = await supabase
        .from('lobbies')
        .select('*')
        .eq('code', roomCode)
        .maybeSingle()

      if (!active) return

      if (fetchError) {
        setError('Could not load that room. Check your connection and try again.')
        setLoading(false)
        return
      }

      if (!row) {
        storeRoom(null)
        setError(`No room is using the code ${roomCode}.`)
        setLoading(false)
        return
      }

      const found = row as Lobby
      storeRoom(found.code)

      await supabase
        .from('lobby_members')
        .upsert(
          { lobby_id: found.id, user_id: userId },
          { onConflict: 'lobby_id,user_id', ignoreDuplicates: true },
        )

      if (!active) return

      setLobby(found)
      await loadMembers(found.id, found.host_id)
      if (!active) return
      setLoading(false)

      const channel = supabase
        .channel(`room:${found.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'lobbies',
            filter: `id=eq.${found.id}`,
          },
          (payload) => {
            if (!active) return
            setLobby(payload.new as Lobby)
          },
        )
        .on(
          'postgres_changes',
          { event: 'DELETE', schema: 'public', table: 'lobbies' },
          (payload) => {
            const removed = payload.old as { id?: string }
            if (!active || removed?.id !== found.id) return
            storeRoom(null)
            setRoomCode(null)
            setLobby(null)
            setMembers([])
            setScores({})
            navigate('/')
          },
        )
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'lobby_members',
            filter: `lobby_id=eq.${found.id}`,
          },
          () => {
            void loadMembers(found.id, found.host_id)
          },
        )
        .on('broadcast', { event: 'score' }, ({ payload }) => {
          if (!active) return
          const data = payload as ScorePayload
          if (!data?.userId) return
          setScores((prev) => ({
            ...prev,
            [data.userId]: {
              game: data.game,
              score: data.score,
              name: data.name,
              color: data.color,
            },
          }))
        })
        .subscribe()

      channelRef.current = channel
    }

    void connect()

    return () => {
      active = false
      if (channelRef.current && supabase) {
        void supabase.removeChannel(channelRef.current)
      }
      channelRef.current = null
    }
  }, [roomCode, userId, navigate])

  // Everyone in a room follows the host: game changes move the whole room,
  // and returning to the room clears the game for everyone. Only room-linked
  // game URLs follow along, so browsing solo games is never interrupted.
  useEffect(() => {
    if (!lobby) return
    const inRoom = location.pathname.startsWith('/lobby')
    const inGame = location.pathname.startsWith('/play')
    const linkedToRoom = new URLSearchParams(location.search).has('lobby')
    if (!inRoom && !(inGame && linkedToRoom)) return

    if (lobby.current_game) {
      if (location.pathname !== `/play/${lobby.current_game}`) {
        navigate(`/play/${lobby.current_game}?lobby=${lobby.code}`)
      }
    } else if (inGame) {
      navigate(`/lobby/${lobby.code}`)
    }
  }, [lobby, location.pathname, navigate])

  const createLobby = useCallback(async (): Promise<ActionResult> => {
    if (!supabase) return { ok: false, error: 'Supabase is not configured yet.' }
    if (!userId) return { ok: false, error: 'Sign in to open a room.' }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const roomCode = randomRoomCode()
      const { data, error: insertError } = await supabase
        .from('lobbies')
        .insert({ code: roomCode, host_id: userId })
        .select()
        .single()

      if (!insertError) {
        const created = data as Lobby
        await supabase
          .from('lobby_members')
          .insert({ lobby_id: created.id, user_id: userId })
        setRoomCode(created.code)
        storeRoom(created.code)
        navigate(`/lobby/${created.code}`)
        return { ok: true }
      }

      if (insertError.code !== '23505') {
        return { ok: false, error: insertError.message }
      }
    }

    return { ok: false, error: 'Could not find a free room code. Try again.' }
  }, [navigate, userId])

  const joinLobby = useCallback(
    async (roomCode: string): Promise<ActionResult> => {
      if (!supabase) return { ok: false, error: 'Supabase is not configured yet.' }
      if (!userId) return { ok: false, error: 'Sign in to join a room.' }

      const cleaned = roomCode.trim().toUpperCase()
      if (cleaned.length < 4) return { ok: false, error: 'Enter the full room code.' }

      const { data, error: fetchError } = await supabase
        .from('lobbies')
        .select('*')
        .eq('code', cleaned)
        .maybeSingle()

      if (fetchError) return { ok: false, error: fetchError.message }
      if (!data) return { ok: false, error: `No room found with code ${cleaned}.` }

      const found = data as Lobby
      setRoomCode(found.code)
      storeRoom(found.code)

      // A player is only ever in one room.
      await supabase
        .from('lobby_members')
        .delete()
        .eq('user_id', userId)
        .neq('lobby_id', found.id)

      await supabase
        .from('lobby_members')
        .upsert(
          { lobby_id: found.id, user_id: userId },
          { onConflict: 'lobby_id,user_id', ignoreDuplicates: true },
        )

      navigate(`/lobby/${found.code}`)
      return { ok: true }
    },
    [navigate, userId],
  )

  const switchGame = useCallback(
    async (slug: string): Promise<ActionResult> => {
      if (!supabase || !lobby || !userId) {
        return { ok: false, error: 'No room is open.' }
      }
      if (lobby.host_id !== userId) {
        return { ok: false, error: 'Only the host picks games.' }
      }
      const { error: updateError } = await supabase
        .from('lobbies')
        .update({ current_game: slug })
        .eq('id', lobby.id)
      if (updateError) return { ok: false, error: updateError.message }
      setLobby({ ...lobby, current_game: slug })
      return { ok: true }
    },
    [lobby, userId],
  )

  const openRoom = useCallback(async (): Promise<ActionResult> => {
    if (!supabase || !lobby || !userId) {
      return { ok: false, error: 'No room is open.' }
    }
    if (lobby.host_id !== userId) {
      return { ok: false, error: 'Only the host can return everyone to the room.' }
    }
    const { error: updateError } = await supabase
      .from('lobbies')
      .update({ current_game: null })
      .eq('id', lobby.id)
    if (updateError) return { ok: false, error: updateError.message }
    setLobby({ ...lobby, current_game: null })
    navigate(`/lobby/${lobby.code}`)
    return { ok: true }
  }, [lobby, navigate, userId])

  const leaveLobby = useCallback(async () => {
    if (!supabase || !lobby) return
    if (lobby.host_id === userId) {
      await supabase.from('lobbies').delete().eq('id', lobby.id)
    } else if (userId) {
      await supabase
        .from('lobby_members')
        .delete()
        .eq('lobby_id', lobby.id)
        .eq('user_id', userId)
    }
    storeRoom(null)
    setRoomCode(null)
    setLobby(null)
    setMembers([])
    setScores({})
    navigate('/')
  }, [lobby, navigate, userId])

  const inviteFriend = useCallback(
    async (friendId: string): Promise<ActionResult> => {
      if (!supabase || !lobby || !userId) {
        return { ok: false, error: 'Open a room first.' }
      }
      if (friendId === userId) return { ok: false, error: 'You are already here.' }
      const { error: inviteError } = await supabase
        .from('lobby_invites')
        .insert({ lobby_id: lobby.id, inviter_id: userId, invitee_id: friendId })
      if (inviteError) {
        if (inviteError.code === '23505') {
          return { ok: false, error: 'Already invited — waiting on them.' }
        }
        return { ok: false, error: inviteError.message }
      }
      return { ok: true }
    },
    [lobby, userId],
  )

  const submitScore = useCallback(
    (game: string, score: number) => {
      if (!lobby || !profile) return
      const entry: ScoreEntry = {
        game,
        score,
        name: profile.display_name,
        color: profile.avatar_color,
      }
      setScores((prev) => ({ ...prev, [profile.id]: entry }))
      void channelRef.current?.send({
        type: 'broadcast',
        event: 'score',
        payload: {
          userId: profile.id,
          game,
          score,
          name: profile.display_name,
          color: profile.avatar_color,
        } satisfies ScorePayload,
      })
    },
    [lobby, profile],
  )

  const value = useMemo<LobbyValue>(
    () => ({
      code: roomCode,
      lobby,
      members,
      scores,
      loading,
      error,
      createLobby,
      joinLobby,
      switchGame,
      openRoom,
      leaveLobby,
      inviteFriend,
      submitScore,
    }),
    [
      roomCode,
      lobby,
      members,
      scores,
      loading,
      error,
      createLobby,
      joinLobby,
      switchGame,
      openRoom,
      leaveLobby,
      inviteFriend,
      submitScore,
    ],
  )

  return <LobbyContext.Provider value={value}>{children}</LobbyContext.Provider>
}

export function useLobby(): LobbyValue {
  const ctx = useContext(LobbyContext)
  if (!ctx) throw new Error('useLobby must be used inside LobbyProvider')
  return ctx
}
