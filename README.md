# Laneboard

A local-first service blueprint canvas for seeing a banking journey across channels. Map services, customer steps, frictions, support, owners and technical capabilities. Compare now and target, then present or share a file.

[Open Laneboard](https://leoncort.github.io/laneboard/) · [Download the single file](https://leoncort.github.io/laneboard/laneboard.html) · [Source repository](https://github.com/LeonCort/laneboard)

**Every journey stays in the browser.** No accounts, backend, analytics, telemetry or AI requests. The whole app builds to one self-contained HTML file with every script, style, font and icon inlined. Host it on GitHub Pages, or save it and open it straight from disk on a computer without network access. IndexedDB stores the workspace. On a hosted copy, a small service worker caches the page for offline use.

## Start

Requires Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open the investing or mortgage example from the welcome screen. Examples are read-only; choose **Duplicate to edit**. The [user guide](docs/USER-GUIDE.md) covers the working flows, and the [demo script](docs/DEMO.md) takes about three minutes.

## Verification

```sh
npm test
npm run lint
npm run build
npx playwright install chromium firefox webkit
npm run test:e2e
npm audit --audit-level=high
npm run licenses
npm run sbom
```

Browser tests run against the production build. Set `BASE_URL` to test a hosted deployment. Local preview serves the same security headers as Vercel. `tests/e2e/single-file.spec.ts` checks that the build is one file, runs from disk and runs below a sub-path. Browser coverage uses Chromium, Firefox and WebKit. Unit tests cover every friction rule, file repair and validation, structural edits and more than 100 undo/redo steps.

## Deployment

`npm run build` writes `dist/index.html`, a single self-contained page (about 1.4 MB, 600 kB gzipped). It uses relative paths only, so it runs at any sub-path and from `file://`. Next to it, `dist/` holds optional extras for a hosted copy: `sw.js` (offline cache), `manifest.webmanifest` and the install icons. The page loads them only over http(s).

**GitHub Pages.** `.github/workflows/pages.yml` tests, builds and deploys `main` to GitHub Pages. Turn it on once in the repository under Settings → Pages → Source: GitHub Actions. The workflow also publishes `laneboard.html`, the same file under a clearer name for downloading, and keeps it as a workflow artifact.

**Offline single file.** Download `laneboard.html` and open it in Chrome or Edge. It makes no network requests. The workspace is saved in that browser profile's local storage, exactly as on the hosted copy, so export backups as usual. Firefox and Safari handle storage for local files differently and are not tested from disk.

**Security policy.** Static hosts cannot send headers, so the build adds a Content Security Policy meta tag. It allows only the inlined script, by its SHA-256 hash, and no external hosts. `vercel.json` still works for a Vercel deploy and adds the headers a meta tag cannot carry (`frame-ancestors`, `Referrer-Policy`, `X-Content-Type-Options`, `Permissions-Policy`). Keep analytics and other injected scripts disabled; they conflict with the privacy model and the policy.

## Architecture

- `src/model`: Zod schemas and inferred types.
- `src/rules`: pure friction rules, capabilities and computed KPIs.
- `src/store`: Zustand, Immer and a 200-entry zundo history.
- `src/persistence`: Dexie and serialized autosave.
- `src/io`: validation, JSON/CSV and local image export.
- `src/canvas`: derived grid layout, React Flow nodes and typed edges, rough.js sketches.
- `src/views`: inspector, resizable data drawer and dedicated Overview view.
- `src/ai`: local prompt template with schema and example.
- `src/i18n`: English and Swedish interface strings.
- `src/examples`: two fictional Example Bank journeys.
- `src/styles/laneboard.css`: supplied design tokens and component system.

The versioned `.laneboard.json` file is the public data format. The supplied example imports with exactly 6 phases, 12 lanes, 5 services, 9 steps, 6 frictions and 5 feeds, and no warnings. The importer rejects broken references, duplicate IDs, malformed curves and files over 5 MB. It repairs Markdown fences, omitted IDs and common missing defaults.

## Privacy and backups

Clearing browser data deletes local work. A persistent-storage request reduces eviction risk but does not replace backups. Export the workspace regularly; the app reminds you after 14 days. Files leave the device only when you choose to export or save. AI prompts are copied for use in your own approved assistant. Never include personal customer data.

## Licences

Laneboard is MIT licensed. Dependency notices are in [docs/LICENSES.md](docs/LICENSES.md), with the CycloneDX inventory in [docs/sbom.json](docs/sbom.json). The fonts are self-hosted OFL faces.
