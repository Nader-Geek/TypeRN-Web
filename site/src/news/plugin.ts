import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";
import { NEWS_DIR, loadPosts } from "./posts";

const VIRTUAL = "virtual:news";
const RESOLVED = `\0${VIRTUAL}`;

// Gives the home page the list of posts without their text, and serves the
// news pages in the dev server. scripts/build-news.mjs writes them for the build.
export function news(): Plugin {
  return {
    name: "typer-news",
    resolveId: (id) => (id === VIRTUAL ? RESOLVED : undefined),
    load(id) {
      if (id !== RESOLVED) return;
      const list = loadPosts().map(({ slug, title, date, summary, version }) => ({ slug, title, date, summary, version }));
      return `export default ${JSON.stringify(list)};`;
    },
    configureServer(server) {
      const reload = (file: string) => {
        if (!path.resolve(file).startsWith(NEWS_DIR)) return;
        const list = server.moduleGraph.getModuleById(RESOLVED);
        if (list) server.moduleGraph.invalidateModule(list);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", reload).on("change", reload).on("unlink", reload);

      server.middlewares.use(async (req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        if (!/^\/news(\/|$)/.test(url)) return next();
        try {
          const { renderNewsPage } = await server.ssrLoadModule("/src/news/render.tsx");
          const pathname = url.endsWith("/") ? url : `${url}/`;
          const template = fs.readFileSync(path.join(server.config.root, "news/index.html"), "utf8");
          const html = renderNewsPage(await server.transformIndexHtml(pathname, template), pathname);
          if (!html) return next();
          res.setHeader("Content-Type", "text/html");
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
    },
  };
}
