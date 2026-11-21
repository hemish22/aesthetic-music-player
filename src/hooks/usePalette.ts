import { useEffect, useState } from 'react'
import { getPaletteSync } from 'colorthief'

export interface Palette {
  c1: string
  c2: string
  c3: string
  /** Hue (deg) of the main cover color, for contrasting lyric colors. */
  hue: number
  /** True when the cover has no meaningful color (or no art). */
  colorless: boolean
}

/** Warm orange/red fallback, matches the reference look. */
export const DEFAULT_PALETTE: Palette = { c1: '#e0480c', c2: '#9c1d06', c3: '#2a0b05', hue: 18, colorless: true }

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  let h: number
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  return [h * 60, s, l]
}

const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`

/** Turn a dominant-color list into three saturated glow colors (bright → deep). */
function toPalette(colors: { r: number; g: number; b: number }[]): Palette {
  const scored = colors
    .map((c) => {
      const [h, s, l] = rgbToHsl(c.r, c.g, c.b)
      // Prefer colorful, mid-lightness swatches; near-black and near-white make dull glows.
      return { h, s, l, score: s * (1 - Math.abs(l - 0.45)) }
    })
    .sort((a, b) => b.score - a.score)
  const main = scored[0]
  if (!main || main.s < 0.08) return DEFAULT_PALETTE
  const second = scored.find((c) => Math.abs(c.h - main.h) > 12) ?? main
  return {
    c1: hsl(main.h, Math.max(main.s, 0.8), 0.46),
    c2: hsl(second.h, Math.max(second.s, 0.7), 0.28),
    c3: hsl(main.h, Math.max(main.s * 0.8, 0.5), 0.1),
    hue: main.h,
    colorless: false,
  }
}

/** Dominant colors of the album art; falls back to the default when art is missing or CORS-blocked. */
export function usePalette(artUrl: string | null): Palette {
  const [palette, setPalette] = useState(DEFAULT_PALETTE)

  useEffect(() => {
    if (!artUrl) {
      setPalette(DEFAULT_PALETTE)
      return
    }
    let cancelled = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (cancelled) return
      try {
        const colors = getPaletteSync(img, { colorCount: 6 })
        setPalette(colors ? toPalette(colors.map((c) => c.rgb())) : DEFAULT_PALETTE)
      } catch {
        setPalette(DEFAULT_PALETTE)
      }
    }
    img.onerror = () => !cancelled && setPalette(DEFAULT_PALETTE)
    img.src = artUrl
    return () => {
      cancelled = true
    }
  }, [artUrl])

  return palette
}
