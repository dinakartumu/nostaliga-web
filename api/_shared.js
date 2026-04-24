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

// --- CORS ---------------------------------------------------------------

export function applyCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
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

// --- Upstream HTTP helpers ---------------------------------------------

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
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const data = await response.json();
  return { status: response.status, data };
}
