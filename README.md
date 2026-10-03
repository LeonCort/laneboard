# Laneboard

A local-first service blueprint canvas for seeing a banking journey across channels. Map services, customer steps, frictions, support, owners and technical capabilities. Compare now and target, then present or share a file.

**Every journey stays in the browser.** No accounts, backend, analytics, telemetry or AI requests. Static files load from Vercel; IndexedDB stores the workspace. Installed dependencies and fonts are bundled. A service worker caches the app for offline use.

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

Browser tests run against the production build. Set `BASE_URL` to test a hosted deployment. Local preview serves the same security headers as Vercel. Browser coverage uses Chromium, Firefox and WebKit. Unit tests cover every friction rule, file repair and validation, structural edits and more than 100 undo/redo steps.

## Deployment

This is a Vite static site. `vercel.json` defines the build, output directory, CSP, security headers and SPA fallback. Vercel’s Git integration deploys `main` to production and other branches to previews. No runtime environment variables are needed. Keep analytics, speed insights, the Vercel toolbar and other injected scripts disabled; they conflict with the privacy model and CSP.

## Architecture

- `src/model`: Zod schemas and inferred types.
- `src/rules`: pure friction rules, capabilities and computed KPIs.
- `src/store`: Zustand, Immer and a 200-entry zundo history.
- `src/persistence`: Dexie and serialized autosave.
- `src/io`: validation, JSON/CSV and local image export.
- `src/canvas`: derived grid layout, React Flow nodes and typed edges, rough.js sketches.
- `src/views`: inspector and resizable data drawer.
- `src/ai`: local prompt template with schema and example.
- `src/i18n`: English and Swedish interface strings.
- `src/examples`: two fictional Example Bank journeys.
- `src/styles/laneboard.css`: supplied design tokens and component system.

The versioned `.laneboard.json` file is the public data format. The supplied example imports with exactly 6 phases, 12 lanes, 5 services, 9 steps, 6 frictions and 5 feeds, and no warnings. The importer rejects broken references, duplicate IDs, malformed curves and files over 5 MB. It repairs Markdown fences, omitted IDs and common missing defaults.

## Privacy and backups

Clearing browser data deletes local work. A persistent-storage request reduces eviction risk but does not replace backups. Export the workspace regularly; the app reminds you after 14 days. Files leave the device only when you choose to export or save. AI prompts are copied for use in your own approved assistant. Never include personal customer data.

## Licences

Laneboard is MIT licensed. Dependency notices are in [docs/LICENSES.md](docs/LICENSES.md), with the CycloneDX inventory in [docs/sbom.json](docs/sbom.json). The fonts are self-hosted OFL faces.
