import { useCallback, useEffect, useRef, useState } from 'react'
import { roundRect } from '../lib/canvas'
import type { GameProps } from './types'

const COLS = 20
const ROWS = 20
const CELL = 18
const SPEED = 112

type Point = { x: number; y: number }
type Dir = 'up' | 'down' | 'left' | 'right'

const VECTORS: Record<Dir, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const OPPOSITE: Record<Dir, Dir> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

const START_SNAKE: Point[] = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
]

function randomFood(snake: Point[]): Point {
  const free: Point[] = []
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (!snake.some((part) => part.x === x && part.y === y)) free.push({ x, y })
    }
  }
  return free[Math.floor(Math.random() * free.length)] ?? { x: 0, y: 0 }
}

export default function Snake({ onGameOver }: GameProps) {
  const [status, setStatus] = useState<'ready' | 'playing' | 'over'>('ready')
  const [score, setScore] = useState(0)
  const [length, setLength] = useState(START_SNAKE.length)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const snake = useRef<Point[]>(START_SNAKE.map((part) => ({ ...part })))
  const direction = useRef<Dir>('right')
  const queued = useRef<Dir[]>([])
  const food = useRef<Point>(randomFood(snake.current))
  const scoreRef = useRef(0)
  const statusRef = useRef<'ready' | 'playing' | 'over'>('ready')
  const timer = useRef<number | null>(null)
  const overRef = useRef(onGameOver)
  overRef.current = onGameOver

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#080a12'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    ctx.strokeStyle = 'rgba(255,255,255,0.035)'
    ctx.lineWidth = 1
    for (let i = 1; i < COLS; i += 1) {
      ctx.beginPath()
      ctx.moveTo(i * CELL + 0.5, 0)
      ctx.lineTo(i * CELL + 0.5, canvas.height)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * CELL + 0.5)
      ctx.lineTo(canvas.width, i * CELL + 0.5)
      ctx.stroke()
    }

    const foodX = food.current.x * CELL + CELL / 2
    const foodY = food.current.y * CELL + CELL / 2
    ctx.save()
    ctx.shadowColor = '#ff5cc8'
    ctx.shadowBlur = 14
    ctx.fillStyle = '#ff5cc8'
    ctx.beginPath()
    ctx.arc(foodX, foodY, CELL * 0.31, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()

    snake.current.forEach((part, index) => {
      const fade = index / Math.max(1, snake.current.length - 1)
      ctx.fillStyle =
        index === 0 ? '#d8ff8f' : `rgba(184, 255, 61, ${0.92 - fade * 0.5})`
      const pad = index === 0 ? 1.5 : 2.5
      roundRect(
        ctx,
        part.x * CELL + pad,
        part.y * CELL + pad,
        CELL - pad * 2,
        CELL - pad * 2,
        index === 0 ? 5 : 4,
      )
      ctx.fill()
    })
  }, [])

  const end = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
    statusRef.current = 'over'
    setStatus('over')
    overRef.current(scoreRef.current)
    draw()
  }, [draw])

  const tick = useCallback(() => {
    const nextDirection = queued.current.shift()
    if (nextDirection && nextDirection !== OPPOSITE[direction.current]) {
      direction.current = nextDirection
    }

    const vector = VECTORS[direction.current]
    const head = snake.current[0]
    const next = { x: head.x + vector.x, y: head.y + vector.y }

    if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
      end()
      return
    }

    const eating = next.x === food.current.x && next.y === food.current.y
    const body = eating ? snake.current : snake.current.slice(0, -1)
    if (body.some((part) => part.x === next.x && part.y === next.y)) {
      end()
      return
    }

    snake.current = [next, ...body]
    if (eating) {
      scoreRef.current += 10
      setScore(scoreRef.current)
      setLength(snake.current.length)
      food.current = randomFood(snake.current)
    }
    draw()
  }, [draw, end])

  const start = useCallback(() => {
    if (timer.current !== null) {
      window.clearInterval(timer.current)
      timer.current = null
    }
    snake.current = START_SNAKE.map((part) => ({ ...part }))
    direction.current = 'right'
    queued.current = []
    food.current = randomFood(snake.current)
    scoreRef.current = 0
    setScore(0)
    setLength(snake.current.length)
    statusRef.current = 'playing'
    setStatus('playing')
    draw()
    timer.current = window.setInterval(tick, SPEED)
  }, [draw, tick])

  const press = useCallback(
    (dir: Dir) => {
      if (statusRef.current !== 'playing') {
        start()
        return
      }
      if (queued.current.length < 3) queued.current.push(dir)
    },
    [start],
  )

  useEffect(() => {
    draw()
    return () => {
      if (timer.current !== null) window.clearInterval(timer.current)
    }
  }, [draw])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const map: Record<string, Dir | undefined> = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        w: 'up',
        a: 'left',
        s: 'down',
        d: 'right',
      }
      const dir = map[event.key] ?? map[event.key.toLowerCase()]
      if (dir) {
        event.preventDefault()
        press(dir)
      }
      if (event.key === ' ') {
        event.preventDefault()
        if (statusRef.current !== 'playing') start()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press, start])

  return (
    <div className="game-wrap">
      <div className="game-hud">
        <div className="hud-stat">
          <span className="hud-label">Score</span>
          <span className="hud-value">{score}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Length</span>
          <span className="hud-value">{length}</span>
        </div>
      </div>

      <div className="canvas-stage">
        <canvas
          ref={canvasRef}
          width={COLS * CELL}
          height={ROWS * CELL}
          className="game-canvas"
        />
        {status !== 'playing' && (
          <div className="game-overlay">
            <p className="overlay-kicker">{status === 'over' ? 'Run over' : 'Ready'}</p>
            <h3>{status === 'over' ? `${score} points` : 'Eat. Grow. Survive.'}</h3>
            <p>
              {status === 'over'
                ? 'The walls are undefeated. Try a tighter line.'
                : 'Arrow keys or WASD to steer.'}
            </p>
            <button type="button" className="btn btn-primary" onClick={start}>
              {status === 'over' ? 'Play again' : 'Start game'}
            </button>
          </div>
        )}
      </div>

      <div className="dpad">
        <button
          type="button"
          className="dpad-btn dpad-up"
          onClick={() => press('up')}
          aria-label="Move up"
        >
          ▲
        </button>
        <button
          type="button"
          className="dpad-btn dpad-left"
          onClick={() => press('left')}
          aria-label="Move left"
        >
          ◀
        </button>
        <button
          type="button"
          className="dpad-btn dpad-down"
          onClick={() => press('down')}
          aria-label="Move down"
        >
          ▼
        </button>
        <button
          type="button"
          className="dpad-btn dpad-right"
          onClick={() => press('right')}
          aria-label="Move right"
        >
          ▶
        </button>
      </div>
    </div>
  )
}
