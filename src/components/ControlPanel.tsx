import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePosition } from '../hooks/usePlayer'
import { SpotifySource } from '../sources/spotify'
import type { PlayerSource, PlayerState, QueueEntry, RepeatMode } from '../sources/types'
import { Icon } from './icons'

interface Props {
  source: PlayerSource
  state: PlayerState
  onClose: () => void
}

/** Filled share of a range input, for the CSS track gradient. */
const fill = (v: number, max: number) => ({ '--p': `${Math.min(100, (v / max) * 100)}%` }) as CSSProperties

const NEXT_REPEAT: Record<RepeatMode, RepeatMode> = { off: 'context', context: 'track', track: 'off' }

function fmt(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Pop-up glass panel with everything the clean main screen hides. */
export function ControlPanel({ source, state, onClose }: Props) {
  const { track, isPlaying, shuffle, repeat, volume } = state
  const pos = usePosition(source, 500)
  const [queue, setQueue] = useState<QueueEntry[] | null>(null)
  const [link, setLink] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const lastVolume = useRef(volume || 0.8)
  const spotify = source instanceof SpotifySource ? source : null

  const loadQueue = () => {
    void source.getQueue().then(setQueue, () => setQueue([]))
  }
  // Refresh whenever the track changes while the panel is open.
  useEffect(loadQueue, [source, track?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const duration = track?.durationMs || 1

  const linkAction = async (kind: 'play' | 'queue') => {
    if (!spotify) return
    const ok = kind === 'play' ? await spotify.play(link) : await spotify.addToQueue(link)
    setNote(ok ? (kind === 'play' ? 'Playing' : 'Added to queue') : 'Paste a Spotify track link')
    if (ok) {
      setLink('')
      window.setTimeout(loadQueue, 600)
    }
  }

  return (
    <div className="glass panel" role="dialog" aria-label="Player controls">
      <div className="panel-head">
        {track?.artUrl && <img src={track.artUrl} alt="" />}
        <div className="panel-meta">
          <div className="player-title">{track?.title ?? 'Nothing playing'}</div>
          <div className="player-artist">{track?.artist}</div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Close controls">
          <Icon name="close" size={15} />
        </button>
      </div>

      <div className="scrub-row">
        <span>{fmt(pos)}</span>
        <input
          className="range"
          type="range"
          min={0}
          max={duration}
          step={1000}
          value={Math.min(pos, duration)}
          style={fill(pos, duration)}
          onChange={(e) => source.seek(Number(e.target.value))}
          aria-label="Seek"
        />
        <span>-{fmt(duration - pos)}</span>
      </div>

      <div className="panel-transport">
        <button className={`icon-btn ${shuffle ? 'on' : ''}`} onClick={() => source.setShuffle(!shuffle)} aria-label="Shuffle" aria-pressed={shuffle}>
          <Icon name="shuffle" size={16} />
        </button>
        <button className="icon-btn" onClick={() => source.prev()} aria-label="Previous">
          <Icon name="prev" size={18} />
        </button>
        <button className="icon-btn big" onClick={() => source.toggle()} aria-label={isPlaying ? 'Pause' : 'Play'}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={20} />
        </button>
        <button className="icon-btn" onClick={() => source.next()} aria-label="Next">
          <Icon name="next" size={18} />
        </button>
        <button
          className={`icon-btn ${repeat !== 'off' ? 'on' : ''}`}
          onClick={() => source.setRepeat(NEXT_REPEAT[repeat])}
          aria-label={`Repeat: ${repeat}`}
          title={`Repeat: ${repeat === 'context' ? 'all' : repeat === 'track' ? 'one' : 'off'}`}
        >
          <Icon name={repeat === 'track' ? 'repeatOne' : 'repeat'} size={16} />
        </button>
      </div>

      <div className="volume-row">
        <button
          className="icon-btn"
          onClick={() => {
            if (volume > 0) {
              lastVolume.current = volume
              source.setVolume(0)
            } else {
              source.setVolume(lastVolume.current)
            }
          }}
          aria-label={volume > 0 ? 'Mute' : 'Unmute'}
        >
          <Icon name={volume > 0 ? 'volume' : 'mute'} size={16} />
        </button>
        <input
          className="range"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          style={fill(volume, 1)}
          onChange={(e) => source.setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
      </div>

      {spotify && (
        <div className="link-row">
          <input className="link-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a Spotify link…" />
          <button className="pill small" disabled={!link.trim()} onClick={() => void linkAction('play')}>
            Play
          </button>
          <button className="pill small" disabled={!link.trim()} onClick={() => void linkAction('queue')}>
            + Queue
          </button>
        </div>
      )}
      {note && <p className="panel-note">{note}</p>}

      <div className="queue-head">
        <span>Up next</span>
        <button className="icon-btn" onClick={loadQueue} aria-label="Refresh queue">
          <Icon name="refresh" size={13} />
        </button>
      </div>
      <ul className="queue">
        {queue === null && <li className="queue-empty">Loading…</li>}
        {queue?.length === 0 && <li className="queue-empty">Queue is empty</li>}
        {queue?.map((q) => (
          <li key={q.key}>
            <button disabled={!source.playFromQueue || q.index === undefined} onClick={() => source.playFromQueue?.(q)}>
              {q.artUrl ? <img src={q.artUrl} alt="" /> : <span className="queue-art" />}
              <span className="queue-text">
                <span className="queue-title">{q.title}</span>
                <span className="queue-artist">{q.artist}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

    </div>
  )
}
