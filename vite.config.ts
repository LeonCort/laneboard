import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { Plugin } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
// The build is one self-contained index.html (scripts, styles, fonts and icons
// inlined), so it can be served from any sub-path such as GitHub Pages or
// opened straight from disk. Static hosts cannot send headers, so the policy is
// a meta tag that allows exactly the inlined scripts by hash.
function contentSecurityPolicy(): Plugin {
  return {
    name: "laneboard-csp",
    apply: "build",
    enforce: "post",
    // Runs after vite-plugin-singlefile has inlined the bundle into the page.
    writeBundle(options) {
      const file = `${options.dir}/index.html`;
      const html = readFileSync(file, "utf8");
      const open = '<script type="module" crossorigin>';
      const start = html.indexOf(open) + open.length,
        end = html.lastIndexOf("</script>");
      if (start < open.length || end < start)
        throw new Error("Expected one inlined module script in index.html");
      const hash = createHash("sha256")
        .update(html.slice(start, end))
        .digest("base64");
      const policy = [
        "default-src 'self'",
        `script-src 'sha256-${hash}'`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob:",
        "font-src 'self' data:",
        "connect-src 'self' data: blob:",
        "worker-src 'self'",
        "manifest-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'none'",
      ].join("; ");
      const charset = '<meta charset="UTF-8"/>';
      writeFileSync(
        file,
        html.replace(
          charset,
          `${charset}<meta http-equiv="Content-Security-Policy" content="${policy}"/>`,
        ),
      );
    },
  };
}
export default defineConfig({
  base: "./",
  plugins: [
    react(),
    viteSingleFile({ removeViteModuleLoader: true }),
    contentSecurityPolicy(),
  ],
  preview: {
    headers: Object.fromEntries(
      JSON.parse(
        readFileSync(new URL("./vercel.json", import.meta.url), "utf8"),
      ).headers[0].headers.map((h: { key: string; value: string }) => [
        h.key,
        h.value,
      ]),
    ),
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["tests/setup.ts"],
  },
  build: { sourcemap: false, assetsInlineLimit: () => true },
});
