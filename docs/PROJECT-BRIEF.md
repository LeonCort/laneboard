# Laneboard: Project Brief

Oct 3, 2026 · @Leon Cort

## Summary

Laneboard is a local-first, browser-based canvas for mapping service blueprints across a bank's channels. It shows lanes for every touchpoint, a customer journey drawn across them, and the services, frictions and technical capabilities that shape the experience. It sits between Excalidraw (fast, free-form, local) and Figma (structured, polished). It is built for banks but not tied to any one bank. All data stays on the user's device, and the app never sends anything over the network.

Customer experience work in a bank spans products, private and business banking, and channel development. Today that work lives in slides and whiteboards that cannot hold structure, compare current and target states, or be reused. Laneboard makes the map itself the working artefact.

**Working name:** Laneboard (to be confirmed).

**v1 is successful when:**

- A new user opens the tool, loads the bundled example and presents it in under one minute.
- A user imports an AI-generated JSON file and gets a complete, editable map with no manual setup.
- The app makes zero network requests after the page has loaded, which DevTools shows and the Content Security Policy enforces.
- The rules engine flags every service that is a webview inside a linked flow, or available in only one logged-in channel.

## Background and problem

Banks organise around silos (products, private banking, business banking, digital channels, branches and service, IT) so they can scale. Customers move across those silos, and the friction lands on them at the seams:

- They restart a task because context does not follow them between channels.
- Information about the same service differs between channels.
- A service exists in one channel but not another, or only as a reference to another channel.
- A webview gets used to cover a gap, but it cannot follow links into other tasks, so the channel's version becomes a compromise.

A cross-cutting customer experience function needs one map that shows all of this at once. Existing tools do not fit a bank's constraints:

| Tool type | Why it falls short |
| --- | --- |
| Cloud journey-management platforms (TheyDo, Smaply and similar) | Data leaves the bank. Procurement and security review take months. |
| Figma, Miro | Cloud-hosted and unstructured. No data model, no rules, no current vs target comparison. |
| Excalidraw | Local and fast, but free-form only. No lanes, data model or analysis. |
| PowerPoint, Excel | Static. Cannot toggle layers or compare states, and structure is lost between versions. |

A working HTML prototype was built during exploration. It proves the concept: scenarios, toggleable layers, a services table with friction rules, a current/target toggle, a guided presentation and a "silos vs. cross-cutting role" view. Laneboard turns that prototype into a proper, local, reusable tool.

## Privacy and local-first

Laneboard is local-first in the Excalidraw sense. It is hosted as a static site on Vercel, but every journey lives in the user's own browser, and nothing the user creates is ever sent to a server. It is a personal productivity tool, not a procured bank system. Open-source libraries are therefore fine, as long as they are bundled at build time. These rules are fixed. If a feature conflicts with one of them, the rule wins and the feature is dropped.

1. **Static hosting on Vercel.** A Vite build deployed as a static site: no serverless or edge functions, no database, no accounts. Every branch gets a preview deployment, and `main` deploys to production.
2. **No user data leaves the browser.** No backend, sync, analytics, telemetry or error reporting, which rules out Vercel Analytics, Speed Insights and Sentry. The only network traffic is loading the app's own static files.
3. **Bundle every dependency.** Use npm libraries freely (React, React Flow, Radix, Zustand, Dexie and the rest), but bundle them with Vite.
   - No CDN script tags.
   - No remote fonts: self-host them with `@fontsource`.
   - No runtime fetches of code or data.
