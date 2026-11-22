import { useEffect, useRef } from 'react'
import { MATCH_COLORS, rgba, type LyricColors, type RGB } from '../lyrics/colors'
import { locate, type Lyrics } from '../lyrics/lrclib'
import { onFrame } from '../frameClock'

interface Props {
  lyrics: Lyrics | null
  getPosition: () => number
  font: 'sans' | 'serif'
  colors: LyricColors
  /** px size of words not being sung */
  wordSize: number
  /** px size of the word being sung */
  activeSize: number
  /** 0..1.5 glow strength */
  glow: number
  linesPerGroup: number
  /** 0..3 sway speed multiplier; 0 = still */
  driftSpeed: number
  /** px how far words wander from their resting place */
  driftDistance: number
  /** false while the lyrics view is hidden: the render loop stops entirely */
  visible: boolean
  /** canvas pixels per CSS pixel, capped at the screen's devicePixelRatio */
  resolution: number
}

interface Node {
  word: string
  startMs: number
  endMs: number
  x: number // 0..1 within the drawing area
  y: number
  /** per-word sway: phases and frequencies (rad/s) for x and y */
  phx: number
  phy: number
  fx: number
  fy: number
}

interface Graph {
  nodes: Node[]
  edges: [number, number][]
  /** phases of the slow whole-constellation drift */
  gx: number
  gy: number
}

const FADE_MS = 700

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Deterministic layout for a group of lines, so seeking always reproduces the same constellation. */
function buildGraph(lyrics: Lyrics, group: number, linesPerGroup: number): Graph {
  const rand = mulberry32(group * 7919 + 13)
  // Separate stream for motion, so adding sway didn't change any layout.
  const sway = mulberry32(group * 104729 + 7)
  const TAU = Math.PI * 2
  const words = lyrics.lines.slice(group * linesPerGroup, (group + 1) * linesPerGroup).flatMap((l) => l.words)
  const n = words.length
  const nodes: Node[] = []
  const edges: [number, number][] = []
  let y = 0.3 + rand() * 0.4
  words.forEach((w, k) => {
    // Walk left→right so reading order is preserved, wandering vertically.
    // Mean-reverting so the shape wanders around the middle instead of sticking to an edge.
    y = Math.min(0.95, Math.max(0.05, 0.5 + (y - 0.5) * 0.5 + (rand() - 0.5) * 0.8))
    nodes.push({
      word: w.text,
      startMs: w.startMs,
      endMs: w.endMs,
      x: (k + 0.5) / n + (rand() - 0.5) * (0.6 / n),
      y,
      phx: sway() * TAU,
      phy: sway() * TAU,
      fx: 0.55 + sway() * 0.45,
      fy: 0.5 + sway() * 0.45,
    })
    if (k > 0) edges.push([k - 1, k])
    if (k > 1 && rand() < 0.55) edges.push([k - 2, k])
    if (k > 2 && rand() < 0.3) edges.push([k - 3, k])
  })
  return { nodes, edges, gx: sway() * TAU, gy: sway() * TAU }
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath()
  ctx.moveTo(x, y - s)
  ctx.quadraticCurveTo(x, y, x + s, y)
  ctx.quadraticCurveTo(x, y, x, y + s)
  ctx.quadraticCurveTo(x, y, x - s, y)
  ctx.quadraticCurveTo(x, y, x, y - s)
  ctx.fill()
}

