import { useEffect, useState } from 'react'

export interface Duotone {
  sharp: string
  soft: string
}

type RGB = [number, number, number]

/** Any CSS color string → RGB, using the canvas parser. */
function toRgb(ctx: CanvasRenderingContext2D, color: string): RGB {
  ctx.fillStyle = '#000'
  ctx.fillStyle = color
  const hex = String(ctx.fillStyle)
  if (hex.startsWith('#')) return [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as RGB
  const m = hex.match(/[\d.]+/g)
  return m ? (m.slice(0, 3).map(Number) as RGB) : [224, 72, 12]
}

const canvasToUrl = (c: HTMLCanvasElement) =>
  new Promise<string>((resolve, reject) => c.toBlob((b) => (b ? resolve(URL.createObjectURL(b)) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.9))

/**
 * Bakes the lyrics-view cover once: monochrome, tone-mapped so midtones fall to black, then
 * tinted with the palette (a vertical c1 → c1/c2 gradient). Also makes a heavily blurred copy.
 *
 * This replaces live CSS grayscale/contrast/blur filters and a multiply-blend tint layer. On a 2x
 * Retina panel those needed big GPU surfaces, and under memory pressure Brave dropped the tint per
 * tile (patches of grey flickering in and out). Plain images composite cheaply and reliably.
 *
 * Returns null when the art can't be read (e.g. CORS) so the caller can fall back.
 */
export function useDuotone(artUrl: string | null, c1: string, c2: string): Duotone | null {
  const [result, setResult] = useState<Duotone | null>(null)

  useEffect(() => {
    setResult(null)
    if (!artUrl) return
    let cancelled = false
    const urls: string[] = []
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = async () => {
      try {
        const size = Math.min(1024, Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.round((img.naturalWidth / Math.max(img.naturalWidth, img.naturalHeight)) * size)
        const h = Math.round((img.naturalHeight / Math.max(img.naturalWidth, img.naturalHeight)) * size)
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const ctx = c.getContext('2d', { willReadFrequently: true })!
        ctx.filter = 'blur(1px)'
        ctx.drawImage(img, 0, 0, w, h)
        ctx.filter = 'none'
        const top = toRgb(ctx, c1)
        const low = toRgb(ctx, c2).map((v, i) => top[i] * 0.55 + v * 0.45) as RGB
        const data = ctx.getImageData(0, 0, w, h) // throws on tainted (CORS-blocked) art
        const px = data.data
        for (let y = 0; y < h; y++) {
          const k = y / (h - 1 || 1)
          const tint = [0, 1, 2].map((i) => (top[i] + (low[i] - top[i]) * k) / 255)
          for (let x = 0; x < w; x++) {
            const o = (y * w + x) * 4
            const lum = (0.2126 * px[o] + 0.7152 * px[o + 1] + 0.0722 * px[o + 2]) / 255
            // same curve as the old CSS: brightness(0.92) contrast(1.6)
            const v = Math.min(1, Math.max(0, (lum * 0.92 - 0.5) * 1.6 + 0.5))
            px[o] = 255 * v * tint[0]
            px[o + 1] = 255 * v * tint[1]
            px[o + 2] = 255 * v * tint[2]
          }
        }
        ctx.putImageData(data, 0, 0)

        // Soft copy: blur at low resolution; the browser's smooth upscale finishes the job.
        const s = document.createElement('canvas')
        s.width = 160
        s.height = Math.round((160 * h) / w)
        const sctx = s.getContext('2d')!
        sctx.filter = 'blur(6px)'
        sctx.drawImage(c, 0, 0, s.width, s.height)

        const [sharp, soft] = await Promise.all([canvasToUrl(c), canvasToUrl(s)])
        urls.push(sharp, soft)
        if (!cancelled) setResult({ sharp, soft })
      } catch {
        if (!cancelled) setResult(null)
      }
    }
    img.src = artUrl
    return () => {
      cancelled = true
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [artUrl, c1, c2])

  return result
}
