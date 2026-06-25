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

  try {
    const { status, data } = await foursquareRequest(code);
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
}
