# In-Store Screens Middleware Demo

Hackathon demo for treating physical in-store screens as retail media inventory in Criteo.

- `Page` = in-store zone (`electronics`, `whitegoods`, `checkout`, etc.)
- `Screen` = physical placement (`Vertical Screen`, `Kiosk`, `Digital Menu Board`, etc.)
- `Template` = display behavior/look for that screen placement
- `GET /api/screen-ad?screenId=...` returns RMJS-compatible payloads

## What Is Included

- Admin UI: `http://localhost:3000/admin.html`
- Screen player: `http://localhost:3000/screen.html`
- Express middleware API with file-backed storage (`data/db.json`)
- Pre-seeded showcase screens for all template presets
- Local product image assets for reliable offline/demo rendering (`public/assets/products`)

## Admin UI Capabilities

- Add pages (Page ID, Page Type, Environment, beacon toggles)
- Add screens with template preset dropdown
- Edit configured screens
- Delete configured screens
- Goal Agent workflow:
  - Generate goal-driven plans
  - Target specific SKUs from product feed
  - Review proposed screen-level changes
  - Apply approved plans
  - View live running screens/creative snapshot after apply
  - Auto-create missing line-item creative during apply when required
  - Compare before/after delivery telemetry for an applied plan
  - View run history
- Telemetry dashboard:
  - Proof-of-play summary for local fallback rendering
  - Exposure time, average dwell, and play counts by screen, template, and SKU
- Group configured screens by parent-child tree:
  - Parent: `Store ID`
  - Child: `Mapped Page`
- Collapse/expand Store and Page groups
- Open any configured screen directly from the list

## Screen Player Behavior

- Attempts RMJS render first when available
- Uses native fallback renderer when RMJS is unreachable (or forced)
- Template-specific fallback layouts are production-like and distinct
- Looping templates (`carousel-banner`, `menu-loop`) rotate through multi-product creative sets
- Template CTAs are signage instructions for non-touch screens (not clickable UI actions)

RMJS mode options:

- `?rmjs=auto` (default): attempt RMJS except local/dev fallback scenarios
- `?rmjs=on`: always attempt RMJS
- `?rmjs=off`: force native fallback renderer

Example:

`http://localhost:3000/screen.html?screenId=STORE_42_TEMPLATE_KIOSK_K1&rmjs=off`

## Run Locally

```bash
npm install
npm run dev
npm run smoke
```

The writable DB file defaults to `data/db.json`. In production, set `DB_FILE` to a path outside the git checkout so runtime changes do not block `git pull`.

Example:

```bash
DB_FILE=/var/lib/criteoscreens/db.json PORT=3100 npm start
```

Open:

- Admin: `http://localhost:3000/admin.html`
- Default seed screen: `http://localhost:3000/screen.html?screenId=STORE_42_ELECTRONICS_V1`

## Template Showcase URLs

- Fullscreen Banner: `http://localhost:3000/screen.html?screenId=STORE_42_TEMPLATE_BANNER_H1`
- Fullscreen Hero: `http://localhost:3000/screen.html?screenId=STORE_42_TEMPLATE_HERO_V1`
- Carousel Banner: `http://localhost:3000/screen.html?screenId=STORE_42_TEMPLATE_CAROUSEL_H1`
- Kiosk Interactive: `http://localhost:3000/screen.html?screenId=STORE_42_TEMPLATE_KIOSK_K1`
- Shelf Spotlight: `http://localhost:3000/screen.html?screenId=STORE_42_TEMPLATE_SHELF_S1`
- Menu Loop: `http://localhost:3000/screen.html?screenId=STORE_42_TEMPLATE_MENU_M1`

## Template Presets

- `fullscreen-banner`: general high-impact horizontal promo
- `fullscreen-hero`: portrait/feature-led creative
- `carousel-banner`: rotating horizontal offer set
- `kiosk-interactive`: staff-assisted kiosk signage with QR handoff
- `shelf-spotlight`: compact shelf-edge promotion
- `menu-loop`: digital menu board rotation

