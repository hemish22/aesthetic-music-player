import { useRef, useState } from 'react'
import { clientId, redirectUri } from '../auth/spotify'

interface Props {
  loggedIn: boolean
  busy: boolean
  error: string | null
  onSpotify: () => void
  onFiles: (files: File[]) => void
}

/** Landing card shown until a source is active. */
export function SourcePicker({ loggedIn, busy, error, onSpotify, onFiles }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [hint, setHint] = useState(false)

  return (
    <div className="glass picker">
      <h1>Pick your music</h1>
      <button
        className="pill primary"
        disabled={busy}
        onClick={() => {
          if (!clientId) setHint(true)
          else onSpotify()
        }}
      >
        {busy ? 'Connecting…' : loggedIn ? 'Connect Spotify' : 'Log in with Spotify'}
      </button>
      <button className="pill" onClick={() => input.current?.click()}>
        Choose local files
      </button>
      <input
        ref={input}
        type="file"
        accept="audio/*"
        multiple
        hidden
        onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))}
      />
      <p className="picker-note">or drop audio files anywhere</p>
      {hint && (
        <p className="picker-error">
          Add <code>VITE_SPOTIFY_CLIENT_ID</code> to <code>.env.local</code> and register <code>{redirectUri}</code> as a
          redirect URI in your Spotify app, then restart the dev server.
        </p>
      )}
      {error && <p className="picker-error">{error}</p>}
    </div>
  )
}
