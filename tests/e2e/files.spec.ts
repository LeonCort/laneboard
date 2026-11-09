import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import example from "../../src/examples/investing.laneboard.json" with { type: "json" };
const editable = (title: string) => {
  const file = structuredClone(example);
  Object.assign(file.journeys[0], { readOnly: false, title });
  return JSON.stringify(file);
};
// Real file pickers cannot be driven by a test, so stand in for the File
// System Access API with an in-page disk.
async function fakeFileSystem(page: Page, files: Record<string, string>) {
  await page.addInitScript((initial) => {
    const disk = new Map<string, string>(Object.entries(initial));
    const handle = (name: string) => ({
      name,
      getFile: async () => new File([disk.get(name) ?? ""], name),
      createWritable: async () => {
        let text = "";
        return {
          write: async (x: string) => void (text += x),
          close: async () => void disk.set(name, text),
        };
      },
    });
    const w = window as unknown as Record<string, unknown>;
    w.__disk = disk;
    w.__nextOpen = Object.keys(initial)[0];
    w.__nextSave = "copy.laneboard.json";
    w.showOpenFilePicker = async () => [handle(w.__nextOpen as string)];
    w.showSaveFilePicker = async () => handle(w.__nextSave as string);
  }, files);
}
const onDisk = (page: Page, name: string) =>
  page.evaluate(
    (n) =>
      JSON.parse(
        (window as unknown as { __disk: Map<string, string> }).__disk.get(n)!,
      ).journeys[0].title as string,
    name,
  );
const rename = async (page: Page, title: string) => {
  // The journey title in the top bar selects the journey and shows its details.
  await page.locator(".lb-filepill__title").click();
  const field = page
    .getByRole("textbox", { name: "Name", exact: true })
    .first();
  await field.fill(title);
  await field.press("Tab");
};
test("opens a Laneboard file, saves over it and saves a separate copy", async ({
  page,
}) => {
  await fakeFileSystem(page, {
    "savings.laneboard.json": editable("Savings journey"),
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Open Laneboard file…" }).click();
  await expect(page.locator(".lb-toast")).toContainText(
    "Opened savings.laneboard.json",
  );
  const state = page.getByTestId("file-state");
  await expect(state).toHaveAttribute("data-dirty", "false");
  await expect(state).toContainText("savings");
  await expect(page).toHaveTitle("savings.laneboard.json — Laneboard");

  await rename(page, "Savings, revised");
  await expect(state).toHaveAttribute("data-dirty", "true");
  await expect(page).toHaveTitle("• savings.laneboard.json — Laneboard");
  await page
    .locator(".lb-canvas, .react-flow")
    .first()
    .click({ position: { x: 5, y: 300 } });
  await page.keyboard.press("ControlOrMeta+s");
  await expect(state).toHaveAttribute("data-dirty", "false");
  expect(await onDisk(page, "savings.laneboard.json")).toBe("Savings, revised");

  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Search actions…").fill("Save as…");
  await page.getByRole("option", { name: "Save as…", exact: true }).click();
  await expect(state).toContainText("copy");
  await rename(page, "Only in the copy");
  await state.click();
  await expect(state).toHaveAttribute("data-dirty", "false");
  expect(await onDisk(page, "copy.laneboard.json")).toBe("Only in the copy");
  expect(await onDisk(page, "savings.laneboard.json")).toBe("Savings, revised");
});
test("asks before replacing unsaved work and can start an empty Laneboard", async ({
  page,
}) => {
  await fakeFileSystem(page, { "a.laneboard.json": editable("A") });
  await page.goto("/");
  await page.getByRole("button", { name: "Open Laneboard file…" }).click();
  await rename(page, "A, unsaved");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Search actions…").fill("New empty Laneboard");
  await page
    .getByRole("option", { name: "New empty Laneboard", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Replace the current Laneboard?",
  });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByTestId("file-state")).toHaveAttribute(
    "data-dirty",
    "true",
  );
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByPlaceholder("Search actions…").fill("New empty Laneboard");
  await page
    .getByRole("option", { name: "New empty Laneboard", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Continue without saving" }).click();
  await expect(
    page.getByRole("button", { name: "Open investing example" }),
  ).toBeVisible();
  await expect(page.getByTestId("file-state")).toHaveCount(0);
});
test("without file pickers, opens with a file input and saves by downloading", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.showOpenFilePicker;
    delete w.showSaveFilePicker;
  });
  await page.goto("/");
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Open Laneboard file…" }).click();
  await (
    await chooser
  ).setFiles({
    name: "plain.laneboard.json",
    mimeType: "application/json",
    buffer: Buffer.from(editable("Plain")),
  });
  await expect(page.getByTestId("file-state")).toContainText("plain");
  await rename(page, "Plain, downloaded");
  const download = page.waitForEvent("download");
  await page.getByTestId("file-state").click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("plain.laneboard.json");
  const saved = JSON.parse(await readFile((await file.path())!, "utf8"));
  expect(saved.journeys[0].title).toBe("Plain, downloaded");
  await expect(page.getByTestId("file-state")).toHaveAttribute(
    "data-dirty",
    "false",
  );
});
