import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mutateDb, readDb } from "./dataStore.js";

const PAGE_TYPES = [
  "Homepage",
  "Search",
  "Search Bar",
  "Merchandising",
  "Category",
  "Category Menu",
  "Product Detail",
  "Favorites",
  "Confirmation",
  "Checkout",
  "Deals",
  "In-Store Zone"
];
const ENVIRONMENTS = ["Desktop", "Mobile Web", "Mobile App", "Mixed", "iOS", "Android", "In-Store"];
const VERBOSITY_OPTIONS = ["Min", "Standard", "Max"];
const SCREEN_TYPES = [
  "Vertical Screen",
  "Horizontal Screen",
  "Shelf Edge",
  "Endcap",
  "Kiosk",
  "Digital Menu Board"
];
const TEMPLATE_PRESETS = [
  {
    id: "fullscreen-banner",
    name: "Fullscreen Banner",
    description: "Single hero creative for general in-store displays.",
    defaultScreenType: "Horizontal Screen",
    defaultScreenSize: "1920x1080",
    defaultRefreshInterval: 30000,
    defaultFormatPrefix: "desktop-instore",
    defaultImage: "https://images.unsplash.com/photo-1607083206968-13611e3d76db?w=1200",
    defaultPromotion: "Storewide offer"
  },
  {
    id: "fullscreen-hero",
    name: "Fullscreen Hero",
    description: "High-impact portrait/entrance creative with large product visual.",
    defaultScreenType: "Vertical Screen",
    defaultScreenSize: "1080x1920",
    defaultRefreshInterval: 30000,
    defaultFormatPrefix: "desktop-instore-hero",
    defaultImage: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=1200",
    defaultPromotion: "Featured now"
  },
  {
    id: "carousel-banner",
    name: "Carousel Banner",
    description: "Rotating wide creative for aisle or wall-mounted horizontal screens.",
    defaultScreenType: "Horizontal Screen",
    defaultScreenSize: "1920x1080",
    defaultRefreshInterval: 20000,
    defaultFormatPrefix: "desktop-instore-carousel",
    defaultImage: "https://images.unsplash.com/photo-1560393464-5c69a73c5770?w=1200",
    defaultPromotion: "Weekly highlights"
  },
  {
    id: "kiosk-interactive",
    name: "Kiosk Interactive",
    description: "Touch-friendly kiosk layout with strong CTA and pricing emphasis.",
    defaultScreenType: "Kiosk",
    defaultScreenSize: "1080x1920",
    defaultRefreshInterval: 15000,
    defaultFormatPrefix: "desktop-instore-kiosk",
    defaultImage: "https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=1200",
    defaultPromotion: "Tap to explore"
  },
  {
    id: "shelf-spotlight",
    name: "Shelf Spotlight",
    description: "Compact creative for shelf-edge and endcap placements.",
    defaultScreenType: "Shelf Edge",
    defaultScreenSize: "1280x720",
    defaultRefreshInterval: 12000,
    defaultFormatPrefix: "desktop-instore-shelf",
    defaultImage: "https://images.unsplash.com/photo-1517666005606-69dea9b54865?w=1200",
    defaultPromotion: "Aisle special"
  },
  {
    id: "menu-loop",
    name: "Menu Loop",
    description: "Digital menu board rotation for food courts and service counters.",
    defaultScreenType: "Digital Menu Board",
    defaultScreenSize: "1920x1080",
    defaultRefreshInterval: 10000,
    defaultFormatPrefix: "desktop-instore-menu",
    defaultImage: "https://images.unsplash.com/photo-1512152272829-e3139592d56f?w=1200",
    defaultPromotion: "Now serving deals"
  }
];
const TEMPLATE_PRESET_MAP = new Map(TEMPLATE_PRESETS.map((entry) => [entry.id, entry]));
const DEFAULT_REFRESH_INTERVAL = 30000;
const DEFAULT_TRACKING_BASE_URL = "https://httpbin.org/get";
const SCREEN_SIZE_PATTERN = /^\d{3,5}x\d{3,5}$/i;
const rotationState = new Map();

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function toTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readRequiredString(value, fieldName, maxLength = 120) {
  const parsed = toTrimmedString(value);
  if (!parsed) {
    throw new HttpError(400, `${fieldName} is required.`);
  }
  if (parsed.length > maxLength) {
    throw new HttpError(400, `${fieldName} must be at most ${maxLength} chars.`);
  }
  return parsed;
}

