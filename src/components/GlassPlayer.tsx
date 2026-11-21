import { useRef } from 'react'
import { usePosition } from '../hooks/usePlayer'
import type { PlayerSource, PlayerState } from '../sources/types'
import { Icon } from './icons'

interface Props {
  source: PlayerSource
  state: PlayerState
}

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Liquid-glass mini player: thumb, title/artist, scrub bar, transport controls. */
export function GlassPlayer({ source, state }: Props) {
  const pos = usePosition(source)
  const barRef = useRef<HTMLDivElement>(null)
  const { track, isPlaying } = state
  if (!track) return null

  const duration = track.durationMs || 1
  const progress = Math.min(1, pos / duration)

  const scrub = (e: React.PointerEvent) => {
    const r = barRef.current!.getBoundingClientRect()
    source.seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration)
  }

  return (
    <div className="glass player">
      <div className="player-top">
        {track.artUrl ? <img className={`disc ${isPlaying ? 'spin' : ''}`} src={track.artUrl} alt="" /> : <div className="disc" />}
        <div className="player-meta">
          <div className="player-title">{track.title}</div>
          <div className="player-artist">{track.artist}</div>
        </div>
      </div>
      <div className="scrub-row">
        <span>{fmt(pos)}</span>
        <div className="scrub" ref={barRef} onPointerDown={scrub}>
          <div className="scrub-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <span>-{fmt(duration - pos)}</span>
      </div>
      <div className="controls">
        <button onClick={() => source.prev()} aria-label="Previous">
          <Icon name="prev" />
        </button>
        <button className="play" onClick={() => source.toggle()} aria-label={isPlaying ? 'Pause' : 'Play'}>
          <Icon name={isPlaying ? 'pause' : 'play'} />
        </button>
        <button onClick={() => source.next()} aria-label="Next">
          <Icon name="next" />
        </button>
      </div>
    </div>
  )
}
