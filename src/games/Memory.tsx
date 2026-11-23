import { useEffect, useRef, useState } from 'react'
import type { GameProps } from './types'

const EMOJIS = ['🚀', '👾', '🎮', '🍕', '🦊', '🌵', '⚡', '🎲']

interface Card {
  key: number
  emoji: string
  matched: boolean
}

function makeDeck(): Card[] {
  const pairs = [...EMOJIS, ...EMOJIS]
  for (let i = pairs.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    const swap = pairs[i]
    pairs[i] = pairs[j]
    pairs[j] = swap
  }
  return pairs.map((emoji, key) => ({ key, emoji, matched: false }))
}

export default function Memory({ onGameOver }: GameProps) {
  const [deck, setDeck] = useState<Card[]>(makeDeck)
  const [flipped, setFlipped] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [status, setStatus] = useState<'playing' | 'over'>('playing')

  const locked = useRef(false)
  const timer = useRef<number | null>(null)
  const movesRef = useRef(0)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  const restart = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    locked.current = false
    movesRef.current = 0
    setDeck(makeDeck())
    setFlipped([])
    setMoves(0)
    setStatus('playing')
  }

  const flip = (key: number) => {
    if (status !== 'playing' || locked.current) return
    const card = deck.find((item) => item.key === key)
    if (!card || card.matched || flipped.includes(key)) return

    if (flipped.length === 0) {
      setFlipped([key])
      return
    }

    const firstKey = flipped[0]
    const first = deck.find((item) => item.key === firstKey)
    if (!first) return

    setFlipped([firstKey, key])
    const nextMoves = movesRef.current + 1
    movesRef.current = nextMoves
    setMoves(nextMoves)

    if (first.emoji === card.emoji) {
      const nextDeck = deck.map((item) =>
        item.key === firstKey || item.key === key ? { ...item, matched: true } : item,
      )
      const matchedPairs = nextDeck.filter((item) => item.matched).length / 2
      setDeck(nextDeck)
      setFlipped([])
      if (matchedPairs === EMOJIS.length) {
        const finalScore = Math.max(100, 1200 - nextMoves * 30)
        setStatus('over')
        onGameOver(finalScore)
      }
    } else {
      locked.current = true
      timer.current = window.setTimeout(() => {
        setFlipped([])
        locked.current = false
        timer.current = null
      }, 680)
    }
  }

  const matchedPairs = deck.filter((card) => card.matched).length / 2
  const score = Math.max(100, 1200 - moves * 30)

  return (
    <div className="game-wrap">
      <div className="game-hud">
        <div className="hud-stat">
          <span className="hud-label">Moves</span>
          <span className="hud-value">{moves}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Pairs</span>
          <span className="hud-value">
            {matchedPairs}/{EMOJIS.length}
          </span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Score</span>
          <span className="hud-value">{status === 'over' ? score : '—'}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={restart}>
          New game
        </button>
      </div>

      <div className="board-shell">
        <div className="memory-grid">
          {deck.map((card) => {
            const revealed = card.matched || flipped.includes(card.key)
            return (
              <button
                key={card.key}
                type="button"
                className={`memory-card${revealed ? ' revealed' : ''}${
                  card.matched ? ' matched' : ''
                }`}
                onClick={() => flip(card.key)}
                aria-label={revealed ? `Card ${card.emoji}` : 'Hidden card'}
              >
                <span className="memory-face">{revealed ? card.emoji : '?'}</span>
              </button>
            )
          })}
        </div>

        {status === 'over' && (
          <div className="game-overlay">
            <p className="overlay-kicker">Board cleared</p>
            <h3>{score} points</h3>
            <p>{moves} moves. Fewer moves, more points.</p>
            <button type="button" className="btn btn-primary" onClick={restart}>
              Play again
            </button>
          </div>
        )}
      </div>

      <p className="game-hint">Flip two cards · match all eight pairs</p>
    </div>
  )
}