function readOptionalString(value, maxLength = 500) {
  const parsed = toTrimmedString(value);
  if (!parsed) {
    return "";
  }
  return parsed.slice(0, maxLength);
}

function readBoolean(value, defaultValue = false) {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (lower === "true") {
      return true;
    }
    if (lower === "false") {
      return false;
    }
  }
  return defaultValue;
}

function readRefreshInterval(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return DEFAULT_REFRESH_INTERVAL;
  }
  return Math.max(5000, Math.min(300000, parsed));
}

function readIsoDateOr(value, fallbackIso) {
  const source = toTrimmedString(value) || fallbackIso;
  const date = new Date(source);
  if (Number.isNaN(date.valueOf())) {
    return fallbackIso;
  }
  return date.toISOString();
}

function ensureAllowed(value, allowedValues, fieldName) {
  if (!allowedValues.includes(value)) {
    throw new HttpError(400, `${fieldName} must be one of: ${allowedValues.join(", ")}`);
  }
}

function getTemplatePreset(templateId) {
  const normalizedId = readOptionalString(templateId, 80);
  if (normalizedId && TEMPLATE_PRESET_MAP.has(normalizedId)) {
    return TEMPLATE_PRESET_MAP.get(normalizedId);
  }
  if (normalizedId) {
    return {
      id: normalizedId,
      name: titleCase(normalizedId),
      description: "Custom template preset.",
      defaultScreenType: "Horizontal Screen",
      defaultScreenSize: "1920x1080",
      defaultRefreshInterval: DEFAULT_REFRESH_INTERVAL,
      defaultFormatPrefix: "desktop-instore",
      defaultImage: "https://images.unsplash.com/photo-1607083206968-13611e3d76db?w=1200",
      defaultPromotion: "In-store special"
    };
  }
  return TEMPLATE_PRESET_MAP.get("fullscreen-banner");
}

function buildDefaultFormat(templateId, screenSize) {
  const template = getTemplatePreset(templateId);
  return `${template.defaultFormatPrefix}-${screenSize}`;
}

function getTemplateLoopIntervalMs(templateId) {
  switch (templateId) {
    case "carousel-banner":
      return 4000;
    case "menu-loop":
      return 3200;
    default:
      return 0;
  }
}

function normalizeRenderingAttributes(value) {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return "{}";
}

function buildBeaconUrl(event, screenId, adid) {
  const base = process.env.TRACKING_BASE_URL || DEFAULT_TRACKING_BASE_URL;
  try {
    const beaconUrl = new URL(base);
    beaconUrl.searchParams.set("event", event);
    beaconUrl.searchParams.set("screenId", screenId);
    beaconUrl.searchParams.set("adid", adid);
    return beaconUrl.toString();
  } catch {
    return `${DEFAULT_TRACKING_BASE_URL}?event=${encodeURIComponent(event)}&screenId=${encodeURIComponent(
      screenId
    )}&adid=${encodeURIComponent(adid)}`;
  }
}

