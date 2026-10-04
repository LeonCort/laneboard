import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
const setup = async (page: Page) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start with bank channels", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Set up your journey" }),
  ).toBeVisible();
};
const skip = async (page: Page) => {
  await setup(page);
  await page.getByRole("button", { name: "Skip setup" }).click();
};
const data = async (page: Page, tab = "Services") => {
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("tab", { name: new RegExp(`^${tab}`) }).click();
};
const clean = async (page: Page) =>
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);

test("guided hypothesis, readable next steps and actual overview context", async ({
  page,
}) => {
  await setup(page);
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel("Name", { exact: true })
    .fill("Freelancer cash-flow hypothesis");
  await dialog
    .getByLabel("Customer", { exact: true })
    .fill("Freelancer with a late invoice");
  await dialog
    .getByLabel("Situation")
    .fill("An invoice is late and a tax bill is due");
  await dialog
    .getByLabel("Journey goal")
    .fill("Get a decision without repeating invoice data");
  await dialog.getByRole("button", { name: "Next", exact: true }).click();
  await dialog
    .getByLabel("Hypothesis", { exact: true })
    .fill("Reusing invoice data will reduce repeated information");
  await dialog
    .getByLabel("How we will test it")
    .fill("Compare completion in two prototypes with five freelancers");
  await dialog
    .getByLabel("Next validation action")
    .fill("Recruit five freelancers");
  await dialog.getByLabel("Evidence", { exact: true }).selectOption("assumed");
  await dialog
    .getByLabel("First customer action")
    .fill("Notice the invoice is overdue");
  await dialog.getByRole("button", { name: "Start mapping" }).click();
  await data(page, "Steps");
  const first = page.locator(".lb-story-step").first();
  await expect(first.getByLabel("Journey", { exact: true })).toHaveValue(
    "Notice the invoice is overdue",
  );
  await first.getByRole("button", { name: "Add next step" }).click();
  const form = page.locator(".lb-next-step");
  await expect(form.getByLabel("Lane", { exact: true })).toHaveValue(
    "customer",
  );
  await expect(form.getByLabel("Phase", { exact: true })).toHaveValue(
    "discover",
  );
  await form
    .getByLabel("Journey", { exact: true })
    .fill("Check the cash balance");
  await form.getByRole("button", { name: "Add next step" }).click();
  await expect(
    page
      .locator(".lb-story-step")
      .nth(1)
      .getByLabel("Transition", { exact: true }),
  ).toHaveValue("continue");
  await page
    .locator(".lb-story-step")
    .nth(1)
    .getByRole("button", { name: "Move up" })
    .click();
  await expect(first.getByLabel("Journey", { exact: true })).toHaveValue(
    "Check the cash balance",
  );
  await clean(page);
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".lb-overview")).toContainText(
    "Reusing invoice data will reduce repeated information",
  );
  await expect(page.locator(".lb-overview")).toContainText(
    "Recruit five freelancers",
  );
  await expect(page.locator(".lb-overview")).not.toContainText(
    "Private banking",
  );
  await clean(page);
  await page.reload();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".lb-overview")).toContainText(
    "Compare completion in two prototypes with five freelancers",
  );
});

test("selected service survives repeated coverage edits, removal, links, undo and reload", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await skip(page);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .locator(".lb-library-grid")
    .getByRole("button", { name: /^Service/ })
    .click();
  const inspector = page.locator(".lb-inspector");
  await expect(inspector.getByLabel("Flow connection")).toHaveValue("unknown");
  await inspector
    .getByLabel("Name", { exact: true })
    .fill("Cash-flow assessment");
  for (const value of ["native", "webview", "missing", "na", "native"]) {
    await inspector
      .getByLabel("Mobile app", { exact: true })
      .selectOption(value);
    await inspector
      .getByLabel("Internet bank", { exact: true })
      .selectOption("native");
    await expect(inspector.getByLabel("Name", { exact: true })).toHaveValue(
      "Cash-flow assessment",
    );
  }
  await page
    .locator(".lb-library-grid")
    .getByRole("button", { name: /^Service/ })
    .click();
  await inspector.getByLabel("Name", { exact: true }).fill("Invoice data");
  await inspector.getByLabel("Cash-flow assessment", { exact: true }).check();
  await expect(inspector.getByLabel("Flow connection")).toHaveValue(
    "connected",
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(inspector.getByLabel("Flow connection")).toHaveValue("unknown");
  await page.reload();
  await data(page);
  await expect(
    page.getByLabel("Cash-flow assessment — Internet bank status"),
  ).toHaveValue("native");
  expect(errors).toEqual([]);
});

