import {
  applyCors,
  requireAppProxyAuth,
  requireTmdbConfig,
  tmdbEpisodeStill,
} from "../_shared.js";

// GET /api/tmdb/still?id={showTmdbId}&season={n}&episode={m}
//
// Resolve-only TMDB proxy (NOS-94) for a single episode still. Returns the
// absolute image.tmdb.org URL (or "none"). See api/tmdb/artwork.js.
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

  const id = String(req.query.id || "");
  const season = String(req.query.season || "");
  const episode = String(req.query.episode || "");
  if (![id, season, episode].every((value) => /^\d+$/.test(value))) {
    res.status(400).json({ error: "id, season, and episode must be numeric" });
    return;
  }

  try {
    const { status, data } = await tmdbEpisodeStill(id, season, episode);
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