Each preset includes default values for:

- Screen type
- Screen size
- Refresh interval
- Format prefix
- Fallback image
- Default rendering attributes (promotion, badge, CTA, subcopy, legal)

## API Overview

### `GET /api/health`

Basic health check.

### `GET /api/options`

Returns:

- `pageTypes`
- `environments`
- `verbosityOptions` (page-level field; defaults to `Min`)
- `screenTypes`
- `templates` (preset metadata and defaults)
- `goalObjectives` (agent objective presets)
- `goalAggressivenessOptions` (`Conservative`, `Balanced`, `Aggressive`)
- `goalSupportsSkuTargeting` (`true`)

### `GET /api/products`

Returns product feed items for SKU targeting in Goal Agent.

Query params:

- `q` (optional free text search)
- `category` (optional category filter)
- `limit` (optional, max `300`)

Example:

`GET /api/products?q=laptop&category=electronics&limit=20`

### `GET /api/pages`

List configured pages.

### `POST /api/pages`

Create a page.

```json
{
  "pageId": "ELECTRONICS",
  "pageType": "Category",
  "environment": "Desktop",
  "verbosity": "Min",
  "firePageBeacons": true,
  "oneTagHybridIntegration": false,
  "includeBidInResponse": false
}
```

### `GET /api/screens`

List configured screens and line items.

Optional filters:

- `?pageId=ELECTRONICS`
- `?storeId=STORE_42`

### `POST /api/screens`

Create a screen and default line item.

```json
{
  "screenId": "STORE_42_ELECTRONICS_V2",
  "storeId": "STORE_42",
  "location": "electronics",
  "pageId": "ELECTRONICS",
  "screenType": "Vertical Screen",
  "screenSize": "1080x1920",
  "templateId": "fullscreen-hero",
  "refreshInterval": 30000,
  "product": {
    "ProductId": "SKU12345",
    "ProductName": "Demo Product",
    "ProductPage": "https://store.example.com/product/sku12345",
    "Image": "/assets/products/category-general.svg",
    "Price": "29.99",
    "ComparePrice": "39.99",
    "Rating": "4.5",
    "ClientAdvertiserId": "demo-advertiser",
    "RenderingAttributes": "{\"promotion\":\"Save 25%\",\"badge\":\"Featured\",\"cta\":\"Find in aisle\",\"subcopy\":\"Today only\",\"legal\":\"While stock lasts.\"}"
  }
}
```

### `PUT /api/screens/:screenId`

Edit an existing screen configuration (mapping, template, size, refresh, etc.).

### `DELETE /api/screens/:screenId`

Delete a configured screen.

### `POST /api/screens/:screenId/line-items`

Add a line item to an existing screen.

### `GET /api/agent/goals/runs`

Returns recent Goal Agent runs (planned/applied), newest first.

### `POST /api/agent/goals/plan`

Generates and stores a proposed plan for a business goal.

Behavior:

- `targetSkuIds` is optional.
- If `targetSkuIds` is empty and `prompt` is provided, the planner infers candidate SKUs from `data/productFeed.json`.
- Context guardrails prevent mismatched section targeting (for example laptop-focused SKUs on whitegoods screens).
- Response run includes:
  - `goal.targetSource` (`manual`, `prompt`, `none`)
  - `goal.inferredTerms` (prompt terms used for inference)
  - `totals.excludedScreens` (count skipped by guardrail)
  - `excludedScreens[]` with per-screen skip reason and relevance

```json
{
  "objective": "checkout-attach",
  "aggressiveness": "Balanced",
  "storeId": "STORE_42",
  "pageId": "CHECKOUT",
  "prompt": "Boost checkout add-on visibility for afternoon traffic.",
  "targetSkuIds": ["LAP-ULTRA-13-001", "LAP-GAME-16-002"]
}
```

Objective IDs:

