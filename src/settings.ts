import { useCallback, useState } from 'react'
import type { LyricColorMode } from './lyrics/colors'

/** Everything the user can customize. Saved in localStorage. */
export interface Settings {
  // Background (lyrics view)
  /** 0..1 brightness/opacity of the full-screen album art. */
  coverOpacity: number
  /** Out-of-focus copy toward the left and bottom. */
  coverSoftFocus: boolean
  /** 0..1 strength of the orange speck/dust ("dotted") effect; 0 turns it off. */
  specks: number
  scratches: boolean
  /** Warm glow behind the clock. */
  coverGlow: boolean

  // Lyrics
  /** px size of words that aren't being sung. */
  wordSize: number
  /** px size of the word being sung. */
  activeSize: number
  lyricColor: LyricColorMode
  lyricFont: 'sans' | 'serif'
  /** 0..1.5 strength of the glow around lyric words. */
  lyricGlow: number
  /** How many lyric lines share one constellation. */
  linesPerGroup: 1 | 2 | 3
  /** 0..3 speed of the lyric sway/drift (1 = default pace); 0 holds them still. */
  driftSpeed: number
  /** px how far lyrics wander from their resting place. */
  driftDistance: number

  // Clock
  showTime: boolean
  showDate: boolean
  hour12: boolean
  /** 0.6..1.4 scale of the clock. */
  clockSize: number

  // Effects
  edgeGlow: boolean
  /** Seconds for the edge light to circle the screen once. */
  edgeSpeed: number
  /** Length of the edge light as a share of the screen's perimeter (0.03..0.6). */
  edgeLength: number
  cursorGlow: boolean
  miniControls: boolean

  // Performance
  /** Max repaints per second for all animation; 0 = match the display (heaviest). */
  frameRate: 30 | 60 | 0
  /** Lyric canvas pixels per CSS pixel (capped at the screen's own density). */
  lyricResolution: 1 | 1.5 | 2
}

export const DEFAULT_SETTINGS: Settings = {
  coverOpacity: 1,
  coverSoftFocus: true,
  specks: 1,
  scratches: true,
  coverGlow: true,
  wordSize: 27,
  activeSize: 43,
  lyricColor: 'contrast',
  lyricFont: 'sans',
  lyricGlow: 1,
  linesPerGroup: 2,
  driftSpeed: 1,
  driftDistance: 14,
  showTime: true,
  showDate: true,
  hour12: false,
  clockSize: 1,
  edgeGlow: true,
  edgeSpeed: 7,
  edgeLength: 0.09,
  cursorGlow: true,
  miniControls: true,
  frameRate: 60,
  lyricResolution: 2,
}

const KEY = 'aesthetic-settings'

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    // corrupt value: fall through to defaults
  }
  // Carry over the two options that were saved separately before settings existed.
  return {
    ...DEFAULT_SETTINGS,
    miniControls: localStorage.getItem('mini-controls') !== 'off',
    lyricColor: localStorage.getItem('lyric-color') === 'match' ? 'match' : 'contrast',
  }
}

export type UpdateSettings = (patch: Partial<Settings>) => void

export function useSettings(): [Settings, UpdateSettings, () => void] {
  const [settings, setSettings] = useState<Settings>(load)

  const update = useCallback<UpdateSettings>((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      localStorage.setItem(KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const reset = useCallback(() => {
    localStorage.setItem(KEY, JSON.stringify(DEFAULT_SETTINGS))
    setSettings(DEFAULT_SETTINGS)
  }, [])

  return [settings, update, reset]
}
