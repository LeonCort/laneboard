import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:4177");
await page.waitForTimeout(500);
await page.screenshot({ path: "../../work/welcome.png" });
await page.getByRole("button", { name: "Open investing example" }).click();
await page.waitForTimeout(1000);
await page.screenshot({ path: "../../work/editor.png" });
console.log(
  JSON.stringify({
    title: await page.title(),
    errors,
    text: (await page.locator("body").innerText()).slice(0, 250),
  }),
);
await browser.close();
