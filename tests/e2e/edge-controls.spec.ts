import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

const edge = (page: Page, id: string) =>
  page.locator(`.react-flow__edge[data-id="${id}"]`);
const controls = (page: Page) =>
  page.getByRole("group", { name: "Connection controls", exact: true });
const runtimeErrors = new WeakMap<Page, string[]>();
test.beforeEach(({ page }) => {
  const errors: string[] = [];
  runtimeErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
});
test.afterEach(({ page }) => expect(runtimeErrors.get(page)).toEqual([]));
async function setup(page: Page, readOnly = false) {
  const file = JSON.parse(
      await readFile("tests/fixtures/connections.laneboard.json", "utf8"),
    ),
    j = file.journeys[0];
  j.readOnly = readOnly;
  j.services[0].linksTo = ["account"];
  j.services.push({
    ...structuredClone(j.services[1]),
    id: "budget",
    name: "Budget planner",
    linksTo: [],
  });
  j.steps.push({
    ...structuredClone(j.steps[1]),
    id: "review",
    text: "Review account",
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Or paste JSON").fill(JSON.stringify(file));
  await page.getByRole("button", { name: "Preview import" }).click();
  await page.getByRole("button", { name: "Import into workspace" }).click();
  await page
    .locator(".lb-inspector")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("button", { name: "Collapse journey pane" }).click();
  await page.getByRole("button", { name: "Fit to screen" }).click();
  await expect(page.locator(".lb-zoombar")).toContainText("100%");
}
async function selectEdge(
  page: Page,
  id: string,
  button: "left" | "right" = "left",
) {
  // Fit and handle measurement settle on animation frames. Coordinate-based
  // gestures must use the painted path after that motion has finished.
  await page.locator(".react-flow__viewport").evaluate(async (viewport) => {
    let previous = "",
      stable = 0;
    for (let frame = 0; frame < 120 && stable < 3; frame++) {
      await new Promise(requestAnimationFrame);
      const current = `${getComputedStyle(viewport).transform}|${[...viewport.querySelectorAll(".lb-edge")].map((path) => path.getAttribute("d")).join("|")}`;
      stable = current === previous ? stable + 1 : 0;
      previous = current;
    }
  });
  // On slower machines the canvas can still shift between finding the path
  // and the click landing, so repeat the click until the edge is selected.
  const controls = page.locator(`[data-edge-controls="${id}"]`);
  const menu = page.locator(".lb-context-menu");
  await expect(async () => {
    // A menu from an earlier right-click would cover the path.
    if (await menu.isVisible()) await page.keyboard.press("Escape");
    let point: { x: number; y: number } | null = null;
    await expect
      .poll(
        async () => {
          point = await edge(page, id)
            .locator(".lb-edge")
            .evaluate((path) => {
              const line = path as SVGPathElement,
                id = line.closest(".react-flow__edge")!.getAttribute("data-id");
              for (const fraction of [
                0.5,
                0.25,
                0.75,
                ...Array.from({ length: 19 }, (_, i) => (i + 1) / 20),
              ]) {
                const point = line
                  .getPointAtLength(line.getTotalLength() * fraction)
                  .matrixTransform(line.getScreenCTM()!);
                if (
                  document
                    .elementFromPoint(point.x, point.y)
                    ?.closest(".react-flow__edge")
                    ?.getAttribute("data-id") === id
                )
                  return { x: point.x, y: point.y };
              }
              return null;
            });
          return point;
        },
        { message: "Connection has an exposed clickable path" },
      )
      .toBeTruthy();
    await page.mouse.click(point!.x, point!.y, { button });
    await expect(controls).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 20000 });
}
async function reconnect(
  page: Page,
  id: string,
  end: "source" | "target",
  cardId: string,
) {
  await expect(
    edge(page, id).locator(`.react-flow__edgeupdater-${end}`),
  ).toBeVisible();
  await expect
    .poll(
      () =>
        edge(page, id)
          .locator(`.react-flow__edgeupdater-${end}`)
          .evaluate((handle) => {
            const r = handle.getBoundingClientRect();
            return (
              document.elementFromPoint(
                r.x + r.width / 2,
                r.y + r.height / 2,
              ) === handle
            );
          }),
      { message: "Each endpoint handle can receive a pointer gesture" },
    )
    .toBe(true);
  // Hover waits for two stable painted frames before beginning the drag.
  await edge(page, id).locator(`.react-flow__edgeupdater-${end}`).hover();
  const target = await page
    .locator(`.react-flow__node[data-id="${cardId}"]`)
    .boundingBox();
  expect(target).not.toBeNull();
  await page.mouse.down();
  await page.mouse.move(
    target!.x + target!.width / 2,
    target!.y + target!.height / 2,
    { steps: 14 },
  );
  await page.mouse.up();
}

test("selects connections and drags both endpoints without moving cards; invalid drops keep the edge", async ({
  page,
}) => {
  await setup(page);
  const initial = "service-link-service-options-app-service-account-app";
  await selectEdge(page, initial);
  await expect(
    edge(page, initial).locator(".react-flow__edgeupdater"),
  ).toHaveCount(2);
  await expect(page.locator(".lb-inspector")).toHaveCount(0);
  const position = await page
    .locator('[data-id="service-options-app"]')
    .evaluate((node) => getComputedStyle(node).transform);
  await reconnect(page, initial, "target", "note-research-customer");
  await expect(edge(page, initial)).toBeAttached();
  await expect(page.locator(`[data-edge-controls="${initial}"]`)).toBeVisible();
  await reconnect(page, initial, "target", "service-budget-app");
  const changed = "service-link-service-options-app-service-budget-app";
  await expect(edge(page, changed)).toBeAttached();
  await expect(edge(page, initial)).toHaveCount(0);
  await expect(controls(page)).toContainText("Budget planner");
  await reconnect(page, changed, "source", "service-account-app");
  const moved = "service-link-service-account-app-service-budget-app";
  await expect(edge(page, moved)).toBeAttached();
  await expect(page.locator('[data-id="service-options-app"]')).toHaveCSS(
    "transform",
    position,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(edge(page, changed)).toBeAttached();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(edge(page, initial)).toBeAttached();
});

test("search changes either endpoint with keyboard and deletes only the connection", async ({
  page,
}) => {
  await setup(page);
  await selectEdge(
    page,
    "service-link-service-options-app-service-account-app",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await controls(page)
    .getByRole("button", { name: "Change destination" })
    .click();
  const search = page
    .locator(".lb-link-popover")
    .getByRole("combobox", { name: "Find a connection" });
  await search.fill("Budget planner");
  await expect(
    page.locator('.lb-link-popover [cmdk-item][aria-selected="true"]'),
  ).toContainText("Budget planner");
  await page.keyboard.press("Enter");
  await expect(
    edge(page, "service-link-service-options-app-service-budget-app"),
  ).toBeVisible();
  await controls(page).getByRole("button", { name: "Change source" }).click();
  await search.fill("Open savings account");
  await expect(
    page.locator('.lb-link-popover [cmdk-item][aria-selected="true"]'),
  ).toContainText("Open savings account");
  await page.keyboard.press("Enter");
  const changed = "service-link-service-account-app-service-budget-app";
  await expect(edge(page, changed)).toBeAttached();
  await controls(page)
    .getByRole("button", { name: "Delete connection" })
    .click();
  await expect(page.locator(".lb-edge--service")).toHaveCount(0);
  await expect(page.locator(".lb-card--service")).toHaveCount(3);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(edge(page, changed)).toBeAttached();
  await expect(
    page.getByRole("status").filter({ hasText: "Saved in this browser" }),
  ).toBeVisible();
  await page.reload();
  await expect(edge(page, changed)).toBeAttached();
});

test("feed and journey edges can be removed and retargeted while preserving all cards and backups", async ({
  page,
}) => {
  await page.setViewportSize({ width: 924, height: 1000 });
  await setup(page);
  await selectEdge(page, "feed-edge-signal");
  await controls(page)
    .getByRole("button", { name: "Delete connection" })
    .click();
  await expect(edge(page, "feed-edge-signal")).toHaveCount(0);
  await expect(page.locator(".lb-card--feed")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await selectEdge(page, "feed-edge-signal");
  await controls(page)
    .getByRole("button", { name: "Change destination" })
    .click();
  await page
    .locator(".lb-link-popover")
    .getByRole("combobox", { name: "Find a connection" })
    .fill("Review account");
  await expect(
    page.locator('.lb-link-popover [cmdk-item][aria-selected="true"]'),
  ).toContainText("Review account");
  await page.keyboard.press("Enter");
  await expect(edge(page, "feed-edge-signal")).toHaveAttribute(
    "aria-label",
    "Edge from feed-signal-customer to step-review-app",
  );
  await expect(page.locator(".lb-tools-sheet")).toHaveCount(0);
  await selectEdge(page, "edge-compare-open");
  await controls(page)
    .getByRole("button", { name: "Change destination" })
    .click();
  await page
    .locator(".lb-link-popover")
    .getByRole("combobox", { name: "Find a connection" })
    .fill("Review account");
  await expect(
    page.locator('.lb-link-popover [cmdk-item][aria-selected="true"]'),
  ).toContainText("Review account");
  await page.keyboard.press("Enter");
  await expect(edge(page, "edge-compare-review")).toBeAttached();
  await controls(page)
    .getByRole("button", { name: "Delete connection" })
    .click();
  await expect(edge(page, "edge-compare-review")).toHaveCount(0);
  await expect(page.locator(".lb-card--step")).toHaveCount(3);
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Whole workspace/ }).click();
  const stream = await (await download).createReadStream(),
    chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.journeys[0].steps[0].next.now).toEqual([]);
  expect(exported.journeys[0].feeds[0].to).toBe("review");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(edge(page, "edge-compare-review")).toBeAttached();
});

test("keyboard and right-click select edges; read-only connections disable editing", async ({
  page,
}) => {
  await setup(page);
  const id = "service-link-service-options-app-service-account-app";
  await edge(page, id).focus();
  await page.keyboard.press("Enter");
  await expect(controls(page)).toBeVisible();
  await page.keyboard.press("Delete");
  await expect(edge(page, id)).toHaveCount(0);
  await expect(page.locator(".lb-card--service")).toHaveCount(3);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await selectEdge(page, id, "right");
  const menu = page.locator(".lb-context-menu");
  await expect(
    menu.getByRole("menuitem", { name: "Change destination" }),
  ).toBeVisible();
  await menu.getByRole("menuitem", { name: "Delete connection" }).click();
  await expect(edge(page, id)).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit lane Mobile app" })
    .click({ button: "right" });
  await page
    .locator(".lb-context-menu")
    .getByRole("menuitem", { name: "Lock lane" })
    .click();
  await selectEdge(page, id);
  await expect(
    controls(page).getByRole("button", { name: "Delete connection" }),
  ).toBeDisabled();
  await expect(edge(page, id).locator(".react-flow__edgeupdater")).toHaveCount(
    0,
  );
});

test("read-only example connections remain inspectable without mutation handles", async ({
  page,
}) => {
  await setup(page, true);
  const id = "service-link-service-options-app-service-account-app";
  await selectEdge(page, id);
  await expect(controls(page)).toContainText("read-only");
  await expect(
    controls(page).getByRole("button", { name: "Change source" }),
  ).toBeDisabled();
  await expect(
    controls(page).getByRole("button", { name: "Change destination" }),
  ).toBeDisabled();
  await expect(
    controls(page).getByRole("button", { name: "Delete connection" }),
  ).toBeDisabled();
  await expect(edge(page, id).locator(".react-flow__edgeupdater")).toHaveCount(
    0,
  );
  await page.keyboard.press("Delete");
  await expect(edge(page, id)).toBeAttached();
  await page.keyboard.press("Escape");
  await expect(controls(page)).toHaveCount(0);
});
