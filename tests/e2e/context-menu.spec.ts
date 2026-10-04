import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

const menu = (page: Page) => page.locator(".lb-context-menu");
const node = (page: Page, id: string) => page.locator(`[data-id="${id}"]`);
async function setup(
  page: Page,
  options: { readOnly?: boolean; group?: boolean } = {},
) {
  const file = JSON.parse(
    await readFile("tests/fixtures/connections.laneboard.json", "utf8"),
  );
  file.journeys[0].readOnly = !!options.readOnly;
  if (options.group) {
    file.journeys[0].laneGroups = [{ id: "digital", name: "Digital channels" }];
    file.journeys[0].lanes[1].group = "digital";
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Or paste JSON").fill(JSON.stringify(file));
  await page.getByRole("button", { name: "Preview import" }).click();
  await page.getByRole("button", { name: "Import into workspace" }).click();
  await expect(page.locator(".lb-inspector")).toBeVisible();
  await page
    .locator(".lb-inspector")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("button", { name: "Collapse journey pane" }).click();
  await page.getByRole("button", { name: "Fit to screen" }).click();
  await expect(page.locator(".lb-zoombar")).toContainText("100%");
}
async function cellMenu(page: Page, id: string) {
  const cell = node(page, id);
  let position: { x: number; y: number } | null = null;
  await expect
    .poll(async () => {
      position = await cell.evaluate((element) => {
        const box = element.getBoundingClientRect();
        for (let y = box.height - 20; y >= 20; y -= 20)
          for (let x = 30; x < box.width - 20; x += 20) {
            const hit = document.elementFromPoint(box.left + x, box.top + y);
            // Selectable connections can cross a cell. Use exposed background,
            // so this gesture really targets the cell rather than a connection.
            if (
              hit?.closest(".react-flow__node") === element &&
              !hit.closest(".lb-card")
            )
              return { x, y };
          }
        return null;
      });
      return position;
    })
    .toBeTruthy();
  await cell.click({ button: "right", position: position! });
  await expect(menu(page)).toBeVisible();
}

test("right-click card commands target the clicked card and reuse link search, duplication and undo", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await setup(page);
  await node(page, "service-options-app").click({ button: "right" });
  await expect(menu(page)).toContainText("Savings options");
  await node(page, "service-account-app").click({ button: "right" });
  await expect(menu(page)).toContainText("Open savings account");
  await node(page, "service-options-app").click({ button: "right" });
  await expect(menu(page)).toContainText("Savings options");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await menu(page)
    .getByRole("menuitem", { name: "Add link…", exact: true })
    .click();
  await expect(menu(page)).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Find a connection" })
    .fill("Open savings");
  await page.keyboard.press("Enter");
  await expect(page.locator(".lb-edge--service")).toHaveCount(1);
  await node(page, "service-options-app").click({ button: "right" });
  await menu(page)
    .getByRole("menuitem", { name: "Duplicate", exact: true })
    .click();
  await expect(page.locator(".lb-card--service")).toHaveCount(3);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".lb-card--service")).toHaveCount(2);
  await node(page, "service-account-app").click({ button: "right" });
  await expect(menu(page)).toContainText("Open savings account");
  await menu(page)
    .getByRole("menuitem", { name: "Delete", exact: true })
    .click();
  await expect(node(page, "service-account-app")).toHaveCount(0);
  await expect(node(page, "service-options-app")).toBeVisible();
  await expect(page.locator(".lb-edge--service")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(node(page, "service-account-app")).toBeVisible();
  expect(errors).toEqual([]);
});

