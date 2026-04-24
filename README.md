# nostaliga-web

Marketing site + OAuth token-swap service for the Nostaliga iOS/macOS app,
deployed to Vercel at https://nostaliga.app.

## Structure

```
nostaliga-web/
├── api/                    # Vercel serverless functions (Node 18+)
│   ├── _shared.js          # encryption, config, upstream HTTP helpers
│   ├── spotify/
│   │   ├── token.js        # POST — authorization_code → tokens
│   │   └── refresh_token.js# POST — refresh_token → access_token
│   └── strava/
│       ├── callback.js     # GET  — OAuth trampoline back to deep link
│       └── token.js        # POST — code OR refresh_token exchange
├── src/
│   ├── layouts/Layout.astro
│   ├── pages/              # /, /privacy, /support
│   └── styles/global.css
├── astro.config.mjs
└── .env.example            # required server-side env vars
```

Astro builds the static marketing pages; the `api/` directory is picked up
automatically by Vercel and deployed as Node.js serverless functions at
`/api/*`. No `vercel.json` is required.

## Local development

```sh
npm install
npm run dev       # Astro dev server on http://localhost:4321
npx vercel dev    # Astro + API routes together on http://localhost:3000
```

`vercel dev` reads `.env.local` (copy from `.env.example`).

## Environment variables

Set these in the Vercel dashboard (Project → Settings → Environment Variables).
See `.env.example` for a template.

| Variable                       | Required          | Purpose                                                                                     |
| ------------------------------ | ----------------- | ------------------------------------------------------------------------------------------- |
| `SPOTIFY_CLIENT_ID`            | yes (for Spotify) | Spotify app client ID                                                                       |
| `SPOTIFY_CLIENT_SECRET`        | yes (for Spotify) | Spotify app client secret                                                                   |
| `SPOTIFY_CLIENT_CALLBACK_URL`  | yes (for Spotify) | Redirect URI registered in Spotify, must match iOS client                                   |
| `STRAVA_CLIENT_ID`             | yes (for Strava)  | Strava app client ID                                                                        |
| `STRAVA_CLIENT_SECRET`         | yes (for Strava)  | Strava app client secret                                                                    |
| `ENCRYPTION_SECRET`            | optional          | If set, Spotify refresh tokens are aes-256-cbc encrypted before being returned to the iOS client |

Rotating `ENCRYPTION_SECRET` invalidates every Spotify refresh token already
stored on users' devices, forcing them to re-authorize.

## Endpoints

| Method | Path                         | Description                                             |
| ------ | ---------------------------- | ------------------------------------------------------- |
| POST   | `/api/spotify/token`         | Exchange `code` for access + refresh tokens             |
| POST   | `/api/spotify/refresh_token` | Exchange `refresh_token` for a fresh access token       |
| GET    | `/api/strava/callback`       | OAuth trampoline — redirects to deep link from `state`  |
| POST   | `/api/strava/token`          | Exchange `code` or `refresh_token` (via `grant_type`)   |

The server is stateless. No tokens or codes are persisted. Each request
forwards to Spotify/Strava and streams the response back.

## Privacy note

This service is what allows the iOS app to hold no client secret. The
server forwards OAuth material to Spotify/Strava on the device's behalf and
returns the result. It does not persist anything. This is disclosed on
`/privacy`.

## Deploy

Pushed to `main` → Vercel auto-deploys both the static site and the API
functions.