test("narrow windows retain editing and clean mode retains zoom and details", async ({
  page,
}) => {
  await page.setViewportSize({ width: 924, height: 780 });
  await skip(page);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Library" })).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /^Service/ })
    .click();
  const details = page.getByRole("dialog", { name: "Open details" });
  await expect(details).toBeVisible();
  await details.getByLabel("Name", { exact: true }).fill("Invoice assessment");
  await details
    .getByLabel("Mobile app", { exact: true })
    .selectOption("native");
  await clean(page);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Collapse journey pane" }).click();
  await expect(
    page.getByRole("button", { name: "Zoom in", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Fit to screen" }).click();
  await page.getByRole("button", { name: "Open details", exact: true }).click();
  await expect(
    page
      .getByRole("dialog", { name: "Open details" })
      .getByLabel("Name", { exact: true }),
  ).toHaveValue("Invoice assessment");
  await expect(
    page
      .getByRole("dialog", { name: "Open details" })
      .getByLabel("Name", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await expect(page.locator(".lb-data-page")).toBeVisible();
  await page.getByRole("button", { name: "Canvas", exact: true }).click();
  await page.getByRole("button", { name: "Expand journey pane" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});

test("explicit Target copy, denominator changes and review are visible", async ({
  page,
}) => {
  await skip(page);
  await page.getByRole("button", { name: "Library", exact: true }).click();
  await page
    .locator(".lb-library-grid")
    .getByRole("button", { name: /^Service/ })
    .click();
  await page
    .locator(".lb-inspector")
    .getByLabel("Name", { exact: true })
    .fill("Invoice assessment");
  await page
    .locator(".lb-inspector")
    .getByLabel("Mobile app", { exact: true })
    .selectOption("missing");
  await page.getByRole("button", { name: "Target", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "Target has not been created",
  );
  await page.getByRole("button", { name: "Create Target from Now" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "No differences from Now yet",
  );
  await page.keyboard.press("Escape");
  await data(page);
  await page
    .getByLabel("Invoice assessment — Mobile app status")
    .selectOption("na");
  await page.getByRole("tab", { name: /^Target changes/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Missing → Not applicable",
  );
  await expect(page.getByRole("tabpanel")).toContainText(
    "Not applicable: 0 → 1",
  );
  await page.getByRole("button", { name: "Mark design reviewed" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Design reviewed");
  await data(page);
  await page
    .getByLabel("Invoice assessment — Mobile app status")
    .selectOption("native");
  await page.getByRole("tab", { name: /^Target changes/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText("Draft");
});

test("completed imported journey presents actual cards after switching views and reloading", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(Element.prototype, "requestFullscreen", {
      value: undefined,
    }),
  );
  const raw = await readFile(
    "tests/fixtures/freelancer-cash-flow.laneboard.json",
    "utf8",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Or paste JSON").fill(raw);
  await page.getByRole("button", { name: "Preview import" }).click();
  await page.getByRole("button", { name: "Import into workspace" }).click();
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect(page.locator(".lb-overview")).toContainText(
    "Ownership handoffs",
  );
  await expect(page.locator(".lb-overview")).toContainText(
    "Digital channels → Business lending",
  );
  await data(page, "Steps");
  await page.reload();
  await page.getByRole("button", { name: "Present", exact: true }).click();
  await expect(
    page.locator(".react-flow__node-card .lb-card--service").first(),
  ).toBeVisible();
  await expect(
    page.locator(".react-flow__node-card .lb-card--service").first(),
  ).toContainText(/\S+/);
  await page.getByRole("button", { name: "Next slide" }).click();
  await expect(
    page.locator(".react-flow__node-card .lb-card--step").first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Exit presentation" }).click();
});

test("cell menus create in context and fit uses the unobscured workspace", async ({
  page,
}) => {
  await skip(page);
  const cell = page.locator('[data-id="cell-app-discover"]');
  await cell.hover();
  await cell.getByRole("button", { name: /^Add in this cell/ }).click();
  await page
    .getByRole("menuitem", { name: "Journey step", exact: true })
    .click();
  const inspector = page.locator(".lb-inspector");
  await expect(inspector.getByLabel("Lane", { exact: true })).toHaveValue(
    "app",
  );
  await expect(inspector.getByLabel("Phase", { exact: true })).toHaveValue(
    "discover",
  );
  await inspector
    .getByLabel("Journey", { exact: true })
    .fill("Check the saved invoice");
  await page.getByRole("button", { name: "Fit to screen" }).click();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const cells = [
          ...document.querySelectorAll(".react-flow__node-cell"),
        ].map((n) => n.getBoundingClientRect());
        const labels = document
          .querySelector(".lb-lane-overlay")!
          .getBoundingClientRect();
        const details = document
          .querySelector(".lb-inspector")!
          .getBoundingClientRect();
        return Math.min(
          ...cells.map((c) =>
            Math.min(
              c.x - labels.right,
              details.x - c.right,
              c.y - 148,
              window.innerHeight - 94 - c.bottom,
            ),
          ),
        );
      }),
    )
    .toBeGreaterThanOrEqual(0);
  await data(page, "Steps");
  await expect(
    page.locator(".lb-story-step").getByLabel("Journey", { exact: true }),
  ).toHaveValue("Check the saved invoice");
});
