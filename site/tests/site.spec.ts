import { expect, test, type Page } from "@playwright/test";

const DOWNLOAD = "https://github.com/ScanR/TypeR/releases/latest/download/TypeR.zip";

const collectErrors = (page: Page) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`[console] ${msg.text()}`);
  });
  page.on("pageerror", (error) => errors.push(`[pageerror] ${error.message}`));
  return errors;
};

const scrollThrough = async (page: Page) => {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < height; y += 600) {
    await page.evaluate((top) => window.scrollTo({ top, behavior: "instant" }), y);
    await page.waitForTimeout(120);
  }
};

for (const width of [375, 1440]) {
  test(`no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await scrollThrough(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("no console errors", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await scrollThrough(page);
  expect(errors).toEqual([]);
});

test("the web version replaces the demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#demo")).toHaveCount(0);
  await expect(page.getByText("Your turn")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Try it on a page" })).toHaveCount(0);
  await expect(page.locator("#nav-links").getByRole("link", { name: "Web version" })).toHaveAttribute("href", "/web/");

  await page.locator(".hero__cta").getByRole("link", { name: "Online web version" }).click();
  await expect(page).toHaveURL(/\/web\/$/);
  await expect(page.locator(".mbar__logo")).toBeVisible();
});

test("the web version doesn't take the former site's i18n.js from the cache", async ({ page }) => {
  await page.route(/\/i18n\.js$/, (route) => route.fulfill({ contentType: "text/javascript", body: "// the former site's file" }));
  await page.goto("/web/");
  await expect(page.locator("#menus button").first()).toBeVisible();
  await expect(page.locator("#tools button").first()).toBeVisible();
});

test("the tour is gone from the story", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".step")).toHaveCount(5);
  await expect(page.getByText("Learn it by doing it")).toHaveCount(0);
  await expect(page.locator(".ring, .guide")).toHaveCount(0);
});

test("the trailer loads nothing until it is played, with sound", async ({ page }) => {
  await page.goto("/");
  const video = page.locator(".trailer video");
  await expect(page.locator("main > section").nth(1)).toHaveId("trailer");
  await expect(video).toHaveAttribute("preload", "none");
  expect(await video.evaluate((v: HTMLVideoElement) => [v.readyState, v.controls])).toEqual([0, false]);

  await page.getByRole("button", { name: "Play the trailer" }).click();
  await expect(page.getByRole("button", { name: "Play the trailer" })).toHaveCount(0);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.2);
  expect(await video.evaluate((v: HTMLVideoElement) => [v.controls, v.muted, v.duration > 100])).toEqual([false, false, true]);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(/\/videos\/trailer-av1\.mp4$/);
});

test("the trailer's player goes where it is asked, and stays there", async ({ page }) => {
  await page.goto("/");
  const video = page.locator(".trailer video");
  const now = () => video.evaluate((v: HTMLVideoElement) => v.currentTime);
  await page.getByRole("button", { name: "Play the trailer" }).click();
  await expect.poll(now).toBeGreaterThan(0.2);

  // A click far ahead of what has loaded, then back
  const seek = page.getByRole("slider", { name: "Seek" });
  const { width, height } = (await seek.boundingBox())!;
  await seek.click({ position: { x: width * 0.75, y: height / 2 } });
  await page.waitForTimeout(1500);
  expect(await now()).toBeGreaterThan(75);
  await seek.click({ position: { x: width * 0.25, y: height / 2 } });
  await page.waitForTimeout(1500);
  const back = await now();
  expect(back).toBeGreaterThan(25);
  expect(back).toBeLessThan(35);
  await expect(page.locator(".player__time")).toContainText("/ 1:47");

  // The keyboard
  await page.keyboard.press("ArrowRight");
  expect(await now()).toBeGreaterThan(back + 4);
  await page.keyboard.press("m");
  expect(await video.evaluate((v: HTMLVideoElement) => v.muted)).toBe(true);
  await expect(page.getByRole("button", { name: "Unmute" })).toBeVisible();
  await page.getByRole("button", { name: "Pause" }).click();
  await expect(page.getByRole("button", { name: "Play", exact: true })).toBeVisible();
  expect(await video.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);

  // The controls leave while it plays, and come back
  await page.getByRole("button", { name: "Play", exact: true }).click();
  await page.waitForTimeout(3000);
  await expect(page.locator(".player")).toBeHidden();
  await page.locator(".trailer video").hover({ position: { x: 40, y: 40 } });
  await expect(page.locator(".player")).toBeVisible();
});

test("the trailer has an H.264 fallback that plays", async ({ page }) => {
  await page.goto("/");
  const video = page.locator(".trailer video");
  await video.evaluate((v: HTMLVideoElement) => {
    v.querySelector("source")?.remove();
    v.load();
  });
  await page.getByRole("button", { name: "Play the trailer" }).click();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.2);
  expect(await video.evaluate((v: HTMLVideoElement) => v.currentSrc)).toMatch(/\/videos\/trailer\.mp4$/);
});

test("the story plays the clip of the current step", async ({ page }) => {
  await page.goto("/");
  await page.locator(".step").nth(2).scrollIntoViewIfNeeded();
  const clip = page.locator(".reel__clip.is-on");
  await expect(clip).toHaveAttribute("src", "/videos/textshaper.mp4");
  await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.2);
  const paused = await page.locator(".reel__clip:not(.is-on)").evaluateAll((all: HTMLVideoElement[]) => all.every((v) => v.paused));
  expect(paused).toBe(true);
});

test("install: the command of each system, then the installers", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const install = page.locator("#install");

  await install.getByRole("tab", { name: "Windows" }).click();
  await expect(install.locator(".setup pre")).toHaveText("irm https://raw.githubusercontent.com/ScanR/TypeR/master/get.ps1 | iex");
  await expect(install.locator(".setup")).toContainText("PowerShell");
  await expect(install.locator(".dl")).toContainText("install_win.cmd");
  await expect(install.locator(".rosetta")).toHaveCount(0);

  await install.getByRole("tab", { name: "macOS" }).click();
  await expect(install.locator(".rosetta")).toContainText("Open using Rosetta");
  await expect(install.locator(".rosetta")).toContainText("Activity Monitor");
  await expect(install.locator(".setup pre")).toHaveText("curl -fsSL https://raw.githubusercontent.com/ScanR/TypeR/master/get.sh | bash");
  await expect(install.locator(".setup")).toContainText("Terminal");
  await expect(install.locator(".dl")).toContainText("install_mac.command");

  await install.getByRole("button", { name: "Copy" }).click();
  await expect(install.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("get.sh | bash");

  await expect(install.getByRole("link", { name: "Online web version" })).toHaveAttribute("href", "/web/");
});

test("one download, socials in the nav", async ({ page }) => {
  await page.goto("/");
  const hrefs = await page.locator('#install a:has-text("Download")').evaluateAll((links) => links.map((a) => (a as HTMLAnchorElement).href));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of hrefs) expect(href).toBe(DOWNLOAD);
  await expect(page.locator('a[href$=".ccx"]')).toHaveCount(0);

  for (const button of [page.locator(".nav__cta"), page.locator(".hero__cta").getByRole("link", { name: "Download" })]) {
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await button.click();
    await expect(page).toHaveURL(/#install$/);
    await expect(page.locator("#install-title")).toBeInViewport();
  }

  const nav = page.locator("#nav .nav__right");
  for (const label of ["GitHub", "Support TypeR on Ko-fi", "Discord"]) {
    await expect(nav.getByRole("link", { name: label })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "Download" })).toBeVisible();
});

test("new in 3.0 badges", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".step .badge")).toHaveCount(5);
  for (const tool of ["Font FindeR", "Contextual alternates", "Conditional refont", "Right-to-left"]) {
    await expect(page.locator(".tools dt", { hasText: tool }).locator(".badge")).toHaveText("New");
  }
});

test.describe("news", () => {
  const POST = "/news/typer-3-0-0/";

  test("the home page leads to the news", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#news .postlist li")).toHaveCount(3);
    await expect(page.locator(".hero__version a")).toHaveAttribute("href", POST);
    await page.locator("#nav-links").getByRole("link", { name: "News" }).click();
    await expect(page).toHaveURL(/\/news\/$/);
    await expect(page.getByRole("heading", { level: 1, name: "News" })).toBeVisible();
  });

  test("the feed lists the posts, newest first", async ({ page }) => {
    await page.goto("/news/");
    await expect(page.locator(".lead-post__title")).toHaveText("TypeR 3.0");
    await expect(page.locator(".postlist__title").first()).toHaveText("TypeR 2.5");
    await expect(page.locator(".postlist__title").last()).toHaveText("TypeR 0.5 beta");
    await page.locator(".lead-post").click();
    await expect(page).toHaveURL(new RegExp(`${POST}$`));
  });

  test("a post is static HTML with its own preview", async ({ request }) => {
    const html = await (await request.get(POST)).text();
    expect(html).toContain("<title>TypeR 3.0 · TypeR</title>");
    expect(html).toContain('property="og:title" content="TypeR 3.0"');
    expect(html).toContain("Native in Photoshop 2025 and later");
    expect(html).toContain('<details><summary>Smart paste</summary>');
    expect(html).not.toContain("Validation limits");
    expect(html).not.toContain("news-head");
    expect(html).not.toContain("news-page");
  });

  test("a post's nav, outline and links work", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto(POST);
    await expect(page.locator(".nav__cta")).toHaveAttribute("href", "/#install");
    await expect(page.locator("#nav-links").getByRole("link", { name: "News" })).toHaveAttribute("aria-current", "page");

    await page.locator(".toc").getByRole("link", { name: "Shortcuts" }).click();
    await expect(page.locator("#shortcuts")).toBeInViewport();
    await expect(page.locator(".toc").getByRole("link", { name: "Shortcuts" })).toHaveAttribute("aria-current", "true");
    await expect(page.locator("#nav")).toHaveClass(/is-stuck/);

    await expect(page.locator(".pager__older")).toContainText("TypeR 2.5");
    await expect(page.locator(".pager__newer")).toHaveCount(0);

    await page.setViewportSize({ width: 375, height: 800 });
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("button", { name: "Close menu" })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("the clips loop like GIFs on screen, and open bigger", async ({ page, request }) => {
    const errors = collectErrors(page);
    await page.goto(POST);
    const clip = page.locator('.prose video[src="/videos/click-paste.mp4"]');
    await expect(clip).not.toHaveAttribute("controls");
    await clip.scrollIntoViewIfNeeded();
    await expect.poll(() => clip.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThan(0.2);

    const sources = await page.locator(".prose video, .prose img").evaluateAll((all) => all.flatMap((el) => [el.getAttribute("src"), el.getAttribute("poster")]).filter(Boolean));
    expect(sources.length).toBeGreaterThan(20);
    for (const src of sources) expect((await request.get(src!)).status(), src!).toBe(200);
    expect(await page.locator(".prose video:not([width]), .prose img:not([width])").count()).toBe(0);

    await clip.click();
    const box = page.locator("dialog.lightbox");
    await expect(box.locator("video")).toHaveAttribute("src", "/videos/click-paste.mp4");
    await box.getByRole("button", { name: "Close" }).click();
    await expect(box).not.toBeVisible();
    expect(errors).toEqual([]);
  });

  test("a post's own links lead somewhere", async ({ page }) => {
    await page.goto(POST);
    const anchors = await page.locator('.prose a[href^="#"]').evaluateAll((links) => links.map((a) => a.getAttribute("href")!.slice(1)));
    expect(anchors.length).toBeGreaterThan(5);
    for (const id of anchors) expect(await page.locator(`[id="${id}"]`).count(), id).toBe(1);
  });

  test("with reduced motion the clips wait, with their controls", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(POST);
    const clip = page.locator(".prose video").first();
    await clip.scrollIntoViewIfNeeded();
    await expect(clip).toHaveAttribute("controls", "");
    expect(await clip.evaluate((v: HTMLVideoElement) => v.paused)).toBe(true);
  });

  test("a section link from a post lands on its section", async ({ page }) => {
    await page.goto(POST);
    await page.locator(".nav__cta").click();
    await expect(page).toHaveURL(/\/#install$/);
    await expect(page.locator("#install-title")).toBeInViewport();
  });

  test("the sitemap has every post", async ({ request }) => {
    const xml = await (await request.get("/sitemap.xml")).text();
    expect(xml).toContain("<loc>https://typer.hayasaku.fr/news/</loc>");
    expect(xml).toContain(`<loc>https://typer.hayasaku.fr${POST}</loc>`);
  });

  for (const width of [375, 920, 1440]) {
    test(`no horizontal overflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const url of ["/", "/news/", POST]) {
        await page.goto(url);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, url).toBeLessThanOrEqual(0);
      }
    });
  }
});

test("the 404 page", async ({ page }) => {
  await page.goto("/404.html");
  await expect(page.getByRole("heading", { name: "This bubble is empty" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Back to TypeR" })).toHaveAttribute("href", "/");
});

test("keyboard: skip link", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();

});

test("reduced motion: still loads and works", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  const duration = await page.locator(".hero__line").first().evaluate((el) => getComputedStyle(el).animationDuration);
  expect(parseFloat(duration)).toBeLessThan(0.01);
});

test.describe("on Windows", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, "platform", { get: () => "Win32" }));
  });

  test("the motion stays on with animation effects turned off", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const duration = await page.locator(".hero__line").first().evaluate((el) => getComputedStyle(el).animationDuration);
    expect(parseFloat(duration)).toBeCloseTo(0.9);
    await expect(page.locator("html")).toHaveClass(/motion/);
  });

  test("the wheel glides to where it asked to go", async ({ page }) => {
    await page.goto("/");
    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, 600);
    const seen = new Set<number>();
    await expect
      .poll(async () => {
        const y = await page.evaluate(() => scrollY);
        seen.add(y);
        return y;
      })
      .toBe(600);
    expect(Array.from(seen).some((y) => y > 0 && y < 600)).toBe(true);
  });

  test("the wheel stops at the end of the page", async ({ page }) => {
    await page.goto("/");
    await page.mouse.move(700, 450);
    const end = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    await page.mouse.wheel(0, end + 5000);
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThanOrEqual(end - 1);
  });

  test("a link isn't held back by the glide", async ({ page }) => {
    await page.goto("/");
    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, 300);
    await page.getByRole("link", { name: "Help" }).first().click();
    await expect(page.locator("#help")).toBeInViewport();
  });
});

test("a Mac's wheel is left to the system", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "platform", { get: () => "MacIntel" }));
  await page.goto("/");
  const prevented = page.evaluate(
    () => new Promise((resolve) => addEventListener("wheel", (e) => setTimeout(() => resolve(e.defaultPrevented)), { once: true })),
  );
  await page.mouse.move(700, 450);
  await page.mouse.wheel(0, 100);
  expect(await prevented).toBe(false);
});
