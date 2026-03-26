# In-Store Screens Demo: Technical Explanation

This document is an engineering-oriented explanation of the repository as inspected on March 26, 2026. It is intended to help a retail media engineering team understand what the code does, how the pieces fit together, what is real versus demo-modeled, and where the main implementation boundaries sit.

## 1. What This Repo Actually Is

This repository is a self-contained demo platform for treating physical in-store screens as retail media inventory.

At runtime it behaves like one monolithic Node/Express application that does all of the following:

- serves the admin UI used to set up supply, plan campaigns, and view monitoring
- serves the screen player used by physical screens or simulated screens
- serves a presenter-notes companion page
- persists state to a local JSON database
- reads a local product feed
- plans in-store campaigns against configured or synthetic demo inventory
- applies campaign changes by writing managed line items into screen records
- emits and aggregates proof-of-play / exposure telemetry
- optionally runs OpenAI-backed batch generation for product images and brand logos

This is not a microservice system, and it is not split into a frontend app plus backend API in separate projects. It is one process, one repo, and mostly one large server file plus one large admin client file.

## 2. Repository Shape

The important files are:

- `src/server.js`
  The main application. It contains constants, utility functions, product-feed normalization, device-resolution logic, goal planning, telemetry modeling, demo-preset generation, workspace leasing, API routes, and server startup.
- `src/dataStore.js`
  File-backed persistence layer. It serializes all DB access through an in-memory queue and writes atomically.
- `src/demoStoreCatalog.js`
  Synthetic large-scale store catalog generator. It builds thousands of store profiles across markets, tiers, and archetypes.
- `public/admin.html`, `public/admin.js`, `public/admin.css`
  The guided admin/demo experience.
- `public/screen.html`, `public/screen.css`
  The shared screen player and native fallback renderer.
- `public/presenter-notes.html`, `public/presenter-notes.js`, `public/presenter-notes.css`
  Presenter companion view that follows the main demo state.
- `data/db.json`
  Tracked seed database.
- `data/productFeed.json`
  Tracked product catalog used for targeting, creative, and fallback content.
- `scripts/smoke.mjs`
  End-to-end smoke test against the local server.
- `scripts/generate-product-images.mjs`
  Resumable OpenAI-backed packshot generation.
- `scripts/generate-brand-logos.mjs`
  Resumable OpenAI-backed brand-logo generation.
- `scripts/deploy-production.sh`
  Simple Linux deploy helper.

## 3. Current Repository Data Snapshot

At the inspected repo state:

- `data/db.json` contains:
  - 6 pages
  - 58 screens
  - 11 agent runs
  - 2,542 telemetry events
- `data/productFeed.json` contains:
  - 1,164 products
  - 4 categories: `electronics`, `whitegoods`, `aisle`, `foodcourt`
  - 10 advertiser accounts with roughly even product counts

The synthetic demo catalog is much larger than the tracked seed DB:

- `src/demoStoreCatalog.js` generates 2,359 demo stores
- `src/server.js` defines 5 blueprint screens per store
- that produces 11,795 synthetic screen specs for planning and guided-demo rollouts

That distinction matters:

- `data/db.json` is the tracked seed state
- the demo store catalog is generated code-side
- the admin UI can materialize large parts of that generated inventory into the writable DB via the demo preset

## 4. Runtime Architecture

### 4.1 Process model

The app is an ESM Node app requiring Node 18+.

`package.json` exposes:

- `npm start`: run `src/server.js`
- `npm run dev`: watch mode for `src/server.js`
- `npm run smoke`: exercise the API end to end
- `npm run generate:product-images`
- `npm run generate:brand-logos`

### 4.2 HTTP surfaces

The process serves:

- static assets from `public/`
- generated product images from the configured generated-image directory
- generated brand logos from the configured generated-logo directory
- JSON APIs under `/api/*`
- telemetry collection at `/collect`

`/` redirects to `/admin.html`.

### 4.3 Persistence model

The writable DB defaults to `temp/db.json`, not `data/db.json`.

Startup persistence flow:

