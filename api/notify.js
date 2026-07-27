import { readBody } from "./_shared.js";

// POST /api/notify — { email } → adds someone to the launch notify list.
//
// Unlike the other routes here, this one is called by a BROWSER (the notify
// form on the marketing site), not by the iOS app. It is same-origin — the
// form posts to the relative path "/api/notify" — so it deliberately emits no
// CORS headers, matching `applyCors`'s stance for the native routes: there is
// no legitimate cross-origin caller.
//
// There is no database in this project (every other route is a stateless
// proxy), so a signup is delivered as an email via Resend rather than stored.
// At pre-launch volume that is the whole feature; if the list ever needs
// management (segments, unsubscribe, export), move to a real provider.

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const USER_AGENT = "Nostaliga/1.0 (+https://www.nostaliga.app)";

// Deliberately permissive: the goal is to reject obvious typos and junk, not to
// adjudicate RFC 5322. Anything that looks like a@b.c passes.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_TO_EMAIL;
  if (!apiKey || !to) {
    res.status(500).json({ error: "Notify is not configured on the server." });
    return;
  }

  const body = readBody(req);
  const email = String(body.email || "").trim();

  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    res.status(400).json({ error: "Enter a valid email address." });
    return;
  }

  // Honeypot: a hidden field real users never fill. Bots that blindly complete
  // every input get a 200 so they don't retry, but nothing is sent.
  if (body.company) {
    res.status(200).json({ ok: true });
    return;
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": USER_AGENT,
      },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM_EMAIL || "Nostaliga <onboarding@resend.dev>",
        to: [to],
        reply_to: email,
        subject: `Nostaliga notify: ${email}`,
        text: `${email} asked to be notified when Nostaliga launches.`,
      }),
    });

    if (!response.ok) {
      // Don't leak provider detail to the browser; log it for the Vercel logs.
      const detail = await response.text();
      console.error("resend failed", response.status, detail);
      res.status(502).json({ error: "Could not save that right now." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error("notify error", err);
    res.status(500).json({ error: "Could not save that right now." });
  }
}
