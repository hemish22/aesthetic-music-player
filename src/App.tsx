import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { AlbumCard } from './components/AlbumCard'
import { Background } from './components/Background'
import { Clock } from './components/Clock'
import { CoverBackdrop } from './components/CoverBackdrop'
import { EdgeGlow } from './components/EdgeGlow'
import { Constellation } from './components/Constellation'
import { ControlPanel } from './components/ControlPanel'
import { Icon } from './components/icons'
import { MiniTransport } from './components/MiniTransport'
import { CursorGlow } from './components/Cursor'
import { GlassPlayer } from './components/GlassPlayer'
import { SourcePicker } from './components/SourcePicker'
import { Waiting } from './components/Waiting'
import { usePalette } from './hooks/usePalette'
import { usePlayer } from './hooks/usePlayer'
import { handleRedirect, isLoggedIn, login } from './auth/spotify'
import { lyricColors, type LyricColorMode } from './lyrics/colors'
import { fetchLyrics, type Lyrics } from './lyrics/lrclib'
import { DemoSource, demoLyrics } from './sources/demo'
import { LocalSource } from './sources/local'
import { SpotifySource } from './sources/spotify'
import type { PlayerSource } from './sources/types'

type View = 'now' | 'lyrics'

const isDemo = new URLSearchParams(window.location.search).has('demo')
const startView: View = new URLSearchParams(window.location.search).get('view') === 'lyrics' ? 'lyrics' : 'now'