1. `src/dataStore.js` treats `data/db.json` as the seed DB.
2. On first write/read it bootstraps `temp/db.json` from the seed if no writable DB exists.
3. All future mutations operate on the writable DB file.

This is an important design choice:

- tracked demo state stays in git
- runtime mutations stay out of git by default
- production can move the DB entirely out of the checkout with `DB_FILE`

## 5. Core Domain Model

The application revolves around a few main persisted objects.

### 5.1 Page

A page is the CYield-style logical placement or zone definition.

Example shape:

```json
{
  "pageId": "ELECTRONICS",
  "pageType": "Category",
  "environment": "In-Store",
  "verbosity": "Min",
  "firePageBeacons": true,
  "oneTagHybridIntegration": false,
  "includeBidInResponse": false,
  "createdAt": "2026-02-09T10:00:00.000Z",
  "updatedAt": "2026-03-24T00:20:55.532Z"
}
```

### 5.2 Screen

A screen is the physical placement plus its delivery behavior.

Key fields:

- `screenId`
- `storeId`
- `location`
- `pageId`
- `screenType`
- `screenSize`
- `format`
- `templateId`
- `refreshInterval`
- `screenShareSlots`
- `defaultSellableShareSlots`
- `deviceHints`
- `lineItems[]`

`deviceHints` is important because the shared player can resolve a screen without an explicit `screenId` by using resolver/device metadata.

### 5.3 Line item

A line item is the unit actually rotated and delivered on a screen.

Important fields:

- `lineItemId`
- `name`
- `activeFrom`
- `activeTo`
- `templateId`
- `deliverySource`
- `deliveryShareSlots`
- `goalPlanId`
- `goalAdvertiserId`
- `goalObjective`
- `products[]`

The system supports multiple line items per screen and allocates delivery via share-slot weighting.

### 5.4 Product

There are two closely related product shapes:

- feed products in `data/productFeed.json`
- delivery products returned by `/api/screen-ad`

Feed products are lower-case, internal, and planning-oriented:

```json
{
  "sku": "LAP-ULTRA-13-001",
  "name": "UltraBook 13 Pro",
  "category": "electronics",
  "brand": "Vertex",
  "productPage": "https://store.example.com/products/lap-ultra-13-001",
  "image": "/assets/products/lap-ultra-13-001.svg",
  "price": "1299.00",
  "comparePrice": "1499.00",
  "rating": "4.8",
  "advertiserId": "advertiser-vertex",
  "tags": ["laptop", "ultrabook", "premium", "new-range"]
}
```

Delivery products are RMJS-facing and title-cased:

- `ProductId`
- `ProductName`
- `ProductPage`
- `Image`
- `Price`
- `ComparePrice`
- `Rating`
- `ClientAdvertiserId`
- `RenderingAttributes`
- beacon URLs

The server spends a lot of code translating between these two shapes.

### 5.5 Agent run

An agent run is the persisted output of the goal planner.

It stores:

- the normalized goal request
- inferred or chosen target SKUs
- store rankings and planning signals
- recommended placements
- proposed changes
- excluded screens and reasons
- budget outputs
- live snapshot after apply

This is the central artifact connecting planning, apply, and monitoring.

### 5.6 Telemetry event

Only two telemetry event types exist:

- `play`
- `exposure`

Fields include:

- `eventId`
- `event`
- `occurredAt`
- `screenId`
- `storeId`
- `pageId`
- `location`
- `templateId`
- `lineItemId`
- `adid`
- `sku`
- `productName`
- `source`
- `reason`
- `exposureMs`

### 5.7 Workspace root

The root DB also contains:

- `workspaces`
- `workspaceClaims`

Each presenter avatar gets an isolated workspace state derived from the seed DB. The admin app never edits the root default state directly once a workspace is claimed.

## 6. Server Responsibilities in `src/server.js`

`src/server.js` is the true application boundary. It currently combines at least nine concerns:

1. static config and enums
2. demo inventory generation
3. product-feed normalization and caching
4. OpenAI-backed SKU inference
5. goal planning and budget modeling
6. line-item normalization and delivery
7. telemetry collection and modeled measurement
8. workspace session / lease management
9. route definitions and server startup

