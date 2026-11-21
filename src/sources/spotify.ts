import { getToken } from '../auth/spotify'
import { EMPTY_STATE, Emitter, type PlayerSource, type PlayerState, type QueueEntry, type RepeatMode, type Track } from './types'

const API = 'https://api.spotify.com/v1'
const DEVICE_NAME = 'Aesthetic Player'
const REPEAT_MODES: RepeatMode[] = ['off', 'context', 'track']

function loadSdk(): Promise<void> {
  if (window.Spotify) return Promise.resolve()
  return new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.onerror = () => reject(new Error('Could not load the Spotify Web Playback SDK'))
    document.body.appendChild(script)
  })
}

async function api(path: string, init: RequestInit = {}) {
  const token = await getToken()
  return fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
}

/** Accepts open.spotify.com links or spotify: URIs for a track, album, playlist or artist. */
export function parseSpotifyLink(input: string): { uris?: string[]; context_uri?: string } | null {
  const m = input.trim().match(/(?:open\.spotify\.com\/(?:intl-[a-z]+\/)?|spotify:)(track|album|playlist|artist)[/:]([A-Za-z0-9]+)/)
  if (!m) return null
  const uri = `spotify:${m[1]}:${m[2]}`
  return m[1] === 'track' ? { uris: [uri] } : { context_uri: uri }
}

export class SpotifySource implements PlayerSource {
  readonly kind = 'spotify' as const
  private emitter = new Emitter()
  private player: Spotify.Player
  private deviceId: string | null = null
  private state: PlayerState = EMPTY_STATE
  private basePos = 0
  private baseAt = performance.now()
  private resyncTimer = 0

  subscribe = this.emitter.subscribe

  private constructor(player: Spotify.Player) {
    this.player = player
    // The SDK only emits events on changes, and the first event after a track change can arrive
    // before audio actually starts. Poll its own clock so lyrics can't drift or run ahead.
    this.resyncTimer = window.setInterval(() => void this.resync(), 1000)
  }

  /** Connect this browser tab as a Spotify Connect device. Needs Premium. */
  static async connect(onError: (msg: string) => void): Promise<SpotifySource> {
    await loadSdk()
    const player = new window.Spotify!.Player({
      name: DEVICE_NAME,
      getOAuthToken: (cb) => {
        getToken().then(cb, (e: Error) => onError(e.message))
      },
      volume: EMPTY_STATE.volume,
    })
    const source = new SpotifySource(player)

    player.addListener('ready', ({ device_id }) => {
      source.deviceId = device_id
      // Pull whatever is playing on the user's other device into this tab.
      void api('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [device_id], play: true }) })
    })
    player.addListener('player_state_changed', (s) => source.onState(s))
    player.addListener('initialization_error', (e) => onError(e.message))
    player.addListener('authentication_error', (e) => onError(e.message))
    player.addListener('account_error', () => onError('Spotify Premium is required for in-browser playback.'))
    player.addListener('playback_error', (e) => onError(e.message))

    // Must run inside a click so browsers allow audio to start later.
    await player.activateElement()
    if (!(await player.connect())) onError('Could not connect to Spotify.')
    return source
  }

  /** Start playing a pasted link on this device. Returns false if the link was not recognised. */
  async play(link: string): Promise<boolean> {
    const body = parseSpotifyLink(link)
    if (!body || !this.deviceId) return false
    await api(`/me/player/play?device_id=${this.deviceId}`, { method: 'PUT', body: JSON.stringify(body) })
    return true
  }

  /** Add a pasted track link to the Spotify queue. Returns false if it isn't a track link. */
  async addToQueue(link: string): Promise<boolean> {
    const uri = parseSpotifyLink(link)?.uris?.[0]
    if (!uri || !this.deviceId) return false
    const res = await api(`/me/player/queue?uri=${encodeURIComponent(uri)}&device_id=${this.deviceId}`, { method: 'POST' })
    return res.ok
  }

  getState() {
    return this.state
  }

  positionMs() {
    return this.state.isPlaying ? this.basePos + (performance.now() - this.baseAt) : this.basePos
  }

  toggle() {
    void this.player.togglePlay()
  }

  next() {
    void this.player.nextTrack()
  }

  prev() {
    void this.player.previousTrack()
  }

  seek(ms: number) {
    this.basePos = ms
    this.baseAt = performance.now()
    void this.player.seek(ms)
    this.emitter.emit()
  }

  setVolume(v: number) {
    this.update({ volume: v })
    void this.player.setVolume(v)
  }

  setShuffle(on: boolean) {
    this.update({ shuffle: on })
    void api(`/me/player/shuffle?state=${on}${this.deviceParam()}`, { method: 'PUT' })
  }

  setRepeat(mode: RepeatMode) {
    this.update({ repeat: mode })
    void api(`/me/player/repeat?state=${mode}${this.deviceParam()}`, { method: 'PUT' })
  }

  async getQueue(): Promise<QueueEntry[]> {
    const res = await api('/me/player/queue')
    if (!res.ok) return []
    const data = (await res.json()) as { queue?: Spotify.Track[] }
    return (data.queue ?? []).map((t, i) => ({
      key: `${t.uri}:${i}`,
      title: t.name,
      artist: t.artists?.map((a) => a.name).join(', ') ?? '',
      // Smallest image is plenty for a list row.
      artUrl: t.album?.images?.at(-1)?.url ?? null,
    }))
  }

  dispose() {
    window.clearInterval(this.resyncTimer)
    this.player.disconnect()
  }

  private async resync() {
    const s = await this.player.getCurrentState()
    if (!s || s.paused !== !this.state.isPlaying) return // a state event is about to land
    // Ignore tiny differences so the lyrics don't jitter.
    if (Math.abs(s.position - this.positionMs()) < 120) return
    this.basePos = s.position
    this.baseAt = performance.now()
  }

  private onState(s: Spotify.PlaybackState | null) {
    if (!s) return
    const t = s.track_window.current_track
    const track: Track = {
      id: t.id ?? t.uri,
      title: t.name,
      artist: t.artists.map((a) => a.name).join(', '),
      album: t.album.name,
      artUrl: t.album.images[0]?.url ?? null,
      durationMs: t.duration_ms,
    }
    this.basePos = s.position
    this.baseAt = performance.now()
    this.update({ track, isPlaying: !s.paused, shuffle: s.shuffle, repeat: REPEAT_MODES[s.repeat_mode] ?? 'off' })
  }

  private deviceParam() {
    return this.deviceId ? `&device_id=${this.deviceId}` : ''
  }

  private update(patch: Partial<PlayerState>) {
    this.state = { ...this.state, ...patch }
    this.emitter.emit()
  }
}
