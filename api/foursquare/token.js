import {
  applyCors,
  foursquareRequest,
  readBody,
  requireFoursquareConfig,
} from "../_shared.js";

// POST /api/foursquare/token — authorization_code → { access_token }.
// Foursquare v2 has no PKCE option, so this proxy is the only way to keep the
// client secret off the device. There is no refresh grant: Foursquare access
// tokens do not expire.
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

  if (!requireFoursquareConfig(res)) return;

  const body = readBody(req);
  const code = body.code;
  if (!code) {
    res.status(400).json({ error: "code is required" });
    return;
  }

  // Older builds omit state. New builds bind authorization to a nonce in
  // redirect_uri; only accept a UUID, never a client-supplied redirect URL.
  const state = body.state;
  if (state !== undefined && (typeof state !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(state))) {
    res.status(400).json({ error: "invalid state" });
    return;
  }

  try {
    const { status, data } = await foursquareRequest(code, state);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
}
