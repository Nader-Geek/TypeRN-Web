/// <reference types="vite/client" />

declare module "virtual:news" {
  const posts: { slug: string; title: string; date: string; summary: string; version?: string }[];
  export default posts;
}
