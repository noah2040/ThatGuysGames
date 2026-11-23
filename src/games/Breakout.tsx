import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { clamp } from '../lib/utils'
import { roundRect } from '../lib/canvas'
import type { GameProps } from './types'

const W = 480
const H = 340
const PADDLE_W = 88
const PADDLE_H = 12
const PADDLE_Y = H - 30
const BALL_R = 7
const ROWS = 4
const COLS = 7
const BRICK_W = 56
const BRICK_H = 18
const BRICK_GAP = 8
const BRICK_LEFT = (W - (COLS * BRICK_W + (COLS - 1) * BRICK_GAP)) / 2
const BRICK_TOP = 52
const ROW_COLORS = ['#ff5cc8', '#a78bfa', '#4de3ff', '#b8ff3d']

interface Brick {
  x: number
  y: number
  w: number
  h: number
  color: string
  alive: boolean
}

interface Ball {
  x: number
  y: number
  vx: number
  vy: number
}

function makeBricks(): Brick[] {
  const bricks: Brick[] = []
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      bricks.push({
        x: BRICK_LEFT + col * (BRICK_W + BRICK_GAP),
        y: BRICK_TOP + row * (BRICK_H + BRICK_GAP),
        w: BRICK_W,
        h: BRICK_H,
        color: ROW_COLORS[row],
        alive: true,
      })
    }
  }
  return bricks
}