- `awareness`
- `checkout-attach`
- `clearance`
- `premium`

### `POST /api/agent/goals/apply`

Applies a previously generated plan by `planId`.

```json
{
  "planId": "goal-abc123"
}
```

Returns:

- `run` (updated run record)
- `appliedCount`
- `skippedCount`
- `creativeGeneratedCount` (auto-generated creatives for screens missing usable line items/products)
- `liveCount`
- `liveScreens[]` (snapshot of currently live templates/products)

### `GET /api/agent/goals/live?planId=goal-abc123`

Returns live/run-time snapshot data for an applied plan.

```json
{
  "planId": "goal-abc123",
  "status": "applied",
  "appliedAt": "2026-02-10T17:00:00.000Z",
  "liveCount": 2,
  "liveScreens": [
    {
      "screenId": "STORE_42_ELECTRONICS_V1",
      "templateId": "fullscreen-hero",
      "templateName": "Fullscreen Hero",
      "refreshInterval": 23000,
      "products": [
        {
          "sku": "LAP-ULTRA-13-001",
          "name": "UltraBook 13 Pro",
          "image": "/assets/products/lap-ultra-13-001.svg"
        }
      ]
    }
  ]
}
```

### `GET /api/screen-ad?screenId=STORE_42_ELECTRONICS_V1`

Returns RMJS-ready payload with all required product fields.

Response shape:

```json
{
  "format": "desktop-instore-1080x1920",
  "products": [
    {
      "ProductId": "SKU-HDPH-001",
      "ProductName": "ANC Headphones Pro",
      "ProductPage": "https://store.example.com/products/sku-hdph-001",
      "Image": "/assets/products/category-electronics.svg",
      "Price": "199.99",
      "ComparePrice": "249.99",
      "Rating": "4.8",
      "adid": "LI-ELEC-001-...",
      "ClientAdvertiserId": "advertiser-audio",
      "RenderingAttributes": "{\"promotion\":\"Save 20%\",\"badge\":\"Featured\",\"cta\":\"Find in aisle\"}",
      "OnLoadBeacon": "https://...",
      "OnViewBeacon": "https://...",
      "OnClickBeacon": "https://...",
      "OnBasketChangeBeacon": "",
      "OnWishlistBeacon": ""
    }
  ],
  "settings": {
    "templateId": "fullscreen-hero",
    "templateName": "Fullscreen Hero",
    "loopIntervalMs": 0,
    "refreshInterval": 30000,
    "storeId": "STORE_42",
    "screenType": "Vertical Screen",
    "pageId": "ELECTRONICS",
    "location": "electronics",
    "lineItemId": "LI-ELEC-001"
  }
}
```

## Important Demo Notes

- `GET /api/screen-ad` rotates through active line items per screen across calls.
- RMJS payload includes all required product fields even when defaults are used.
- Product images are normalized to local demo assets when remote URLs are present, to avoid broken visuals in restricted networks.
- Looping templates are topped up from product feed at runtime when a screen is under-configured (so carousel/menu demos still rotate).
- If `rm.js` fails to load (for example DNS/network restrictions), fallback renderer still shows full template behavior.
- Local fallback rendering now records `play` and timed `exposure` telemetry to `/collect`, surfaced in the admin telemetry panel.
- Tracking base URL can be changed with:

`TRACKING_BASE_URL=https://your-tracker.example.com/collect`

## Production Notes

- Set `PORT` explicitly when running behind NGINX so the app stays on a fixed upstream port.
- The server can be bound explicitly with `HOST` when needed. Default production-safe example: `HOST=0.0.0.0`.
- Set `DB_FILE` to a writable path outside the repo, for example `/var/lib/criteoscreens/db.json`, so deploys can use a clean `git pull`.

Example `systemd` environment:

```ini
Environment=HOST=0.0.0.0
Environment=PORT=3100
Environment=DB_FILE=/var/lib/criteoscreens/db.json
```
