import {
  applyCors,
  config,
  encrypt,
  readBody,
  requireSpotifyConfig,
  spotifyRequest,
} from "../_shared.js";

// POST /api/spotify/token — authorization_code → { access_token, refresh_token, … }
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
  const code = body.code;
  if (!code) {
    res.status(400).json({ error: "code is required" });
    return;
  }

  try {
    const { status, data } = await spotifyRequest("authorization_code", {
      code,
      redirect_uri: config.spotify.clientCallbackUrl,
    });

    if (data.refresh_token && config.encryptionSecret) {
      data.refresh_token = encrypt(data.refresh_token);
    }

    res.status(status).json(data);
  } catch (err) {
    res.status(400).json({ error: err?.message || String(err) });
  }
}
