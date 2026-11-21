import type { CSSProperties } from 'react'
import { useDuotone } from '../hooks/useDuotone'

interface Props {
  artUrl: string | null
  active: boolean
  c1: string
  c2: string
  /** 0..1 */
  artOpacity: number
  softFocus: boolean
  /** 0..1.5 strength of the specks; 0 = off (not rendered at all) */
  specks: number
  scratches: boolean
  glow: boolean
}

/**
 * Full-screen album cover, monochrome and tinted with the palette, with soft focus, drifting
 * orange specks and film scratches over it. Shown behind the constellation lyrics.
 *
 * Perf: the tint and blur are baked into images (useDuotone) and every layer uses normal
 * blending, so this stays cheap and stable on 2x Retina screens.
 */
export function CoverBackdrop({ artUrl, active, c1, c2, artOpacity, softFocus, specks, scratches, glow }: Props) {
  const duo = useDuotone(artUrl, c1, c2)
  if (!artUrl) return null
  return (
    <div
      className={`cover ${active ? 'on' : ''}`}
      style={{ '--art-opacity': artOpacity, '--specks': Math.min(1, specks), '--specks-boost': Math.max(1, specks) } as CSSProperties}
      aria-hidden
    >
      {/* key restarts the fade-in when the processed art changes */}
      <div className="cover-art" key={duo?.sharp ?? artUrl}>
        {duo ? (
          <>
            <img className="cover-sharp" src={duo.sharp} alt="" draggable={false} />
            {softFocus && <img className="cover-soft" src={duo.soft} alt="" draggable={false} />}
          </>
        ) : (
          // Art couldn't be processed (e.g. CORS): plain monochrome, no tint.
          <img className="cover-fallback" src={artUrl} alt="" draggable={false} />
        )}
      </div>
      <div className={`cover-glow ${glow ? '' : 'no-glow'}`} />
      {/* spray specks masked by the art's own brightness, so they gather on highlights */}
      {specks > 0 && (
        <div className="specks">
          <div className="spray" style={{ '--art': `url("${artUrl}")` } as CSSProperties}>
            <i className="spray-noise" />
          </div>
          <div className="dust">
            <i className="dust-noise" />
          </div>
        </div>
      )}
      {scratches && <div className="scratches" />}
    </div>
  )
}
