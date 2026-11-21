// Minimal typings for the parts of the Spotify Web Playback SDK this app uses.
declare namespace Spotify {
  interface Image {
    url: string
  }
  interface Artist {
    name: string
  }
  interface Track {
    id: string | null
    uri: string
    name: string
    duration_ms: number
    artists: Artist[]
    album: { name: string; images: Image[] }
  }
  interface PlaybackState {
    paused: boolean
    shuffle: boolean
    /** 0 off, 1 context, 2 track */
    repeat_mode: 0 | 1 | 2
    position: number
    duration: number
    track_window: { current_track: Track }
  }
  interface PlayerInit {
    name: string
    getOAuthToken(cb: (token: string) => void): void
    volume?: number
  }
  class Player {
    constructor(init: PlayerInit)
    connect(): Promise<boolean>
    disconnect(): void
    activateElement(): Promise<void>
    togglePlay(): Promise<void>
    nextTrack(): Promise<void>
    previousTrack(): Promise<void>
    seek(positionMs: number): Promise<void>
    getCurrentState(): Promise<PlaybackState | null>
    setVolume(volume: number): Promise<void>
    addListener(event: 'ready' | 'not_ready', cb: (data: { device_id: string }) => void): boolean
    addListener(event: 'player_state_changed', cb: (state: PlaybackState | null) => void): boolean
    addListener(
      event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error',
      cb: (data: { message: string }) => void,
    ): boolean
  }
}

interface Window {
  Spotify?: typeof Spotify
  onSpotifyWebPlaybackSDKReady?: () => void
}
