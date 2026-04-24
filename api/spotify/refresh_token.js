import {
  applyCors,
  config,
  decrypt,
  readBody,
  requireSpotifyConfig,
  spotifyRequest,
} from "../_shared.js";

// POST /api/spotify/refresh_token — refresh_token → { access_token, … }
export default async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  if (!requireSpotifyConfig(res)) return;

  const body = readBody(req);
  let refreshToken = body.refresh_token;
  if (!refreshToken) {
    res.status(400).json({ error: "refresh_token is required" });
    return;
  }

  // Normalize escaped newlines that some HTTP clients inject.
  refreshToken = String(refreshToken).replace(/\\n/g, "\n");

  if (config.encryptionSecret) {
    try {
      refreshToken = decrypt(refreshToken);
    } catch {
      res.status(400).json({ error: "invalid refresh_token" });
      return;
    }
  }

  try {
    const { status, data } = await spotifyRequest("refresh_token", {
      refresh_token: refreshToken,
    });
    res.status(status).json(data);
  } catch (err) {
    res.status(400).json({ error: err?.message || String(err) });
  }
}
