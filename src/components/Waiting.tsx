import { useState } from 'react'
import type { SpotifySource } from '../sources/spotify'

interface Props {
  source: SpotifySource
  error: string | null
}

/** Shown after connecting to Spotify until something is playing in this tab. */
export function Waiting({ source, error }: Props) {
  const [link, setLink] = useState('')
  const [bad, setBad] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBad(!(await source.play(link)))
  }

  return (
    <form className="glass picker" onSubmit={submit}>
      <h1>Connected</h1>
      <p className="picker-note">
        Pick the <b>Aesthetic Player</b> device in the Spotify app, or paste a track, album or playlist link:
      </p>
      <input className="link-input" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://open.spotify.com/track/…" />
      <button className="pill primary" type="submit" disabled={!link.trim()}>
        Play here
      </button>
      {bad && <p className="picker-error">That doesn’t look like a Spotify link yet, or the device isn’t ready — try again in a moment.</p>}
      {error && <p className="picker-error">{error}</p>}
    </form>
  )
}
