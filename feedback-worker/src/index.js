// Takes the feedback sent from TypeR Studio (web/feedback.js) and passes it on to a Discord
// channel. The webhook's address stays here, as a secret (DISCORD_WEBHOOK): in the app's files,
// public, anyone could flood the channel with it or delete it.
//
// Deploy: npx wrangler deploy (in this folder). The webhook: npx wrangler secret put DISCORD_WEBHOOK

const ORIGINS = new Set(["https://typer.hayasaku.fr", "typer://app"]);
const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const MAX_TEXT = 2000;
const MAX_BODY = 8192;

const allowed = (origin) => ORIGINS.has(origin) || LOCAL.test(origin);

const cors = (origin) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
});

const reply = (status, origin, body) => new Response(body ? JSON.stringify(body) : null, {
  status,
  headers: { ...(origin ? cors(origin) : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
});

const clip = (value, length) => (typeof value === "string" ? value.trim().slice(0, length) : "");

// Shown as it was typed: no markdown, no link previews, no mentions
const plain = (text) => text.replace(/([\\`*_~|>#\[\]()-])/g, "\\$1").replace(/@/g, "@\u200b");

const COLORS = [0xe5534b, 0xe5534b, 0xf2a33a, 0xf2d03a, 0x6cc644, 0x288edf];

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (!allowed(origin)) return reply(403);
    if (request.method === "OPTIONS") return reply(204, origin);
    if (request.method !== "POST") return reply(405, origin);

    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (env.LIMIT) {
      const { success } = await env.LIMIT.limit({ key: ip });
      if (!success) return reply(429, origin, { error: "too many" });
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply(413, origin);
    let data;
    try {
      data = JSON.parse(raw);
    } catch (error) {
      return reply(400, origin);
    }
    const rating = Number(data.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return reply(400, origin);
    const text = clip(data.text, MAX_TEXT);
    const app = clip(data.app, 20) || "?";
    const lang = clip(data.lang, 10) || "?";
    const days = Number.isFinite(Number(data.days)) ? Math.max(0, Math.min(9999, Math.round(Number(data.days)))) : null;

    const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
    const details = [app, `lang: ${lang}`, days !== null ? `${days} day${days === 1 ? "" : "s"} of use` : ""].filter(Boolean).join(" · ");
    const embed = {
      title: `${stars}  ${rating}/5`,
      description: text ? plain(text) : "*No comment*",
      color: COLORS[rating],
      footer: { text: details },
      timestamp: new Date().toISOString(),
    };

    if (!env.DISCORD_WEBHOOK) return reply(500, origin, { error: "not set up" });
    const sent = await fetch(env.DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "TypeR Studio feedback", embeds: [embed], allowed_mentions: { parse: [] } }),
    });
    if (!sent.ok) {
      console.warn("Discord refused the feedback", sent.status, await sent.text());
      return reply(502, origin, { error: "not delivered" });
    }
    return reply(204, origin);
  },
};