4. **Enforce it with headers.** `vercel.json` sets a Content Security Policy for all routes: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'none'`. It also sets `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`, and a `Permissions-Policy` that turns off camera, microphone and geolocation. Inline styles are allowed because React Flow sets them. Inline scripts are not.
5. **Store in the browser.**
   - Workspaces live in IndexedDB through Dexie.
   - Request persistent storage with `navigator.storage.persist()` so the browser does not evict data.
   - Clearing browser data deletes everything, so show a gentle reminder to export a backup when the last export is over 14 days old.
   - Data leaves the browser only through an explicit export (a download), or a save through the File System Access API where the browser supports it.
6. **Work offline.** An installable PWA (`vite-plugin-pwa`) caches the app shell, so the tool opens and works with no network after the first visit.
7. **No AI inside the app.** AI generation happens outside the tool, in whatever assistant the user is allowed to use. Laneboard only builds the prompt (Appendix B), copies it to the clipboard and reads the resulting file.
8. **Treat imported files as untrusted.**
   - Validate against the schema and cap file size at 5 MB.
   - Render all text as text: no `dangerouslySetInnerHTML`, and no HTML from imports.
   - Never fetch URLs. Open links only on click, with `rel="noopener noreferrer"`.
9. **Keep dependencies healthy.** Prefer MIT, Apache-2.0, BSD or ISC licences, commit the lockfile and keep `npm audit` free of high or critical issues at release.
10. **No customer data.** The tool maps journeys, not individuals. The import dialog and the empty state say so in one line.
11. **No silent data loss.**
    - Autosave on every change, with a visible "Saved" indicator.
    - One-click backup export.
    - A confirmation step built into the UI before deleting a journey or clearing the workspace.

A Playwright test loads the production build, runs through the main flows and fails if any request goes to a host other than the app's own origin.

## Users and use cases

The primary user is a customer experience or channel strategist who owns the map and presents it. Secondary users are service designers, product owners, architects and analysts who receive an exported file and refine their part of it. Everyone works on a desktop browser at 1440 px or wider and sometimes presents on a projector. One person edits a workspace at a time, and files are shared by hand.

| Use case | Who | What they do |
| --- | --- | --- |
| Map a scenario | Strategist, designer | Create a journey with phases and lanes, place the customer's steps, draw the path across channels. |
| Start from AI | Strategist | Describe a scenario to an approved AI assistant using the built-in prompt, import the JSON it returns, then refine it. |
| Register services | Strategist, product owner | List the services a journey needs and set their status per channel, for now and target. Mark whether each is an isolated task or links on. |
| Find friction | Strategist, architect | Read the rule output: webviews in linked flows, single-channel services, restarts. See which technical capabilities each fix needs. |
| Compare now vs target | All | Flip one toggle and see statuses, the path, the experience curve and the KPIs change. |
| Present | Strategist | Run a guided walkthrough with layers switching per step, or focus one lane group. |
| Share | All | Export a journey file for a colleague, a PNG or SVG for slides, or CSV of services and frictions. |
| Keep a library | Strategist | Hold several journeys in one workspace, duplicate one as a starting point and back up the workspace to a file. |

## Core concepts and data model

A map is a grid of **phases** (columns) by **lanes** (rows), with a customer journey drawn across it. Everything lives in one typed model with a single source of truth. The canvas, tables and KPIs are all views of that model, and rules are pure functions over it. Appendix A has the exact file format.

### Entities

| Entity | Belongs to | Key fields | Notes |
| --- | --- | --- | --- |
| Workspace | Device | journeys, owners, capabilities, settings | One per browser profile. Exported as a backup file. |
| Journey | Workspace | id, title, segment, goal, description | One scenario, for example "Small business owner starts investing". |
| Phase | Journey | id, name, order, width | The columns. |
| Lane group | Journey | id, name, lineAfter | Collapsible. `lineAfter` draws a labelled line, such as the self-service boundary or the line of visibility. |
| Lane | Journey | id, group, kind, name, sub, channel, owner | `kind` is one of: customer, entry, channel, backstage, market. Channel lanes carry `channel.type` (digital or assisted), `channel.authenticated` and `channel.webviewHost`. |
| Cell note | Lane × phase | text | Short descriptive text in a cell, such as a touchpoint or a competitor pattern. |
| Service | Journey | id, name, description, phase, isolated, linksTo, status.now, status.target, capabilities | What the customer uses. Status is set per digital channel lane: native, webview, info, missing, planned or na. |
| Journey step | Journey | id, lane, phase, text, in, transition, notes | An ordered waypoint on the path. `in` is now, target or both. `transition` is how the customer arrived here, and can differ per mode. |
| Friction | Journey | id, lane, phase, title, now, recommendation, othersPattern, owner, assumption | A named problem with its current state, what we recommend and how others solve it. |
| Feed | Journey | id, kind, lane, phase, text, explanation, to | An alternative entry (another product, a third party) or a support function that informs a journey step. |
| Experience curve | Journey | now\[\], target\[\] | One value from −2 (hard) to +2 (easy) per phase. |
| Presentation step | Journey | title, text, layers, focusLanes, dimJourney | Optional. A default sequence is generated when none is given. |
| Owner | Workspace | id, name, description | Teams or workstreams of the experience function that own frictions and lanes. |
| Capability | Workspace | id, name, description | Technical capabilities such as session handover, deep linking, context sharing, webview or next best action. These are not services. |

### Terms that must stay distinct

- **Service:** something the customer uses, for example a savings guide or opening a fund account.
- **Capability:** a technical ability that makes services work across channels, for example session handover or context sharing.
- **Isolated task:** a service that can be completed without linking on to another task. A service with any `linksTo` entry is never isolated, and the UI disables the isolated checkbox once a link is added.
- **Webview:** web content embedded in the native app. It works for isolated tasks. In a flow that links on, it cannot follow the link, so the app's version becomes a compromise.

### Transition types

| Type | Meaning | Edge style |
| --- | --- | --- |
| start | First step | none |
| channel-switch | Customer moves on in self-service, within or between channels | solid, accent |
| restart | Customer must start over: lost context or a dead end | dashed, critical, labelled "Restart" |
| to-support | Self-service is not enough, so the customer goes to customer service | dashed, warning |
| lead-to-advisor | A valuable lead goes to an advisor | thick, solid |
| back-to-digital | After the assisted step the relationship continues digitally | dotted |

### Friction rules

Rules run per service, for the selected mode, across digital channel lanes. A service counts as available in a channel when its status there is native or webview. Severity is none, medium or high.

| Rule | Condition | Severity | Message (template) | Capabilities required |
| --- | --- | --- | --- | --- |
| R1 Webview in linked flow | Status is webview and the service is not isolated | High | Webview in {channel}, but the flow links on to {linked services}. The webview cannot follow the link, so the channel's version is a compromise. | webview, context sharing, deep linking |
| R2 Webview fits | Status is webview and the service is isolated | none (positive note) | Webview in {channel} fits: the task is isolated. | webview |
| R3 Single channel | Available in exactly one authenticated digital channel, and the other is not na | High if not isolated, else Medium | Only in {channel}. A customer in {other} {is referred on / waits / hits a dead end} and must switch channel. | session handover, deep linking |
| R3b Webview as fix | R3 fired and the missing channel is a webview host | note | Isolated: can be offered in {channel} as a webview. Not isolated: webview is not an option, because the flow links on to {linked}. | none |
| R4 Not available | Not available in any authenticated channel, and at least one is applicable | Medium | Not yet available in any logged-in channel. | none |
| R5 Context | Not isolated and available somewhere | none | none | context sharing |

Rules live in one pure module with unit tests for every row. They are hard-coded in v1, and making them user-configurable comes later.

## Functional requirements

The canvas has two layers. A structured grid (phases by lanes) is the backbone, which is the Figma side. A free-form layer on top (notes, arrows, text, simple shapes) gives Excalidraw-like speed. Every free-form item can be pinned to a cell or float.

### Canvas and grid

- Infinite canvas with pan, zoom (Ctrl/Cmd + scroll, pinch, +/−, fit to screen) and a minimap.
- The lane header column stays fixed while panning horizontally, and the phase header row stays fixed while panning vertically.
- Lane height grows with its content, and phase width is resizable by dragging the column edge.
- A customer steps row sits under the phases. An experience curve row follows it, where users drag points to edit the value per phase.

### Lanes and phases

- Add, rename, delete and reorder lanes and phases by drag and drop.
- Group lanes. Collapse or expand a group, and hide or show a single lane.
- Set a lane's kind, channel properties, owner and tint.
- Labelled lines between groups, such as "Self-service boundary" and "Line of visibility".
- Templates for a new journey: blank, generic bank channel set, and the example journey.

### Cards

- Card types: note, service, journey step, friction, feed, competitor pattern.
- Create a card by double-clicking a cell, from a palette, or by keyboard (N for note, S for service, F for friction).
- Edit text inline. Every other field lives in a detail panel on the right.
- Multi-select, move between cells, copy, paste, duplicate and delete.
- Undo and redo for every change (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z).
- A service card shows its status in its channel with a dot and a label, never colour alone. A webview in a linked flow gets a critical border.

### Journey path

- Steps are numbered automatically in path order. Reorder them in the detail panel or by dragging in a step list.
- Edges between consecutive steps are drawn automatically and styled by transition type. Restart edges carry a "Restart" label at their midpoint.
- Edges route around collapsed lanes and hidden layers without breaking.
- Feeds draw dashed edges to the step they inform.

### Modes: now and target

- A global toggle switches between now and target.
- Switching rewrites service statuses, visible steps (`in`), transition types, the experience curve and the KPIs.
- Items that change between modes get a subtle highlight, and services read "changed" in target mode.

### Layers

- Toggle chips for: Services, Journey, Frictions, Feeds & support, Market, Owners.
- The Owners layer outlines lanes and frictions by owner. A filter chip per owner dims everything else.

### Data views (bottom drawer)

- The map is always the main surface. Data views open in a resizable drawer over the bottom of the canvas, with tabs for each view.
- **Services:** an editable table with one row per service. Columns: name, description, isolated, links to, status per digital channel, friction severity, rule messages and capabilities required. Status selects edit the current mode.
- **Frictions:** id, title, phase, lane, current state or recommendation (by mode), others' pattern and owner.
- **Capabilities:** one card per capability, listing the services that need it in the current mode.
- **Steps:** the journey path in order, with transition type and notes per mode.
- **Overview** (opened from the left rail): owners with the frictions they own, plus the "silos vs cross-cutting function" diagram in three toggleable states.

### KPIs in the inspector

All values are computed from the model, never invented:

- restarts in the journey;
- number of frictions;
- service coverage (native statuses out of applicable statuses);
- services with friction;
- channels the journey touches;
- a goal card with an optional baseline and target that the user types in.

### Presentation

- A guided walkthrough with title, text, layers, focused lanes and dimmed path per step. It comes from the file, or from a default six-step sequence:
  1. channels and services;
  2. journey;
  3. frictions;
  4. feeds;
  5. market;
  6. owners.
- Full-screen presentation mode, with arrow keys to move and Esc to exit.

### Workspace

- The left panel lists journeys. Create, duplicate, rename and delete them.
- Search across all card text. Filter by owner, severity or lane.
- UI strings live in one dictionary: English by default, Swedish as the second language.
- Settings: accent colour, workspace logo (stored locally), language, and light, dark or system theme.

## Import, export and AI-generated files

One JSON format (Appendix A) covers both backups and AI-generated maps. That keeps the importer the single entry point for content, so the tool needs no generators of its own.

### Import

- Bring a file in with the file picker, by dragging it onto the window, or by pasting JSON into a dialog.
- File extension `.laneboard.json`. Plain `.json` is also accepted.
- Validate with Zod against the versioned schema and run migrations for older `schemaVersion` values.
- **Forgiving with AI output:**
  - Generate missing ids from names.
  - Fill defaults (empty arrays, status `na`, mode `both`).
  - Strip Markdown code fences around the JSON.
  - Ignore unknown fields and list them as warnings.
- **Strict on structure.** Reject with a readable list of problems and their JSON paths when references do not resolve (a step pointing at a missing lane), when experience arrays do not match the number of phases, or when ids are duplicated.
- A preview before committing shows the journey title, phase count, lane count, services, frictions and warnings.
- On import, choose between adding the file as new journeys or replacing the journey with the same id.

### Export

- One journey or the whole workspace as `.laneboard.json`.
- The current map view as PNG or SVG, with the visible layers and current mode, at 1× or 2× scale. Rendered locally.
- Services and frictions as CSV, for spreadsheets.
- A print stylesheet for the Services and Frictions tables, so the browser's own print to PDF works.

### AI-assisted creation

- A "Create with AI" dialog takes a free-text description of the scenario and optional pasted notes.
- It builds the prompt in Appendix B with the schema and an excerpt of the example embedded, and copies it to the clipboard.
- The user pastes the prompt into the bank's approved assistant, saves the reply and imports it.
- No network call is made, and the dialog says so.
- Imported items flagged `assumption: true` show an "Assumption" tag until a user clears it.

## Bundled example journey

The app ships with two example journeys for a fictional "Example Bank". They load from the empty state with one click and are read-only until duplicated. All names are generic, with no real bank, brand or person.

**1. Small business owner starts investing** (business). This is the main example, and its full file is Appendix A. Goal: more small businesses invest their surplus. The current state shows realistic channel friction:

- **Analysis tools in the internet bank only.** The surplus analysis and inflation tool exist only in the internet bank.
- **Savings guide in the app only.** The guide helps the customer understand their risk appetite, sets a reasonable amount and proposes an active monthly saving in a fund. It exists only in the app, and it links on to opening a fund account or investment savings account (ISK), which is a separate task. It is therefore not isolated, so it cannot be moved into the app or web as a webview.
- **Account opening in an isolated webview.** Opening the fund account runs in a webview in the app, which suits an isolated task.
- **Restarts on the path.** The journey restarts twice: from the web analysis to the app guide, and after the separate account-opening task, when the guide's proposal does not carry over.
- **Fund trading split across channels.** It exists in the internet bank and is being built for the app, without one shared capability.
- **Six frictions,** owned by four owners, with recommendations and patterns from other banks marked as assumptions.

In the target state the analysis follows into the guide, the account opens in the flow and the proposed funds are bought directly. Restarts drop from 2 to 0.

**2. Mortgage from calculator to contract** (private). It is shorter and marked throughout as assumptions. It shows a journey that starts at a third-party comparison site, moves to support, becomes an advisor lead and returns to digital signing.

The examples double as test fixtures. Snapshot tests check that each one imports cleanly and that the rules produce the expected severities.

## Technical architecture and stack

Laneboard is a static single-page app hosted on Vercel: React with TypeScript, React Flow for the canvas, and IndexedDB for storage. All of it runs inside the browser, and its only exits are files the user chooses to save. The model and rules are pure TypeScript with no UI dependency, so they can be unit-tested and reused, for example by a future command-line validator for AI files.

&#91;embedded content: architecture · the browser boundary\]

The browser boundary is the privacy model. The only inbound traffic is the app's own static files from Vercel, and journeys leave only as files the user saves.

| Concern | Choice | Why |
| --- | --- | --- |
| Language, UI | TypeScript (strict), React 18 | Typed model, a large ecosystem |
| Build | Vite with `vite-plugin-pwa`, static deploy to Vercel | Fast builds, static output, offline after first visit, preview deploy per branch |
| Canvas | React Flow (`@xyflow/react`) | Pan, zoom, custom nodes, edges, minimap and selection, all MIT-licensed |
| State | Zustand + Immer, undo via `zundo` | Small and predictable, with undo history |
| Schema, validation | Zod, with types inferred from the schema | One source for types, import validation and migrations |
| Storage | Dexie over IndexedDB | Simple versioned local database |
| Image export | `html-to-image` | Local PNG and SVG rendering |
| UI primitives | Radix UI primitives (unstyled), laneboard.css tokens, CSS Modules | Accessible menus, dialogs and tabs, styled only from the design tokens in Appendix C |
| Icons, fonts | `lucide-react`; a self-hosted font via `@fontsource` | No remote assets |
| Tests | Vitest, Testing Library, Playwright | Unit tests for rules, component tests, end-to-end and no-network checks |
| Quality | ESLint, Prettier, `npm audit`, CycloneDX SBOM | Required for internal approval |

### Build on React Flow, not around it

React Flow is the base. Use what it and a few small libraries already do, and write custom code only for the lane model, the rules, the import format and styling. React Flow renders and handles interaction, but the model owns the data: a small pure function turns each card's lane and phase into a node position.

| Need | Use | Custom code |
| --- | --- | --- |
| Pan, zoom, fit view, selection, multi-select, drag | React Flow core | None |
| Minimap, zoom controls, dot background | `<MiniMap>`, `<Controls>`, `<Background>` | Styling only |
| Floating panels over the canvas | `<Panel position="…">` | Panel contents |
| Cells and cards | Cells as group nodes. Cards as child nodes with `parentId` and `extent: 'parent'` | Grid positions from the model |
| Dropping a card into another cell | `onNodeDragStop` + `getIntersectingNodes` | Update the card's lane and phase |
| Journey path and feeds | Custom edges on `BaseEdge` with `getSmoothStepPath` or `getBezierPath`. `EdgeLabelRenderer` for the "Restart" label | One edge component per style |
| Card actions on hover | `<NodeToolbar>` | The buttons |
| Sticky lane labels and phase header | An overlay outside the flow that reads `useViewport()` and moves on one axis only | One small overlay component |
| Resizing phases and sketch shapes | `<NodeResizer>` | None |
| Sketch shapes | Custom nodes that draw an SVG with rough.js | One node type per shape |
| Freehand pen (later) | `perfect-freehand` inside a custom node, following React Flow's freehand example | Later milestone |
| Undo and redo | `zundo` on the Zustand store | None |
| Command palette | `cmdk` | The list of commands |
| Menus, dialogs, tooltips, tabs | Radix UI primitives | Styling from tokens |
| PNG and SVG export | `html-to-image` with `getNodesBounds` and `getViewportForBounds` (React Flow's export recipe) | None |

If a feature needs more than a thin layer on top of these, park it for a later milestone rather than building a custom canvas feature.

### Module layout

```
src/
  model/        types, Zod schema, migrations, defaults, id helpers
  rules/        friction rules, KPIs, capability requirements (pure functions)
  store/        Zustand store, actions, undo/redo, selectors
  persistence/  Dexie database, autosave, backup
  io/           import (parse, repair, validate, preview), export (JSON, CSV, PNG, SVG)
  canvas/       grid layout engine, React Flow node and edge types, free-form layer
  views/        services, frictions, capabilities, overview tables and cards
  present/      guided walkthrough, full-screen mode
  ai/           prompt builder (string templates only, no network)
  i18n/         en, sv dictionaries
  examples/     bundled example journeys (JSON)