/** Lyrics drawn as a star map: each sung word becomes a glowing node linked to its neighbours. */
export function Constellation({ lyrics, getPosition, font, colors, wordSize, activeSize, glow, linesPerGroup, driftSpeed, driftDistance, visible, resolution }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fontRef = useRef(font)
  useEffect(() => {
    fontRef.current = font
  }, [font])
  // Live-tunable values read every frame (no canvas rebuild when sliders move).
  const look = useRef({ wordSize, activeSize, glow, driftSpeed, driftDistance })
  useEffect(() => {
    look.current = { wordSize, activeSize, glow, driftSpeed, driftDistance }
  }, [wordSize, activeSize, glow, driftSpeed, driftDistance])
  const colorsRef = useRef(colors)
  useEffect(() => {
    colorsRef.current = colors
  }, [colors])

  useEffect(() => {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    if (!visible) {
      // Free the (large) backing store while hidden.
      canvas.width = canvas.height = 0
      return
    }
    let w = 0
    let h = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, resolution)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const graphs = new Map<number, Graph>()
    const graphFor = (g: number) => {
      let graph = graphs.get(g)
      if (!graph && lyrics) {
        graph = buildGraph(lyrics, g, linesPerGroup)
        graphs.set(g, graph)
      }
      return graph
    }

    // Live colors ease toward the target each frame, so track or mode changes crossfade.
    const cur: LyricColors = structuredClone(colorsRef.current ?? MATCH_COLORS)
    let lastEase = performance.now()
    const ease = () => {
      // Time-based (~1s to settle) so it behaves the same at any frame rate.
      const now = performance.now()
      const k = 1 - Math.exp(-(now - lastEase) / 250)
      lastEase = now
      const target = colorsRef.current
      for (const key of Object.keys(cur) as (keyof LyricColors)[]) {
        const c: RGB = cur[key]
        for (let i = 0; i < 3; i++) c[i] += (target[key][i] - c[i]) * k
      }
    }

    let shown = -1
    let previous = -1
    let switchedAt = 0

    // Sway clock in seconds. Advanced by dt × speed, so changing speed never makes words jump.
    let clock = 0
    let lastTick = performance.now()
    const tick = () => {
      const now = performance.now()
      // cap dt so a backgrounded tab doesn't lurch when it comes back
      clock += (Math.min(100, now - lastTick) / 1000) * look.current.driftSpeed
      lastTick = now
    }

    const drawGraph = (graph: Graph, pos: number, alpha: number) => {
      // wide spread so the larger words don't collide
      const padX = Math.max(60, w * 0.08)
      const top = h * 0.34
      const area = h * 0.5
      // Slow drift of the whole constellation plus a gentle per-word sway on top,
      // so the shape floats and its lines softly stretch.
      const d = look.current.driftDistance
      const gX = d * 0.6 * Math.sin(clock * 0.31 + graph.gx)
      const gY = d * 0.6 * Math.cos(clock * 0.23 + graph.gy)
      const px = (n: Node) => padX + n.x * (w - padX * 2) + gX + d * 0.45 * Math.sin(clock * n.fx + n.phx)
      const py = (n: Node) => top + n.y * area + gY + d * 0.45 * Math.sin(clock * n.fy + n.phy)
      const sans = fontRef.current === 'sans'

      ctx.lineCap = 'round'
      for (const [a, b] of graph.edges) {
        const na = graph.nodes[a]
        const nb = graph.nodes[b]
        const p = clamp01((pos - nb.startMs) / 400)
        if (p <= 0) continue
        ctx.strokeStyle = rgba(cur.line, 0.6 * alpha * Math.min(1, p * 1.5))
        ctx.lineWidth = 1.1
        ctx.shadowColor = rgba(cur.glow, 0.9)
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.moveTo(px(na), py(na))
        ctx.lineTo(px(na) + (px(nb) - px(na)) * p, py(na) + (py(nb) - py(na)) * p)
        ctx.stroke()
      }

      const t = performance.now()
      for (const n of graph.nodes) {
        const reveal = clamp01((pos - n.startMs) / 350)
        if (reveal <= 0) continue
        // 1 only while the word is being sung, with short fades so neighbours never glow together.
        const active = clamp01((pos - n.startMs) / 160) * (1 - clamp01((pos - n.endMs) / 160))
        const x = px(n)
        const y = py(n)
        const a = alpha * reveal

        ctx.shadowColor = rgba(cur.glow, 1)
        ctx.shadowBlur = 10 + 14 * active
        ctx.fillStyle = rgba(cur.star, a)
        sparkle(ctx, x, y, 4 + 8 * active + 2 * reveal)

        if (active > 0.02) {
          const pulse = 1 + 0.12 * Math.sin(t / 260)
          ctx.shadowBlur = 16
          ctx.strokeStyle = rgba(cur.ring, 0.9 * a * active)
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.arc(x, y, (10 + 8 * active) * pulse, 0, Math.PI * 2)
          ctx.stroke()
          ctx.strokeStyle = rgba(cur.ray, 0.35 * a * active)
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(x - 46 * active, y)
          ctx.lineTo(x + 46 * active, y)
          ctx.moveTo(x, y - 46 * active)
          ctx.lineTo(x, y + 46 * active)
          ctx.stroke()
        }

        const { wordSize: wpx, activeSize: apx, glow: gl } = look.current
        const size = wpx + (apx - wpx) * active
        ctx.font = sans ? `${active > 0.5 ? 700 : 600} ${size}px Inter, system-ui, sans-serif` : `italic ${size + 2}px "Instrument Serif", Georgia, serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        // gap below the star grows with the text so labels don't touch it
        const ty = y + 10 + size * 0.45
        const edge = active > 0.5 ? cur.activeGlow : cur.glow

        // 1. Soft colored bloom spreading out from the word.
        ctx.shadowColor = rgba(edge, 0.95)
        if (gl > 0) {
          ctx.shadowBlur = (16 + 26 * active) * gl
          ctx.fillStyle = rgba(edge, a * Math.min(1, (0.3 + 0.25 * active) * gl))
          ctx.fillText(n.word, x, ty)
        }

        // 2. Thin bright rim tracing the letter edges.
        if (gl > 0) {
          ctx.shadowBlur = (5 + 6 * active) * gl
          ctx.lineJoin = 'round'
          ctx.lineWidth = 1.4 + 1.2 * active
          ctx.strokeStyle = rgba(cur.ray, a * Math.min(1, (0.35 + 0.4 * active) * gl))
          ctx.strokeText(n.word, x, ty)
        }

        // 3. The word itself, crisp on top.
        ctx.shadowBlur = (4 + 8 * active) * gl
        ctx.shadowColor = rgba(edge, 0.7)
        const mix = cur.word.map((v, i) => v + (cur.active[i] - v) * active) as RGB
        ctx.fillStyle = rgba(mix, a * (0.7 + 0.3 * active))
        ctx.fillText(n.word, x, ty)
      }
      ctx.shadowBlur = 0
    }

    // Paced by the shared frame clock (Settings → Performance → Frame rate).
    const frame = () => {
      ctx.clearRect(0, 0, w, h)
      ease()
      tick()
      if (lyrics) {
        const pos = getPosition()
        const { line } = locate(lyrics, pos)
        if (line >= 0) {
          const group = Math.floor(line / linesPerGroup)
          if (group !== shown) {
            previous = shown
            shown = group
            switchedAt = performance.now()
          }
          const fade = clamp01((performance.now() - switchedAt) / FADE_MS)
          const prev = previous >= 0 && fade < 1 ? graphFor(previous) : undefined
          // The outgoing constellation freezes at its end time and dissolves.
          if (prev) drawGraph(prev, Infinity, 1 - fade)
          const cur = graphFor(group)
          if (cur) drawGraph(cur, pos, 1)
        }
      }
    }
    const stop = onFrame(frame)

    return () => {
      stop()
      ro.disconnect()
    }
  }, [lyrics, getPosition, linesPerGroup, visible, resolution])

  return <canvas ref={canvasRef} className="constellation" />
}
