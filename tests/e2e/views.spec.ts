import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function openJourney(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Open investing example" }).click();
  await expect(page.locator(".lb-sticky-phase")).toHaveCount(6);
}

test("navigation remains available when tools close and can reopen them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1126, height: 780 });
  await openJourney(page);
  const before = await page
    .locator(".react-flow__viewport")
    .getAttribute("style");
  const rail = page.getByRole("navigation", { name: "Workspace tools" });
  await rail.getByRole("button", { name: "Collapse interface" }).click();
  await expect(page.locator(".lb-leftpanel")).toHaveCount(0);
  await expect(page.locator(".lb-inspector")).toHaveCount(0);
  await expect(page.locator(".lb-dock")).toHaveCount(0);
  for (const name of [
    "Journeys",
    "Library",
    "Definitions",
    "Prepare AI prompt",
    "Settings",
    "Expand tools",
  ]) {
    await expect(rail.getByRole("button", { name, exact: true })).toBeVisible();
  }
  const railBox = await rail.boundingBox(),
    labels = await page.locator(".lb-lane-overlay").boundingBox();
  expect(labels!.x).toBeGreaterThan(railBox!.x + railBox!.width);
  await rail.getByRole("button", { name: "Expand tools" }).click();
  await expect(page.locator(".lb-leftpanel")).toBeVisible();
  await expect(page.locator(".lb-inspector")).toBeVisible();
  await expect(page.locator(".lb-dock")).toBeVisible();
  await expect(page.locator(".react-flow__viewport")).toHaveAttribute(
    "style",
    before!,
  );
  await page.keyboard.press("ControlOrMeta+\\");
  await rail.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.locator(".lb-leftpanel .lb-library-grid")).toBeVisible();
  await rail.getByRole("button", { name: "Collapse interface" }).click();
  await rail.getByRole("button", { name: "Definitions", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Definitions" })).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await rail.getByRole("button", { name: "Journeys", exact: true }).click();
  await expect(page.locator(".lb-leftpanel")).toContainText(
    "Small business owner starts investing",
  );
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
});

async function checkColumnAlignment(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(() => {
        const headers = [...document.querySelectorAll(".lb-sticky-phase")];
        const cells = [
          ...document.querySelectorAll(".react-flow__node-cell"),
        ].slice(0, headers.length);
        return Math.max(
          ...headers.map((header, i) => {
            const h = header.getBoundingClientRect(),
              c = cells[i].getBoundingClientRect();
            return Math.max(Math.abs(h.x - c.x), Math.abs(h.width - c.width));
          }),
        );
      }),
    )
    .toBeLessThan(1);
}

test("journey title stays in the file panel and views work at narrow widths", async ({
  page,
}) => {
  await openJourney(page);
  for (const width of [1440, 924, 560]) {
    await page.setViewportSize({ width, height: 780 });
    const file = await page.locator(".lb-filepill").boundingBox();
    const title = await page.locator(".lb-filepill__journey").boundingBox();
    const actions = await page.locator(".lb-cluster").boundingBox();
    const views = await page.locator(".lb-view-switch").boundingBox();
    expect(title!.x).toBeGreaterThan(file!.x);
    expect(title!.x + title!.width).toBeLessThanOrEqual(file!.x + file!.width);
    expect(file!.x + file!.width).toBeLessThan(actions!.x);
    expect(views!.y).toBeGreaterThanOrEqual(file!.y + file!.height);
    await checkColumnAlignment(page);
    await page.getByRole("button", { name: "Overview", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Overview", exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".react-flow__node-cell").first(),
    ).not.toBeVisible();
    await expect(page.locator(".lb-dock")).toHaveCount(0);
    const overview = await page.locator(".lb-overview").boundingBox();
    expect(overview!.width).toBeGreaterThan(width - 40);
    expect(
      await page
        .locator(".lb-overview")
        .evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page.getByRole("button", { name: "Canvas", exact: true }).click();
    await expect(page.locator(".react-flow__node-cell").first()).toBeVisible();
  }
});

test("overview updates from the journey and restores canvas position and data drawer", async ({
  page,
}) => {
  await openJourney(page);
  await page.getByRole("button", { name: "View data", exact: true }).click();
  await expect(
    page.getByRole("tablist", { name: "Data views" }).getByRole("tab"),
  ).toHaveCount(5);
  const before = await page
    .locator(".react-flow__viewport")
    .getAttribute("style");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".lb-drawer")).toHaveCount(0);
  await expect(page.getByTestId("overview-restarts")).toHaveText("2");
  await page.getByRole("button", { name: "Target", exact: true }).click();
  await expect(page.getByTestId("overview-restarts")).toHaveText("0");
  await page.getByRole("button", { name: "Now", exact: true }).click();
  await expect(page.locator(".lb-overview")).toContainText(
    "More small businesses invest their surplus",
  );
  await expect(page.locator(".lb-overview")).not.toContainText(
    "Local objectives",
  );
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await expect(page.locator(".lb-drawer")).toHaveCount(0);
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await expect(page.locator(".lb-data-page")).toBeVisible();
  await expect(page.locator(".react-flow__viewport")).toHaveAttribute(
    "style",
    before!,
  );
  await page.getByRole("button", { name: "Close", exact: true }).last().click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page
    .getByRole("button", {
      name: /F2 Webviews only handle isolated tasks/,
    })
    .click();
  await expect(page.locator("main")).toHaveAttribute("data-view", "canvas");
  await expect(page.locator(".lb-inspector__title")).toHaveText(
    "Webviews only handle isolated tasks",
  );
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.getByRole("button", { name: "Present", exact: true }).click();
  await expect(page.locator(".lb-guide")).toBeVisible();
  await page.getByRole("button", { name: "Exit presentation" }).click();
  await expect(
    page.getByRole("region", { name: "Overview", exact: true }),
  ).toBeVisible();
});

test("presentation columns align with the grid and fitting reserves labels and guide space", async ({
  page,
}) => {
  await page.addInitScript(() => {
    // Exercise the in-window presentation fallback, where viewport resizing is supported.
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      value: undefined,
    });
  });
  await openJourney(page);
  const before = await page
    .locator(".react-flow__viewport")
    .getAttribute("style");
  await page
    .getByRole("button", { name: "Present", exact: true })
    .last()
    .click();
  await expect(page.locator(".lb-guide")).toBeVisible();
  for (const width of [1440, 924, 560]) {
    await page.setViewportSize({ width, height: 780 });
    await checkColumnAlignment(page);
    await expect
      .poll(async () => {
        const grid = await page
          .locator('.react-flow__node-cell[data-id^="cell-web-"]')
          .first()
          .boundingBox();
        const labels = await page.locator(".lb-lane-overlay").boundingBox();
        return grid!.x - labels!.x - labels!.width;
      })
      .toBeGreaterThanOrEqual(8);
    await expect
      .poll(async () => {
        const last = await page
          .locator(".lb-sticky-phase")
          .last()
          .boundingBox();
        const canvas = await page.locator(".react-flow").boundingBox();
        return canvas!.width - last!.x - last!.width;
      })
      .toBeGreaterThanOrEqual(16);
    const guide = await page.locator(".lb-guide").boundingBox();
    const labels = await page.locator(".lb-lane-overlay").boundingBox();
    expect(labels!.y + labels!.height).toBeLessThan(guide!.y);
    await page.getByRole("button", { name: "Next slide" }).click();
    await checkColumnAlignment(page);
    await page.getByRole("button", { name: "Previous slide" }).click();
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Exit presentation" }).click();
  await expect
    .poll(() => page.locator(".react-flow__viewport").getAttribute("style"))
    .toBe(before);
});
