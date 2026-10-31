// Turns the posts into static HTML, so that shared links get their own title and
// preview and the text is there without JavaScript. Runs on the build side only.
import { renderToString } from "react-dom/server";
import { NewsIndex, NewsPost } from "../components/NewsPages";
import { postPath } from "./format";
import { loadPosts } from "./posts";

const ORIGIN = "https://typer.hayasaku.fr";

function Head({ path, title, description, image, date }: { path: string; title: string; description: string; image?: string; date?: string }) {
  const url = ORIGIN + path;
  const picture = new URL(image ?? "/og.png", ORIGIN).href;
  return (
    <>
      <title>{`${title} · TypeR`}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content={date ? "article" : "website"} />
      <meta property="og:site_name" content="TypeR" />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={picture} />
      {date && <meta property="article:published_time" content={date} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={picture} />
    </>
  );
}

export type NewsPage = { path: string; date?: string; html: (template: string) => string };

const fill = (template: string, head: JSX.Element, page: JSX.Element) =>
  template.replace("<!--news-head-->", () => renderToString(head)).replace("<!--news-page-->", () => renderToString(page));

export function newsPages(): NewsPage[] {
  const posts = loadPosts();
  return [
    {
      path: "/news/",
      html: (template) =>
        fill(template, <Head path="/news/" title="News" description="TypeR's updates and their detailed changelogs." />, <NewsIndex posts={posts} />),
    },
    ...posts.map((post, i) => ({
      path: postPath(post.slug),
      date: post.date,
      html: (template: string) =>
        fill(
          template,
          <Head path={postPath(post.slug)} title={post.title} description={post.summary} image={post.cover} date={post.date} />,
          <NewsPost post={post} newer={posts[i - 1]} older={posts[i + 1]} />,
        ),
    })),
  ];
}

export function renderNewsPage(template: string, path: string) {
  return newsPages().find((page) => page.path === path)?.html(template);
}
