import type { ComponentType } from 'react'
import type { GameProps } from './types'
import Snake from './Snake'
import Game2048 from './Game2048'
import Memory from './Memory'
import Breakout from './Breakout'

export interface GameMeta {
  slug: string
  name: string
  blurb: string
  emoji: string
  accent: string
  controls: string
  component: ComponentType<GameProps>
}

export const games: GameMeta[] = [
  {
    slug: 'snake',
    name: 'Snake',
    blurb: 'Eat, grow, and don’t box yourself in. The walls are undefeated.',
    emoji: '🐍',
    accent: '#b8ff3d',
    controls: 'Arrow keys or WASD',
    component: Snake,
  },
  {
    slug: '2048',
    name: '2048',
    blurb: 'Slide, merge, chase the 2048 tile. Simple until it isn’t.',
    emoji: '🔢',
    accent: '#ffc857',
    controls: 'Arrow keys, WASD or swipe',
    component: Game2048,
  },
  {
    slug: 'memory',
    name: 'Memory Match',
    blurb: 'Flip cards and find pairs. Fewer moves means a bigger score.',
    emoji: '🃏',
    accent: '#ff5cc8',
    controls: 'Click or tap cards',
    component: Memory,
  },
  {
    slug: 'breakout',
    name: 'Breakout',
    blurb: 'A paddle, a ball and 28 bricks. Three balls to clear the board.',
    emoji: '🧱',
    accent: '#4de3ff',
    controls: 'Mouse, touch or ← →',
    component: Breakout,
  },
]

export function gameBySlug(slug?: string): GameMeta | undefined {
  return games.find((game) => game.slug === slug)
}
