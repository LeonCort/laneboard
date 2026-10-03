import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
const svg = await fs.readFile("public/favicon.svg", "utf8");
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [192, 512]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<style>body{margin:0}svg{width:100vw;height:100vh}</style>${svg}`,
  );
  await page.screenshot({ path: `public/icon-${size}.png` });
}
await browser.close();
