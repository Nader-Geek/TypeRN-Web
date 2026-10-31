// "2026-10-31" to "October 31, 2026", the same on the server and in any browser
export const formatDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" });

export const postPath = (slug: string) => `/news/${slug}/`;
