import type { CSSProperties } from 'react'
import { useDuotone } from '../hooks/useDuotone'

interface Props {
  artUrl: string | null
  active: boolean
  c1: string
  c2: string
}

/**
 * Full-screen album cover, monochrome and tinted with the palette, with soft focus, drifting
 * orange specks and film scratches over it. Shown behind the constellation lyrics.
 *
 * Perf: the tint and blur are baked into images (useDuotone) and every layer uses normal
 * blending, so this stays cheap and stable on 2x Retina screens.
 */
export function CoverBackdrop({ artUrl, active, c1, c2 }: Props) {
  const duo = useDuotone(artUrl, c1, c2)
  if (!artUrl) return null
  return (
    <div className={`cover ${active ? 'on' : ''}`} aria-hidden>
      {/* key restarts the fade-in when the processed art changes */}
      <div className="cover-art" key={duo?.sharp ?? artUrl}>
        {duo ? (
          <>
            <img className="cover-sharp" src={duo.sharp} alt="" draggable={false} />
            <img className="cover-soft" src={duo.soft} alt="" draggable={false} />
          </>
        ) : (
          // Art couldn't be processed (e.g. CORS): plain monochrome, no tint.
          <img className="cover-fallback" src={artUrl} alt="" draggable={false} />
        )}
      </div>
      <div className="cover-glow" />
      {/* spray specks masked by the art's own brightness, so they gather on highlights */}
      <div className="spray" style={{ '--art': `url("${artUrl}")` } as CSSProperties}>
        <i className="spray-noise" />
      </div>
      <div className="dust">
        <i className="dust-noise" />
      </div>
      <div className="scratches" />
    </div>
  )
}
