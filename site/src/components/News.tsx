import posts from "virtual:news";
import { PostList } from "./NewsPages";
import { LINKS } from "../data/content";

export default function News() {
  return (
    <section className="news" id="news" aria-labelledby="news-title">
      <div className="wrap help__grid">
        <div>
          <h2 className="h2" id="news-title">
            News
          </h2>
          <p className="sub">Every update, in detail.</p>
          <a className="btn btn--line btn--sm news__all" href={LINKS.news}>
            All news
          </a>
        </div>
        <PostList posts={posts.slice(0, 3)} />
      </div>
    </section>
  );
}
