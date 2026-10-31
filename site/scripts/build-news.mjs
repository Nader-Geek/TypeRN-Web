// Writes the news pages into dist/ from the template Vite built, and adds them
// to the sitemap. Runs after `vite build`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const site = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(site, "dist");
const ORIGIN = "https://typer.hayasaku.fr";

const vite = await createServer({
  root: site,
  appType: "custom",
  logLevel: "warn",
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true },
});

try {
  const { newsPages } = await vite.ssrLoadModule("/src/news/render.tsx");
  const pages = newsPages();
  const template = fs.readFileSync(path.join(dist, "news", "index.html"), "utf8");
  for (const page of pages) {
    const dir = path.join(dist, page.path);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), page.html(template));
  }

  const urls = pages.map((page) => `  <url><loc>${ORIGIN}${page.path}</loc>${page.date ? `<lastmod>${page.date}</lastmod>` : ""}</url>`);
  const sitemap = path.join(dist, "sitemap.xml");
  fs.writeFileSync(sitemap, fs.readFileSync(sitemap, "utf8").replace("</urlset>", `${urls.join("\n")}\n</urlset>`));
  console.log(`Wrote ${pages.length} news pages`);
} finally {
  await vite.close();
}
