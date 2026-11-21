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
  showTime: true,
  showDate: true,
  hour12: false,
  clockSize: 1,
  edgeGlow: true,
  edgeSpeed: 7,
  edgeLength: 0.09,
  cursorGlow: true,
  miniControls: true,
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
