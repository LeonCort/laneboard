import fs from "node:fs/promises";
const lock = JSON.parse(await fs.readFile("package-lock.json", "utf8"));
const rows = [];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path || entry.dev) continue;
  const p = JSON.parse(await fs.readFile(`${path}/package.json`, "utf8"));
  rows.push([
    p.name,
    p.version,
    typeof p.license === "string"
      ? p.license
      : JSON.stringify(p.license || "See package licence"),
  ]);
}
rows.sort((a, b) => a[0].localeCompare(b[0]));
await fs.writeFile(
  "docs/LICENSES.md",
  `# Runtime dependency licences\n\nGenerated from the committed lockfile. Fonts are self-hosted; their font files use the SIL Open Font License.\n\n| Package | Version | Licence |\n| --- | --- | --- |\n${rows.map((r) => `| ${r.join(" | ")} |`).join("\n")}\n`,
);
console.log(`Wrote ${rows.length} runtime dependency notices.`);
