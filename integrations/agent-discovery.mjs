// Post-build pass that makes the static site readable by crawlers and agents:
// writes /sitemap.xml and an index.md beside every indexable index.html.
// middleware.js serves the .md copy when a request sends Accept: text/markdown.
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import TurndownService from "turndown";

async function findPages(dir) {
  const pages = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) pages.push(...(await findPages(path)));
    else if (entry.name === "index.html") pages.push(path);
  }
  return pages;
}

function toMarkdown(html, url) {
  const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
  const main = html.match(/<main[^>]*>([\s\S]*)<\/main>/)?.[1] ?? html;
  const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
  turndown.remove(["script", "style", "noscript", "svg", "button", "dialog"]);
  // Links and images resolve against the page so the markdown stands alone.
  turndown.addRule("absoluteLinks", {
    filter: (node) => node.nodeName === "A" && node.getAttribute("href"),
    replacement: (content, node) =>
      content.trim() ? `[${content.trim()}](${new URL(node.getAttribute("href"), url)})` : "",
  });
  turndown.addRule("absoluteImages", {
    filter: "img",
    replacement: (_, node) => {
      const alt = node.getAttribute("alt");
      return alt ? `![${alt}](${new URL(node.getAttribute("src"), url)})` : "";
    },
  });
  const body = turndown.turndown(main).replace(/\n{3,}/g, "\n\n").trim();
  return `---\ntitle: ${JSON.stringify(decode(title))}\nurl: ${url}\n---\n\n${body}\n`;
}

function decode(text) {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export default function agentDiscovery() {
  let site;
  return {
    name: "agent-discovery",
    hooks: {
      "astro:config:done": ({ config }) => {
        site = config.site;
      },
      "astro:build:done": async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const urls = [];
        for (const file of await findPages(root)) {
          const html = await readFile(file, "utf8");
          if (/<meta name="robots" content="[^"]*noindex/.test(html)) continue;
          const route = relative(root, file).split(sep).slice(0, -1).join("/");
          const url = new URL(route, new URL("/", site)).href;
          urls.push(url);
          await writeFile(file.replace(/\.html$/, ".md"), toMarkdown(html, url));
        }
        urls.sort();
        const entries = urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n");
        await writeFile(
          join(root, "sitemap.xml"),
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>\n`,
        );
        logger.info(`sitemap.xml and markdown copies written for ${urls.length} pages`);
      },
    },
  };
}
