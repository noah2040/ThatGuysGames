import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { LobbyInvite, Profile } from '../lib/types'
import { useAuth } from '../context/AuthContext'
import { useLobby } from '../context/LobbyContext'

interface InviteView {
  id: string
  code: string
  inviter: string
}

export function Invites() {
  const { session } = useAuth()
  const { joinLobby } = useLobby()
  const [invites, setInvites] = useState<InviteView[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const userId = session?.user.id

  useEffect(() => {
    if (!supabase || !userId) {
      setInvites([])
      return
    }

    let active = true

    const hydrate = async (rows: LobbyInvite[]): Promise<InviteView[]> => {
      if (!supabase || rows.length === 0) return []
      const lobbyIds = [...new Set(rows.map((row) => row.lobby_id))]
      const inviterIds = [...new Set(rows.map((row) => row.inviter_id))]

      const { data: lobbies } = await supabase
        .from('lobbies')
        .select('id, code')
        .in('id', lobbyIds)
      const { data: people } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', inviterIds)

      const codeById = new Map(
        ((lobbies ?? []) as { id: string; code: string }[]).map((row) => [
          row.id,
          row.code,
        ]),
      )
      const nameById = new Map(
        ((people ?? []) as Pick<Profile, 'id' | 'display_name'>[]).map((row) => [
          row.id,
          row.display_name,
        ]),
      )

      return rows.flatMap((row) => {
        const code = codeById.get(row.lobby_id)
        if (!code) return []
        return [
          {
            id: row.id,
            code,
            inviter: nameById.get(row.inviter_id) ?? 'A friend',
          },
        ]
      })
    }

    const load = async () => {
      const { data } = await supabase!
        .from('lobby_invites')
        .select('*')
        .eq('invitee_id', userId)
      if (!active || !data) return
      setInvites(await hydrate(data as LobbyInvite[]))
    }

    void load()

    const channel = supabase
      .channel(`invites:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'lobby_invites',
          filter: `invitee_id=eq.${userId}`,
        },
        async (payload) => {
          const row = payload.new as LobbyInvite
          const view = (await hydrate([row]))[0]
          if (!active || !view) return
          setInvites((prev) =>
            prev.some((invite) => invite.id === view.id) ? prev : [...prev, view],
          )
        },
      )
      .subscribe()

    return () => {
      active = false
      if (supabase) void supabase.removeChannel(channel)
    }
  }, [userId])

  const dismiss = useCallback(
    async (invite: InviteView) => {
      setInvites((prev) => prev.filter((item) => item.id !== invite.id))
      if (supabase && userId) {
        await supabase
          .from('lobby_invites')
          .delete()
          .eq('id', invite.id)
          .eq('invitee_id', userId)
      }
    },
    [userId],
  )

  const accept = useCallback(
    async (invite: InviteView) => {
      setBusy(invite.id)
      const result = await joinLobby(invite.code)
      if (result.ok) {
        await dismiss(invite)
      }
      setBusy(null)
    },
    [dismiss, joinLobby],
  )

  if (invites.length === 0) return null

  return (
    <div className="toast-stack">
      {invites.map((invite) => (
        <div key={invite.id} className="toast">
          <div>
            <p className="toast-title">Room invite</p>
            <p className="toast-copy">
              <strong>{invite.inviter}</strong> wants you in room{' '}
              <span className="mono">{invite.code}</span>
            </p>
          </div>
          <div className="toast-actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => void accept(invite)}
              disabled={busy === invite.id}
            >
              {busy === invite.id ? 'Joining…' : 'Join'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void dismiss(invite)}
            >
              Later
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
