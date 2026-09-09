# nostaliga-web

Marketing site + OAuth token-swap service for the Nostaliga iOS/macOS app,
deployed to Vercel at https://nostaliga.app.

## Structure

```
nostaliga-web/
├── api/                    # Vercel serverless functions (Node 18+)
│   ├── _shared.js          # encryption, config, upstream HTTP helpers
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
| `STRAVA_CLIENT_ID`             | yes (for Strava)  | Strava app client ID                                                                        |
| `STRAVA_CLIENT_SECRET`         | yes (for Strava)  | Strava app client secret                                                                    |
| `LASTFM_API_KEY`               | yes (for Last.fm) | Last.fm API key (public; also in the app) — used to sign `auth.getSession`                  |
| `LASTFM_SHARED_SECRET`         | yes (for Last.fm) | Last.fm shared secret — held server-side so it never ships in the app (NOS-99)              |
| `ENCRYPTION_SECRET`            | optional          | If set, supported provider refresh tokens are aes-256-cbc encrypted before being returned to the iOS client |

Rotating `ENCRYPTION_SECRET` invalidates previously encrypted refresh tokens already
stored on users' devices, forcing them to re-authorize.

The legacy Spotify token and refresh endpoints have been removed. Spotify
history imports and Last.fm scrobbling remain supported.

## Endpoints

| Method | Path                         | Description                                             |
| ------ | ---------------------------- | ------------------------------------------------------- |
| GET    | `/api/strava/callback`       | OAuth trampoline — redirects to deep link from `state`  |
| POST   | `/api/strava/token`          | Exchange `code` or `refresh_token` (via `grant_type`)   |
| POST   | `/api/lastfm/session`        | Exchange a Last.fm auth `token` for a session key (signs `auth.getSession` server-side) |

The server is stateless. No tokens or codes are persisted. Each request
forwards to the relevant provider and returns its response.

## Privacy note

This service is what allows the iOS app to hold no client secret. The
server forwards OAuth material to supported providers on the device's behalf
and returns the result. Authentication handlers do not write credentials to an
application database; hosting request logs may be retained. This is disclosed on
`/privacy`.

## Deploy

Pushed to `main` → Vercel auto-deploys both the static site and the API
functions.