export default function App() {
  const [source, setSource] = useState<PlayerSource | null>(() => (isDemo ? new DemoSource() : null))
  const [view, setView] = useState<View>(startView)
  const [font, setFont] = useState<'sans' | 'serif'>('sans')
  const [lyrics, setLyrics] = useState<Lyrics | null>(isDemo ? demoLyrics : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [showMini, setShowMini] = useState(() => localStorage.getItem('mini-controls') !== 'off')
  const [lyricColor, setLyricColor] = useState<LyricColorMode>(() => (localStorage.getItem('lyric-color') === 'match' ? 'match' : 'contrast'))

  const player = usePlayer(source)
  const { track } = player
  const palette = usePalette(track?.artUrl ?? null)
  const colors = useMemo(() => lyricColors(palette.hue, palette.colorless, lyricColor), [palette, lyricColor])

  const connectSpotify = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      setSource(await SpotifySource.connect(setError))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  // Finish the Spotify OAuth redirect if we just came back from it.
  useEffect(() => {
    handleRedirect()
      .then((ok) => ok && setLoggedIn(true))
      .catch((e: Error) => setError(e.message))
  }, [])

  // Fetch synced lyrics once we know the track (and, for local files, its duration).
  const trackId = track?.id
  const hasDuration = (track?.durationMs ?? 0) > 0
  useEffect(() => {
    if (isDemo || !track || !hasDuration) return
    let cancelled = false
    setLyrics(null)
    fetchLyrics(track).then((l) => !cancelled && setLyrics(l))
    return () => {
      cancelled = true
    }
    // Deps are id + duration presence, not the track object, which changes identity on metadata updates.
  }, [trackId, hasDuration])

  const addFiles = useCallback(
    async (files: File[]) => {
      let local = source instanceof LocalSource ? source : null
      if (!local) {
        source?.dispose()
        local = new LocalSource()
        setSource(local)
      }
      await local.addFiles(files)
    },
    [source],
  )

  // Per-track lyric offset in ms (positive = lyrics appear sooner). Saved so a fix sticks.
  const offsetRef = useRef(0)
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    offsetRef.current = trackId ? Number(localStorage.getItem(`lyric-offset:${trackId}`) ?? 0) : 0
  }, [trackId])

  const nudge = useCallback(
    (deltaMs: number) => {
      if (!trackId) return
      offsetRef.current += deltaMs
      localStorage.setItem(`lyric-offset:${trackId}`, String(offsetRef.current))
      setToast(`lyrics ${offsetRef.current >= 0 ? '+' : '−'}${(Math.abs(offsetRef.current) / 1000).toFixed(2)}s`)
    },
    [trackId],
  )
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 1400)
    return () => window.clearTimeout(id)
  }, [toast])

  const getPosition = useCallback(() => (source?.positionMs() ?? 0) + offsetRef.current, [source])

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen()
  }, [])
  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])


  const changeShowMini = useCallback((on: boolean) => {
    setShowMini(on)
    localStorage.setItem('mini-controls', on ? 'on' : 'off')
  }, [])
  const closePanel = useCallback(() => setPanelOpen(false), [])
  const changeLyricColor = useCallback((mode: LyricColorMode) => {
    setLyricColor(mode)
    localStorage.setItem('lyric-color', mode)
  }, [])

  // Keyboard: space = play/pause, L = lyrics view, F = fullscreen, C = controls, [ ] = nudge lyrics.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        source?.toggle()
      } else if (e.key === '[') nudge(-250)
      else if (e.key === ']') nudge(250)
      else if (e.key === 'l') setView((v) => (v === 'now' ? 'lyrics' : 'now'))
      else if (e.key === 'f') toggleFullscreen()
      else if (e.key === 'c') setPanelOpen((o) => !o)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [source, nudge, toggleFullscreen])

  const vars = useMemo(() => ({ '--c1': palette.c1, '--c2': palette.c2, '--c3': palette.c3 }) as CSSProperties, [palette])
  useEffect(() => {
    // Set on the root so the registered-property transitions animate the whole page.
    for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, String(v))
  }, [vars])

  return (
    <div
      className={`stage ${view === 'lyrics' && track?.artUrl ? 'lyrics-mode' : ''}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        void addFiles(Array.from(e.dataTransfer.files))
      }}
    >
      <Background />
      <CoverBackdrop artUrl={track?.artUrl ?? null} active={view === 'lyrics'} c1={palette.c1} c2={palette.c2} />
      <EdgeGlow />
      <CursorGlow />
      <Clock />

      {!source ? (
        <SourcePicker loggedIn={loggedIn} busy={busy} error={error} onSpotify={() => (loggedIn ? connectSpotify() : login())} onFiles={addFiles} />
      ) : !track ? (
        source instanceof SpotifySource ? <Waiting source={source} error={error} /> : null
      ) : (
        <>
          <section className={`view view-now ${view === 'now' ? 'on' : ''}`}>
            <AlbumCard artUrl={track.artUrl} onClick={() => setView('lyrics')} />
            <GlassPlayer source={source} state={player} />
          </section>

          <section className={`view view-lyrics ${view === 'lyrics' ? 'on' : ''}`}>
            <Constellation lyrics={lyrics} getPosition={getPosition} font={font} colors={colors} />
            {lyrics === null && <p className="no-lyrics">no synced lyrics for this track</p>}
          </section>
          {view === 'lyrics' && showMini && <MiniTransport source={source} isPlaying={player.isPlaying} />}
          {panelOpen && (
            <ControlPanel source={source} state={player} onClose={closePanel} showMini={showMini} onShowMini={changeShowMini}
              lyricColor={lyricColor}
              onLyricColor={changeLyricColor}
            />
          )}
          {toast && <div className="toast">{toast}</div>}
        </>
      )}
      <div className="dock">
        {track && view === 'lyrics' && track.artUrl && (
          <button className="dock-thumb" onClick={() => setView('now')} aria-label="Back to player">
            <img src={track.artUrl} alt="" />
          </button>
        )}
        {track && (
          <button
            className={`dock-btn ${panelOpen ? 'active' : ''}`}
            onClick={() => setPanelOpen((o) => !o)}
            title="Controls (C)"
            aria-label="Toggle controls"
            aria-expanded={panelOpen}
          >
            <Icon name="sliders" size={14} />
          </button>
        )}
        {track && (
          <button className="dock-btn" onClick={() => setFont((f) => (f === 'sans' ? 'serif' : 'sans'))} aria-label="Toggle lyric font">
            Aa
          </button>
        )}
        <button className="dock-btn" onClick={toggleFullscreen} title="Fullscreen (F)" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {isFullscreen ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
          </svg>
        </button>
      </div>
    </div>
  )
}
