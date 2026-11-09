import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";

async function setup(page: Page, readOnly = false) {
  const file = JSON.parse(
    await readFile("tests/fixtures/connections.laneboard.json", "utf8"),
  );
  file.journeys[0].readOnly = readOnly;
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
  await expect(
    page.locator('[data-id="service-account-app"]'),
  ).toBeInViewport();
}
const card = (page: Page, id: string) => page.locator(`[data-id="${id}"]`);
const picker = (page: Page) => page.locator(".lb-link-popover");
async function openLinks(page: Page, id: string) {
  await card(page, id).hover();
  await card(page, id)
    .getByRole("button", { name: /^Add link from/ })
    .click();
  await expect(picker(page)).toBeVisible();
}
async function dragLink(page: Page, from: string, to: string, valid = true) {
  await card(page, from).hover();
  const button = card(page, from).getByRole("button", {
    name: /^Add link from/,
  });
  // The plus appears on hover; measure it only once it is shown, so the press
  // lands on the handle on slower machines too.
  await expect(button).toBeVisible();
  const plus = await button.boundingBox(),
    target = await card(page, to).boundingBox();
  expect(plus).not.toBeNull();
  expect(target).not.toBeNull();
  await page.mouse.move(plus!.x + plus!.width / 2, plus!.y + plus!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    plus!.x + plus!.width / 2 + 8,
    plus!.y + plus!.height / 2,
    { steps: 4 },
  );
  await expect(card(page, to).locator(".lb-card")).toHaveAttribute(
    "data-link-target",
    String(valid),
  );
  await page.mouse.move(
    target!.x + target!.width / 2,
    target!.y + target!.height / 2,
    { steps: 12 },
  );
  await page.mouse.up();
  await expect(picker(page)).toHaveCount(0);
}

test("search connects services with keyboard, updates details, undoes and saves the link", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await setup(page);
  await openLinks(page, "service-options-app");
  await picker(page)
    .getByRole("combobox", { name: "Find a connection" })
    .fill("nothing matches");
  await expect(picker(page).getByRole("option")).toHaveCount(0);
  await picker(page)
    .getByRole("combobox", { name: "Find a connection" })
    .fill("Open savings");
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.keyboard.press("Enter");
  await expect(page.locator(".lb-edge--service")).toHaveCount(1);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator(".lb-edge--service")).toHaveCount(0);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(page.locator(".lb-edge--service")).toHaveCount(1);
  await card(page, "service-options-app").click();
  const details = page.locator(".lb-inspector");
  await expect(
    details.getByLabel("Open savings account", { exact: true }),
  ).toBeChecked();
  await expect(
    details.getByLabel("Flow connection", { exact: true }),
  ).toHaveValue("connected");
  await details.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: /Whole workspace/ }).click();
  const stream = await (await downloading).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.journeys[0].services[0].linksTo).toEqual(["account"]);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("status").filter({ hasText: "Saved in this browser" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".lb-edge--service")).toHaveCount(1);
  await openLinks(page, "service-options-app");
  await picker(page)
    .getByRole("option", { name: /Open savings account/ })
    .click();
  await expect(page.locator(".lb-edge--service")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("dragging the hover plus connects services and retargets feeds without moving cards", async ({
  page,
}) => {
  await setup(page);
  const position = await card(page, "service-options-app").evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await dragLink(page, "service-options-app", "service-account-app");
  await expect(page.locator(".lb-edge--service")).toHaveCount(1);
  await expect(card(page, "service-options-app")).toHaveCSS(
    "transform",
    position,
  );
  await card(page, "service-options-app")
    .getByRole("button", { name: /^Add link from/ })
    .focus();
  await page.keyboard.press("Enter");
  await expect(picker(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(picker(page)).toHaveCount(0);
  await dragLink(page, "service-options-app", "step-compare-app", false);
  await expect(page.locator(".lb-edge--service")).toHaveCount(1);
  await expect(card(page, "service-options-app")).toHaveCSS(
    "transform",
    position,
  );
  await dragLink(page, "feed-signal-customer", "step-open-app");
  await expect(page.locator('[data-id="feed-edge-signal"]')).toHaveAttribute(
    "aria-label",
    "Edge from feed-signal-customer to step-open-app",
  );
  await card(page, "feed-signal-customer").click();
  await expect(
    page.locator(".lb-inspector").getByLabel("Informs step"),
  ).toHaveValue("open");
  await page
    .locator(".lb-inspector")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(page.locator('[data-id="feed-edge-signal"]')).toHaveAttribute(
    "aria-label",
    "Edge from feed-signal-customer to step-compare-app",
  );
});

test("feed search works in a smaller window without opening a second pane", async ({
  page,
}) => {
  await page.setViewportSize({ width: 924, height: 1000 });
  await setup(page);
  await openLinks(page, "feed-signal-customer");
  await expect(page.locator(".lb-tools-sheet")).toHaveCount(0);
  await picker(page)
    .getByRole("combobox", { name: "Find a connection" })
    .fill("Open an account");
  await page.keyboard.press("Enter");
  await expect(page.locator('[data-id="feed-edge-signal"]')).toHaveAttribute(
    "aria-label",
    "Edge from feed-signal-customer to step-open-app",
  );
  await openLinks(page, "feed-signal-customer");
  await page.keyboard.press("Escape");
  await expect(picker(page)).toHaveCount(0);
  await expect(page.locator(".lb-dock")).toBeVisible();
});

test("read-only link controls continue in a duplicate, and the plus remains clickable after fitting", async ({
  page,
}) => {
  await setup(page, true);
  await openLinks(page, "service-options-app");
  await picker(page)
    .getByRole("button", { name: "Duplicate to edit", exact: true })
    .click();
  await expect(
    picker(page).getByRole("combobox", { name: "Find a connection" }),
  ).toBeEnabled();
  await picker(page)
    .getByRole("option", { name: /Open savings account/ })
    .click();
  await expect(page.locator(".lb-edge--service")).toHaveCount(1);
  await expect(page.locator(".lb-filepill__title")).toContainText("copy");
  await page
    .locator(".lb-inspector")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page.getByRole("button", { name: "Fit to screen" }).click();
  await expect(page.locator(".lb-zoombar")).toContainText("100%");
  await openLinks(page, "service-options-app");
  await expect(
    picker(page).getByRole("option", { name: /Connected · select to remove/ }),
  ).toBeVisible();
});
