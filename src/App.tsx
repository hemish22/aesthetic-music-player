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
import { SettingsPanel } from './components/SettingsPanel'
import { SourcePicker } from './components/SourcePicker'
import { Waiting } from './components/Waiting'
import { usePalette } from './hooks/usePalette'
import { usePlayer } from './hooks/usePlayer'
import { handleRedirect, isLoggedIn, login } from './auth/spotify'
import { lyricColors } from './lyrics/colors'
import { fetchLyrics, type Lyrics } from './lyrics/lrclib'
import { DemoSource, demoLyrics } from './sources/demo'
import { LocalSource } from './sources/local'
import { SpotifySource } from './sources/spotify'
import type { PlayerSource } from './sources/types'
import { useSettings } from './settings'

type View = 'now' | 'lyrics'
type Panel = 'controls' | 'settings' | null

const isDemo = new URLSearchParams(window.location.search).has('demo')
const startView: View = new URLSearchParams(window.location.search).get('view') === 'lyrics' ? 'lyrics' : 'now'

export default function App() {
  const [source, setSource] = useState<PlayerSource | null>(() => (isDemo ? new DemoSource() : null))
  const [view, setView] = useState<View>(startView)
  const [settings, updateSettings, resetSettings] = useSettings()
  const [lyrics, setLyrics] = useState<Lyrics | null>(isDemo ? demoLyrics : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loggedIn, setLoggedIn] = useState(isLoggedIn())
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [panel, setPanel] = useState<Panel>(null)

  const player = usePlayer(source)
  const { track } = player
  const palette = usePalette(track?.artUrl ?? null)
  const colors = useMemo(() => lyricColors(palette.hue, palette.colorless, settings.lyricColor), [palette, settings.lyricColor])

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


  const closePanel = useCallback(() => setPanel(null), [])
  const togglePanel = useCallback((p: Exclude<Panel, null>) => setPanel((cur) => (cur === p ? null : p)), [])

  // Keyboard: space = play/pause, L = lyrics view, F = fullscreen, C = controls, S = settings, [ ] = nudge lyrics.
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
      else if (e.key === 'c') togglePanel('controls')
      else if (e.key === 's') togglePanel('settings')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [source, nudge, toggleFullscreen, togglePanel])

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
      <CoverBackdrop
        artUrl={track?.artUrl ?? null}
        active={view === 'lyrics'}
        c1={palette.c1}
        c2={palette.c2}
        artOpacity={settings.coverOpacity}
        softFocus={settings.coverSoftFocus}
        specks={settings.specks}
        scratches={settings.scratches}
        glow={settings.coverGlow}
      />
      {settings.edgeGlow && <EdgeGlow lapSeconds={settings.edgeSpeed} length={settings.edgeLength} />}
      {settings.cursorGlow && <CursorGlow />}
      <Clock showTime={settings.showTime} showDate={settings.showDate} hour12={settings.hour12} scale={settings.clockSize} />

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
            <Constellation
              lyrics={lyrics}
              getPosition={getPosition}
              font={settings.lyricFont}
              colors={colors}
              wordSize={settings.wordSize}
              activeSize={settings.activeSize}
              glow={settings.lyricGlow}
              linesPerGroup={settings.linesPerGroup}
            />
            {lyrics === null && <p className="no-lyrics">no synced lyrics for this track</p>}
          </section>
          {view === 'lyrics' && settings.miniControls && <MiniTransport source={source} isPlaying={player.isPlaying} />}
          {panel === 'controls' && <ControlPanel source={source} state={player} onClose={closePanel} />}
          {toast && <div className="toast">{toast}</div>}
        </>
      )}
      {panel === 'settings' && <SettingsPanel settings={settings} update={updateSettings} reset={resetSettings} onClose={closePanel} />}
      <div className="dock">
        {track && view === 'lyrics' && track.artUrl && (
          <button className="dock-thumb" onClick={() => setView('now')} aria-label="Back to player">
            <img src={track.artUrl} alt="" />
          </button>
        )}
        {track && (
          <button
            className={`dock-btn ${panel === 'controls' ? 'active' : ''}`}
            onClick={() => togglePanel('controls')}
            title="Controls (C)"
            aria-label="Toggle controls"
            aria-expanded={panel === 'controls'}
          >
            <Icon name="sliders" size={14} />
          </button>
        )}
        {track && (
          <button
            className="dock-btn"
            onClick={() => updateSettings({ lyricFont: settings.lyricFont === 'sans' ? 'serif' : 'sans' })}
            title="Lyric font"
            aria-label="Toggle lyric font"
          >
            Aa
          </button>
        )}
        <button
          className={`dock-btn ${panel === 'settings' ? 'active' : ''}`}
          onClick={() => togglePanel('settings')}
          title="Settings (S)"
          aria-label="Toggle settings"
          aria-expanded={panel === 'settings'}
        >
          <Icon name="gear" size={14} />
        </button>
        <button className="dock-btn" onClick={toggleFullscreen} title="Fullscreen (F)" aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            {isFullscreen ? <path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /> : <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />}
          </svg>
        </button>
      </div>
    </div>
  )
}