From an engineering point of view, this file is a monolith. That is not a criticism of the demo working; it is simply the main fact the next team should understand before modifying it.

## 7. Data Store Internals

`src/dataStore.js` is small but important.

What it does:

- normalizes DB shape on read
- bootstraps writable DB from seed data
- serializes all reads and writes through a promise queue
- performs atomic writes using a temp file plus rename
- falls back to direct overwrite if rename hits Windows `EPERM`
- keeps `lastKnownDb` in memory as a recovery fallback if JSON parsing fails

Implications:

- there is no real multi-process locking
- within one Node process, writes are serialized safely
- across multiple processes, this is not a production-grade datastore
- for a demo or single-service install, it is adequate

## 8. Demo Store Catalog

`src/demoStoreCatalog.js` is not a list of hardcoded stores. It is a generator for a large synthetic network.

It models:

- store archetypes such as `flagship`, `metro`, `suburban`, `regional`, `compact`
- market definitions across the US, Canada, and Mexico
- trade areas within metros
- store-level inventory and traffic scaling
- category bias by store
- screen configs by placement type

The generated output gives the planner something large enough to feel like a real network.

Important detail:

- the tracked DB seed still contains a small curated demo
- the planner can operate against the generated network when the request targets demo stores
- the demo preset can materialize generated screen specs into the writable DB

## 9. Workspace / Avatar Model

Before most API calls, the admin user must claim an avatar workspace.

Implementation summary:

- `/api/workspaces` creates or reads a session cookie
- `/api/workspaces/claim` assigns one of 12 demo avatars such as `atlas`, `nova`, `sora`
- the claim is stored in `workspaceClaims`
- leases expire after 2 hours
- once claimed, middleware `requireWorkspaceClaim` gates `/api/*` and `/collect`
- per-workspace state is stored under `workspaces[workspaceId]`

This is a useful demo feature because multiple presenters can run separate journeys without overwriting each other.

It is not multi-user auth. It is lightweight lease-based state isolation.

## 10. Admin UI

### 10.1 What the admin app is

The admin UI is a guided three-stage demo shell:

- `supply`
- `buying`
- `monitoring`

`public/admin.html` provides the structure.
`public/admin.js` provides almost all behavior.
`public/admin.css` provides the visual system.

### 10.2 How `public/admin.js` is organized

`public/admin.js` is another monolith. It contains:

- a large in-memory `state` object
- element lookup map
- fetch wrappers
- render functions for every section
- event handlers for every interaction
- workspace handling
- market-story overlay logic
- goal prompt inference helpers
- preview rail loading
- presenter snapshot publishing

This is effectively a hand-written SPA with no framework.

### 10.3 The three-stage flow

Supply stage:

- create one anchor placement
- optionally inspect advanced page/screen config
- apply shared preset
- show rollout handoff

Buying stage:

- choose account / advertiser
- choose objective and aggressiveness
- set scope and flight dates
- let AI or heuristics shortlist SKUs
- review recommended placements
- edit funded placements and budget
- apply plan

Monitoring stage:

- brand dashboard
- KPI rail
- measurement board
- live screen inspector
- preview rail
- recent campaign runs

### 10.4 Presenter-notes integration

The admin app publishes a stage-aware snapshot to:

- `localStorage`
- `BroadcastChannel`

The presenter notes page reads that snapshot and renders:

- talk track
- proof points
- stage modules
- live state
- plan context
- telemetry summary

This is a clean demo-specific pattern: the notes page does not call the backend itself; it follows the main admin tab.

## 11. Shared Screen Player

### 11.1 What `public/screen.html` does

The screen player is the runtime surface that a physical device or simulated device would load.

It supports three major modes:

- explicit `screenId`
- resolved `deviceId` / device profile
- showcase preview mode

It also supports RMJS mode flags:

- `rmjs=auto`
- `rmjs=on`
- `rmjs=off`

### 11.2 Delivery strategy

Load flow:

1. build `/api/screen-ad` request from query params and viewport/orientation hints
2. optionally try to load RMJS
3. if RMJS is available, render with RMJS
4. otherwise render with the native fallback layouts
5. schedule refresh on the screen refresh interval

