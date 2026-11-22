/**
 * One shared animation clock for the whole app.
 *
 * Why: on a 120Hz+ screen the browser recomposites every full-screen layer on every vsync as long
 * as anything animates, and that (not the effects themselves) is most of the GPU load. Driving all
 * ambient motion from one throttled loop means the screen is repainted at most `fps` times a second,
 * with the lyrics canvas, cursor glow and CSS/WAAPI loops all landing in the same repaint.
 *
 * Looping CSS animations and Web Animations (infinite iterations) are paused and stepped from here,
 * even with no cap: Chrome's own animation engine smooths moving layers, which blurs the 1px dust
 * and grain textures (they're meant to jump in whole pixels). Short one-off animations (panel
 * slide-ins, fades) are left alone.
 */

type FrameCallback = (now: number) => void

let fps = 60
let last = 0
const callbacks = new Set<FrameCallback>()
/** offset between the page clock and each stepped animation's own time */
const offsets = new WeakMap<Animation, number>()

const isLoop = (a: Animation) => a.effect?.getTiming().iterations === Infinity

function step(now: number) {
  for (const a of document.getAnimations()) {
    if (!isLoop(a)) continue
    let offset = offsets.get(a)
    if (offset === undefined) {
      offset = (Number(a.currentTime) || 0) - now
      offsets.set(a, offset)
      a.pause()
    }
    // Don't spend repaints on layers that are hidden.
    const target = (a.effect as KeyframeEffect | null)?.target
    if (target && !target.checkVisibility({ visibilityProperty: true })) continue
    a.currentTime = now + offset
  }
}

function loop(now: number) {
  requestAnimationFrame(loop)
  // small slack so 60fps on a 120Hz screen lands on every other vsync
  if (fps > 0 && now - last < 1000 / fps - 2) return
  last = now
  step(now)
  for (const cb of callbacks) cb(now)
}
requestAnimationFrame(loop)

/** Max repaints per second; 0 = match the display (no throttling). */
export function setFrameRate(next: number) {
  fps = next
}

/** Run `cb` on each (throttled) frame. Returns an unsubscribe function. */
export function onFrame(cb: FrameCallback): () => void {
  callbacks.add(cb)
  return () => callbacks.delete(cb)
}
