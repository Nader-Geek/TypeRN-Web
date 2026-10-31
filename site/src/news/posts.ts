// Reads the posts of content/news at build time, and in the dev server. Only
// the build side imports this: the browser gets the "virtual:news" list.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { imageSize } from "image-size";
import { Marked } from "marked";

export const NEWS_DIR = fileURLToPath(new URL("../../content/news/", import.meta.url));
const PUBLIC_DIR = fileURLToPath(new URL("../../public/", import.meta.url));

export type PostMeta = { slug: string; title: string; date: string; summary: string; version?: string; cover?: string };
export type Heading = { id: string; text: string };
export type Post = PostMeta & { html: string; toc: Heading[] };

function parseFrontmatter(file: string, source: string) {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${file}: the post must start with a --- block`);
  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon > 0) fields[line.slice(0, colon).trim()] = line.slice(colon + 1).trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  for (const key of ["title", "date", "summary"]) {
    if (!fields[key]) throw new Error(`${file}: "${key}" is missing`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fields.date)) throw new Error(`${file}: "date" must look like 2026-10-31`);
  return { fields, body: match[2] };
}

const attribute = (text: string) => text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

// So that a picture takes its place before it loads and the outline's links stay right
function sizeOf(publicPath: string) {
  const file = path.join(PUBLIC_DIR, publicPath);
  if (!fs.existsSync(file)) return "";
  const { width, height } = imageSize(fs.readFileSync(file));
  return ` width="${width}" height="${height}"`;
}

// An image, or a clip that loops like a GIF when its address ends in .mp4 (src/news/media.ts
// plays it on screen and takes the controls away). The poster has the same name, in .jpg.
function renderMedia(href: string, alt: string, title?: string | null) {
  const poster = href.replace(/\.mp4$/, ".jpg");
  const media = href.endsWith(".mp4")
    ? `<video src="${href}" poster="${poster}"${sizeOf(poster)} aria-label="${attribute(alt)}" controls muted loop playsinline preload="none"></video>`
    : `<img src="${href}" alt="${attribute(alt)}"${sizeOf(href)} loading="lazy" decoding="async">`;
  return `<figure>${media}${title ? `<figcaption>${title}</figcaption>` : ""}</figure>`;
}

function renderMarkdown(body: string) {
  const toc: Heading[] = [];
  const used = new Map<string, number>();
  const marked = new Marked({
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const inner = this.parser.parseInline(tokens);
        const text = inner.replace(/<[^>]+>/g, "");
        const base = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "section";
        const seen = used.get(base) ?? 0;
        used.set(base, seen + 1);
        const id = seen ? `${base}-${seen + 1}` : base;
        if (depth === 2) toc.push({ id, text });
        return `<h${depth} id="${id}">${inner}</h${depth}>\n`;
      },
      image({ href, text, title }) {
        return renderMedia(href, text, title);
      },
      // Images on consecutive lines sit side by side
      paragraph({ tokens }) {
        const images = tokens.filter((token) => token.type === "image");
        if (!images.length || tokens.some((token) => token.type !== "image" && token.raw.trim())) return false;
        const inner = this.parser.parseInline(images);
        return images.length > 1 ? `<div class="shots shots--${images.length}">${inner}</div>\n` : `${inner}\n`;
      },
    },
  });
  return { html: marked.parse(body, { async: false }), toc };
}

// Newest first
export function loadPosts(): Post[] {
  return fs
    .readdirSync(NEWS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const { fields, body } = parseFrontmatter(file, fs.readFileSync(path.join(NEWS_DIR, file), "utf8"));
      const meta: PostMeta = {
        slug: file.replace(/\.md$/, ""),
        title: fields.title,
        date: fields.date,
        summary: fields.summary,
        version: fields.version,
        cover: fields.cover,
      };
      return { ...meta, ...renderMarkdown(body) };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.slug.localeCompare(a.slug, "en", { numeric: true }));
}