### 11.3 Native fallback renderer

The fallback renderer is not a placeholder. It has bespoke markup and styling per template:

- `fullscreen-banner`
- `fullscreen-hero`
- `carousel-banner`
- `kiosk-interactive`
- `shelf-spotlight`
- `menu-loop`

The screen player:

- parses `RenderingAttributes`
- derives copy if the stored copy looks too generic
- injects QR modules for kiosk, shelf, menu, and some clearance cases
- loops multi-product templates locally
- posts `play` and `exposure` beacons back to `/collect`

`public/screen.css` is therefore doing two jobs:

- immersive device/showcase framing
- full native creative layouts for the fallback renderer

## 12. Device Resolution Model

One of the most important ideas in the repo is that all physical screens can use the same shared player URL.

The server resolves the actual screen by:

- explicit `screenId` when supplied
- explicit resolver/device ID
- device profile string
- viewport size
- orientation
- coarse browser hints

Each screen stores `deviceHints`, including:

- `resolverId`
- `viewport`
- `orientation`
- page/location/store tokens
- user-agent hints

If the shared player cannot resolve uniquely, the API returns a conflict instructing the caller to provide stronger device identity.

This is the core mechanism behind the “one shared player URL” story in the demo.

## 13. Supply Setup and Demo Preset

The guided supply workflow is implemented through:

- page creation APIs
- screen creation APIs
- demo preset helpers in the server

The demo preset logic:

- seeds or updates the standard demo pages
- seeds or updates a set of generated screen specs across the demo store network
- populates line items from the product feed
- clears rotation state
- optionally clears runs and telemetry on full reset

The server also builds a `demo config snapshot` that the admin UI uses to render:

- stage progress
- configured vs missing screens
- quick links
- counts
- handoff summaries

This means the admin UI is not hardcoding the stage summary. The backend synthesizes it from live state.

## 14. Goal Planning System

This is the most complex subsystem in the repo.

### 14.1 Inputs

The planner takes:

- objective
- aggressiveness
- flight start/end
- advertiser
- optional brand
- optional assortment category
- optional store/page scope
- optional prompt
- optional manual target SKUs

### 14.2 Target SKU resolution

The planner resolves products in this order:

1. manual `targetSkuIds` if supplied
2. prompt-based inference
3. advertiser/brand assortment fallback
4. no target products

Prompt inference has two layers:

- OpenAI-based semantic selection if `OPENAI_API_KEY` is present
- heuristic scoring fallback if not

The heuristic scorer uses:

- SKU, category, name, brand, and tag token matches
- intent signals such as `stock`, `value`, `premium`, `rating`, `newness`
- store-level stock signals
- price / discount / rating features

The OpenAI path is tightly constrained:

- the server first scores and narrows candidates
- only top candidates are sent to the model
- the model must return JSON matching a schema
- if the call fails or times out, the server falls back to heuristics

### 14.3 Store strategy

The planner does not just score screens independently.

It first builds store-level strategy using synthetic sales signals derived from the demo catalog:

- total sales
- foot traffic index
- checkout intent index
- premium demand index
- clearance pressure index
- stock fit
- traffic fit
- capability fit
- continuity fit

This lets the plan explain why certain stores are favored.

### 14.4 Screen scoring

For each candidate screen, the planner computes:

- objective fit
- assortment fit
- stock fit
- traffic fit
- capability fit
- continuity fit
- scope fit

It also computes:

- recommended template
- recommended target SKUs for that screen
- planned share of screen
- estimated impressions
- estimated placement cost
- confidence score
- exclusion reason if held out

### 14.5 Budget model

Budgeting is built on retailer-set CPM by screen type.

The code stores default CPMs for:

- vertical screens
- horizontal screens
- shelf edge
- endcap
- kiosk
- digital menu board

Estimated impressions are modeled from:

- screen type
- placement role
- store traffic / checkout signals
- refresh interval
- sellable share ratio
- flight duration

The output includes:

- `maxSpend`
- `selectedSpend`
- funded vs held-back placements
- funded vs held-back impressions

