import type { Track } from '../sources/types'

export interface LyricWord {
  text: string
  startMs: number
  endMs: number
}

export interface LyricLine {
  startMs: number
  endMs: number
  text: string
  words: LyricWord[]
}

export interface Lyrics {
  lines: LyricLine[]
}

const MAX_LINE_MS = 7000
const cache = new Map<string, Promise<Lyrics | null>>()

/** Parse LRC text ("[01:23.45] words") into lines with evenly-spread word timings. */
export function parseLrc(lrc: string): Lyrics | null {
  const raw: { startMs: number; text: string }[] = []
  for (const row of lrc.split('\n')) {
    const stamps = [...row.matchAll(/\[(\d+):(\d+(?:\.\d+)?)\]/g)]
    if (!stamps.length) continue
    const text = row.replace(/\[[^\]]*\]/g, '').trim()
    for (const s of stamps) {
      raw.push({ startMs: (Number(s[1]) * 60 + Number(s[2])) * 1000, text })
    }
  }
  raw.sort((a, b) => a.startMs - b.startMs)

  const lines: LyricLine[] = []
  raw.forEach((cur, i) => {
    if (!cur.text) return
    const nextStart = raw[i + 1]?.startMs ?? cur.startMs + 4000
    const endMs = Math.min(nextStart, cur.startMs + MAX_LINE_MS)
    lines.push({ startMs: cur.startMs, endMs, text: cur.text, words: spreadWords(cur.text, cur.startMs, endMs) })
  })
  return lines.length ? { lines } : null
}

/** LRCLIB only has line timing, so split each line's span across its words by length. */
function spreadWords(text: string, startMs: number, endMs: number): LyricWord[] {
  const parts = text.split(/\s+/).filter(Boolean)
  const weights = parts.map((p) => p.length + 2)
  const total = weights.reduce((a, b) => a + b, 0)
  let t = startMs
  return parts.map((p, i) => {
    const wordStart = t
    t += ((endMs - startMs) * weights[i]) / total
    return { text: p, startMs: wordStart, endMs: t }
  })
}

/** Index of the line active at posMs (-1 before the first line) and the active word in it. */
export function locate(lyrics: Lyrics, posMs: number): { line: number; word: number } {
  const { lines } = lyrics
  let lo = 0
  let hi = lines.length - 1
  let line = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (lines[mid].startMs <= posMs) {
      line = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  if (line < 0) return { line: -1, word: -1 }
  const words = lines[line].words
  let word = 0
  for (let i = 0; i < words.length; i++) if (words[i].startMs <= posMs) word = i
  return { line, word }
}

async function request(url: string): Promise<unknown | null> {
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json()
}

interface LrclibHit {
  syncedLyrics?: string | null
  duration?: number
}

/** Max length difference (s) before a search hit is treated as a different recording. */
const DURATION_TOLERANCE_S = 3

async function load(track: Track): Promise<Lyrics | null> {
  const base = 'https://lrclib.net/api'
  try {
    const exact = new URLSearchParams({
      track_name: track.title,
      artist_name: track.artist,
      album_name: track.album,
      duration: String(Math.round(track.durationMs / 1000)),
    })
    const hit = (await request(`${base}/get?${exact}`)) as LrclibHit | null
    if (hit?.syncedLyrics) return parseLrc(hit.syncedLyrics)

    const loose = new URLSearchParams({ track_name: track.title, artist_name: track.artist })
    const hits = (await request(`${base}/search?${loose}`)) as LrclibHit[] | null
    // Lyrics timed for another version (single, remaster, live) drift badly, so match on length.
    const target = track.durationMs / 1000
    const found = (hits ?? [])
      .filter((h) => h.syncedLyrics && h.duration !== undefined && Math.abs(h.duration - target) <= DURATION_TOLERANCE_S)
      .sort((a, b) => Math.abs(a.duration! - target) - Math.abs(b.duration! - target))[0]
    return found?.syncedLyrics ? parseLrc(found.syncedLyrics) : null
  } catch {
    return null
  }
}

export function fetchLyrics(track: Track): Promise<Lyrics | null> {
  let p = cache.get(track.id)
  if (!p) {
    p = load(track)
    cache.set(track.id, p)
  }
  return p
}
