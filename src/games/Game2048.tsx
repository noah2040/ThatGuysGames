import { useCallback, useEffect, useRef, useState, type TouchEvent } from 'react'
import type { GameProps } from './types'

type Board = number[][]
type Dir = 'left' | 'right' | 'up' | 'down'

const TILE_STYLES: Record<number, { bg: string; fg: string }> = {
  2: { bg: '#25243a', fg: '#e9e8f4' },
  4: { bg: '#312f4e', fg: '#e9e8f4' },
  8: { bg: '#2c7a5b', fg: '#eafff4' },
  16: { bg: '#28946a', fg: '#eafff4' },
  32: { bg: '#4a9b2f', fg: '#f4ffe9' },
  64: { bg: '#86b32a', fg: '#141a02' },
  128: { bg: '#d0a72c', fg: '#1c1502' },
  256: { bg: '#e08a2b', fg: '#1e1002' },
  512: { bg: '#e2652c', fg: '#fff6ee' },
  1024: { bg: '#e0456a', fg: '#fff2f6' },
  2048: { bg: '#ff5cc8', fg: '#20071a' },
}

function tileStyle(value: number): { bg: string; fg: string } {
  return TILE_STYLES[value] ?? { bg: '#a78bfa', fg: '#160c2a' }
}

function emptyBoard(): Board {
  return Array.from({ length: 4 }, () => [0, 0, 0, 0])
}

function addTile(board: Board): Board {
  const next = board.map((row) => [...row])
  const spots: [number, number][] = []
  next.forEach((row, r) => {
    row.forEach((value, c) => {
      if (value === 0) spots.push([r, c])
    })
  })
  if (spots.length === 0) return next
  const [r, c] = spots[Math.floor(Math.random() * spots.length)]
  next[r][c] = Math.random() < 0.9 ? 2 : 4
  return next
}

function freshBoard(): Board {
  return addTile(addTile(emptyBoard()))
}

function slideLine(line: number[]): { line: number[]; gained: number } {
  const values = line.filter((value) => value !== 0)
  const out: number[] = []
  let gained = 0
  for (let i = 0; i < values.length; i += 1) {
    if (values[i] === values[i + 1]) {
      const merged = values[i] * 2
      out.push(merged)
      gained += merged
      i += 1
    } else {
      out.push(values[i])
    }
  }
  while (out.length < 4) out.push(0)
  return { line: out, gained }
}

function moveBoard(board: Board, dir: Dir): { board: Board; gained: number; moved: boolean } {
  const next = emptyBoard()
  const reverse = dir === 'right' || dir === 'down'
  let gained = 0
  let moved = false

  for (let i = 0; i < 4; i += 1) {
    const line =
      dir === 'left' || dir === 'right' ? board[i] : board.map((row) => row[i])
    const oriented = reverse ? [...line].reverse() : line
    const result = slideLine(oriented)
    const finalLine = reverse ? [...result.line].reverse() : result.line
    gained += result.gained
    if (finalLine.some((value, index) => value !== line[index])) moved = true

    for (let j = 0; j < 4; j += 1) {
      if (dir === 'left' || dir === 'right') next[i][j] = finalLine[j]
      else next[j][i] = finalLine[j]
    }
  }

  return { board: next, gained, moved }
}

function canMove(board: Board): boolean {
  for (let r = 0; r < 4; r += 1) {
    for (let c = 0; c < 4; c += 1) {
      if (board[r][c] === 0) return true
      if (c < 3 && board[r][c] === board[r][c + 1]) return true
      if (r < 3 && board[r][c] === board[r + 1][c]) return true
    }
  }
  return false
}

export default function Game2048({ onGameOver }: GameProps) {
  const [board, setBoard] = useState<Board>(freshBoard)
  const [score, setScore] = useState(0)
  const [status, setStatus] = useState<'playing' | 'over'>('playing')
  const [won, setWon] = useState(false)

  const boardRef = useRef(board)
  const scoreRef = useRef(0)
  const statusRef = useRef<'playing' | 'over'>('playing')
  const wonRef = useRef(false)
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const overRef = useRef(onGameOver)
  overRef.current = onGameOver

  const reset = useCallback(() => {
    const next = freshBoard()
    boardRef.current = next
    setBoard(next)
    scoreRef.current = 0
    setScore(0)
    statusRef.current = 'playing'
    setStatus('playing')
    wonRef.current = false
    setWon(false)
  }, [])

  const apply = useCallback((dir: Dir) => {
    if (statusRef.current !== 'playing') return
    const result = moveBoard(boardRef.current, dir)
    if (!result.moved) return

    const next = addTile(result.board)
    boardRef.current = next
    setBoard(next)

    if (result.gained > 0) {
      scoreRef.current += result.gained
      setScore(scoreRef.current)
    }

    if (!wonRef.current && next.some((row) => row.includes(2048))) {
      wonRef.current = true
      setWon(true)
    }

    if (!canMove(next)) {
      statusRef.current = 'over'
      setStatus('over')
      overRef.current(scoreRef.current)
    }
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const map: Record<string, Dir | undefined> = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
        a: 'left',
        d: 'right',
        w: 'up',
        s: 'down',
      }
      const dir = map[event.key] ?? map[event.key.toLowerCase()]
      if (!dir) return
      event.preventDefault()
      apply(dir)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [apply])

  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStart.current
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    touchStart.current = null
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return
    if (Math.abs(dx) > Math.abs(dy)) apply(dx > 0 ? 'right' : 'left')
    else apply(dy > 0 ? 'down' : 'up')
  }

  const best = Math.max(...board.flat())

  return (
    <div className="game-wrap">
      <div className="game-hud">
        <div className="hud-stat">
          <span className="hud-label">Score</span>
          <span className="hud-value">{score}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Best tile</span>
          <span className="hud-value">{best}</span>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
          New game
        </button>
      </div>

      <div className="board-shell">
        <div className="board-2048" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
          {board.map((row, r) =>
            row.map((value, c) => (
              <div
                key={`${r}-${c}`}
                className={`tile-2048${value ? ' filled' : ''}`}
                style={
                  value
                    ? { background: tileStyle(value).bg, color: tileStyle(value).fg }
                    : undefined
                }
              >
                {value || ''}
              </div>
            )),
          )}
        </div>

        {status === 'over' ? (
          <div className="game-overlay">
            <p className="overlay-kicker">No moves left</p>
            <h3>{score} points</h3>
            <p>The grid filled up. One more run?</p>
            <button type="button" className="btn btn-primary" onClick={reset}>
              Play again
            </button>
          </div>
        ) : (
          won && (
            <div className="game-overlay">
              <p className="overlay-kicker">2048</p>
              <h3>You hit 2048!</h3>
              <p>Keep sliding for a bigger score.</p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setWon(false)}
              >
                Keep playing
              </button>
            </div>
          )
        )}
      </div>

      <p className="game-hint">Arrow keys / WASD · or swipe the board</p>
    </div>
  )
}
