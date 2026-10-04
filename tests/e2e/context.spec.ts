import { test, expect } from "@playwright/test";

for (const width of [1440, 924]) {
  test(`rapid cell Add clicks open one menu and create in context at ${width}px`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await page
      .getByRole("button", { name: "Start with bank channels", exact: true })
      .click();
    await page.getByRole("button", { name: "Skip setup" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const cell = page.locator('[data-id="cell-app-discover"]');
    await cell.hover();
    await cell.getByRole("button", { name: /^Add in this cell/ }).dblclick();
    await expect(page.getByRole("menu")).toHaveCount(1);
    await expect(page.locator(".lb-picker")).toHaveCount(0);
    await page
      .getByRole("menuitem", { name: "Journey step", exact: true })
      .click();
    const details = page.locator(".lb-inspector");
    await expect(details.getByLabel("Lane", { exact: true })).toHaveValue(
      "app",
    );
    await expect(details.getByLabel("Phase", { exact: true })).toHaveValue(
      "discover",
    );
    await details
      .getByLabel("Journey", { exact: true })
      .fill("Review the invoice");
    if (width <= 960) await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Collapse journey pane" }).click();
    await expect(page.locator(".lb-leftpanel")).toHaveCount(0);
    await expect(page.locator(".lb-dock")).toBeVisible();
    if (width > 960) {
      await expect(details.getByLabel("Journey", { exact: true })).toHaveValue(
        "Review the invoice",
      );
      await details.getByRole("button", { name: "Close", exact: true }).click();
      await expect(details).toHaveCount(0);
    }
    const card = page.locator(".lb-card--step").first();
    await card.click();
    await expect(details.getByLabel("Journey", { exact: true })).toHaveValue(
      "Review the invoice",
    );
    expect(errors).toEqual([]);
  });
}

test("details follow journey, phase, lane and cell selection independently of the left pane", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start with bank channels", exact: true })
    .click();
  await page.getByRole("button", { name: "Skip setup" }).click();
  const details = page.locator(".lb-inspector");
  await page.getByRole("button", { name: "Collapse journey pane" }).click();
  await expect(details).toBeVisible();
  await details.getByRole("button", { name: "Close", exact: true }).click();
  await expect(details).toHaveCount(0);
  await page.getByRole("button", { name: "01 Discover", exact: true }).click();
  await expect(details.locator(".lb-inspector__kind")).toHaveText("phase");
  await page
    .getByRole("button", { name: "Edit lane Mobile app", exact: true })
    .click();
  await expect(details.locator(".lb-inspector__kind")).toHaveText("lane");
  await page.keyboard.press("Escape");
  await page
    .locator('[data-id="cell-app-discover"]')
    .click({ position: { x: 40, y: 20 } });
  await expect(details.locator(".lb-inspector__kind")).toHaveText("cell");
  await details.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Open details", exact: true }).click();
  await expect(details.locator(".lb-inspector__kind")).toHaveText("journey");
  await expect(page.locator(".lb-leftpanel")).toHaveCount(0);
  await expect(page.locator(".lb-dock")).toBeVisible();
});

test("Add lane on an example explains editing and continues in the duplicated journey", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open investing example" }).click();
  await page
    .locator(".lb-canvas-actions")
    .getByRole("button", { name: "Add lane", exact: true })
    .dblclick();
  const form = page.getByRole("dialog", { name: "Add lane", exact: true });
  await expect(form).toBeVisible();
  await expect(form.getByLabel("Name", { exact: true })).toBeDisabled();
  await form
    .getByRole("button", { name: "Duplicate to edit", exact: true })
    .click();
  await expect(form).toBeVisible();
  await expect(form.getByLabel("Name", { exact: true })).toBeEnabled();
  await form.getByLabel("Name", { exact: true }).fill("Partner portal");
  await form.getByRole("button", { name: "Add lane", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit lane Partner portal", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".lb-filepill__title")).toContainText("copy");
});

test("cell text cannot intercept Add when the canvas is zoomed in", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open investing example" }).click();
  await page
    .getByRole("button", { name: "Duplicate to edit", exact: true })
    .click();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator(".lb-zoombar")).toContainText("82%");
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect(page.locator(".lb-zoombar")).toContainText("98%");
  const cell = page.locator('[data-id="cell-web-need"]');
  await cell.hover();
  await cell.getByRole("button", { name: /^Add in this cell/ }).click();
  await page.getByRole("menuitem", { name: "Note", exact: true }).click();
  const details = page.locator(".lb-inspector");
  await expect(details.locator(".lb-inspector__kind")).toHaveText("note");
  await expect(details.getByLabel("Lane", { exact: true })).toHaveValue("web");
  await expect(details.getByLabel("Phase", { exact: true })).toHaveValue(
    "need",
  );
});
