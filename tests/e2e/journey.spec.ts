import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import example from "../../src/examples/investing.laneboard.json" with { type: "json" };
const openPalette = async (page: Page, action: string) => {
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Search actions…").fill(action);
  await page.getByRole("option", { name: action, exact: true }).click();
};
const readSaved = async (page: Page) =>
  page.evaluate(async () => {
    const request = indexedDB.open("laneboard");
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const req = db
      .transaction("workspaces")
      .objectStore("workspaces")
      .get("local");
    return await new Promise<Record<string, unknown>>((resolve) => {
      req.onsuccess = () => resolve(req.result.data);
    });
  });
async function importFile(page: Page, raw: string) {
  await openPalette(page, "Import");
  await page.getByLabel("Or paste JSON").fill(raw);
  await page
    .getByRole("button", { name: "Preview import", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Import into workspace", exact: true })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved in this browser" }),
  ).toBeVisible();
}
test("complete local-first journey flow with no external requests", async ({
  page,
  context,
  baseURL,
  browserName,
}) => {
  // This composite flow includes image rendering, two imports and a reload.
  test.setTimeout(120000);
  const external: string[] = [],
    errors: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== new URL(baseURL!).origin)
      external.push(request.url());
  });
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Open investing example" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open investing example" }).click();
  await expect(page.getByTestId("kpi-restarts")).toHaveText("2");
  await page
    .getByRole("button", { name: "Target", exact: true })
    .first()
    .click();
  await expect(page.getByTestId("kpi-restarts")).toHaveText("0");
  await page.getByRole("button", { name: "Now", exact: true }).first().click();
  await page
    .getByRole("button", { name: "Duplicate to edit", exact: true })
    .click();
  await page
    .getByLabel("Name", { exact: true })
    .fill("Investment journey — edited");
  await page.getByRole("button", { name: "View data" }).click();
  await page
    .getByLabel("Surplus analysis — Mobile app status")
    .selectOption("native");
  await expect(page.getByTestId("kpi-serviceFriction")).toHaveText("3");
  await page
    .getByLabel("Fund trading — Mobile app status")
    .selectOption("native");
  await page.getByRole("tab", { name: /Capabilities/ }).click();
  await expect(
    page.getByRole("tabpanel", { name: "Capabilities" }),
  ).toContainText("Context sharing");
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await openPalette(page, "Add note");
  await page
    .getByLabel("Notes", { exact: true })
    .fill("Edited locally with no upload");
  await page.getByLabel("Notes", { exact: true }).blur();
  await page.keyboard.press("ControlOrMeta+z");
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(page.getByLabel("Notes", { exact: true })).toHaveValue(
    "Edited locally with no upload",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Sketch", exact: true }).click();
  await openPalette(page, "Add sketch rectangle");
  await expect(page.locator(".lb-sketch")).toHaveCount(1);
  await page.getByLabel("Pin to cell").selectOption("app");
  await expect(page.locator(".lb-pin")).toHaveCount(1);
  await expect(
    page.getByRole("status").filter({ hasText: "Saved in this browser" }),
  ).toBeVisible();
  const pinned = await page.evaluate(async () => {
    const request = indexedDB.open("laneboard");
    const db = await new Promise<IDBDatabase>((resolve) => {
      request.onsuccess = () => resolve(request.result);
    });
    const req = db
      .transaction("workspaces")
      .objectStore("workspaces")
      .get("local");
    return await new Promise<{ dx: number; dy: number }>((resolve) => {
      req.onsuccess = () => {
        const w = req.result.data;
        resolve(
          w.journeys.find((j: { id: string }) => j.id === w.ui.selectedJourney)
            .sketches[0].anchor,
        );
      };
    });
  });
  const handle = page.locator(
    ".react-flow__resize-control.bottom.right.handle",
  );
  const handleBox = await handle.boundingBox();
  const sketch = page.locator(".react-flow__node-sketch");
  const widthBefore = await sketch.evaluate((n) => n.clientWidth);
  expect(handleBox).not.toBeNull();
  await page.mouse.move(
    handleBox!.x + handleBox!.width / 2,
    handleBox!.y + handleBox!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 30, handleBox!.y + 25, { steps: 5 });
  await page.mouse.up();
  await expect
    .poll(() => sketch.evaluate((n) => n.clientWidth))
    .toBeGreaterThan(widthBefore);
  await expect(
    page.getByRole("status").filter({ hasText: "Saved in this browser" }),
  ).toBeVisible();
  const resized = await readSaved(page);
  const savedJourney = (
    resized.journeys as {
      id: string;
      sketches: { anchor: { dx: number; dy: number } }[];
    }[]
  ).find(
    (j) => j.id === (resized.ui as { selectedJourney: string }).selectedJourney,
  )!;
  expect(savedJourney.sketches[0].anchor.dx).toBeCloseTo(pinned.dx, 1);
  expect(savedJourney.sketches[0].anchor.dy).toBeCloseTo(pinned.dy, 1);
  await page.getByLabel("Width", { exact: true }).click();
  await page.getByLabel("Width", { exact: true }).press("ControlOrMeta+a");
  await page.getByLabel("Width", { exact: true }).pressSequentially("240");
  await page.getByLabel("Width", { exact: true }).blur();
  await expect.poll(() => sketch.evaluate((n) => n.clientWidth)).toBe(240);
  await page.getByLabel("Horizontal offset", { exact: true }).fill("24");
  await page.getByLabel("Horizontal offset", { exact: true }).blur();
  await page.keyboard.press("ControlOrMeta+z");
  await expect(
    page.getByLabel("Horizontal offset", { exact: true }),
  ).toHaveValue("12");
  await page.keyboard.press("Escape");
  await openPalette(page, "Export");
  const jsonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /Whole workspace/ }).click();
  expect((await jsonDownload).suggestedFilename()).toBe(
    "workspace.laneboard.json",
  );
  await page.getByLabel("Image scale").selectOption("2");
  const mapSize = await page.locator(".react-flow").boundingBox();
  const pngDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /^PNG/ }).click();
  const png = await pngDownload;
  expect(png.suggestedFilename()).toMatch(/\.png$/);
  const pngBytes = await readFile((await png.path())!);
  expect(pngBytes.readUInt32BE(16)).toBe(mapSize!.width * 2);
  expect(pngBytes.readUInt32BE(20)).toBe(mapSize!.height * 2);
  const svgDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: /^SVG/ }).click();
  const svg = await svgDownload;
  expect(svg.suggestedFilename()).toMatch(/\.svg$/);
  const svgText = await readFile((await svg.path())!, "utf8");
  expect(svgText).toContain(`width="${mapSize!.width * 2}"`);
  expect(svgText).toContain(`height="${mapSize!.height * 2}"`);
  expect(svgText).toContain("Surplus analysis");
  expect(svgText).not.toContain("lb-island");
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved in this browser" }),
  ).toBeVisible();
  const before = await readSaved(page);
  await page.reload();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved in this browser" }),
  ).toBeVisible();
  const after = await readSaved(page);
  expect(after).toEqual(before);
  await openPalette(page, "Present");
  await expect(page.locator(".lb-guide")).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".lb-guide__step")).toHaveText("2 / 2");
  await page.keyboard.press("Escape");
  await expect(page.locator(".lb-guide")).toHaveCount(0);
  await importFile(page, JSON.stringify(example));
  await openPalette(
    page,
    "Open journey: Small business owner starts investing",
  );
  await expect(page.getByTestId("kpi-restarts")).toHaveText("2");
  await openPalette(page, "Prepare AI prompt");
  await page
    .getByLabel("Describe the scenario")
    .fill("An SME opens a savings account");
  await page.getByRole("button", { name: "Copy prompt", exact: true }).click();
  await expect(page.getByLabel("Prompt", { exact: true })).toHaveValue(
    /SCHEMA[\s\S]*An SME|An SME[\s\S]*SCHEMA/,
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await openPalette(page, "Collapse interface");
  await expect(page.locator(".lb-dock")).not.toBeVisible();
  await page.keyboard.press("ControlOrMeta+\\");
  await expect(page.locator(".lb-dock")).toBeVisible();
  if (browserName === "chromium") {
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId("kpi-restarts")).toHaveText("2");
    await context.setOffline(false);
  }
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test("malformed import is rejected without changing the workspace", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open investing example" }).click();
  const malformed = structuredClone(example);
  malformed.journeys[0].steps[0].lane = "missing";
  await openPalette(page, "Import");
  await page.getByLabel("Or paste JSON").fill(JSON.stringify(malformed));
  await page.getByRole("button", { name: "Preview import" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "journeys[0].steps[0].lane",
  );
  await expect(
    page.getByRole("button", { name: "Import into workspace" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.getByTestId("kpi-restarts")).toHaveText("2");
});
test("mortgage example and default six-step presentation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open mortgage example" }).click();
  await expect(page.getByTestId("kpi-restarts")).toHaveText("1");
  await page
    .getByRole("button", { name: "Present", exact: true })
    .first()
    .click();
  await expect(page.locator(".lb-guide__step")).toHaveText("1 / 6");
  for (let i = 0; i < 5; i++) await page.keyboard.press("ArrowRight");
  await expect(page.locator(".lb-guide__step")).toHaveText("6 / 6");
  await page.keyboard.press("Escape");
  await expect(page.locator(".lb-guide")).toHaveCount(0);
});
test("welcome and editor meet accessibility checks in light and dark themes", async ({
  page,
}) => {
  const themeReady = async (theme: string) => {
    await page.evaluate(async (theme) => {
      document.documentElement.dataset.theme = theme;
      await document.fonts.ready;
      void document.body.offsetWidth;
      await Promise.all(
        document.getAnimations().map((a) => a.finished.catch(() => {})),
      );
    }, theme);
  };
  await page.goto("/");
  await page.getByRole("button", { name: "Open investing example" }).waitFor();
  for (const theme of ["light", "dark"]) {
    await themeReady(theme);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.getByRole("button", { name: "Open investing example" }).click();
  for (const theme of ["light", "dark"]) {
    await themeReady(theme);
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
});
