import {
  applyCors,
  decryptRefreshToken,
  encryptRefreshTokenInPlace,
  readBody,
  requireTraktConfig,
  traktRequest,
} from "../_shared.js";

// POST /api/trakt/token — handles both authorization_code and refresh_token
// grants. The iOS app sends JSON like { grant_type, code } or
// { grant_type, refresh_token }; the server injects the client secret and
// redirect_uri and forwards to Trakt.
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

  if (!requireTraktConfig(res)) return;

  const body = readBody(req);
  const grantType = body.grant_type;

  try {
    if (grantType === "authorization_code") {
      const code = body.code;
      if (!code) {
        res.status(400).json({ error: "code is required" });
        return;
      }
      const { status, data } = await traktRequest("authorization_code", {
        code,
      });
      res.status(status).json(encryptRefreshTokenInPlace(data));
      return;
    }

    if (grantType === "refresh_token") {
      const refreshToken = body.refresh_token;
      if (!refreshToken) {
        res.status(400).json({ error: "refresh_token is required" });
        return;
      }
      const { status, data } = await traktRequest("refresh_token", {
        refresh_token: decryptRefreshToken(refreshToken),
      });
      res.status(status).json(encryptRefreshTokenInPlace(data));
      return;
    }

    res.status(400).json({ error: `unsupported grant_type: ${grantType}` });
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
}
