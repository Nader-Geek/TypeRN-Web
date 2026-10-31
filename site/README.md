# TypeR 3.0 site

The one-page site of TypeR 3.0 (direction B, "Panel Break"), built with Vite, React and TypeScript into a static
bundle for typer.hayasaku.fr.

```sh
npm install
npm run dev        # http://localhost:5173, with hot reload
npm run build      # type-checks, builds to dist/ and copies it to the repository's root
npm run preview    # serves the repository's root on http://localhost:4173, with /web/
npm test           # Playwright, on the production build, in your installed Google Chrome
```

GitHub Pages publishes the root of `main`, so **commit what `npm run build` writes to the root**: `index.html`,
`404.html`, `news/`, `assets/site/`, `assets/fonts/`, `images/`, `videos/`, `favicon.svg`, `og.png`, `robots.txt` and `sitemap.xml`. Edit the
sources here, never those copies. `npm run dev` doesn't serve `/web/`; `npm run preview` does. Its warning about `outDir` is harmless: preview writes nothing.

```
index.html               the page shell: SEO, Open Graph and Twitter tags, favicon, font preloads
404.html                 the not-found page (a second Vite entry)
src/App.tsx              the sections in order
content/news/            the news posts, one Markdown file each
src/components/          Nav, Hero, Trailer, Story (What's new), Toolkit, Install, Help, News, NewsPages, Footer
src/news/                reads the posts and renders the news pages
src/data/content.ts      links, install commands, nav, story steps, toolkit (with the "New" flags), FAQ
src/hooks/               the scroll loop: nav state, hero tilt, story steps, scroll spy
src/styles/site.css      tokens at the top (:root), then one block per section
public/                  copied as-is: fonts, images, the story clips, og.png, robots.txt, sitemap.xml
scripts/                 build-news.mjs writes the news pages; publish.mjs copies the build to the root; `node scripts/make-og.mjs` renders public/og.png; make-clips.sh cuts the story clips; make-trailer.sh compresses the trailer
tests/                   Playwright: the basics
```

## News

Each post is one file in `content/news/`, and its name is its address: `typer-3-1-0.md` becomes `/news/typer-3-1-0/`.
It appears in the feed and, if it is among the three latest, on the home page. Nothing else needs changing. `npm run dev`
shows it at once and reloads as you edit.

```md
---
title: TypeR 3.1
date: 2026-12-01
version: 3.1.0
summary: The sentence shown in the feed and in link previews on Discord and elsewhere.
cover: /images/news/3-1.webp
---

## New features

- A list item, with **bold**, `code` and [links](https://typer.hayasaku.fr/).

![What it does](/images/news/3-1-panel.jpg "An optional caption")

![A clip that loops like a GIF](/videos/news/3-1.mp4 "It plays when on screen")

![Side by side](/images/news/a.jpg "Images on consecutive lines")
![Side by side](/images/news/b.jpg "share the row")
```

- `title`, `date` and `summary` are required, and the build stops if one is missing. Posts are sorted by date.
- `version` labels the post "Update"; without it, "News". `cover` is optional: an image above the text, and the link preview.
- Use `##` for sections and `###` below them. With two `##` or more, the post gets an "On this page" outline.
- Put images in `public/images/news/` and clips in `public/videos/news/`. A clip needs a poster with the same name, in `.jpg`. It stays an `.mp4` rather than a real GIF, at a tenth of the weight.
- `scripts/film-news.mjs` films clips on the web version with a visible cursor. `scripts/make-clips.sh` cuts them from the Photoshop recordings.
- The older posts come from the GitHub release notes. The 3.0 post is rewritten from the CHANGELOG of the TypeR repository and the commits since 2.5, which the CHANGELOG doesn't all list.

## Content

- **Install.** One command per system, `get.sh` and `get.ps1` of the TypeR repository's `master` branch (`INSTALL` in
  `src/data/content.ts`). They download the latest release and start its installer, which asks for the new TypeR (UXP)
  or Legacy (CEP).
- **Download.** One link for both editions: `TypeR.zip` from the latest release (`LINKS.download`).
- **Web version.** The Vite build doesn't touch `web/`, the Web version at `/web/`. It lives at the repository's root
  and shares `assets/fonts/` with the site.
- **"New" badges.** They come from the 3.0 CHANGELOG of develop and the panel's What's new tour. The story steps all carry one, and toolkit entries
  get one with `isNew: true`.
- **Story clips.** `public/videos/` holds one clip and poster per story step, cut from the trailer recordings with
  `zsh scripts/make-clips.sh "<recordings folder>"`. Keep file dialogs, the menu bar and the Dock out of the cuts.
- **Trailer.** `public/videos/trailer-av1.mp4`, `trailer.mp4` (H.264, for the browsers without AV1) and the poster come
  from the final render, with `zsh scripts/make-trailer.sh "<trailer render>" "<first frame image>"`. Keep each file under 50 MB, where GitHub starts warning.
  Seeking needs a server that honours byte ranges: `npm run preview` and GitHub Pages do, Python's `http.server` doesn't.
- **Accent colour.** Change `--accent`, `--accent-hi` and `--accent-ink` in `:root`.
- **Dela Gothic One** only contains the Japanese glyphs used on the page. To add kana or kanji, re-subset it from
  `@fontsource/dela-gothic-one` with `pyftsubset`.

## Lettering fonts

The page no longer letters text itself: the story shows recordings. `public/assets/fonts/` still holds Latin subsets of
CC Wild Words Roman (Comicraft) and Fight to the Finish BB (Blambot), both commercial and unused by the site. **Delete
them from there and from the repository's `assets/fonts/` before the site goes public, unless their web-embedding
licences are covered.**

