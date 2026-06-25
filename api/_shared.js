// Shared helpers for the token-swap API routes.
// Files prefixed with `_` are not deployed as Vercel functions, so this is a
// safe place for utility code imported by the real handlers.

import crypto from "node:crypto";

// --- Configuration ------------------------------------------------------

export const config = {
  spotify: {
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    clientCallbackUrl: process.env.SPOTIFY_CLIENT_CALLBACK_URL,
  },
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
  },
  trakt: {
    clientId: process.env.TRAKT_CLIENT_ID,
    clientSecret: process.env.TRAKT_CLIENT_SECRET,
    redirectUri: process.env.TRAKT_REDIRECT_URI,
  },
  foursquare: {
    clientId: process.env.FOURSQUARE_CLIENT_ID,
    clientSecret: process.env.FOURSQUARE_CLIENT_SECRET,
    redirectUri: process.env.FOURSQUARE_REDIRECT_URI,
  },
  encryptionSecret: process.env.ENCRYPTION_SECRET,
};

export function requireSpotifyConfig(res) {
  const { clientId, clientSecret, clientCallbackUrl } = config.spotify;
  if (!clientId || !clientSecret || !clientCallbackUrl) {
    res.status(500).json({ error: "Spotify is not configured on the server." });
    return false;
  }
  return true;
}

export function requireStravaConfig(res) {
  const { clientId, clientSecret } = config.strava;
  if (!clientId || !clientSecret) {
    res.status(500).json({ error: "Strava is not configured on the server." });
    return false;
  }
  return true;
}

export function requireTraktConfig(res) {
  const { clientId, clientSecret, redirectUri } = config.trakt;
  if (!clientId || !clientSecret || !redirectUri) {
    res.status(500).json({ error: "Trakt is not configured on the server." });
    return false;
  }
  return true;
}

export function requireFoursquareConfig(res) {
  const { clientId, clientSecret, redirectUri } = config.foursquare;
  if (!clientId || !clientSecret || !redirectUri) {
    res
      .status(500)
      .json({ error: "Foursquare is not configured on the server." });
    return false;
  }
  return true;
}

// --- CORS ---------------------------------------------------------------

// These token endpoints are called by the native iOS app via URLSession, which
// is not subject to CORS. We deliberately do NOT emit a wildcard
// Access-Control-Allow-Origin: there is no legitimate cross-origin browser
// caller for these credential-issuing routes, so a browser preflight should
// fail rather than be waved through (NOS-82 hardening). Kept as a uniform hook
// so a future route that genuinely needs CORS can opt in here in one place.
export function applyCors(_res) {
  // Intentionally no CORS headers for native-only credential endpoints.
}

// --- Body parsing -------------------------------------------------------

// Vercel auto-parses JSON and urlencoded for POST bodies, but callers may
// send escaped newlines inside the refresh_token which need normalizing.
export function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return Object.fromEntries(new URLSearchParams(req.body));
    }
  }
  return req.body;
}

// --- Encryption (aes-256-cbc, matching legacy format) -------------------

const ALGORITHM = "aes-256-cbc";

export function encrypt(text) {
  if (!config.encryptionSecret) return text;

  const key = crypto.scryptSync(config.encryptionSecret, "salt", 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, "utf8", "base64");
  encrypted += cipher.final("base64");

  return iv.toString("base64") + ":" + encrypted;
}

export function decrypt(text) {
  if (!config.encryptionSecret) return text;

  const parts = text.split(":");
  if (parts.length !== 2) return text;

  const iv = Buffer.from(parts[0], "base64");
  const encryptedText = parts[1];
  const key = crypto.scryptSync(config.encryptionSecret, "salt", 32);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

  let decrypted = decipher.update(encryptedText, "base64", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}

// Encrypt the refresh_token field on an upstream token response in place, when
// ENCRYPTION_SECRET is configured. No-op otherwise. Used so every provider
// stores an opaque refresh_token on the device, matching the Spotify flow.
export function encryptRefreshTokenInPlace(data) {
  if (data && data.refresh_token && config.encryptionSecret) {
    data.refresh_token = encrypt(data.refresh_token);
  }
  return data;
}

// Reverse for an incoming refresh_token. Normalizes escaped newlines some HTTP
// clients inject, and tolerates plaintext tokens issued before encryption was
// enabled (decrypt() returns its input unchanged when it isn't iv:ciphertext).
export function decryptRefreshToken(token) {
  const normalized = String(token).replace(/\\n/g, "\n");
  if (!config.encryptionSecret) return normalized;
  return decrypt(normalized);
}

// --- Upstream HTTP helpers ---------------------------------------------

// Trakt is behind Cloudflare and 403s requests with no User-Agent (Node's
// fetch sends none, unlike on-device URLSession), returning an HTML block page
// that breaks JSON parsing. Send an identifying UA on every upstream call.
const USER_AGENT = "Nostaliga/1.0 (+https://www.nostaliga.app)";

export async function spotifyRequest(grantType, params) {
  const credentials = Buffer.from(
    `${config.spotify.clientId}:${config.spotify.clientSecret}`,
  ).toString("base64");

  const body = new URLSearchParams({
    grant_type: grantType,
    ...params,
  });

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: body.toString(),
  });

  const data = await response.json();
  return { status: response.status, data };
}

export async function stravaRequest(grantType, params) {
  const body = new URLSearchParams({
    client_id: config.strava.clientId,
    client_secret: config.strava.clientSecret,
    grant_type: grantType,
    ...params,
  });

  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: body.toString(),
  });

  const data = await response.json();
  return { status: response.status, data };
}

// Trakt expects a JSON body and echoes the client_id back; redirect_uri must
// match the value registered in the Trakt app and configured on the iOS client.
export async function traktRequest(grantType, params) {
  const body = {
    client_id: config.trakt.clientId,
    client_secret: config.trakt.clientSecret,
    redirect_uri: config.trakt.redirectUri,
    grant_type: grantType,
    ...params,
  };

  const response = await fetch("https://api.trakt.tv/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return { status: response.status, data };
}

// Foursquare v2 has no PKCE and no refresh — access tokens don't expire, so
// only the authorization_code exchange needs proxying. Returns { access_token }.
export async function foursquareRequest(code) {
  const body = new URLSearchParams({
    client_id: config.foursquare.clientId,
    client_secret: config.foursquare.clientSecret,
    grant_type: "authorization_code",
    redirect_uri: config.foursquare.redirectUri,
    code,
  });

  const response = await fetch(
    "https://foursquare.com/oauth2/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": USER_AGENT,
      },
      body: body.toString(),
    },
  );

  const data = await response.json();
  return { status: response.status, data };
}