```

### Layout engine

The grid is computed, not hand-placed:

1. Phase widths come from the model.
2. Lane heights come from measuring the cards in each cell, with React Flow's node measurement.
3. The layout engine turns (lane, phase, index) into node positions.
4. Collapsing a group or hiding a layer reruns the layout.
5. Journey edges re-route with smooth-step or Bezier paths.
6. Free-form items store either an absolute position or a cell anchor with an offset.

**Performance target:** smooth panning at 60 fps with 15 lanes, 12 phases and 300 cards on a standard work laptop.

## UX and interaction model

Laneboard is a canvas-first editor. The map fills the window, and every control floats over it in small panels that collapse out of the way. The structure comes from Figma: pages, layers, an inspector, a tool dock and modes. The speed and tone come from Excalidraw: single-key tools, a welcome screen, plain local-storage messaging and a hand-drawn sketch layer. Unlike both, the canvas is never blank. Every journey starts from a lane template, so people add to and change lanes and cards rather than drawing structure from scratch.

&#91;embedded content: editor layout · floating panels over a full-bleed canvas\]

Collapsing the UI leaves only the file pill and the top-right controls, so the map takes the whole screen.

### What it borrows

| Laneboard | Borrowed from | What it does |
| --- | --- | --- |
| Journeys list, top of left panel | Figma pages | Switch, add, duplicate and rename journeys |
| Lanes and phases tree, left panel | Figma layers | Lane groups and lanes with show/hide and lock toggles, drag to reorder. Phases are listed below. |
| Library, left rail | Figma assets | Lane types, card presets and journey templates to add from |
| Definitions, left rail | Figma variables | Owners, capabilities, channel properties and statuses for the workspace |
| Create with AI, left rail | Figma agents | The prompt builder (Appendix B) and import |
| Inspector, right panel | Figma design panel | Properties of the selection. With nothing selected, it shows the journey's goal, mode, layers and KPIs. |
| Tool dock, bottom centre | Figma toolbar with Excalidraw shortcuts | Select, hand, card tools and sketch tools, with the mode switch at its right end |
| Welcome screen | Excalidraw | Empty state with hand-drawn hints and the local-storage notice |
| Zoom and undo bottom left, help bottom right | Excalidraw | Always in the same place |
| Collapse UI (⌘/Ctrl + \\) | Figma UI3 | Hides every panel down to two pills: file and share |

### Modes

Three modes sit at the right end of the dock, like Figma's Design, Draw and Dev switch.

1. **Map** (default): the structured blueprint.
   - Tools place typed cards that snap into cells: service, step, friction, feed, note.
   - Lanes and phases are added from the + at the end of each row and column, or from the Library.
2. **Sketch:** a free-form layer over the map, as in Excalidraw.
   - Tools in v1: rectangle, ellipse, arrow, text and sticky note. Line and freehand pen come later.
   - Shapes are drawn with rough.js and text uses a hand-drawn font, so a sketch always reads as an annotation, never as structured data.
   - A sketch can be pinned to a cell and move with it.
   - One layer toggle hides every sketch.
3. **Present:** all UI collapses, the guided walkthrough bar sits at the bottom, and arrow keys step through it.

The data views (services, frictions, capabilities, steps) open in a resizable bottom drawer over the canvas, not on separate pages. Selecting a row selects the card and pans to it. Selecting a card highlights its row.

### Tools and shortcuts

Every tool shows its key in the corner of its button, as in Excalidraw.

| Key | Action | Mode |
| --- | --- | --- |
| V | Select | All |
| H, or Space + drag | Pan | All |
| S | Service card | Map |
| J | Journey step | Map |
| F | Friction | Map |
| E | Feed (entry or support) | Map |
| N | Note | Map, Sketch |
| R, O, A, T | Rectangle, ellipse, arrow, text | Sketch |
| Q | Keep the current tool after placing | All |
| ⌘/Ctrl + K | Command palette | All |
| ⌘/Ctrl + \\ | Collapse UI | All |
| Shift + M | Switch between now and target | All |
| ? | Shortcut sheet | All |

### Add and change, don't draw structure

- New journeys start from a template (generic bank channel set, blank lanes, or the example), never an empty canvas.
- Hovering a lane label or phase header shows + (add after) and ⋯ (rename, change type, set owner, hide, delete).
- Double-clicking an empty cell opens a small picker: service, step, friction, feed or note.
- Cards drag between cells and snap. ⌘/Ctrl + D duplicates.
- Lane types come from the Library. New lane types are added there as the need arises, so the model grows without becoming free-form.

### Panels and chrome

- Panels are floating islands 8 px from the window edge, with a 12 px radius, a thin border and a soft shadow. The canvas runs full-bleed underneath.
- **Left rail** (48 px): Journeys, Library, Definitions, Create with AI, Settings.
- **Left panel** (260 px): journeys, then the lanes and phases tree.
- **Right inspector** (280 px): opens on selection and collapses when nothing needs it.
- **Top left:** a file pill with the workspace name, a "Saved in this browser" indicator and a menu for import, export, settings and theme.
- **Top right:** the now/target switch, Present and Export.
- **Command palette (⌘/Ctrl + K):** every action by name, such as add lane, switch journey, toggle layer or export PNG.

### Look

- **Structure is crisp and sketches are hand-drawn.** That contrast tells people at a glance what is data and what is an annotation.
- **Canvas colour:** in dark mode it is a deep neutral, like Figma's. In light mode it is an off-white, like Excalidraw's. Panels sit one step lighter or darker than the canvas.
- **Status is never colour alone:** it always pairs a colour with a word and a line style.
- **Type:** 13 px base. Tabular numbers in KPIs and tables.

### Accessibility

The app must meet WCAG 2.1 AA for text contrast in both themes. Every control needs visible focus, every function must be reachable by keyboard (including card placement through the command palette), and canvas nodes need ARIA labels. Meaning is never carried by colour alone.

## Design system

`laneboard.css` (Appendix C) is the design system and the single source of truth for the UI. It holds the tokens for light and dark mode, the base rules and a class for every component in this brief. The build agent imports it once at the app root and builds every component from it. A [visual style guide](https://claude.ai/artifact/SihhJCsmsgSB1hvfTpb3uD) shows each token and component in light, dark and side by side.

### Rules the agent must follow

1. Never hard-code a colour, font size, radius, shadow, spacing or z-index in a component. Use a token. If one is missing, add it to `laneboard.css`, in the light block and in both dark blocks.
2. **Theme:**
   - `data-theme="light"` or `"dark"` on `<html>`. No attribute means the app follows the OS.
   - The same attribute on any element scopes a theme to that subtree.
3. **Canvas-first.** React Flow fills the viewport. Every control sits on a floating island (`lb-island`), placed with React Flow's `<Panel>`. Nothing is docked to the window edge.
4. **Crisp structure, hand-drawn sketches.**
   - Cards, lanes and edges use the sans font and straight lines.
   - Sketch shapes use rough.js. Sketch text and welcome hints use `--font-hand`.
   - Never mix the two styles on one element.
5. Colour carries meaning only: status, transition type and owner. Surfaces stay neutral. Every status pairs colour with a word and a line style: solid means available, dashed means info, webview or missing, dotted means planned.
6. **One accent** (`--accent*`) for interaction: the active tool, selection, focus, primary button and active layer chip. The accent is configurable per workspace. Set all five accent tokens and check 4.5:1 contrast in both themes.
7. Class names use an `lb-` prefix with BEM-style modifiers. State goes in attributes (`aria-pressed`, `aria-selected`, `aria-expanded`, `data-status`, `data-transition`, `data-severity`, `data-group`, `data-owner-index`, `data-hidden`), not in extra classes.
8. Component CSS lives in CSS Modules next to each component and may only reference tokens. React Flow's own chrome is themed through its `--xy-*` variables and the overrides in section 10.
9. **Type:** Geist, Geist Mono and Caveat (or another OFL hand-drawn face), all self-hosted. Base text is 13 px. Emphasis comes from weight, not new sizes. Use tabular numbers for figures.
10. Spacing sits on a 4 px grid. Radius is 6 px on controls and tree rows, 8 px on cards, cells and tools, and 12 px on islands and dialogs.
11. **Motion:** 120–200 ms with ease-out. No bounce or parallax. Respect `prefers-reduced-motion`.
12. No gradients, glass, heavy shadows or emoji. The tool should feel like Figma for structure and Excalidraw for speed.

### Token groups

| Group | Tokens | Use |
| --- | --- | --- |
| Surfaces | `--bg-canvas`, `--bg-panel`, `--bg-subtle`, `--bg-muted`, `--canvas-dot` | Full-bleed canvas, islands and cards, hover and stats, pressed, dot grid |
| Text and lines | `--text`, `--text-2`, `--text-3`, `--border`, `--border-strong` | Primary, secondary and meta text, all at least 4.5:1 on their surfaces. Hairlines and input borders |
| Accent | `--accent`, `--accent-hover`, `--accent-soft`, `--accent-ink`, `--accent-contrast`, `--focus` | Interaction only |
| Status | `--ok`, `--warn`, `--crit`, `--neutral` (+ `-soft`) | Service status, severity, rule notes |
| Transitions | `--edge-switch`, `--edge-restart`, `--edge-support`, `--edge-lead`, `--edge-return`, `--edge-entry`, `--edge-assist` | Journey edges, step cards, feeds |
| Lane tints | `--tint-customer`, `--tint-entry`, `--tint-self`, `--tint-assisted`, `--tint-backstage`, `--tint-market`, `--phase-bg`, `--phase-ink` | Cells by lane group, phase headers, tree swatches |
| Sketch | `--font-hand`, `--text-hand`, `--sketch-ink`, `--sketch-fill`, `--note-bg`, `--note-border`, `--note-ink` | Hand-drawn shapes, sketch text, sticky notes, welcome hints |
| Owners | `--cat-1` to `--cat-6` | Owner overlay and tags, in workspace owner order |
| Editor layout | `--island-inset`, `--rail-w`, `--leftpanel-w`, `--inspector-w`, `--dock-h`, `--tool-size`, `--tree-row-h`, `--drawer-h` | Island placement and sizes |
| Scale | `--text-*`, `--space-*`, `--radius-*`, `--shadow-*` (incl. `--shadow-island`), `--z-*`, `--dur-*` | Type, spacing, shape, elevation, layering, motion |

### Component map

| Component | Classes |
| --- | --- |
| Editor and islands | `lb-editor`, `lb-island`, `lb-at-tl`/`-tr`/`-bl`/`-br`/`-bc` (or React Flow `<Panel>`) |
| File pill, top-right | `lb-filepill` (`__logo`, `__name`), `lb-saved[data-state]`, `lb-cluster` |
| Rail | `lb-rail`, `lb-rail__btn`, `lb-rail__sep` |
| Left panel and tree | `lb-leftpanel`, `lb-section` (`--grow`, `__head`, `__actions`), `lb-tree`, `lb-tree__row` (`--depth`, `aria-selected`, `aria-expanded`, `data-hidden`), `__caret`, `__swatch`, `__label`, `__group`, `__meta`, `__toggles`, `lb-iconbtn` |
| Inspector | `lb-inspector` (`__head`, `__kind`, `__title`, `__section`, `__label`), `lb-props`, `lb-statuspick`, `lb-stats`, `lb-stat`, `lb-recommendation` |
| Tool dock | `lb-dock`, `lb-dock__sep`, `lb-tool[aria-pressed]`, `lb-tool__key`, `lb-modes` |
| Corners | `lb-zoombar`, `lb-roundbtn` |
| Controls | `lb-btn` (`--primary`, `--ghost`, `--danger`, `--sm`, `--icon`), `lb-segmented`, `lb-chips`, `lb-chip`, `lb-tabs`, `lb-tab`, `lb-input`, `lb-select`, `lb-textarea`, `lb-field`, `lb-check`, `lb-kbd` |
| Status | `lb-status[data-status]`, `lb-severity[data-severity]`, `lb-tag` (`--assumption`, `--accent`), `lb-pill--goal`, `lb-owner-tag` |
| Canvas | `lb-grid`, `lb-lane-label` (`__sub`, `__actions`), `lb-phase`, `lb-add`, `lb-group-header`, `lb-line[data-kind]`, `lb-cell[data-group]`, `lb-step-customer`, `lb-curve` |
| Cards | `lb-card` + `--service[data-status]` (`.is-linked-webview`, `.is-changed`), `--step[data-transition]`, `--feed[data-kind]`; `lb-friction` (`.is-resolved`); `lb-nodetoolbar`; `lb-picker` |
| Sketch | `lb-sketch` (`--filled`), `lb-sketch-text`, `lb-note`, `lb-pin` |
| Edges | `lb-edge--{transition}`, `lb-edge--entry`, `lb-edge--support`, `lb-edge-label` |
| Overlays | `lb-drawer` (`__handle`, `__head`, `__body`), `lb-cmdk`, `lb-popover`, `lb-menu`, `lb-tooltip`, `lb-dialog`, `lb-scrim`, `lb-toast`, `lb-legend` |
| Views | `lb-table`, `lb-rule-list`, `lb-welcome` (`__center`, `__mark`, `__notice`, `__menu`, `__item`), `lb-hint`, `lb-guide` |

## Scope and milestones

Build in five milestones. Each one ends in a runnable build that passes the no-network test, so security can review early and often.

1. **Foundations.** Repository, CSP, no-network Playwright test, model and Zod schema, Dexie persistence with autosave, JSON import (with repair and preview) and export. The example journey loads and renders read-only as a grid with cards.
2. **Map editing.** Editor shell (rail, left panel with the lanes tree, inspector, tool dock, welcome screen, collapse UI), lanes and phases CRUD with grouping and collapse, cards and detail panel, journey path with typed edges, now/target toggle, layers, undo/redo, free-form notes and arrows.
3. **Services and rules.** Services table with inline status editing, isolated flag and links, rules engine with unit tests, Capabilities view, Frictions table, inspector KPIs, experience curve editing.
4. **Present and share.** Present mode with the guided walkthrough, Sketch mode with rough.js shapes, the command palette, Overview with owners and the silos diagram, PNG, SVG and CSV export, print styles, the "Create with AI" prompt builder.
5. **Hardening.** Accessibility pass, performance at target size, Swedish strings, licence report, PWA offline check, Vercel production deploy with security headers, a user guide (one Markdown page) and a short demo script.

### Out of scope for v1

- Real-time collaboration or any server component, which would break the local-only rule.
- Built-in AI calls.
- A user-editable rule engine (rules stay in code with tests).
- Version history with visual diffs (a backup file covers this for v1).
- Comments and mentions.
- A full drawing toolset beyond notes, arrows, text and basic shapes.

## Acceptance criteria

v1 is done when every box below is ticked on the Vercel production deploy in current Chrome, Edge, Firefox and Safari.

- [ ] The Playwright suite opens the app, imports both examples, edits, exports and presents, and records zero requests outside the app's origin.
- [ ] The CSP and security headers from `vercel.json` are served on every route, and no feature needs them loosened.
- [ ] Reloading the page restores the workspace exactly, including the selected journey, mode, layers and collapsed groups.
- [ ] Importing Appendix A gives 6 phases, 12 lanes, 5 services, 9 journey steps, 6 frictions and 5 feeds, with no warnings.
- [ ] A malformed file (a missing lane reference, duplicate ids, a wrong experience length) is rejected with readable errors that name the JSON path, and nothing is changed.
- [ ] An AI-style file with Markdown fences, missing ids and missing defaults imports with warnings, not errors.
- [ ] In the example's current state the rules give: surplus analysis Medium (R3) with the R3b note that it can be offered in the app as a webview; inflation tool High (R3) with the R3b note that a webview is not an option because it links on to the savings guide; savings guide High (R3); account opening None with the R2 note; fund trading High (R3).
- [ ] Switching to target changes restarts from 2 to 0 and updates the coverage KPI. Changed statuses are marked.
- [ ] Changing any service status in the Services table updates the map, KPIs and Capabilities view within one frame.
- [ ] Adding a `linksTo` entry clears and disables the isolated flag.
- [ ] Undo and redo work across at least 100 steps for every edit type.
- [ ] PNG and SVG export of the map matches the screen, with the visible layers and the current mode.
- [ ] The guided walkthrough runs the default six steps with keyboard navigation in full-screen mode.
- [ ] The "Create with AI" dialog copies a prompt that contains the schema and the user's description.
- [ ] Lighthouse accessibility is 90 or above. Every action is reachable by keyboard.
- [ ] `npm audit` reports no high or critical issues. After one visit, the app opens and works offline.

* [ ] ⌘/Ctrl + \\ collapses every panel to the file pill and the top-right controls, and brings them back.
* [ ] Every tool in the dock has a one-key shortcut shown on its button, and every action is reachable from the command palette.
* [ ] Sketch shapes render hand-drawn, can be pinned to a cell, and hide with one layer toggle.
* [ ] Selecting a row in the data drawer selects the card and pans to it. Selecting a card highlights its row.
* [ ] A new user lands on the welcome screen, sees where their data is stored, and can open the example in one click.

## Assumptions and open questions

**Assumptions**

- Users work in a current desktop browser (Chrome, Edge, Firefox or Safari) at 1440 px or wider.
- One person edits a workspace. Collaboration happens by passing files.
- English UI first, Swedish second. Journey content can be in any language.
- The product is a personal tool hosted on Vercel, so open-source npm libraries need no procurement. Data never leaves the browser.
- AI-generated files come from an assistant outside the tool. The user is responsible for what they paste into it.

**Open questions**

- [ ] Product name: keep "Laneboard" or choose another?
- [ ] Domain: a custom domain on Vercel, or the default `*.vercel.app`?
- [ ] Should a workspace be password-locked on shared computers, with local encryption via the Web Crypto API? This is not in v1 unless asked for.
- [ ] Are there more transition types or service statuses the team uses that should be built in?
- [ ] Should owners default to the four workstreams of the customer experience function (strategy, technology and architecture, insight, market), or start empty?
- [ ] Is a PDF export of the map needed beyond PNG and SVG?

## Appendix A: file format

One file format, `.laneboard.json`, covers backups, sharing and AI-generated imports. A file holds workspace-level owners and capabilities, plus one or more journeys. All references use string ids. Ids are lowercase letters, digits and hyphens, unique within their list.

| Field | Type | Rules |
| --- | --- | --- |
| `format`, `schemaVersion` | `"laneboard"`, integer | Required. This brief is version 1, and older versions are migrated on import. |
| `owners[]`, `capabilities[]` | `{id, name, description}` | Optional. Merged into the workspace by id. |
| `journeys[].phases[]` | `{id, name}` | At least one. Array order is column order. |
| `journeys[].laneGroups[]` | `{id, name, lineAfter?}` | `lineAfter.kind` is boundary or visibility. |
| `journeys[].lanes[]` | `{id, group, kind, name, sub?, owner?, channel?, assumption?}` | `group` is a group id, or `null` for the top. `kind` is one of: customer, entry, channel, backstage, market. Channel lanes need `channel`: `{type: digital, authenticated, webviewHost}` or `{type: assisted}`. |
| `journeys[].cells` | `{ [laneId]: string[] }` | One string per phase, empty strings allowed. Array length equals the number of phases. |
| `journeys[].services[]` | `{id, name, phase, description?, isolated, linksTo[], capabilities[], status.now, status.target}` | Status keys must be digital channel lane ids. Values: native, webview, info, missing, planned, na. A missing key means na. |
| `journeys[].steps[]` | `{id, lane, phase, in, transition, text, textTarget?, notes?}` | Array order is path order. `in` is now, target or both. `transition.now` and `transition.target` are one of: start, channel-switch, restart, to-support, lead-to-advisor, back-to-digital. |
| `journeys[].frictions[]` | `{id, lane, phase, owner?, title, now, recommendation, othersPattern?, assumption?}` | `assumption: true` shows an Assumption tag until someone clears it. |
| `journeys[].feeds[]` | `{id, kind, lane, phase, to, text, explanation?}` | `kind` is entry or support. `to` is a step id. |
| `journeys[].experience` | `{now: number[], target: number[]}` | Values from −2 to 2, one per phase. |
| `journeys[].presentation[]` | `{title, text, layers[], focusLanes[], dimJourney}` | Optional. Layers: services, journey, frictions, feeds, market, owners. |

**Validation on import:**

- Every lane, phase, group, owner, capability, service and step reference must resolve.
- Ids must be unique within each list.
- `cells` and `experience` arrays must match the number of phases.

**Repairs before validation**, each reported as a warning:

- Strip Markdown code fences.
- Generate missing ids from names.
- Default missing arrays to empty, a missing status to `na` and a missing `in` to `both`.

The example below is the bundled journey "Small business owner starts investing". It is also the test fixture for the acceptance criteria, and the same file is delivered alongside this brief as `example-journey.laneboard.json`.

```json
{
  "format": "laneboard",
  "schemaVersion": 1,
  "exportedAt": "2026-10-04T00:00:00Z",
  "owners": [
    { "id": "strategy", "name": "Channel strategy", "description": "Target picture for channels and entry points, the self-service boundary and how transitions work." },
    { "id": "tech", "name": "Technology & architecture", "description": "Requirements for webviews, session handover and context sharing, and how support functions plug in." },
    { "id": "insight", "name": "Customer insight", "description": "How customers move within and between channels, directly and via third parties, measured against the goal." },
    { "id": "market", "name": "Market watch", "description": "How competitors, niche banks and global players solve the same problem." }
  ],
  "capabilities": [
    { "id": "session-handover", "name": "Session handover", "description": "The customer switches channel without logging in again." },
    { "id": "deep-linking", "name": "Deep linking", "description": "Links land on the right step in the right channel, not the start page." },
    { "id": "context-sharing", "name": "Context sharing", "description": "Data and task state follow the customer between channels, systems and staff." },
    { "id": "webview", "name": "Webview", "description": "Web content inside the native app. Fits isolated tasks; cannot follow links in a longer flow." },
    { "id": "next-best-action", "name": "Next best action", "description": "The right offer or next step based on the customer's situation." }
  ],
  "journeys": [
    {
      "id": "sme-investing",
      "title": "Small business owner starts investing",
      "segment": "Business",
      "goal": "More small businesses invest their surplus",
      "description": "A small business owner with surplus cash explores what it could do, gets a proposal for monthly fund saving and starts investing.",
      "phases": [
        { "id": "need", "name": "Need arises" },
        { "id": "explore", "name": "Explore & compare" },
        { "id": "start", "name": "Apply & get started" },
        { "id": "use", "name": "Use & manage" },
        { "id": "help", "name": "Get help" },
        { "id": "deepen", "name": "Deepen the relationship" }
      ],
      "laneGroups": [
        { "id": "entry", "name": "Entry points" },
        { "id": "self", "name": "Self-service", "lineAfter": { "kind": "boundary", "label": "Self-service boundary: a person takes over here" } },
        { "id": "assisted", "name": "Assisted", "lineAfter": { "kind": "visibility", "label": "Line of visibility: the customer does not see below" } },
        { "id": "backstage", "name": "Backstage" },
        { "id": "market", "name": "Market" }
      ],
      "lanes": [
        { "id": "customer", "group": null, "kind": "customer", "name": "Customer", "sub": "What the customer does and wants", "owner": "insight" },
        { "id": "other-products", "group": "entry", "kind": "entry", "name": "Other products", "sub": "Signals from other products and services", "owner": "strategy" },
        { "id": "third-parties", "group": "entry", "kind": "entry", "name": "Third parties", "sub": "Aggregators, partners, power of attorney", "owner": "insight" },
        { "id": "web", "group": "self", "kind": "channel", "name": "Public website", "sub": "Not logged in", "channel": { "type": "digital", "authenticated": false, "webviewHost": false } },
        { "id": "app", "group": "self", "kind": "channel", "name": "Mobile app", "sub": "Private and business", "channel": { "type": "digital", "authenticated": true, "webviewHost": true } },
        { "id": "netbank", "group": "self", "kind": "channel", "name": "Internet bank", "sub": "Logged-in web", "channel": { "type": "digital", "authenticated": true, "webviewHost": false } },
        { "id": "support", "group": "assisted", "kind": "channel", "name": "Customer service", "sub": "Support by phone and chat", "channel": { "type": "assisted" } },
        { "id": "advisor", "group": "assisted", "kind": "channel", "name": "Advisor", "sub": "Advice at the branch or by phone", "channel": { "type": "assisted" } },
        { "id": "enablers", "group": "backstage", "kind": "backstage", "name": "Enablers", "sub": "Technology and architecture", "owner": "tech" },
        { "id": "support-functions", "group": "backstage", "kind": "backstage", "name": "Support functions", "sub": "Inform the journey", "owner": "tech" },
        { "id": "insight", "group": "backstage", "kind": "backstage", "name": "Insight", "sub": "Measurement and follow-up", "owner": "insight" },
        { "id": "competitors", "group": "market", "kind": "market", "name": "How others solve it", "sub": "Patterns to verify", "owner": "market", "assumption": true }
      ],
      "cells": {
        "customer": ["The business has money left on the account", "Wants to understand what the surplus could do", "Wants to start saving in funds", "Saves and follows the investment", "Unsure about risk, tax and rules", "Wants to plan liquidity and buffer long term"],
        "other-products": ["Balance grows on the business account", "Notice about interest on the account", "Existing business account and signatory", "Year-end and quarterly reports", "Tax statement and VAT", "Occupational pension for the owner"],
        "third-parties": ["Accounting software shows liquidity via API", "Accountant gives advice", "Accountant with power of attorney helps", "Bookkeeping fetches fund holdings", "Accountant acts by power of attorney", "Auditor's recommendations"],
        "web": ["Articles about business saving", "Describes the tools and links to login", "Information about fund accounts for businesses", "", "Help pages about funds for businesses", "Guides on liquidity planning"],
        "app": ["Daily overview of the business account", "", "", "", "Chat and self-help", ""],
        "netbank": ["", "", "", "", "Secure messages", ""],
        "support": ["", "Answers questions about the tools", "Helps with the fund account", "", "Questions about risk and tax", "Picks up signals about new needs"],
        "advisor": ["", "", "", "Business advisor at the branch", "Takes complex questions", "Whole picture: liquidity, buffer, pension"],
        "enablers": ["Account data feeds the analysis", "Analysis data is not shared between web and app", "Webview for the fund account, an isolated task", "Fund trading built for app and web", "Context sharing to customer service", "Lead routing to business advisors"],
        "support-functions": ["Deposit pricing", "Fund range and sustainability data", "KYC and signing authority", "Fund and securities platform", "Suitability assessment and compliance", "CRM and the company's relationship"],
        "insight": ["How many businesses have a surplus?", "Tool use per channel", "Drop-off between analysis and fund account", "Share saving monthly", "Contact reasons about funds", "Share of small businesses investing"],
        "competitors": ["Surplus suggested directly in the account overview", "Analysis and investment proposal in one flow", "Fund account opened in a few taps in the app", "One trading capability, same experience in every channel", "Support and advisors see the customer's analysis", "Liquidity planning as an ongoing service"]
      },
      "services": [
        {
          "id": "surplus-analysis", "name": "Surplus analysis", "phase": "need",
          "description": "Shows how much of the business balance is surplus over a buffer.",
          "isolated": true, "linksTo": [], "capabilities": [],
          "status": {
            "now": { "web": "info", "app": "missing", "netbank": "native" },
            "target": { "web": "info", "app": "native", "netbank": "native" }
          }
        },
        {
          "id": "inflation-tool", "name": "Inflation tool", "phase": "explore",
          "description": "Shows what inflation does to cash left on the account over time.",
          "isolated": false, "linksTo": ["savings-guide"], "capabilities": [],
          "status": {
            "now": { "web": "info", "app": "missing", "netbank": "native" },
            "target": { "web": "info", "app": "native", "netbank": "native" }
          }
        },
        {
          "id": "savings-guide", "name": "Savings guide", "phase": "explore",
          "description": "Helps the customer understand their risk appetite, sets a reasonable amount and proposes an active monthly saving in a fund, based on the customer's answers and context.",
          "isolated": false, "linksTo": ["fund-account"], "capabilities": ["next-best-action"],
          "status": {
            "now": { "web": "info", "app": "native", "netbank": "missing" },
            "target": { "web": "info", "app": "native", "netbank": "native" }
          }
        },
        {
          "id": "fund-account", "name": "Open fund account or ISK", "phase": "start",
          "description": "A separate task needed before a monthly fund saving can start. The savings guide normally links here.",
          "isolated": true, "linksTo": [], "capabilities": [],
          "status": {
            "now": { "web": "info", "app": "webview", "netbank": "native" },
            "target": { "web": "info", "app": "native", "netbank": "native" }
          }
        },
        {
          "id": "fund-trading", "name": "Fund trading", "phase": "use",
          "description": "Buy and sell funds, including the funds proposed by the savings guide.",
          "isolated": false, "linksTo": [], "capabilities": [],
          "status": {
            "now": { "web": "na", "app": "planned", "netbank": "native" },
            "target": { "web": "na", "app": "native", "netbank": "native" }
          }
        }
      ],
      "steps": [
        { "id": "a", "lane": "netbank", "phase": "need", "in": "both", "transition": { "now": "start", "target": "start" },
          "text": "Runs the surplus analysis in the internet bank",
          "notes": { "now": "The analysis exists only in the internet bank.", "target": "The analysis exists in both the app and the internet bank." } },
        { "id": "b", "lane": "netbank", "phase": "explore", "in": "both", "transition": { "now": "channel-switch", "target": "channel-switch" },
          "text": "Sees the effect of inflation in the inflation tool",
          "notes": { "now": "Same channel, but the result is not saved for the next step.", "target": "The result is saved and follows the customer." } },
        { "id": "c", "lane": "app", "phase": "explore", "in": "both", "transition": { "now": "restart", "target": "channel-switch" },
          "text": "Opens the savings guide in the app: risk appetite and a proposed monthly saving",
          "notes": { "now": "The guide exists only in the app. No link from the internet bank; the customer logs in again and the analysis does not follow.", "target": "Deep link with context: the analysis becomes input to the guide." } },
        { "id": "d", "lane": "app", "phase": "start", "in": "both", "transition": { "now": "channel-switch", "target": "channel-switch" },
          "text": "Starts the monthly saving and opens a fund account",
          "textTarget": "Opens the fund account inside the flow",
          "notes": { "now": "Monthly saving needs a fund account or ISK, a separate task. Account opening runs in a webview.", "target": "Account opening is linked from the guide and returns to it with the proposal kept." } },
        { "id": "e", "lane": "app", "phase": "start", "in": "now", "transition": { "now": "restart" },
          "text": "Returns to the guide, but the proposal did not carry over",
          "notes": { "now": "Context is not shared between the account-opening task and the guide, so the customer starts the guide again." } },
        { "id": "f", "lane": "netbank", "phase": "use", "in": "now", "transition": { "now": "channel-switch" },
          "text": "Buys the funds in the internet bank and has to find them again",
          "notes": { "now": "Fund trading is not yet in the app, and the guide's proposal is not available in the internet bank." } },
        { "id": "f2", "lane": "app", "phase": "use", "in": "target", "transition": { "target": "channel-switch" },
          "text": "Buys the proposed funds directly",
          "notes": { "target": "Fund trading in app and internet bank with the same rules, terms and proposal." } },
        { "id": "g", "lane": "support", "phase": "help", "in": "both", "transition": { "now": "to-support", "target": "to-support" },
          "text": "Calls about risk and tax for the company's investment",
          "notes": { "now": "Customer service sees neither the analysis nor the proposal.", "target": "Customer service sees the analysis and the guide's proposal." } },
        { "id": "h", "lane": "advisor", "phase": "deepen", "in": "both", "transition": { "now": "lead-to-advisor", "target": "lead-to-advisor" },
          "text": "Business advisor takes the whole picture: buffer, liquidity, pension",
          "notes": { "now": "A larger surplus is a valuable lead.", "target": "The analysis gives the advisor context and a reason to reach out proactively." } }
      ],
      "frictions": [
        { "id": "F1", "lane": "app", "phase": "explore", "owner": "strategy", "assumption": false,
          "title": "Insight and advice sit in different channels",
          "now": "The surplus analysis and inflation tool exist only in the internet bank, the savings guide only in the app. The customer switches channel mid-decision and takes nothing along.",
          "recommendation": "Plan each service across the whole journey, not per channel. Either offer analysis and guide in both channels, or join them with deep links that carry the result.",
          "othersPattern": "Analysis and investment proposal in one flow." },
        { "id": "F2", "lane": "app", "phase": "start", "owner": "tech", "assumption": false,
          "title": "Webviews only handle isolated tasks",
          "now": "The guide's proposal needs a fund account or ISK, a separate task the customer is normally linked to. A flow that links on cannot run in a webview, so services like the guide cannot be moved between channels as webviews.",
          "recommendation": "Mark which tasks are isolated and which link on. Use webviews only for isolated tasks; build natively, or require linking and return to the original flow, where the service is part of a longer journey.",
          "othersPattern": "Account opening in a few taps from inside the app's flow." },
        { "id": "F3", "lane": "web", "phase": "explore", "owner": "strategy", "assumption": false,
          "title": "Information does not hang together",
          "now": "The public website describes the tools but does not lead into the right step. Names and structure differ between web and app.",
          "recommendation": "Shared terms and content model for the tools in every channel, and entry points that land on the right step after login.",
          "othersPattern": "Same names and structure for tools in every channel." },
        { "id": "F4", "lane": "netbank", "phase": "use", "owner": "tech", "assumption": false,
          "title": "Fund trading is being built for two channels",
          "now": "Fund trading exists in the internet bank and is coming to the app. Without one shared capability, rules, terms and the guide's proposal risk differing.",
          "recommendation": "One shared capability with two interfaces: the same rules, the same terms, and the guide's proposal available in both.",
          "othersPattern": "One trading capability with the same experience everywhere." },
        { "id": "F5", "lane": "support", "phase": "help", "owner": "tech", "assumption": false,
          "title": "Customer service cannot see the customer's context",
          "now": "The analysis and fund proposal are invisible to customer service. The customer explains their situation from the start.",
          "recommendation": "Context sharing: analysis results and proposals follow the customer to customer service and advisors.",
          "othersPattern": "Support and advisors see the same material as the customer." },
        { "id": "F6", "lane": "insight", "phase": "start", "owner": "insight", "assumption": false,
          "title": "Nobody measures the whole journey",
          "now": "Use is measured per channel and per tool. Drop-off between analysis, guide and fund account is invisible.",
          "recommendation": "Measure the journey against the shared goal: share of small businesses that start investing, with drop-off per transition.",
          "othersPattern": "Goals and measurement per customer journey, not per channel." }
      ],
      "feeds": [
        { "id": "fd1", "kind": "entry", "lane": "other-products", "phase": "need", "to": "a",
          "text": "Balance grows on the business account", "explanation": "A signal from the account can invite the customer to the surplus analysis, also in the app." },
        { "id": "fd2", "kind": "entry", "lane": "third-parties", "phase": "explore", "to": "b",
          "text": "Accounting software shows liquidity", "explanation": "Data via API can prefill the analysis." },
        { "id": "fd3", "kind": "support", "lane": "support-functions", "phase": "explore", "to": "c",
          "text": "Fund range and sustainability data", "explanation": "Informs the guide's proposal." },
        { "id": "fd4", "kind": "support", "lane": "support-functions", "phase": "start", "to": "d",
          "text": "KYC and signing authority", "explanation": "Decides who may open a fund account for the business." },
        { "id": "fd5", "kind": "support", "lane": "support-functions", "phase": "deepen", "to": "h",
          "text": "CRM shows the company's relationship", "explanation": "Gives the advisor the whole picture." }
      ],
      "experience": {
        "now": [0.5, 1, -1, -2, -1.2, 0],
        "target": [1, 1.5, 1.2, 1.2, 0.8, 1.5]
      },
      "presentation": [
        { "title": "Channels and services", "text": "Which services does the goal need, and where do they exist today?", "layers": ["services"], "focusLanes": ["web", "app", "netbank"], "dimJourney": false },
        { "title": "Frictions", "text": "Friction appears in the transitions: missing services, webviews in linked flows and restarts.", "layers": ["services", "journey", "frictions"], "focusLanes": [], "dimJourney": false }
      ]
    }
  ]
}
```

## Appendix B: prompt for generating an import file

The "Create with AI" dialog fills this template and copies it to the clipboard. `{{DESCRIPTION}}` is the user's scenario text and `{{NOTES}}` any pasted notes. `{{SCHEMA}}` is the field table from Appendix A as plain text. `{{EXAMPLE}}` is the example file with `cells` and all but two steps, frictions and services removed, to keep the prompt short. `{{CHANNELS}}` lists the channel lanes from the user's current template, so generated maps match their setup.

```text
You are helping a customer experience strategist at a bank map a service blueprint.
Create ONE Laneboard import file for the scenario below.