function titleCase(value) {
  const normalized = toTrimmedString(value).replace(/[_-]+/g, " ");
  if (!normalized) {
    return "Store";
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function buildStorageProduct(rawProduct, screenId, location, templateId) {
  const product = rawProduct && typeof rawProduct === "object" ? rawProduct : {};
  const template = getTemplatePreset(templateId);
  const defaultProductName = `${titleCase(location)} ${template.name}`;
  const productId =
    readOptionalString(product.ProductId, 80) ||
    readOptionalString(product.productId, 80) ||
    `SKU-${screenId}-001`;
  const productName =
    readOptionalString(product.ProductName, 120) ||
    readOptionalString(product.productName, 120) ||
    defaultProductName;
  const productPage =
    readOptionalString(product.ProductPage, 500) ||
    readOptionalString(product.productPage, 500) ||
    "https://store.example.com/products/featured";
  const image =
    readOptionalString(product.Image, 500) ||
    readOptionalString(product.image, 500) ||
    template.defaultImage;

  return {
    ProductId: productId,
    ProductName: productName,
    ProductPage: productPage,
    Image: image,
    Price: readOptionalString(product.Price, 30) || readOptionalString(product.price, 30) || "29.99",
    ComparePrice:
      readOptionalString(product.ComparePrice, 30) || readOptionalString(product.comparePrice, 30) || "39.99",
    Rating: readOptionalString(product.Rating, 10) || readOptionalString(product.rating, 10) || "4.5",
    adid: readOptionalString(product.adid, 120),
    ClientAdvertiserId:
      readOptionalString(product.ClientAdvertiserId, 120) ||
      readOptionalString(product.clientAdvertiserId, 120) ||
      "demo-advertiser",
    RenderingAttributes: normalizeRenderingAttributes(
      product.RenderingAttributes ??
        product.renderingAttributes ?? {
          promotion: template.defaultPromotion,
          templateId: template.id
        }
    ),
    OnLoadBeacon: readOptionalString(product.OnLoadBeacon, 500),
    OnViewBeacon: readOptionalString(product.OnViewBeacon, 500),
    OnClickBeacon: readOptionalString(product.OnClickBeacon, 500),
    OnBasketChangeBeacon: readOptionalString(product.OnBasketChangeBeacon, 500),
    OnWishlistBeacon: readOptionalString(product.OnWishlistBeacon, 500)
  };
}

function normalizeLineItemForStorage(rawLineItem, { screenId, templateId, location, fallbackProduct }, index) {
  const lineItem = rawLineItem && typeof rawLineItem === "object" ? rawLineItem : {};
  const startFallback = new Date(Date.now() - 60 * 1000).toISOString();
  const endFallback = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const lineItemId =
    readOptionalString(lineItem.lineItemId, 120) ||
    readOptionalString(lineItem.id, 120) ||
    `${screenId}-LI-${index + 1}`;
  const products = Array.isArray(lineItem.products) && lineItem.products.length > 0 ? lineItem.products : [fallbackProduct];

  return {
    lineItemId,
    name: readOptionalString(lineItem.name, 180) || `Line Item ${index + 1}`,
    activeFrom: readIsoDateOr(lineItem.activeFrom, startFallback),
    activeTo: readIsoDateOr(lineItem.activeTo, endFallback),
    templateId: readOptionalString(lineItem.templateId, 120) || templateId,
    products: products.map((product) => buildStorageProduct(product, screenId, location, templateId))
  };
}

function normalizeProductForDelivery(rawProduct, { screenId, lineItemId, index }) {
  const product = rawProduct && typeof rawProduct === "object" ? rawProduct : {};
  const adid =
    readOptionalString(product.adid, 120) || `${lineItemId}-${Date.now()}-${Math.max(index + 1, 1)}`;

  return {
    ProductId:
      readOptionalString(product.ProductId, 80) ||
      readOptionalString(product.productId, 80) ||
      `${screenId}-SKU-${index + 1}`,
    ProductName:
      readOptionalString(product.ProductName, 120) ||
      readOptionalString(product.productName, 120) ||
      "In-Store Featured Product",
    ProductPage:
      readOptionalString(product.ProductPage, 500) ||
      readOptionalString(product.productPage, 500) ||
      "https://store.example.com/products/featured",
    Image:
      readOptionalString(product.Image, 500) ||
      readOptionalString(product.image, 500) ||
      "https://images.unsplash.com/photo-1583258292688-d0213dc5a3a8?w=1200",
    Price: readOptionalString(product.Price, 30) || readOptionalString(product.price, 30) || "0.00",
    ComparePrice: readOptionalString(product.ComparePrice, 30) || readOptionalString(product.comparePrice, 30),
    Rating: readOptionalString(product.Rating, 10) || readOptionalString(product.rating, 10),
    adid,
    ClientAdvertiserId:
      readOptionalString(product.ClientAdvertiserId, 120) ||
      readOptionalString(product.clientAdvertiserId, 120) ||
      "demo-advertiser",
    RenderingAttributes: normalizeRenderingAttributes(
      product.RenderingAttributes ?? product.renderingAttributes ?? { inStore: true }
    ),
    OnLoadBeacon: readOptionalString(product.OnLoadBeacon, 500) || buildBeaconUrl("load", screenId, adid),
    OnViewBeacon: readOptionalString(product.OnViewBeacon, 500) || buildBeaconUrl("view", screenId, adid),
    OnClickBeacon: readOptionalString(product.OnClickBeacon, 500) || buildBeaconUrl("click", screenId, adid),
    OnBasketChangeBeacon: readOptionalString(product.OnBasketChangeBeacon, 500),
    OnWishlistBeacon: readOptionalString(product.OnWishlistBeacon, 500)
  };
}

function isLineItemActive(lineItem, currentDate) {
  if (!lineItem) {
    return false;
  }
  const fromDate = new Date(lineItem.activeFrom);
  const toDate = new Date(lineItem.activeTo);
  if (Number.isNaN(fromDate.valueOf()) || Number.isNaN(toDate.valueOf())) {
    return true;
  }
  return fromDate <= currentDate && currentDate <= toDate;
}

function pickLineItem(screenId, lineItems) {
  if (!lineItems.length) {
    return null;
  }
  const currentIndex = rotationState.get(screenId) ?? 0;
  const selected = lineItems[currentIndex % lineItems.length];
  rotationState.set(screenId, currentIndex + 1);
  return selected;
}

function normalizeError(error) {
  if (error instanceof HttpError) {
    return { status: error.status, message: error.message };
  }
  return { status: 500, message: "Unexpected error." };
}

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.resolve(__dirname, "../public")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/options", (_req, res) => {
  res.json({
    pageTypes: PAGE_TYPES,
    environments: ENVIRONMENTS,
    verbosityOptions: VERBOSITY_OPTIONS,
    screenTypes: SCREEN_TYPES,
    templates: TEMPLATE_PRESETS
  });
});