### 14.6 Guardrails

The planner excludes screens when:

- the configured sellable share is already full for the flight
- screen context does not fit the selected assortment strongly enough
- conservative planning should stay anchored to the requested page
- score is below threshold
- stronger placements cover the same scenario more efficiently

Excluded placements are persisted with reasons, not silently dropped.

That is why the admin UI can explain why something is missing.

## 15. Apply Flow

Applying a plan does not replace the whole screen record. It injects a managed sponsored-share line item.

Apply behavior:

1. pick the funded placements after budget selection
2. re-check screen-share capacity for the selected flight
3. materialize demo screens/pages if the plan references generated demo inventory not yet in the DB
4. preserve non-goal line items
5. create a goal-managed line item with objective-specific creative attributes
6. add a baseline rotation line item if the screen would otherwise become empty
7. write live snapshot details back to the run record

The managed line items are tagged with:

- `deliverySource: "goal-share"`
- `goalPlanId`
- `goalAdvertiserId`
- `goalObjective`

That is how later reads distinguish “campaign-owned” line items from the pre-existing baseline rotation.

## 16. Screen Delivery

`GET /api/screen-ad` is the delivery endpoint used by the player.

Its main job is to convert stored screen state into a delivery-ready payload.

It does the following:

1. resolve the target screen
2. filter to active line items
3. compute weighted share allocation
4. honor explicit requested line item / plan / advertiser if provided
5. otherwise rotate fairly via `rotationState`
6. top up multi-product templates from the product feed if under-configured
7. prefer feed image paths for matching SKUs
8. normalize product shape for delivery
9. emit beacon URLs in the payload

The response contains:

- `format`
- `products[]`
- `settings`

`settings` includes delivery metadata the player uses, such as template, refresh interval, selected line item, delivery share info, resolver ID, and request-resolution details.

## 17. Line-Item Share Model

The repo models sellable share explicitly.

Key concepts:

- a screen has total share slots, defaulting to 6
- a screen also has a default number of sellable share slots
- a line item may declare `deliveryShareSlots`
- the planner only buys into free sellable share for the target flight

This is one of the more realistic parts of the demo because it separates:

- screen existence
- baseline retailer-owned rotation
- sponsored share availability

The rotation picker uses share weight rather than simple round-robin, so line items with more share slots win proportionally more calls.

## 18. Telemetry and Measurement

### 18.1 Observed telemetry

Observed telemetry is minimal but clear:

- `play` events
- `exposure` events with dwell time

These events can come from:

- the native fallback renderer in `screen.html`
- the smoke test
- any external caller posting to `/collect`

The summary API aggregates totals and breakdowns by:

- screen
- template
- SKU

### 18.2 Modeled measurement board

The monitoring dashboard also shows modeled retail metrics.

These are not raw truth data. They are simulated from:

- live telemetry totals
- plan budget
- target products
- averaged demo store sales signals
- objective-specific boost factors

Modeled outputs include:

- shopper interaction rate
- QR scans
- incremental sales
- new-to-brand sales
- return on spend
- total exposure time
- total ad plays

The code is explicit about this by attaching source tags such as:

- `telemetry`
- `modeled`
- `sales-signal`
- `plan`

Engineering implication:

- proof-of-play and exposure are observed
- QR, incrementality, sales lift, and ROAS are demo-modeled

That distinction matters for anyone treating this as a prototype for productization.

## 19. Product Feed and Generated Assets

The product feed is more than a static lookup table. It is the canonical source for:

- SKU targeting
- screen creative enrichment
- fallback product top-up
- advertiser/brand account derivation
- generated asset stamping
- synthetic stock signals

The image and logo generation scripts mutate the feed by writing generated asset paths and metadata back into the JSON.

That means:

- the feed is both input data and generated-state storage
- manifests track generation progress and failures
- delivery automatically picks up generated assets because it prefers the feed image/logo for matching SKUs

## 20. OpenAI-Backed Generation Jobs

The server exposes background job APIs for:

- product images
- brand logos

Those APIs do not generate images inline inside the HTTP request. Instead they:

