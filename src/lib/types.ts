export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_color: string
  created_at: string
}

export interface Friendship {
  id: string
  requester_id: string
  addressee_id: string
  status: 'pending' | 'accepted'
  created_at: string
}

export interface Lobby {
  id: string
  code: string
  host_id: string
  current_game: string | null
  created_at: string
}

export interface LobbyMemberRow {
  lobby_id: string
  user_id: string
  joined_at: string
}

export interface LobbyInvite {
  id: string
  lobby_id: string
  inviter_id: string
  invitee_id: string
  created_at: string
}
