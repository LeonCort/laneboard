import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import example from "../../src/examples/investing.laneboard.json" with { type: "json" };
const built = resolve("dist/index.html");
async function watch(page: Page) {
  const errors: string[] = [],
    requests: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (!/^(file|data|blob):/.test(r.url())) requests.push(r.url());
  });
  return { errors, requests };
}
test("the build is one self-contained HTML file", async () => {
  test.skip(!!process.env.BASE_URL, "needs the local build");
  const html = await readFile(built, "utf8");
  expect(html).not.toMatch(/<script[^>]+src=/);
  expect(html).not.toMatch(/<link[^>]+rel="stylesheet"/);
  expect(html).not.toMatch(/url\(["']?\.?\/?assets\//);
  expect(html).toContain('http-equiv="Content-Security-Policy"');
});
test("the downloaded file works from disk and keeps the workspace", async ({
  page,
  browserName,
}) => {
  // Chromium-based browsers (Chrome, Edge) are the target for work computers.
  test.skip(
    browserName !== "chromium",
    "file:// storage is verified in Chromium",
  );
  test.skip(!!process.env.BASE_URL, "needs the local build");
  const { errors, requests } = await watch(page);
  await page.goto(pathToFileURL(built).href);
  await page.getByRole("button", { name: "Open investing example" }).click();
  await expect(page.getByTestId("kpi-restarts")).toHaveText("2");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Search actions…").fill("Import");
  await page.getByRole("option", { name: "Import", exact: true }).click();
  const copy = structuredClone(example);
  copy.journeys[0].title = "Opened from disk";
  await page.getByLabel("Or paste JSON").fill(JSON.stringify(copy));
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import into workspace", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved in this browser" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("Opened from disk").first()).toBeVisible();
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
test("the hosted copy runs below a sub-path such as GitHub Pages", async ({
  browser,
  browserName,
}) => {
  test.skip(!!process.env.BASE_URL, "needs the local build");
  // Playwright routes service worker requests only in Chromium, so other
  // browsers would fetch sw.js from the real network. There the worker is
  // blocked and the test checks the manifest URL, which resolves the same way.
  const intercepted = browserName === "chromium";
  const context = await browser.newContext(
    intercepted ? {} : { serviceWorkers: "block" },
  );
  const page = await context.newPage();
  const { errors } = await watch(page);
  const served: string[] = [];
  const types: Record<string, string> = {
    html: "text/html",
    js: "text/javascript",
    webmanifest: "application/manifest+json",
    svg: "image/svg+xml",
    png: "image/png",
  };
  // Context routes also see the service worker script request in Chromium.
  await context.route("https://pages.example/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    served.push(path);
    if (!path.startsWith("/laneboard/"))
      return route.fulfill({ status: 404, body: "" });
    const name = path.slice("/laneboard/".length) || "index.html";
    try {
      const body = await readFile(resolve("dist", name));
      return route.fulfill({
        body,
        contentType: types[name.split(".").pop()!] ?? "text/plain",
      });
    } catch {
      return route.fulfill({ status: 404, body: "" });
    }
  });
  await page.goto("https://pages.example/laneboard/");
  await page.getByRole("button", { name: "Open mortgage example" }).click();
  await expect(page.getByTestId("kpi-restarts")).toHaveText("1");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "manifest.webmanifest",
  );
  expect(
    await page.evaluate(
      () =>
        new URL(
          document.querySelector<HTMLLinkElement>('link[rel="manifest"]')!.href,
        ).pathname,
    ),
  ).toBe("/laneboard/manifest.webmanifest");
  if (intercepted)
    await expect.poll(() => served.includes("/laneboard/sw.js")).toBe(true);
  expect(served.every((p) => p.startsWith("/laneboard/"))).toBe(true);
  expect(errors).toEqual([]);
  await context.close();
});
