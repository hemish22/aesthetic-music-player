import jsmediatags from 'jsmediatags/dist/jsmediatags.min.js'
import { EMPTY_STATE, Emitter, type PlayerSource, type PlayerState, type QueueEntry, type RepeatMode, type Track } from './types'

interface QueueItem {
  file: File
  track: Track
}

function readTags(file: File): Promise<Track> {
  const fallbackTitle = file.name.replace(/\.[^.]+$/, '')
  const base: Track = {
    id: `${file.name}:${file.size}`,
    title: fallbackTitle,
    artist: 'Unknown artist',
    album: '',
    artUrl: null,
    durationMs: 0,
  }
  return new Promise((resolve) => {
    jsmediatags.read(file, {
      onSuccess: ({ tags }) => {
        let artUrl: string | null = null
        if (tags.picture) {
          const bytes = new Uint8Array(tags.picture.data)
          artUrl = URL.createObjectURL(new Blob([bytes], { type: tags.picture.format }))
        }
        resolve({
          ...base,
          title: tags.title || base.title,
          artist: tags.artist || base.artist,
          album: tags.album || '',
          artUrl,
        })
      },
      onError: () => resolve(base),
    })
  })
}

export class LocalSource implements PlayerSource {
  readonly kind = 'local' as const
  private audio = new Audio()
  private emitter = new Emitter()
  private queue: QueueItem[] = []
  private index = -1
  private objectUrl: string | null = null
  private state: PlayerState = EMPTY_STATE

  subscribe = this.emitter.subscribe

  constructor() {
    this.audio.preload = 'auto'
    this.audio.volume = this.state.volume
    this.audio.addEventListener('play', () => this.update({ isPlaying: true }))
    this.audio.addEventListener('pause', () => this.update({ isPlaying: false }))
    this.audio.addEventListener('ended', () => {
      if (this.state.repeat === 'track') {
        this.audio.currentTime = 0
        void this.audio.play()
      } else {
        this.next()
      }
    })
    this.audio.addEventListener('loadedmetadata', () => {
      const t = this.state.track
      if (t) this.update({ track: { ...t, durationMs: this.audio.duration * 1000 } })
    })
  }

  async addFiles(files: File[]) {
    const audio = files.filter((f) => f.type.startsWith('audio/') || /\.(mp3|m4a|flac|wav|ogg|aac)$/i.test(f.name))
    const items = await Promise.all(audio.map(async (file) => ({ file, track: await readTags(file) })))
    if (!items.length) return
    const wasEmpty = this.queue.length === 0
    this.queue.push(...items)
    if (wasEmpty) this.load(0, true)
  }

  getState() {
    return this.state
  }

  positionMs() {
    return this.audio.currentTime * 1000
  }

  toggle() {
    if (!this.state.track) return
    if (this.audio.paused) void this.audio.play()
    else this.audio.pause()
  }

  next() {
    const n = this.queue.length
    if (this.state.shuffle && n > 1) {
      // Any track except the current one.
      this.load((this.index + 1 + Math.floor(Math.random() * (n - 1))) % n, true)
    } else if (this.index + 1 < n) {
      this.load(this.index + 1, true)
    } else if (this.state.repeat === 'context' && n > 0) {
      this.load(0, true)
    } else {
      this.audio.pause()
    }
  }

  prev() {
    // Restart the track first, like most players; go back only when already near the start.
    if (this.audio.currentTime > 3 || this.index === 0) this.audio.currentTime = 0
    else this.load(this.index - 1, true)
  }

  seek(ms: number) {
    this.audio.currentTime = ms / 1000
    this.emitter.emit()
  }

  setVolume(v: number) {
    this.audio.volume = v
    this.update({ volume: v })
  }

  setShuffle(on: boolean) {
    this.update({ shuffle: on })
  }

  setRepeat(mode: RepeatMode) {
    this.update({ repeat: mode })
  }

  async getQueue(): Promise<QueueEntry[]> {
    return this.queue.slice(this.index + 1).map((q, i) => ({
      key: `${q.track.id}:${i}`,
      title: q.track.title,
      artist: q.track.artist,
      artUrl: q.track.artUrl,
      index: this.index + 1 + i,
    }))
  }

  playFromQueue(entry: QueueEntry) {
    if (entry.index !== undefined) this.load(entry.index, true)
  }

  dispose() {
    this.audio.pause()
    this.audio.removeAttribute('src')
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.queue.forEach((q) => q.track.artUrl && URL.revokeObjectURL(q.track.artUrl))
  }

  private load(i: number, autoplay: boolean) {
    const item = this.queue[i]
    if (!item) return
    this.index = i
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
    this.objectUrl = URL.createObjectURL(item.file)
    this.audio.src = this.objectUrl
    this.update({ track: item.track })
    if (autoplay) void this.audio.play().catch(() => undefined)
  }

  private update(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch }
    this.emitter.emit()
  }
}
