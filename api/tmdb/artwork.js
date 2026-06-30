import {
  applyCors,
  requireAppProxyAuth,
  requireTmdbConfig,
  tmdbBaseArtwork,
} from "../_shared.js";

// GET /api/tmdb/artwork?type=movie|tv|episode&id={tmdbId}
//
// Resolve-only TMDB proxy (NOS-94): resolves a title's poster + backdrop with
// the TMDB token held server-side and returns absolute image.tmdb.org URLs (or
// the "none" sentinel). The iOS client loads the bytes directly from the CDN
// and caches the URL, so each title is resolved ~once. Cached at the edge since
// TMDB metadata is stable.
export default async function handler(req, res) {
  applyCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "method not allowed" });
    return;
  }

  if (!requireAppProxyAuth(req, res)) return;
  if (!requireTmdbConfig(res)) return;

  const type = String(req.query.type || "");
  const id = String(req.query.id || "");
  if (!["movie", "tv", "episode"].includes(type)) {
    res.status(400).json({ error: "type must be movie, tv, or episode" });
    return;
  }
  if (!/^\d+$/.test(id)) {
    res.status(400).json({ error: "id must be a numeric TMDB id" });
    return;
  }

  try {
    const { status, data } = await tmdbBaseArtwork(type, id);
    if (status === 200) {
      res.setHeader(
        "Cache-Control",
        "public, s-maxage=604800, stale-while-revalidate=86400",
      );
    }
    res.status(status).json(data);
  } catch (err) {
    res.status(500).json({ error: err?.message || String(err) });
  }
}