- validate options
- spawn a child Node process running the relevant script
- capture stdout/stderr into in-memory job logs
- expose job snapshot and progress endpoints

The scripts themselves are resumable:

- they read the feed
- read or create a manifest
- skip existing assets unless forced
- call the OpenAI Responses API with the image-generation tool
- write PNGs atomically
- update the feed and manifest atomically

This is a sensible demo pattern because long-running generation is decoupled from request latency.

## 21. Smoke Test

`scripts/smoke.mjs` is the main automated verification path.

It checks:

- health endpoint
- workspace claim flow
- template availability
- sample screen delivery
- live snapshot behavior if there is an applied plan
- telemetry round trip through `/collect`

This is valuable because there are otherwise no formal unit or integration tests in the repo.

## 22. Environment Variables and Operational Controls

Important env vars include:

- `PORT`
- `HOST`
- `DB_FILE`
- `TRACKING_BASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `OPENAI_BASE_URL`
- `PRODUCT_FEED_FILE`
- `PRODUCT_IMAGE_MANIFEST_FILE`
- `PRODUCT_IMAGE_OUTPUT_DIR`
- `PRODUCT_IMAGE_BASE_PATH`
- `BRAND_LOGO_MANIFEST_FILE`
- `BRAND_LOGO_OUTPUT_DIR`
- `BRAND_LOGO_BASE_PATH`
- `OPENAI_PRODUCT_IMAGE_MODEL`
- `OPENAI_PRODUCT_IMAGE_QUALITY`
- `OPENAI_PRODUCT_IMAGE_SIZE`
- `OPENAI_BRAND_LOGO_MODEL`
- `OPENAI_BRAND_LOGO_QUALITY`
- `OPENAI_BRAND_LOGO_SIZE`

Operationally, the app is designed to be easy to run on a single host behind a reverse proxy.

It is not designed for horizontally scaled, stateless multi-instance deployment without replacing the file-based DB and in-memory job state.

## 23. Engineering Assessment

### 23.1 Strengths

- extremely self-contained demo
- realistic screen-share and line-item concepts
- good fallback path when RMJS is unavailable
- synthetic large-scale network gives the planner something credible to work against
- telemetry and live snapshot loop make the demo observable
- workspace leasing is a pragmatic demo feature
- generation jobs and manifests are resumable

### 23.2 Main technical debt

- `src/server.js` is far too large for safe long-term ownership
- `public/admin.js` is also monolithic and stateful
- the same file mixes domain logic, API logic, and demo storytelling concerns
- there is no schema enforcement layer beyond manual normalization
- file-backed persistence is a bottleneck and a single-host assumption
- the measurement board mixes observed and modeled metrics in one surface, which is fine for demoing but risky if not clearly labeled in future product work
- the player logic is inline inside `screen.html`, which makes it harder to test and reuse

### 23.3 Where to split first if productizing

If this moved beyond demo stage, the cleanest first decomposition would be:

1. `server/api/*`
   routes only
2. `server/domain/planning/*`
   goal planner, scoring, budgeting, target inference
3. `server/domain/delivery/*`
   screen resolution, line-item rotation, product normalization
4. `server/domain/telemetry/*`
   event collection, aggregation, modeled measurement
5. `server/domain/demo/*`
   demo catalog, preset materialization, presenter metadata
6. `server/storage/*`
   DB and feed adapters
7. `client/admin/*`
   state, services, rendering
8. `client/player/*`
   player runtime separated from HTML shell

That would preserve behavior while cutting the main maintenance risk.

## 24. Bottom Line

The codebase is best understood as a monolithic demo platform with four big capabilities:

- model in-store screens as CYield-like supply objects
- plan CMax-style demand against that supply
- deliver and preview the resulting creative on a shared player URL
- monitor the result with observed telemetry plus modeled retail outcomes

The most important technical ideas are:

- one shared player URL, resolved server-side to a physical screen
- explicit screen-share inventory and managed sponsored-share line items
- a planner that combines SKU intent, store signals, and template logic
- a demo-friendly but clearly synthetic measurement layer

If the team keeps those four ideas in mind, the rest of the repository becomes much easier to reason about.