OUTPUT RULES
- Reply with JSON only. No Markdown, no comments, no text before or after.
- Follow the Laneboard file format, schemaVersion 1, exactly as described in SCHEMA.
- Use the shape of EXAMPLE. Every id is lowercase-with-hyphens and unique in its list.
- Use 5 to 7 phases. Use these lanes unless the scenario clearly needs others: {{CHANNELS}}
- Every "cells" array and both "experience" arrays have exactly one entry per phase.
- Every reference (lane, phase, owner, step, service, capability) must point to an id that exists in the file.

CONTENT RULES
- Services: what the customer uses. Set status per digital channel for "now" and "target":
  native | webview | info | missing | planned | na.
- A service is "isolated" only if it can be completed without linking on to another task.
  If it links on, list the linked services in "linksTo" and set isolated to false.
- Steps: the customer's path in order, 6 to 10 steps, crossing channels where realistic.
  Use transition types: start | channel-switch | restart | to-support | lead-to-advisor | back-to-digital.
  Use "in": "now" or "target" for steps that exist in only one state.
- Frictions: 3 to 8. Each needs "now" (what goes wrong), "recommendation" (what we advocate)
  and, if known, "othersPattern" (how others solve it).
- Feeds: other products or third parties that lead in (kind "entry"), and support functions
  that inform a step (kind "support").
