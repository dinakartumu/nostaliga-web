import crypto from "node:crypto";
import { applyCors, config, readBody } from "../_shared.js";

// POST /api/lastfm/session — { token } → Last.fm `auth.getSession` response.
//
// Last.fm signs authenticated calls with api_sig = MD5(sorted key+value pairs +
// shared secret). `auth.getSession` (the token → session-key exchange) is the
// only Last.fm call the app makes that needs signing, so we compute the
// signature here and the shared secret never ships in the app bundle (NOS-99).
// The public api_key still lives on the client for its unsigned read calls.
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

  const { apiKey, sharedSecret } = config.lastfm;
  if (!apiKey || !sharedSecret) {
    res.status(500).json({ error: "Last.fm is not configured on the server." });
    return;
  }

  const body = readBody(req);
  const token = body.token;
  if (!token) {
    res.status(400).json({ error: "token is required" });
    return;
  }

  try {
    // Params that are both signed and sent. Must match the client's previous
    // signing exactly: every param except `format` is signed, keys sorted,
    // concatenated as key+value, then the shared secret appended, MD5 hex.
    const signed = { api_key: apiKey, method: "auth.getSession", token };
    const apiSig = crypto
      .createHash("md5")
      .update(
        Object.keys(signed)
          .sort()
          .map((k) => k + signed[k])
          .join("") + sharedSecret,
        "utf8",
      )
      .digest("hex");

    const query = new URLSearchParams({
      ...signed,
      api_sig: apiSig,
      format: "json",
    });

    const response = await fetch(
      "https://ws.audioscrobbler.com/2.0/?" + query.toString(),
      {
        headers: { "User-Agent": "Nostaliga/1.0 (+https://www.nostaliga.app)" },
      },
    );

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
}
