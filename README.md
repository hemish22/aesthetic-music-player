# Aesthetic Music Player

Lock-screen style music player: album-art glow, serif clock, tilted album card, glass mini player,
and lyrics drawn as a constellation. Plays Spotify (Premium) or local audio files.

## Run
```
npm install
npm run dev        # open http://127.0.0.1:5173  (not "localhost")
```
Preview the look with no keys: `http://127.0.0.1:5173/?demo` (add `&view=lyrics` for the constellation).

## Spotify
1. Create an app at https://developer.spotify.com/dashboard (select "Web Playback SDK").
2. Add redirect URI `http://127.0.0.1:5173/callback`.
3. `cp .env.example .env.local` and set `VITE_SPOTIFY_CLIENT_ID`. Restart `npm run dev`.
4. Log in, then pick the **Aesthetic Player** device in Spotify, or paste a track/album/playlist link.

## Keys
`Space` play/pause · `L` lyrics view · `F` fullscreen. Click the album to open lyrics, click the thumbnail to return.

Lyrics come from [LRCLIB](https://lrclib.net) (track title/artist/album/duration are sent to look them up).