- Experience: -2 (hard) to 2 (easy) per phase, for now and target.
- Do not invent statistics, prices or named competitors. Anything you infer rather than take
  from the description or notes gets "assumption": true (frictions, lanes).
- Write in the language of the description.

SCENARIO
{{DESCRIPTION}}

NOTES (may be empty)
{{NOTES}}

SCHEMA
{{SCHEMA}}

EXAMPLE
{{EXAMPLE}}
```

The dialog states in one line that nothing is sent anywhere. The user pastes the prompt into their own approved assistant, saves the JSON reply as a file and imports it.

## Appendix C: laneboard.css

`laneboard.css` ships alongside this brief and goes into the repository at `src/styles/laneboard.css`. It has 17 sections:

- **1–3, below:** light tokens, dark tokens and base rules. This is the style guide.
- **4–17:** component classes for the editor shell and islands, controls, status, canvas, cards, the sketch layer, edges and React Flow theming, popovers and the command palette, the data drawer, tables, the welcome screen, presentation, responsive and print. The [visual style guide](https://claude.ai/artifact/SihhJCsmsgSB1hvfTpb3uD) shows every one of them in light and dark.

The dark values appear twice in the file: under `prefers-color-scheme: dark` and under `[data-theme="dark"]`. Both blocks must stay identical. Only the first is printed here.

```css
/* ---------- 1. Tokens: light (default) ---------- */
:root, [data-theme="light"] {
  color-scheme: light;

  /* Fonts: self-host Geist, Geist Mono and Caveat (or another OFL
     hand-drawn face) with @fontsource. Never load them from a CDN. */
  --font-sans: "Geist", "Geist Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-mono: "Geist Mono", "Geist Mono Variable", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --font-hand: "Caveat", "Segoe Print", "Bradley Hand", cursive; /* sketch layer + welcome hints only */

  /* Type scale (px). Base UI text is 13. */
  --text-2xs: 10px;   /* tool shortcut letters, micro labels */
  --text-xs: 11px;    /* meta, uppercase labels, rail labels, mono tags */
  --text-sm: 12px;    /* secondary text, tree rows, inspector labels */
  --text-md: 13px;    /* body, cards, inputs, buttons */
  --text-lg: 15px;    /* section and inspector titles */
  --text-xl: 18px;    /* dialog titles */
  --text-2xl: 22px;   /* welcome / journey title */
  --text-kpi: 20px;   /* stat values in the inspector */
  --text-hand: 20px;  /* sketch text and welcome hints */
  --leading-tight: 1.25;
  --leading-normal: 1.45;
  --weight-regular: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --tracking-caps: 0.06em;

  /* Spacing: 4px grid */
  --space-0: 0;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* Radius */
  --radius-xs: 4px;   /* tags, kbd, tool key */
  --radius-sm: 6px;   /* inputs, buttons, chips, tree rows */
  --radius-md: 8px;   /* cards, cells, tool buttons */
  --radius-lg: 12px;  /* islands, dialogs */
  --radius-pill: 999px;

  /* Editor layout */
  --island-inset: 8px;      /* distance from window edge */
  --island-gap: 8px;        /* gap between neighbouring islands */
  --rail-w: 52px;
  --leftpanel-w: 260px;
  --inspector-w: 280px;
  --dock-h: 48px;
  --tool-size: 36px;
  --tree-row-h: 28px;
  --drawer-h: 320px;        /* default; user-resizable */
  --lane-label-w: 200px;
  --phase-min-w: 220px;
  --cell-gap: 10px;
  --row-gap: 8px;
  --control-h: 32px;
  --control-h-sm: 26px;

  /* Motion */
  --ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
  --dur-fast: 120ms;
  --dur-base: 200ms;
  --dur-slow: 320ms;

  /* Z-index scale */
  --z-canvas: 0;
  --z-edges: 1;
  --z-cards: 2;
  --z-sticky: 5;    /* sticky lane labels / phase header overlay */
  --z-island: 10;   /* rail, panels, dock, pills */
  --z-drawer: 20;
  --z-popover: 50;  /* menus, tooltips, legend, node toolbar */
  --z-modal: 60;    /* dialogs, command palette */
  --z-toast: 70;

  /* Surfaces. Light canvas is airy like Excalidraw; islands are white. */
  --bg-canvas: #f6f7f9;    /* canvas, full-bleed */
  --bg-app: #f6f7f9;       /* same as canvas (canvas-first) */
  --bg-panel: #ffffff;     /* islands, cards, tables */
  --bg-subtle: #f1f3f6;    /* hover, table header, segmented track */
  --bg-muted: #e8ebf0;     /* pressed, selected row */
  --canvas-dot: #d9dde5;   /* dot grid */
  --border: #e3e6eb;       /* hairline */
  --border-strong: #cbd1da;/* inputs, emphasised dividers */
  --text: #161b26;         /* primary text */
  --text-2: #4f5869;       /* secondary text, 7:1 on panel */
  --text-3: #646d7e;       /* meta, placeholders, 4.5:1+ on panel and canvas */
  --text-on-strong: #ffffff;

  /* Accent (overridable per workspace) */
  --accent: #2e5bda;
  --accent-hover: #2650c4;
  --accent-soft: #e9effc;
  --accent-ink: #1d3f9e;
  --accent-contrast: #ffffff;

  /* Focus */
  --focus: #2e5bda;
  --focus-ring: 0 0 0 2px var(--bg-panel), 0 0 0 4px var(--focus);

  /* Semantic status */
  --ok: #2e7d4f;      --ok-soft: #e7f4ec;
  --warn: #a35f00;    --warn-soft: #fbf1e1;
  --crit: #c0392b;    --crit-soft: #fbe9e7;
  --neutral: #7d8697; --neutral-soft: #eef0f3;

  /* Journey transition types (edges) */
  --edge-switch: #3373de;   /* channel-switch: solid */
  --edge-restart: #c0392b;  /* restart: dashed + label */
  --edge-support: #c26a12;  /* to-support: dashed */
  --edge-lead: #167e6b;     /* lead-to-advisor: thick */
  --edge-return: #6b4fb8;   /* back-to-digital: dotted */
  --edge-entry: #2e8a5c;    /* feed: alternative entry, dashed thin */
  --edge-assist: #6a7586;   /* feed: support function, dashed thin */

  /* Lane-group tints (cells on the canvas) */
  --tint-customer: #ffffff;
  --tint-entry: #eaf4ee;
  --tint-self: #eaf1fb;
  --tint-assisted: #f8f2e6;
  --tint-backstage: #eef0f3;
  --tint-market: #f1edf8;

  /* Phase header + customer steps */
  --phase-bg: #e3ebf8;
  --phase-ink: #23446f;

  /* Sketch layer (hand-drawn) and sticky notes */
  --sketch-ink: #1e2a3d;
  --sketch-fill: rgba(46, 91, 218, 0.08);
  --note-bg: #fff6d6;
  --note-border: #f0dc94;
  --note-ink: #4a3d0c;

  /* Owner / categorical palette */
  --cat-1: #2e5bda;
  --cat-2: #c26a12;
  --cat-3: #167e6b;
  --cat-4: #8a4fc0;
  --cat-5: #c0397a;
  --cat-6: #5f7a1d;

  /* Elevation */
  --shadow-xs: 0 1px 1px rgba(16, 24, 40, 0.04);
  --shadow-sm: 0 1px 2px rgba(16, 24, 40, 0.06), 0 1px 3px rgba(16, 24, 40, 0.06);
  --shadow-island: 0 1px 2px rgba(16, 24, 40, 0.05), 0 6px 20px rgba(16, 24, 40, 0.07);
  --shadow-md: 0 8px 24px rgba(16, 24, 40, 0.12), 0 2px 6px rgba(16, 24, 40, 0.06);
  --scrim: rgba(16, 24, 40, 0.32);
}