app.get("/api/pages", async (_req, res) => {
  const db = await readDb();
  const pages = [...db.pages].sort((a, b) => a.pageId.localeCompare(b.pageId));
  res.json({ pages });
});

app.post("/api/pages", async (req, res) => {
  try {
    const pageId = readRequiredString(req.body.pageId, "pageId", 40);
    const pageType = readRequiredString(req.body.pageType, "pageType", 40);
    const environment = readRequiredString(req.body.environment, "environment", 40);
    const verbosity = readOptionalString(req.body.verbosity, 20) || "Min";

    ensureAllowed(pageType, PAGE_TYPES, "pageType");
    ensureAllowed(environment, ENVIRONMENTS, "environment");
    ensureAllowed(verbosity, VERBOSITY_OPTIONS, "verbosity");

    const page = await mutateDb(async (db) => {
      const exists = db.pages.some((entry) => entry.pageId.toLowerCase() === pageId.toLowerCase());
      if (exists) {
        throw new HttpError(409, `Page ${pageId} already exists.`);
      }

      const now = new Date().toISOString();
      const record = {
        pageId,
        pageType,
        environment,
        verbosity,
        firePageBeacons: readBoolean(req.body.firePageBeacons, true),
        oneTagHybridIntegration: readBoolean(req.body.oneTagHybridIntegration, false),
        includeBidInResponse: readBoolean(req.body.includeBidInResponse, false),
        createdAt: now,
        updatedAt: now
      };
      db.pages.push(record);
      return record;
    });

    res.status(201).json({ page });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.get("/api/screens", async (req, res) => {
  const db = await readDb();
  const pageIdFilter = toTrimmedString(req.query.pageId);
  const storeIdFilter = toTrimmedString(req.query.storeId);
  let screens = [...db.screens];

  if (pageIdFilter) {
    screens = screens.filter((screen) => screen.pageId === pageIdFilter);
  }
  if (storeIdFilter) {
    screens = screens.filter((screen) => screen.storeId === storeIdFilter);
  }

  screens.sort((a, b) => a.screenId.localeCompare(b.screenId));
  res.json({ screens });
});

app.post("/api/screens", async (req, res) => {
  try {
    const screenId = readRequiredString(req.body.screenId, "screenId", 80);
    const storeId = readRequiredString(req.body.storeId, "storeId", 80);
    const location = readRequiredString(req.body.location, "location", 80);
    const pageId = readRequiredString(req.body.pageId, "pageId", 40);
    const screenType = readRequiredString(req.body.screenType, "screenType", 80);
    const screenSize = readRequiredString(req.body.screenSize, "screenSize", 20);
    if (!SCREEN_SIZE_PATTERN.test(screenSize)) {
      throw new HttpError(400, "screenSize must look like 1920x1080.");
    }
    ensureAllowed(screenType, SCREEN_TYPES, "screenType");

    const templateId = readOptionalString(req.body.templateId, 80) || "fullscreen-banner";
    const template = getTemplatePreset(templateId);
    const format = readOptionalString(req.body.format, 120) || buildDefaultFormat(template.id, screenSize);
    const refreshInterval =
      req.body.refreshInterval === undefined
        ? readRefreshInterval(template.defaultRefreshInterval)
        : readRefreshInterval(req.body.refreshInterval);
    const fallbackProduct = buildStorageProduct(req.body.product, screenId, location, template.id);
    const rawLineItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];

    const screen = await mutateDb(async (db) => {
      const page = db.pages.find((entry) => entry.pageId === pageId);
      if (!page) {
        throw new HttpError(400, `Page ${pageId} does not exist. Create the page first.`);
      }
      const exists = db.screens.some((entry) => entry.screenId.toLowerCase() === screenId.toLowerCase());
      if (exists) {
        throw new HttpError(409, `Screen ${screenId} already exists.`);
      }

      const lineItems =
        rawLineItems.length > 0
          ? rawLineItems.map((lineItem, index) =>
              normalizeLineItemForStorage(
                lineItem,
                { screenId, templateId, location, fallbackProduct },
                index
              )
            )
          : [
              normalizeLineItemForStorage(
                {
                  name: `${titleCase(location)} Default Rotation`,
                  products: [fallbackProduct]
                },
                { screenId, templateId, location, fallbackProduct },
                0
              )
            ];

      const now = new Date().toISOString();
      const record = {
        screenId,
        storeId,
        location,
        pageId,
        screenType,
        screenSize,
        format,
        templateId,
        refreshInterval,
        lineItems,
        createdAt: now,
        updatedAt: now
      };
      db.screens.push(record);
      return record;
    });

    res.status(201).json({ screen });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.put("/api/screens/:screenId", async (req, res) => {
  try {
    const screenId = readRequiredString(req.params.screenId, "screenId", 80);
    const screen = await mutateDb(async (db) => {
      const record = db.screens.find((entry) => entry.screenId === screenId);
      if (!record) {
        throw new HttpError(404, `Screen ${screenId} was not found.`);
      }

      const nextStoreId = readOptionalString(req.body.storeId, 80) || record.storeId;
      const nextLocation = readOptionalString(req.body.location, 80) || record.location;
      const nextPageId = readOptionalString(req.body.pageId, 40) || record.pageId;
      const nextTemplateId = readOptionalString(req.body.templateId, 80) || record.templateId || "fullscreen-banner";
      const template = getTemplatePreset(nextTemplateId);
      const nextScreenType =
        readOptionalString(req.body.screenType, 80) || record.screenType || template.defaultScreenType;
      const nextScreenSize =
        readOptionalString(req.body.screenSize, 20) || record.screenSize || template.defaultScreenSize;

      ensureAllowed(nextScreenType, SCREEN_TYPES, "screenType");
      if (!SCREEN_SIZE_PATTERN.test(nextScreenSize)) {
        throw new HttpError(400, "screenSize must look like 1920x1080.");
      }

      const page = db.pages.find((entry) => entry.pageId === nextPageId);
      if (!page) {
        throw new HttpError(400, `Page ${nextPageId} does not exist. Create the page first.`);
      }

      const templateChanged = nextTemplateId !== record.templateId;
      const sizeChanged = nextScreenSize !== record.screenSize;
      const explicitFormat = readOptionalString(req.body.format, 120);
      const nextFormat =
        explicitFormat ||
        (templateChanged || sizeChanged
          ? buildDefaultFormat(template.id, nextScreenSize)
          : readOptionalString(record.format, 120) || buildDefaultFormat(template.id, nextScreenSize));
      const nextRefreshInterval =
        req.body.refreshInterval === undefined
          ? templateChanged
            ? readRefreshInterval(template.defaultRefreshInterval)
            : readRefreshInterval(record.refreshInterval)
          : readRefreshInterval(req.body.refreshInterval);

      const shouldReplacePrimaryProduct = req.body.product !== undefined;
      const fallbackProduct = buildStorageProduct(req.body.product, screenId, nextLocation, template.id);
      const currentLineItems = Array.isArray(record.lineItems) ? record.lineItems : [];
      const updatedLineItems =
        currentLineItems.length > 0
          ? currentLineItems.map((lineItem, index) => {
              const sourceProducts = Array.isArray(lineItem.products) ? lineItem.products : [];
              const nextProducts =
                shouldReplacePrimaryProduct && index === 0
                  ? [fallbackProduct]
                  : sourceProducts.length > 0
                    ? sourceProducts.map((product) => buildStorageProduct(product, screenId, nextLocation, template.id))
                    : [fallbackProduct];

              return {
                ...lineItem,
                templateId: template.id,
                products: nextProducts
              };
            })
          : [
              normalizeLineItemForStorage(
                {
                  name: `${titleCase(nextLocation)} Default Rotation`,
                  products: [fallbackProduct]
                },
                {
                  screenId,
                  templateId: template.id,
                  location: nextLocation,
                  fallbackProduct
                },
                0
              )
            ];

      record.storeId = nextStoreId;
      record.location = nextLocation;
      record.pageId = nextPageId;
      record.screenType = nextScreenType;
      record.screenSize = nextScreenSize;
      record.templateId = template.id;
      record.format = nextFormat;
      record.refreshInterval = nextRefreshInterval;
      record.lineItems = updatedLineItems;
      record.updatedAt = new Date().toISOString();
      return record;
    });

    res.json({ screen });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.delete("/api/screens/:screenId", async (req, res) => {
  try {
    const screenId = readRequiredString(req.params.screenId, "screenId", 80);
    const deleted = await mutateDb(async (db) => {
      const index = db.screens.findIndex((entry) => entry.screenId === screenId);
      if (index < 0) {
        throw new HttpError(404, `Screen ${screenId} was not found.`);
      }

      const [removed] = db.screens.splice(index, 1);
      return removed;
    });

    rotationState.delete(screenId);
    res.json({ deleted: true, screenId: deleted.screenId });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.post("/api/screens/:screenId/line-items", async (req, res) => {
  try {
    const screenId = readRequiredString(req.params.screenId, "screenId", 80);
    const lineItem = await mutateDb(async (db) => {
      const screen = db.screens.find((entry) => entry.screenId === screenId);
      if (!screen) {
        throw new HttpError(404, `Screen ${screenId} was not found.`);
      }
      const fallbackProduct = buildStorageProduct(req.body.product, screenId, screen.location, screen.templateId);
      const normalizedLineItem = normalizeLineItemForStorage(
        req.body,
        {
          screenId,
          templateId: screen.templateId,
          location: screen.location,
          fallbackProduct
        },
        screen.lineItems.length
      );
      screen.lineItems.push(normalizedLineItem);
      screen.updatedAt = new Date().toISOString();
      return normalizedLineItem;
    });

    res.status(201).json({ lineItem });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.get("/api/screen-ad", async (req, res) => {
  try {
    const screenId = readRequiredString(req.query.screenId, "screenId", 80);
    const db = await readDb();
    const screen = db.screens.find((entry) => entry.screenId === screenId);
    if (!screen) {
      throw new HttpError(404, `Screen ${screenId} was not found.`);
    }

    const now = new Date();
    const activeLineItems = (screen.lineItems || []).filter((lineItem) => isLineItemActive(lineItem, now));
    const candidateLineItems = activeLineItems.length > 0 ? activeLineItems : screen.lineItems || [];
    const selectedLineItem = pickLineItem(screenId, candidateLineItems);
    if (!selectedLineItem) {
      throw new HttpError(404, `Screen ${screenId} has no line items configured.`);
    }

    const products = (selectedLineItem.products || []).map((product, index) =>
      normalizeProductForDelivery(product, {
        screenId,
        lineItemId: selectedLineItem.lineItemId,
        index
      })
    );

    const selectedTemplateId =
      readOptionalString(selectedLineItem.templateId, 120) || screen.templateId || "fullscreen-banner";
    const selectedTemplate = getTemplatePreset(selectedTemplateId);

    res.json({
      format:
        readOptionalString(screen.format, 120) ||
        buildDefaultFormat(screen.templateId || selectedTemplate.id, screen.screenSize),
      products,
      settings: {
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        loopIntervalMs: getTemplateLoopIntervalMs(selectedTemplate.id),
        refreshInterval: readRefreshInterval(screen.refreshInterval),
        screenType: screen.screenType,
        pageId: screen.pageId,
        lineItemId: selectedLineItem.lineItemId
      }
    });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.get("/", (_req, res) => {
  res.redirect("/admin.html");
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`In-store middleware listening on http://localhost:${PORT}`);
});
