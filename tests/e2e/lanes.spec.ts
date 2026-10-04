import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

async function blankBank(page: Page, width = 1440) {
  await page.setViewportSize({ width, height: 1000 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Start with bank channels", exact: true })
    .click();
  await expect(page.locator(".lb-sticky-phase")).toHaveCount(4);
  await page
    .getByRole("button", { name: "Collapse interface", exact: true })
    .click();
}

test("inline lane editing, grouping, hiding and adding work with tools closed", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await blankBank(page);
  await page
    .getByRole("button", { name: "Edit lane Mobile app", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "Edit lane", exact: true });
  await expect(editor.getByLabel("Name", { exact: true })).toBeFocused();
  await editor.getByLabel("Name", { exact: true }).fill("Business app");
  await editor
    .getByLabel("Subtitle", { exact: true })
    .fill("Banking on the go");
  await editor.getByLabel("Lane group").selectOption({ label: "Assisted" });
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  const label = page.getByRole("button", {
    name: "Edit lane Business app",
    exact: true,
  });
  await expect(label).toBeVisible();
  await expect(page.locator(".lb-leftpanel")).toHaveCount(0);
  await expect(page.locator(".lb-inspector")).toHaveCount(0);
  await label.click();
  await expect(editor.getByLabel("Lane group")).toHaveValue("assisted");
  await expect(editor.getByLabel("Subtitle")).toHaveValue("Banking on the go");
  await editor.getByLabel("Name", { exact: true }).fill("Mobile banking");
  await editor.getByRole("button", { name: "Hide lane", exact: true }).click();
  await expect(label).toHaveCount(0);
  const hidden = page.getByRole("button", {
    name: "Hidden lanes (1)",
    exact: true,
  });
  await expect(hidden).toBeFocused();
  await hidden.click();
  await page
    .getByRole("menuitem", { name: "Show Mobile banking", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit lane Mobile banking", exact: true }),
  ).toBeVisible();
  await expect(hidden).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(
    page.getByRole("button", { name: "Hidden lanes (1)", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(
    page.getByRole("button", { name: "Edit lane Mobile banking", exact: true }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Add lane to Assisted", exact: true })
    .click();
  const add = page.getByRole("dialog", { name: "Add lane", exact: true });
  await expect(add.getByLabel("Lane group")).toHaveValue("assisted");
  await expect(add.getByLabel("Lane kind")).toHaveValue("assisted");
  await add.getByLabel("Name", { exact: true }).fill("Video advice");
  await add.getByLabel("Subtitle").fill("Remote meetings");
  await add.getByLabel("Name", { exact: true }).press("Enter");
  await expect(
    page.getByRole("button", { name: "Edit lane Video advice", exact: true }),
  ).toBeInViewport();
  await expect(page.locator('[data-id^="cell-lane-"]')).toHaveCount(4);
  await page.keyboard.press("ControlOrMeta+z");
  await expect(
    page.getByRole("button", { name: "Edit lane Video advice", exact: true }),
  ).toHaveCount(0);
  await page.keyboard.press("ControlOrMeta+Shift+z");
  await expect(
    page.getByRole("button", { name: "Edit lane Video advice", exact: true }),
  ).toBeInViewport();
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await page.reload();
  await page
    .getByRole("button", { name: "Collapse interface", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit lane Video advice", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit lane Mobile banking", exact: true })
    .click();
  await expect(editor.getByLabel("Lane group")).toHaveValue("assisted");
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(errors).toEqual([]);
});

test("context controls fit narrow screens and remain available in empty or collapsed groups", async ({
  page,
}) => {
  await blankBank(page, 560);
  // The only backstage lane can be hidden without losing its group's add action.
  await page
    .getByRole("button", { name: "Edit lane Enablers", exact: true })
    .click();
  let editor = page.getByRole("dialog", { name: "Edit lane", exact: true });
  let box = await editor.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(560);
  const accessibility = await new AxeBuilder({ page })
    .include(".lb-lane-popover")
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  await editor.getByRole("button", { name: "Hide lane", exact: true }).click();
  await page
    .getByRole("button", { name: "Add lane to Backstage", exact: true })
    .click();
  const add = page.getByRole("dialog", { name: "Add lane", exact: true });
  await expect(add.getByLabel("Lane kind")).toHaveValue("backstage");
  await add.getByLabel("Name", { exact: true }).fill("Data platform");
  await add.getByRole("button", { name: "Add lane", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit lane Data platform", exact: true }),
  ).toBeVisible();
  const group = page
    .locator(".lb-lane-overlay")
    .getByRole("button", { name: "Backstage", exact: true });
  await group.click();
  await expect(group).toHaveAttribute("aria-expanded", "false");
  await page
    .getByRole("button", { name: "Add lane to Backstage", exact: true })
    .click();
  await add.getByLabel("Name", { exact: true }).fill("Research team");
  await add.getByRole("button", { name: "Add lane", exact: true }).click();
  await expect(group).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: "Edit lane Research team", exact: true }),
  ).toBeInViewport();
  await page
    .getByRole("button", { name: "Edit lane Research team", exact: true })
    .click();
  editor = page.getByRole("dialog", { name: "Edit lane", exact: true });
  await editor.getByLabel("Name", { exact: true }).fill("Discard this draft");
  await editor.getByLabel("Name", { exact: true }).press("Escape");
  await expect(editor).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Edit lane Research team", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Add lane", exact: true }).click();
  await add.getByLabel("Lane group").selectOption({ label: "Self-service" });
  await expect(add.getByLabel("Lane kind")).toHaveValue("digital");
  await add.getByLabel("Name", { exact: true }).fill("Partner portal");
  box = await add.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(1000);
  await add.getByRole("button", { name: "Add lane", exact: true }).click();
  await page
    .getByRole("button", { name: "Edit lane Partner portal", exact: true })
    .click();
  await expect(editor.getByLabel("Lane group")).toHaveValue("self");
});

test("inline editing protects examples and offers a duplicate before editing", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open investing example" }).click();
  await page
    .getByRole("button", { name: "Collapse interface", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit lane Customer", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "Edit lane", exact: true });
  await expect(editor.getByLabel("Name", { exact: true })).toBeDisabled();
  await expect(
    editor.getByRole("button", { name: "Hide lane", exact: true }),
  ).toBeDisabled();
  await editor
    .getByRole("button", { name: "Duplicate to edit", exact: true })
    .click();
  await expect(editor).toHaveCount(0);
  await page
    .getByRole("button", { name: "Edit lane Customer", exact: true })
    .click();
  await editor.getByLabel("Name", { exact: true }).fill("Business owner");
  await editor.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Edit lane Business owner", exact: true }),
  ).toBeVisible();
});
