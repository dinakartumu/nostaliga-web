// Vercel Routing Middleware: when a request prefers Markdown (Accept: text/markdown),
// answer with the index.md copy integrations/agent-discovery.mjs wrote beside the page.
// Everything else falls through to the static HTML untouched.
export const config = {
  matcher: ["/((?!api/|oauth/|_astro/|.*\\.[a-z0-9]+$).*)"],
};

const next = () => new Response(null, { headers: { "x-middleware-next": "1" } });

export default async function middleware(request) {
  const accept = request.headers.get("accept") ?? "";
  if (!/\btext\/markdown\b/i.test(accept)) return next();

  const url = new URL(request.url);
  url.pathname = `${url.pathname.replace(/\/$/, "")}/index.md`;
  const page = await fetch(url);
  if (!page.ok) return next();

  const markdown = await page.text();
  return new Response(markdown, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "vary": "Accept",
      // Rough estimate (~4 characters per token), same idea as Cloudflare's header.
      "x-markdown-tokens": String(Math.ceil(markdown.length / 4)),
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
