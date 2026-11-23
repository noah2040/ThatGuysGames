export function randomRoomCode(length = 5): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let code = ''
  for (let i = 0; i < length; i += 1) {
    code += alphabet[bytes[i] % alphabet.length]
  }
  return code
}

export function initials(name: string): string {
  const parts = name.replace(/[^\w\s]/g, ' ').trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

const HIGH_SCORE_PREFIX = 'pixelpit.highscore.'

export function getHighScore(slug: string): number {
  try {
    const raw = localStorage.getItem(HIGH_SCORE_PREFIX + slug)
    const value = raw ? Number.parseInt(raw, 10) : 0
    return Number.isFinite(value) ? value : 0
  } catch {
    return 0
  }
}

export function saveHighScore(slug: string, score: number): number {
  const best = Math.max(getHighScore(slug), score)
  try {
    localStorage.setItem(HIGH_SCORE_PREFIX + slug, String(best))
  } catch {
    // storage can be unavailable in private windows; the score is still shown for this run
  }
  return best
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