/* ---------- 2. Tokens: dark ---------- */
/* Deep neutral canvas like Figma's; islands one step lighter.
   Applied when the OS is dark and the user has not forced light,
   and when the user forces dark. Keep both blocks identical. */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg-canvas: #14171c;
    --bg-app: #14171c;
    --bg-panel: #1e232b;
    --bg-subtle: #262c35;
    --bg-muted: #2f3641;
    --canvas-dot: #272d37;
    --border: #2c333e;
    --border-strong: #3b4452;
    --text: #e8ecf2;
    --text-2: #a9b2c0;
    --text-3: #8590a3;
    --text-on-strong: #101317;
    --accent: #7fa3f5;
    --accent-hover: #9bb7f7;
    --accent-soft: #1d2a45;
    --accent-ink: #c4d4fa;
    --accent-contrast: #101317;
    --focus: #8fb0f7;
    --ok: #5cc796;      --ok-soft: #14301f;
    --warn: #f0a84e;    --warn-soft: #33270f;
    --crit: #ff7a6b;    --crit-soft: #3a1c1b;
    --neutral: #8a95a8; --neutral-soft: #262c36;
    --edge-switch: #6da6f5;
    --edge-restart: #ff7a6b;
    --edge-support: #f0a050;
    --edge-lead: #4cc3a8;
    --edge-return: #b49bf0;
    --edge-entry: #5cc796;
    --edge-assist: #9fb0c6;
    --tint-customer: #1b1f26;
    --tint-entry: #17221c;
    --tint-self: #182131;
    --tint-assisted: #241f19;
    --tint-backstage: #1b1e24;
    --tint-market: #201c2b;
    --phase-bg: #1f2b3f;
    --phase-ink: #c0d4f3;
    --sketch-ink: #dfe5ee;
    --sketch-fill: rgba(127, 163, 245, 0.10);
    --note-bg: #3a3320;
    --note-border: #5a4e28;
    --note-ink: #f3e7b8;
    --cat-1: #7fa3f5;
    --cat-2: #f0a050;
    --cat-3: #4cc3a8;
    --cat-4: #c39bf0;
    --cat-5: #f08ab8;
    --cat-6: #a8c76a;
    --shadow-xs: 0 1px 1px rgba(0, 0, 0, 0.3);
    --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.35), 0 1px 3px rgba(0, 0, 0, 0.25);
    --shadow-island: 0 1px 2px rgba(0, 0, 0, 0.4), 0 8px 24px rgba(0, 0, 0, 0.35);
    --shadow-md: 0 10px 28px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.35);
    --scrim: rgba(0, 0, 0, 0.55);
  }
}
/* [data-theme="dark"] { …identical values… } */

