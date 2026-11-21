/** Colors for the constellation lyrics, either matching the warm palette or contrasting with it. */

export type RGB = [number, number, number]
export type LyricColorMode = 'match' | 'contrast'

export interface LyricColors {
  word: RGB
  active: RGB
  activeGlow: RGB
  star: RGB
  line: RGB
  glow: RGB
  ring: RGB
  ray: RGB
}

/** The original warm gold look. */
export const MATCH_COLORS: LyricColors = {
  word: [255, 222, 190],
  active: [255, 227, 90],
  activeGlow: [255, 200, 60],
  star: [255, 232, 170],
  line: [255, 206, 140],
  glow: [255, 140, 45],
  ring: [255, 140, 60],
  ray: [255, 220, 150],
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const k = (n: number) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

/**
 * Contrast mode uses the opposite hue, but kept light and low-saturation (silvery) so it reads
 * cleanly instead of vibrating against the saturated background. Only the active word gets more color.
 */
export function lyricColors(coverHue: number, colorless: boolean, mode: LyricColorMode): LyricColors {
  if (mode === 'match' || colorless) return MATCH_COLORS
  const h = (coverHue + 180) % 360
  return {
    word: hslToRgb(h, 0.16, 0.86),
    active: hslToRgb(h, 0.6, 0.82),
    activeGlow: hslToRgb(h, 0.7, 0.68),
    star: hslToRgb(h, 0.25, 0.93),
    line: hslToRgb(h, 0.18, 0.78),
    glow: hslToRgb(h, 0.5, 0.6),
    ring: hslToRgb(h, 0.55, 0.72),
    ray: hslToRgb(h, 0.3, 0.86),
  }
}

export const rgba = (c: RGB, a: number) => `rgba(${c[0] | 0}, ${c[1] | 0}, ${c[2] | 0}, ${a})`
