import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
await page.goto(process.env.BASE_URL || "http://127.0.0.1:4177");
await page.getByRole("button", { name: "Open investing example" }).click();
for (const theme of ["light", "dark"]) {
  await page.evaluate(
    (t) => (document.documentElement.dataset.theme = t),
    theme,
  );
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  console.log(
    JSON.stringify({
      theme,
      violations: result.violations.map((v) => ({
        id: v.id,
        count: v.nodes.length,
        nodes: v.nodes
          .map((n) => ({ target: n.target, summary: n.failureSummary }))
          .slice(0, 10),
      })),
    }),
  );
}
await browser.close();
