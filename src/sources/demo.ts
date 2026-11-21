import { parseLrc, type Lyrics } from '../lyrics/lrclib'
import { EMPTY_STATE, Emitter, type PlayerSource, type PlayerState, type QueueEntry, type RepeatMode, type Track } from './types'

/** Open the app with ?demo to preview the look without audio, keys or network. */
const DEMO_LRC = `
[00:02.00] Neon fades across the quiet room
[00:06.00] Every star is spelling out your name
[00:10.00] Hold the night a little longer
[00:14.00] Gold and ember in the afterglow
[00:18.00] Stay until the city falls asleep
[00:22.00] Silver light is dancing on the walls
[00:26.00] Neon fades across the quiet room
[00:30.00] Every star is spelling out your name
`

export const demoLyrics: Lyrics | null = parseLrc(DEMO_LRC)

function makeArt(): string {
  const c = document.createElement('canvas')
  c.width = c.height = 400
  const ctx = c.getContext('2d')!
  const bg = ctx.createLinearGradient(0, 0, 400, 400)
  bg.addColorStop(0, '#3a1206')
  bg.addColorStop(1, '#0c0402')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, 400, 400)
  const glow = ctx.createRadialGradient(200, 180, 10, 200, 180, 190)
  glow.addColorStop(0, '#ff5a14')
  glow.addColorStop(0.55, '#a8300a')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, 400, 400)
  ctx.fillStyle = 'rgba(0,0,0,.55)'
  ctx.beginPath()
  ctx.ellipse(200, 190, 70, 90, 0, 0, Math.PI * 2)
  ctx.fill()
  return c.toDataURL('image/png')
}

export class DemoSource implements PlayerSource {
  readonly kind = 'demo' as const
  private emitter = new Emitter()
  private track: Track = {
    id: 'demo',
    title: 'Afterglow',
    artist: 'Demo Artist',
    album: 'Demo',
    artUrl: makeArt(),
    durationMs: 200000,
  }
  private playing = true
  private extra = { shuffle: false, repeat: 'off' as RepeatMode, volume: EMPTY_STATE.volume }
  private basePos = 0
  private baseAt = performance.now()

  subscribe = this.emitter.subscribe

  getState(): PlayerState {
    return { ...this.extra, track: this.track, isPlaying: this.playing }
  }

  positionMs() {
    const pos = this.playing ? this.basePos + (performance.now() - this.baseAt) : this.basePos
    return pos % this.track.durationMs
  }

  toggle() {
    this.basePos = this.positionMs()
    this.baseAt = performance.now()
    this.playing = !this.playing
    this.emitter.emit()
  }

  next() {
    this.seek(0)
  }

  prev() {
    this.seek(0)
  }

  seek(ms: number) {
    this.basePos = ms
    this.baseAt = performance.now()
    this.emitter.emit()
  }

  setVolume(v: number) {
    this.extra = { ...this.extra, volume: v }
    this.emitter.emit()
  }

  setShuffle(on: boolean) {
    this.extra = { ...this.extra, shuffle: on }
    this.emitter.emit()
  }

  setRepeat(mode: RepeatMode) {
    this.extra = { ...this.extra, repeat: mode }
    this.emitter.emit()
  }

  async getQueue(): Promise<QueueEntry[]> {
    return [
      { key: 'd1', title: 'Night Drive', artist: 'Demo Artist', artUrl: this.track.artUrl },
      { key: 'd2', title: 'Ember', artist: 'Demo Artist', artUrl: this.track.artUrl },
    ]
  }

  dispose() {}
}
