import { useEffect, useRef } from 'react'

type Side = 'top' | 'right' | 'bottom' | 'left'
const SIDES: Side[] = ['top', 'right', 'bottom', 'left']
const PERIOD_MS = 7000

/**
 * A gold light that travels around the screen edge, like the reference. Pure CSS look, not tied to audio.
 *
 * Perf: this used to be a full-screen rotating conic gradient. On a 2x Retina panel that meant
 * ~200 MB GPU layers, which starved other layers and made Brave drop tiles (visible flicker).
 * Now each edge is a thin strip with a small "comet" that slides along it; the comet is handed
 * from edge to edge so it reads as one light circling the screen. Only transforms animate.
 */
export function EdgeGlow() {
  const refs = useRef<Record<Side, HTMLElement | null>>({ top: null, right: null, bottom: null, left: null })

  useEffect(() => {
    let anims: Animation[] = []

    const setup = () => {
      anims.forEach((a) => a.cancel())
      const W = window.innerWidth
      const H = window.innerHeight
      const L = Math.round(0.3 * Math.min(W, H) + 120) // comet length
      const P = 2 * W + 2 * H
      const v = P / PERIOD_MS
      // Distance along the perimeter where the comet's head enters each side (clockwise from top-left).
      const lengths: Record<Side, number> = { top: W, right: H, bottom: W, left: H }
      const enters: Record<Side, number> = { top: 0, right: W, bottom: W + H, left: 2 * W + H }
      const now = document.timeline.currentTime
      const start = typeof now === 'number' ? now : 0

      anims = SIDES.map((side) => {
        const el = refs.current[side]!
        el.style.setProperty('--len', `${L}px`)
        const S = lengths[side]
        const travel = S + L // head enters ... tail leaves
        const tA = enters[side] / v
        const tB = (tA + travel / v) % PERIOD_MS
        // pos = how far the head has gone along this side; offscreen (S+L) when it's elsewhere.
        const posAt = (t: number) => Math.min(travel, v * ((((t - tA) % PERIOD_MS) + PERIOD_MS) % PERIOD_MS))
        const transform = (pos: number) => {
          if (side === 'top') return `translateX(${pos - L}px)`
          if (side === 'right') return `translateY(${pos - L}px)`
          if (side === 'bottom') return `translateX(${W - pos}px)`
          return `translateY(${H - pos}px)`
        }
        const frames: Keyframe[] = [{ offset: 0, transform: transform(posAt(0)) }]
        for (const t of [tA, tB].sort((a, b) => a - b)) {
          if (t <= 0 || t >= PERIOD_MS) continue
          const o = t / PERIOD_MS
          if (t === tA) {
            // jump from parked (past the end) to just-entering; both are offscreen so it's invisible
            frames.push({ offset: o, transform: transform(travel) }, { offset: o, transform: transform(0) })
          } else {
            frames.push({ offset: o, transform: transform(travel) })
          }
        }
        // value just before the loop restarts (the wrap jump itself happens offscreen)
        frames.push({ offset: 1, transform: transform(posAt(PERIOD_MS - 0.001)) })
        const anim = el.animate(frames, { duration: PERIOD_MS, iterations: Infinity, easing: 'linear' })
        anim.startTime = start // keep all four sides in lockstep
        return anim
      })
    }

    setup()
    window.addEventListener('resize', setup)
    return () => {
      window.removeEventListener('resize', setup)
      anims.forEach((a) => a.cancel())
    }
  }, [])

  return (
    <div className="edge-glow" aria-hidden>
      {SIDES.map((side) => (
        <div key={side} className={`edge-side edge-${side}`}>
          <i
            className="edge-comet"
            ref={(el) => {
              refs.current[side] = el
            }}
          >
            <b className="edge-bloom" />
            <b className="edge-line" />
          </i>
        </div>
      ))}
    </div>
  )
}
