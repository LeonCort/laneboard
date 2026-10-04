import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import AxeBuilder from "@axe-core/playwright";
const inspector = (page: Page) => page.locator(".lb-inspector");
async function setup(page: Page, readOnly = false) {
  const file = JSON.parse(
      await readFile("tests/fixtures/connections.laneboard.json", "utf8"),
    ),
    j = file.journeys[0];
  j.readOnly = readOnly;
  j.targetState = "not-started";
  j.lanes[1].channel = {
    type: "digital",
    platform: "app",
    authenticated: true,
    webviewHost: false,
  };
  j.lanes.push({
    id: "netbank",
    name: "Internet bank",
    kind: "channel",
    channel: { type: "digital", platform: "web", authenticated: true },
  });
  j.services[0].status.now = { app: "missing", netbank: "native" };
  await page.goto("/");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.getByLabel("Or paste JSON").fill(JSON.stringify(file));
  await page.getByRole("button", { name: "Preview import" }).click();
  await page.getByRole("button", { name: "Import into workspace" }).click();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("tab", { name: /^Services/ }).click();
  await page
    .getByRole("button", { name: "Savings options", exact: true })
    .click();
  await expect(inspector(page).getByLabel("Name", { exact: true })).toHaveValue(
    "Savings options",
  );
}
async function exported(page: Page, csv = false) {
  const downloading = page.waitForEvent("download");
  if (csv) await page.getByRole("button", { name: "CSV", exact: true }).click();
  else await page.getByRole("button", { name: /Whole workspace/ }).click();
  const stream = await (await downloading).createReadStream(),
    chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString();
}
test("models app browser handoffs, assesses the destination, separates Target and preserves exports", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await setup(page);
  await inspector(page)
    .getByLabel("Mobile app", { exact: true })
    .selectOption("info");
  await expect(inspector(page)).toContainText("no direct link is offered");
  await inspector(page)
    .getByLabel("Mobile app", { exact: true })
    .selectOption("browser-link");
  await expect(inspector(page)).toContainText("opens in a separate browser");
  await expect(inspector(page).locator(".lb-rule-list")).toContainText(
    "choose the web destination",
  );
  await inspector(page)
    .getByLabel("Mobile app — Web destination")
    .selectOption("netbank");
  await expect(inspector(page).locator(".lb-rule-list")).toContainText(
    "assess the system and responsiveness",
  );
  await inspector(page)
    .getByRole("button", { name: "Edit destination characteristics" })
    .click();
  const system = inspector(page).getByLabel("Internet bank — Web system"),
    responsive = inspector(page).getByLabel(
      "Internet bank — Responsive design",
    );
  await system.selectOption("legacy");
  await responsive.selectOption("no");
  await expect(inspector(page).locator(".lb-rule-list")).toContainText(
    "do not offer this link",
  );
  await page.screenshot({
    path: testInfo.outputPath("legacy-browser-handoff.png"),
  });
  await system.selectOption("modern");
  await expect(inspector(page).locator(".lb-rule-list")).toContainText(
    "do not offer this link",
  );
  await responsive.selectOption("unknown");
  await expect(inspector(page).locator(".lb-rule-list")).toContainText(
    "assess the system and responsiveness",
  );
  await responsive.selectOption("yes");
  await expect(inspector(page).locator(".lb-rule-list")).toContainText(
    "recorded as modern and responsive",
  );
  await expect(inspector(page).locator(".lb-rule-list")).not.toContainText(
    "do not offer this link",
  );
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole("button", { name: "Target", exact: true }).click();
  await page.getByRole("button", { name: "Create Target from Now" }).click();
  await expect(page.getByRole("dialog")).toContainText(
    "No differences from Now yet",
  );
  await page.keyboard.press("Escape");
  await expect(system).toHaveValue("modern");
  await system.selectOption("legacy");
  await expect(inspector(page).locator(".lb-rule-list")).toContainText(
    "do not offer this link",
  );
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("tab", { name: /^Target changes/ }).click();
  await expect(page.getByRole("tabpanel")).toContainText(
    "Modern system · Responsive → Legacy system · Responsive",
  );
  await page.getByRole("button", { name: "Now", exact: true }).click();
  await page.getByRole("tab", { name: /^Services/ }).click();
  await expect(
    page.getByLabel("Savings options — Mobile app status"),
  ).toHaveValue("browser-link");
  const csv = await exported(page, true);
  expect(csv).toContain('"Internet bank system"');
  expect(csv).toContain(
    '"browser-link","unknown","unknown","Internet bank","native","modern","yes"',
  );
  await page.getByRole("button", { name: "Export", exact: true }).click();
  const json = JSON.parse(await exported(page));
  const service = json.journeys[0].services[0];
  expect(service.delivery.now.app.destination).toBe("netbank");
  expect(service.delivery.now.netbank).toEqual({
    system: "modern",
    responsive: "yes",
  });
  expect(service.delivery.target.netbank).toEqual({
    system: "legacy",
    responsive: "yes",
  });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("tab", { name: /^Services/ }).click();
  await page
    .getByRole("button", { name: "Savings options", exact: true })
    .click();
  await inspector(page)
    .getByText("Internet bank · Channel characteristics", { exact: true })
    .click();
  await expect(system).toHaveValue("modern");
  await expect(
    page.getByRole("status").filter({ hasText: "Saved in this browser" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Data", exact: true }).click();
  await page.getByRole("tab", { name: /^Services/ }).click();
  await expect(
    page.getByLabel("Savings options — Mobile app status"),
  ).toHaveValue("browser-link");
  expect(errors).toEqual([]);
});
test("read-only services keep browser characteristics inspectable without editing", async ({
  page,
}) => {
  await setup(page, true);
  await expect(
    inspector(page).getByLabel("Mobile app", { exact: true }),
  ).toBeDisabled();
  await inspector(page)
    .getByText("Internet bank · Channel characteristics", { exact: true })
    .click();
  await expect(
    inspector(page).getByLabel("Internet bank — Web system"),
  ).toBeDisabled();
  await expect(
    inspector(page).getByLabel("Internet bank — Responsive design"),
  ).toBeDisabled();
});
