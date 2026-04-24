// GET /api/strava/callback — OAuth trampoline.
// Strava redirects here with ?code=…&state=<deeplink>. The handler bounces
// back to the deep link (e.g., nostaliga://strava?code=…) so
// ASWebAuthenticationSession can intercept it.
export default function handler(req, res) {
  const { code, state, scope, error } = req.query;

  if (!state) {
    res.status(400).send("Missing state parameter.");
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
