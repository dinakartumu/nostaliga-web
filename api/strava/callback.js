// GET /api/strava/callback — OAuth trampoline.
// Strava redirects here with ?code=…&state=<deeplink>. The handler bounces
// back to the deep link (e.g., nostaliga://strava?code=…) so
// ASWebAuthenticationSession can intercept it.

// Only ever bounce back into the app. `state` is attacker-controllable — it
// rides in on the query string — so redirecting to it unchecked turns this
// into an open redirect, and one that carries the authorization code along
// with it.
const ALLOWED_SCHEME = "nostaliga://";

export default function handler(req, res) {
  const { code, state, scope, error } = req.query;

  if (!state) {
    res.status(400).send("Missing state parameter.");
    return;
  }

  if (!String(state).startsWith(ALLOWED_SCHEME)) {
    res.status(400).send("Invalid state parameter.");
    return;
  }

  const separator = String(state).includes("?") ? "&" : "?";
  const params = new URLSearchParams();
  if (code) params.set("code", String(code));
  if (scope) params.set("scope", String(scope));
  if (error) params.set("error", String(error));

  const deepLink = `${state}${separator}${params.toString()}`;
  res.redirect(302, deepLink);
}
