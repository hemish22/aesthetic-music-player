export interface Track {
  id: string
  title: string
  artist: string
  album: string
  artUrl: string | null
  durationMs: number
}

export type RepeatMode = 'off' | 'context' | 'track'

export interface PlayerState {
  track: Track | null
  isPlaying: boolean
  shuffle: boolean
  repeat: RepeatMode
  /** 0..1 */
  volume: number
}

export const EMPTY_STATE: PlayerState = { track: null, isPlaying: false, shuffle: false, repeat: 'off', volume: 0.8 }

export interface QueueEntry {
  key: string
  title: string
  artist: string
  artUrl: string | null
  /** Set when the source can jump straight to this entry (local files). */
  index?: number
}

/** Common surface every playback backend (local files, Spotify, demo) implements. */
export interface PlayerSource {
  readonly kind: 'local' | 'spotify' | 'demo'
  getState(): PlayerState
  /** Current position, interpolated between backend events so it is smooth. */
  positionMs(): number
  subscribe(cb: () => void): () => void
  toggle(): void
  next(): void
  prev(): void
  seek(ms: number): void
  setVolume(v: number): void
  setShuffle(on: boolean): void
  setRepeat(mode: RepeatMode): void
  /** Upcoming tracks. */
  getQueue(): Promise<QueueEntry[]>
  /** Jump to a queue entry, when the backend supports it. */
  playFromQueue?(entry: QueueEntry): void
  dispose(): void
}

/** Tiny helper so every source shares the same subscribe/notify plumbing. */
export class Emitter {
  private listeners = new Set<() => void>()

  subscribe = (cb: () => void) => {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }

  emit() {
    this.listeners.forEach((cb) => cb())
  }
}
