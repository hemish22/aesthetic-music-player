/** Spotify OAuth 2.0 Authorization Code + PKCE. Runs fully in the browser, no client secret. */

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
].join(' ')

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const STORE_KEY = 'spotify_auth'
const VERIFIER_KEY = 'spotify_verifier'

interface StoredAuth {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export const clientId: string | undefined = import.meta.env.VITE_SPOTIFY_CLIENT_ID

/** Spotify rejects `localhost` redirects; the app must be opened at http://127.0.0.1:5173. */
export const redirectUri = `${window.location.origin}/callback`

function randomString(length: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

async function challengeFor(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function save(tokens: { access_token: string; refresh_token?: string; expires_in: number }, prev?: StoredAuth) {
  const auth: StoredAuth = {
    accessToken: tokens.access_token,
    // Refresh responses may omit a new refresh token; keep the old one then.
    refreshToken: tokens.refresh_token ?? prev?.refreshToken ?? '',
    expiresAt: Date.now() + tokens.expires_in * 1000,
  }
  localStorage.setItem(STORE_KEY, JSON.stringify(auth))
  return auth
}

function stored(): StoredAuth | null {
  const raw = localStorage.getItem(STORE_KEY)
  return raw ? (JSON.parse(raw) as StoredAuth) : null
}

async function tokenRequest(body: Record<string, string>) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId!, ...body }),
  })
  if (!res.ok) throw new Error(`Spotify token request failed (${res.status})`)
  return res.json()
}

export async function login() {
  if (!clientId) throw new Error('Missing VITE_SPOTIFY_CLIENT_ID')
  const verifier = randomString(64)
  localStorage.setItem(VERIFIER_KEY, verifier)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES,
    redirect_uri: redirectUri,
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
  })
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`)
}

/** Call once on load. Returns true when this page load was the OAuth redirect and tokens were saved. */
export async function handleRedirect(): Promise<boolean> {
  const url = new URL(window.location.href)
  if (url.pathname !== '/callback') return false
  const code = url.searchParams.get('code')
  const verifier = localStorage.getItem(VERIFIER_KEY)
  window.history.replaceState({}, '', '/')
  if (!code || !verifier) return false
  const tokens = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  })
  localStorage.removeItem(VERIFIER_KEY)
  save(tokens)
  return true
}

export function isLoggedIn() {
  return stored() !== null
}

export function logout() {
  localStorage.removeItem(STORE_KEY)
}

/** A valid access token, refreshing it first when it expires within a minute. */
export async function getToken(): Promise<string> {
  const auth = stored()
  if (!auth) throw new Error('Not logged in to Spotify')
  if (Date.now() < auth.expiresAt - 60_000) return auth.accessToken
  const tokens = await tokenRequest({ grant_type: 'refresh_token', refresh_token: auth.refreshToken })
  return save(tokens, auth).accessToken
}
