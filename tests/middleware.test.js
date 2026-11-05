import test from "node:test";
import assert from "node:assert/strict";
import middleware, { config } from "../middleware.js";

test("Accept: text/markdown is answered with the page's index.md copy", async () => {
  const originalFetch = globalThis.fetch;
  const fetched = [];
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    return new Response("# FAQ\n", { status: 200 });
  };
  try {
    const markdown = await middleware(
      new Request("https://nostaliga.app/faq", { headers: { accept: "text/markdown, text/html;q=0.5" } }),
    );
    assert.deepEqual(fetched, ["https://nostaliga.app/faq/index.md"]);
    assert.equal(markdown.headers.get("content-type"), "text/markdown; charset=utf-8");
    assert.equal(markdown.headers.get("vary"), "Accept");
    assert.equal(markdown.headers.get("x-markdown-tokens"), "2");
    assert.equal(await markdown.text(), "# FAQ\n");

    await middleware(new Request("https://nostaliga.app/", { headers: { accept: "text/markdown" } }));
    assert.equal(fetched[1], "https://nostaliga.app/index.md");

    const html = await middleware(new Request("https://nostaliga.app/faq", { headers: { accept: "text/html" } }));
    assert.equal(html.headers.get("x-middleware-next"), "1");
    assert.equal(fetched.length, 2);
  } finally { globalThis.fetch = originalFetch; }
});

test("a page without a markdown copy falls through to HTML", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("missing", { status: 404 });
  try {
    const response = await middleware(new Request("https://nostaliga.app/review", { headers: { accept: "text/markdown" } }));
    assert.equal(response.headers.get("x-middleware-next"), "1");
  } finally { globalThis.fetch = originalFetch; }
});

test("the matcher skips API routes and static files", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);
  for (const path of ["/", "/faq", "/import/spotify"]) assert.ok(matcher.test(path), path);
  for (const path of ["/api/strava/token", "/oauth/strava/callback", "/robots.txt", "/faq/index.md", "/_astro/a.css"]) {
    assert.ok(!matcher.test(path), path);
  }
});
