import { useEffect, useRef } from 'react'
import { onFrame } from '../frameClock'

/** Soft warm glow that eases toward the pointer. Purely decorative. */
export function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const pos = { ...target }
    let last = performance.now()
    const move = (e: PointerEvent) => {
      target.x = e.clientX
      target.y = e.clientY
    }
    const loop = (now: number) => {
      const dx = target.x - pos.x
      const dy = target.y - pos.y
      // Frame-rate independent easing (~same feel at 30, 60 or 120fps).
      const k = 1 - Math.exp(-(now - last) / 70)
      last = now
      // Settled: leave the style untouched so the browser has nothing to repaint.
      if (Math.abs(dx) < 0.3 && Math.abs(dy) < 0.3) return
      pos.x += dx * k
      pos.y += dy * k
      if (ref.current) ref.current.style.transform = `translate(${pos.x - 150}px, ${pos.y - 150}px)`
    }
    window.addEventListener('pointermove', move)
    const stop = onFrame(loop)
    return () => {
      window.removeEventListener('pointermove', move)
      stop()
    }
  }, [])

  return <div ref={ref} className="cursor-glow" aria-hidden />
}