export default function Breakout({ onGameOver }: GameProps) {
  const [status, setStatus] = useState<'ready' | 'playing' | 'over' | 'won'>('ready')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const paddle = useRef({ x: (W - PADDLE_W) / 2 })
  const ball = useRef<Ball>({ x: W / 2, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 })
  const bricks = useRef<Brick[]>(makeBricks())
  const keys = useRef({ left: false, right: false })
  const playing = useRef(false)
  const stuck = useRef(true)
  const scoreRef = useRef(0)
  const livesRef = useRef(3)
  const statusRef = useRef<'ready' | 'playing' | 'over' | 'won'>('ready')
  const overRef = useRef(onGameOver)
  overRef.current = onGameOver

  const resetBall = () => {
    ball.current = {
      x: paddle.current.x + PADDLE_W / 2,
      y: PADDLE_Y - BALL_R - 1,
      vx: 0,
      vy: 0,
    }
    stuck.current = true
  }

  const launch = useCallback(() => {
    if (statusRef.current !== 'playing' || !stuck.current) return
    stuck.current = false
    ball.current.vx = (Math.random() < 0.5 ? -1 : 1) * 3.2
    ball.current.vy = -5.4
  }, [])

  const startGame = useCallback(() => {
    bricks.current = makeBricks()
    paddle.current.x = (W - PADDLE_W) / 2
    scoreRef.current = 0
    setScore(0)
    livesRef.current = 3
    setLives(3)
    resetBall()
    playing.current = true
    statusRef.current = 'playing'
    setStatus('playing')
  }, [])

  const handlePrimary = useCallback(() => {
    if (statusRef.current === 'playing') {
      launch()
    } else {
      startGame()
      launch()
    }
  }, [launch, startGame])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = '#080a12'
    ctx.fillRect(0, 0, W, H)

    ctx.strokeStyle = 'rgba(255,255,255,0.04)'
    for (let x = 0; x < W; x += 24) {
      ctx.beginPath()
      ctx.moveTo(x + 0.5, 0)
      ctx.lineTo(x + 0.5, H)
      ctx.stroke()
    }

    bricks.current.forEach((brick) => {
      if (!brick.alive) return
      ctx.save()
      ctx.shadowColor = brick.color
      ctx.shadowBlur = 8
      ctx.fillStyle = brick.color
      roundRect(ctx, brick.x, brick.y, brick.w, brick.h, 5)
      ctx.fill()
      ctx.restore()
      ctx.fillStyle = 'rgba(0,0,0,0.18)'
      ctx.fillRect(brick.x + 6, brick.y + brick.h - 5, brick.w - 12, 2)
    })

    const gradient = ctx.createLinearGradient(
      paddle.current.x,
      PADDLE_Y,
      paddle.current.x + PADDLE_W,
      PADDLE_Y,
    )
    gradient.addColorStop(0, '#4de3ff')
    gradient.addColorStop(1, '#b8ff3d')
    ctx.fillStyle = gradient
    roundRect(ctx, paddle.current.x, PADDLE_Y, PADDLE_W, PADDLE_H, 6)
    ctx.fill()

    ctx.save()
    ctx.shadowColor = '#ffffff'
    ctx.shadowBlur = 14
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(ball.current.x, ball.current.y, BALL_R, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }, [])

  const update = useCallback((dt: number) => {
    const pad = paddle.current
    if (keys.current.left) pad.x -= 7.5 * dt
    if (keys.current.right) pad.x += 7.5 * dt
    pad.x = clamp(pad.x, 0, W - PADDLE_W)

    if (!playing.current) return

    if (stuck.current) {
      ball.current.x = pad.x + PADDLE_W / 2
      ball.current.y = PADDLE_Y - BALL_R - 1
      return
    }

    const current = ball.current
    current.x += current.vx * dt
    current.y += current.vy * dt

    if (current.x - BALL_R < 0) {
      current.x = BALL_R
      current.vx = Math.abs(current.vx)
    }
    if (current.x + BALL_R > W) {
      current.x = W - BALL_R
      current.vx = -Math.abs(current.vx)
    }
    if (current.y - BALL_R < 0) {
      current.y = BALL_R
      current.vy = Math.abs(current.vy)
    }

    if (
      current.vy > 0 &&
      current.y + BALL_R >= PADDLE_Y &&
      current.y - BALL_R <= PADDLE_Y + PADDLE_H &&
      current.x >= pad.x - BALL_R &&
      current.x <= pad.x + PADDLE_W + BALL_R
    ) {
      const hit = (current.x - (pad.x + PADDLE_W / 2)) / (PADDLE_W / 2)
      const speed = Math.hypot(current.vx, current.vy)
      const angle = clamp(hit, -1, 1) * 1.05
      current.vx = speed * Math.sin(angle)
      current.vy = -Math.abs(speed * Math.cos(angle))
      current.y = PADDLE_Y - BALL_R - 1
    }

    for (const brick of bricks.current) {
      if (!brick.alive) continue
      if (
        current.x + BALL_R > brick.x &&
        current.x - BALL_R < brick.x + brick.w &&
        current.y + BALL_R > brick.y &&
        current.y - BALL_R < brick.y + brick.h
      ) {
        brick.alive = false
        scoreRef.current += 10
        setScore(scoreRef.current)

        const overlapX = Math.min(
          current.x + BALL_R - brick.x,
          brick.x + brick.w - (current.x - BALL_R),
        )
        const overlapY = Math.min(
          current.y + BALL_R - brick.y,
          brick.y + brick.h - (current.y - BALL_R),
        )
        if (overlapX < overlapY) current.vx *= -1
        else current.vy *= -1

        if (bricks.current.every((item) => !item.alive)) {
          const finalScore = scoreRef.current + 100
          scoreRef.current = finalScore
          setScore(finalScore)
          playing.current = false
          statusRef.current = 'won'
          setStatus('won')
          overRef.current(finalScore)
        }
        break
      }
    }

    if (current.y - BALL_R > H) {
      livesRef.current -= 1
      setLives(livesRef.current)
      if (livesRef.current <= 0) {
        playing.current = false
        statusRef.current = 'over'
        setStatus('over')
        overRef.current(scoreRef.current)
      } else {
        resetBall()
      }
    }
  }, [])

  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(2.4, (now - last) / (1000 / 60))
      last = now
      update(dt)
      draw()
      raf = window.requestAnimationFrame(frame)
    }
    raf = window.requestAnimationFrame(frame)
    return () => window.cancelAnimationFrame(raf)
  }, [draw, update])

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        keys.current.left = true
        event.preventDefault()
      }
      if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        keys.current.right = true
        event.preventDefault()
      }
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        handlePrimary()
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        keys.current.left = false
      }
      if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        keys.current.right = false
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [handlePrimary])

  const movePaddle = (clientX: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * W
    paddle.current.x = clamp(x - PADDLE_W / 2, 0, W - PADDLE_W)
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('button')) return
    movePaddle(event.clientX)
    handlePrimary()
  }

  return (
    <div className="game-wrap">
      <div className="game-hud">
        <div className="hud-stat">
          <span className="hud-label">Score</span>
          <span className="hud-value">{score}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Lives</span>
          <span className="hud-value lives">
            {Array.from({ length: 3 }, (_, index) => (
              <span key={index} className={index < lives ? 'life on' : 'life'} />
            ))}
          </span>
        </div>
      </div>

      <div
        className="canvas-stage breakout-stage"
        onPointerMove={(event) => movePaddle(event.clientX)}
        onPointerDown={onPointerDown}
      >
        <canvas ref={canvasRef} width={W} height={H} className="game-canvas breakout-canvas" />
        {status !== 'playing' && (
          <div className="game-overlay">
            <p className="overlay-kicker">
              {status === 'ready' ? 'Ready' : status === 'won' ? 'Board cleared' : 'Out of lives'}
            </p>
            <h3>
              {status === 'ready'
                ? 'Break every brick'
                : `${score} points${status === 'won' ? ' + 100 bonus' : ''}`}
            </h3>
            <p>Mouse, touch or ← → to move · click or space to launch.</p>
            <button type="button" className="btn btn-primary" onClick={handlePrimary}>
              {status === 'ready' ? 'Start game' : 'Play again'}
            </button>
          </div>
        )}
      </div>

      <p className="game-hint">Clear all 28 bricks · you get 3 balls</p>
    </div>
  )
}
