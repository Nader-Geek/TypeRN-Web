import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { news } from "./src/news/plugin";

// GitHub Pages serves the repository's root, next to web/. The build goes to
// dist/, then scripts/publish.mjs copies it to the root. Its own files stay in
// assets/site, apart from the assets of the web version.
export default defineConfig({
  plugins: [react(), news()],
  base: "/",
  build: {
    outDir: "dist",
    assetsDir: "assets/site",
    assetsInlineLimit: 2048,
    rollupOptions: {
      input: {
        main: "index.html",
        notFound: "404.html",
        news: "news/index.html",
      },
    },
  },
});