test("cell and lane commands work in smaller windows with the journey pane closed", async ({
  page,
}) => {
  await page.setViewportSize({ width: 924, height: 1000 });
  await setup(page);
  await cellMenu(page, "cell-app-apply");
  await expect(page.locator(".lb-tools-sheet")).toHaveCount(0);
  await menu(page).getByRole("menuitem", { name: "Note", exact: true }).click();
  await expect(
    page.locator(".lb-inspector").getByLabel("Lane", { exact: true }),
  ).toHaveValue("app");
  await expect(
    page.locator(".lb-inspector").getByLabel("Phase", { exact: true }),
  ).toHaveValue("apply");
  await page
    .locator(".lb-inspector")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await cellMenu(page, "cell-customer-apply");
  await expect(
    menu(page).getByRole("menuitem", { name: "Service", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Edit lane Mobile app", exact: true })
    .click({ button: "right" });
  await menu(page)
    .getByRole("menuitem", { name: "Hide lane", exact: true })
    .click();
  await expect(node(page, "cell-app-apply")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(node(page, "cell-app-apply")).toBeVisible();
  await page
    .getByRole("button", { name: "Edit lane Mobile app", exact: true })
    .click({ button: "right" });
  await menu(page)
    .getByRole("menuitem", { name: "Edit lane", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Edit lane", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".lb-leftpanel")).toHaveCount(0);
});

test("keyboard menus restore focus, fit inside the window and preserve native text and Shift context menus", async ({
  page,
}) => {
  await setup(page);
  const service = node(page, "service-options-app");
  await service.focus();
  await page.keyboard.press("Shift+F10");
  await expect(menu(page)).toBeVisible();
  await expect(
    menu(page).getByRole("menuitem", { name: "Open details", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(
    menu(page).getByRole("menuitem", { name: "Add link…", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu(page)).toHaveCount(0);
  await expect(service).toBeFocused();
  // The contextual inspector can extend to the bottom of the viewport.
  // Dismiss it before testing an empty-canvas click at the window edge.
  if (await page.locator(".lb-inspector").isVisible())
    await page
      .locator(".lb-inspector")
      .getByRole("button", { name: "Close", exact: true })
      .click();
  await page
    .locator(".react-flow__pane")
    .click({ button: "right", position: { x: 1420, y: 955 } });
  const box = (await menu(page).boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(1440);
  expect(box.y + box.height).toBeLessThanOrEqual(1000);
  await page.keyboard.press("Escape");
  const viewportTransform = await page
    .locator(".react-flow__viewport")
    .getAttribute("style");
  await page.mouse.move(1320, 760);
  await page.mouse.down({ button: "right" });
  await page.mouse.move(1300, 820, { steps: 8 });
  await page.mouse.up({ button: "right" });
  await expect(page.locator(".react-flow__viewport")).toHaveAttribute(
    "style",
    viewportTransform!,
  );
  await page.keyboard.press("Escape");
  await service.click();
  const field = page
    .locator(".lb-inspector")
    .getByLabel("Name", { exact: true });
  await service.click({ button: "right" });
  await field.click();
  await expect(menu(page)).toHaveCount(0);
  await expect(field).toBeFocused();
  expect(
    await field.evaluate((element) =>
      element.dispatchEvent(
        new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
      ),
    ),
  ).toBe(true);
  expect(
    await service.evaluate((element) =>
      element.dispatchEvent(
        new MouseEvent("contextmenu", {
          bubbles: true,
          cancelable: true,
          shiftKey: true,
        }),
      ),
    ),
  ).toBe(true);
  await expect(menu(page)).toHaveCount(0);
});

test("read-only and locked cards explain restrictions and allow duplication or unlocking", async ({
  page,
}) => {
  await setup(page, { readOnly: true });
  await node(page, "service-options-app").click({ button: "right" });
  await expect(
    menu(page).getByRole("menuitem", { name: "Delete", exact: true }),
  ).toBeDisabled();
  await expect(
    menu(page).getByRole("menuitem", { name: "Add link…", exact: true }),
  ).toBeDisabled();
  await menu(page)
    .getByRole("menuitem", { name: "Duplicate to edit", exact: true })
    .click();
  await expect(page.locator(".lb-filepill__title")).toContainText("copy");
  await node(page, "service-options-app").click({ button: "right" });
  await expect(
    menu(page).getByRole("menuitem", { name: "Delete", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Edit lane Mobile app", exact: true })
    .click({ button: "right" });
  await menu(page)
    .getByRole("menuitem", { name: "Lock lane", exact: true })
    .click();
  await node(page, "service-options-app").click({ button: "right" });
  await expect(menu(page)).toContainText("This lane is locked");
  await expect(
    menu(page).getByRole("menuitem", { name: "Duplicate", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "Edit lane Mobile app", exact: true })
    .click({ button: "right" });
  await menu(page)
    .getByRole("menuitem", { name: "Unlock lane", exact: true })
    .click();
  await node(page, "service-options-app").click({ button: "right" });
  await expect(
    menu(page).getByRole("menuitem", { name: "Duplicate", exact: true }),
  ).toBeEnabled();
});

test("group and canvas commands hand off to the correct inline editor and phase creation", async ({
  page,
}) => {
  await setup(page, { group: true });
  const group = page.locator('[data-context-group="digital"]');
  await group.click({ button: "right" });
  await menu(page)
    .getByRole("menuitem", { name: "Add lane", exact: true })
    .click();
  const form = page.getByRole("dialog", { name: "Add lane", exact: true });
  await expect(form.getByLabel("Lane group", { exact: true })).toHaveValue(
    "digital",
  );
  await form.getByLabel("Name", { exact: true }).fill("Partner portal");
  await form.getByRole("button", { name: "Add lane", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit lane Partner portal", exact: true }),
  ).toBeVisible();
  await group.click({ button: "right" });
  await menu(page)
    .getByRole("menuitem", { name: "Collapse group", exact: true })
    .click();
  await expect(node(page, "service-options-app")).toHaveCount(0);
  await group.click({ button: "right" });
  await menu(page)
    .getByRole("menuitem", { name: "Expand group", exact: true })
    .click();
  await expect(node(page, "service-options-app")).toBeVisible();
  await page
    .locator(".react-flow__pane")
    .click({ button: "right", position: { x: 1320, y: 760 } });
  await menu(page)
    .getByRole("menuitem", { name: "Add phase", exact: true })
    .click();
  await expect(
    page.locator(".lb-inspector").getByLabel("Name", { exact: true }),
  ).toHaveValue("New phase");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".lb-sticky-phase")).toHaveCount(2);
});
