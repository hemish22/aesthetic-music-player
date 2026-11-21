import { useRef, type CSSProperties } from 'react'

interface Props {
  artUrl: string | null
  onClick?: () => void
}

const REST_X = 4
const REST_Y = -9

/** Album art that tilts toward the pointer in 3D, resting at a slight angle like the reference. */
export function AlbumCard({ artUrl, onClick }: Props) {
  const ref = useRef<HTMLButtonElement>(null)

  const tilt = (e: React.PointerEvent) => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.setProperty('--rx', `${REST_X - py * 16}deg`)
    el.style.setProperty('--ry', `${REST_Y + px * 18}deg`)
  }

  const reset = () => {
    ref.current?.style.setProperty('--rx', `${REST_X}deg`)
    ref.current?.style.setProperty('--ry', `${REST_Y}deg`)
  }

  return (
    <button
      ref={ref}
      className="album"
      style={{ '--rx': `${REST_X}deg`, '--ry': `${REST_Y}deg` } as CSSProperties}
      onPointerMove={tilt}
      onPointerLeave={reset}
      onClick={onClick}
      aria-label="Show lyrics"
    >
      {artUrl ? <img src={artUrl} alt="" draggable={false} /> : <div className="album-empty" />}
      <span className="album-sheen" />
    </button>
  )
}