/* Accent override (set from workspace settings at runtime):
   document.documentElement.style.setProperty('--accent', '#1f7a6d');
   Also set --accent-hover, --accent-soft, --accent-ink, --accent-contrast
   and check 4.5:1 contrast for --accent-ink on --accent-soft in both themes. */

/* ---------- 3. Base rules ---------- */
*, *::before, *::after { box-sizing: border-box; }
html, body { height: 100%; }
body {
  margin: 0;
  background: var(--bg-app);
  color: var(--text);
  font-family: var(--font-sans);
  font-size: var(--text-md);
  line-height: var(--leading-normal);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}
button, input, select, textarea { font: inherit; color: inherit; }
button { cursor: pointer; }
button:disabled { cursor: not-allowed; }
img, svg { display: block; max-width: 100%; }
h1, h2, h3, h4, p { margin: 0; }
h1 { font-size: var(--text-2xl); font-weight: var(--weight-semibold); letter-spacing: -0.01em; line-height: var(--leading-tight); }
h2 { font-size: var(--text-lg); font-weight: var(--weight-semibold); line-height: var(--leading-tight); }
h3 { font-size: var(--text-md); font-weight: var(--weight-semibold); }
a { color: var(--accent-ink); text-underline-offset: 2px; }
code, kbd, .lb-mono { font-family: var(--font-mono); }
::selection { background: var(--accent-soft); color: var(--text); }
:focus { outline: none; }
:focus-visible { outline: none; box-shadow: var(--focus-ring); border-radius: var(--radius-sm); }
[hidden] { display: none !important; }
[data-theme]:not(html) { background-color: var(--bg-app); color: var(--text); }
.lb-num { font-variant-numeric: tabular-nums; }
.lb-sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.lb-caps { font-size: var(--text-xs); font-weight: var(--weight-semibold); text-transform: uppercase; letter-spacing: var(--tracking-caps); color: var(--text-3); }
.lb-icon { width: 16px; height: 16px; flex: none; stroke-width: 1.6; }

* { scrollbar-width: thin; scrollbar-color: var(--border-strong) transparent; }
*::-webkit-scrollbar { width: 10px; height: 10px; }
*::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: var(--radius-pill); border: 3px solid transparent; background-clip: content-box; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 1ms !important; animation-iteration-count: 1 !important; transition-duration: 1ms !important; scroll-behavior: auto !important; }
}
```
