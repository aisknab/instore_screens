import express from "express";
import fs from "node:fs/promises";
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
const GOAL_AGGRESSIVENESS_OPTIONS = ["Conservative", "Balanced", "Aggressive"];
const GOAL_OBJECTIVES = [
  {
    id: "awareness",
    label: "Drive In-Store Awareness",
    description: "Maximize broad visibility across screens and high-traffic zones.",
    creativeDefaults: {
      promotion: "Now live in-store",
      badge: "Brand Spotlight",
      cta: "See in aisle",
      subcopy: "Featured this hour in your current store.",
      legal: "Availability may vary by store."
    }
  },
  {
    id: "checkout-attach",
    label: "Increase Checkout Attach Rate",
    description: "Promote relevant add-ons and bundles close to checkout or decision points.",
    creativeDefaults: {
      promotion: "Add-on pick for checkout",
      badge: "Basket Builder",
      cta: "Pick up at checkout",
      subcopy: "Pair this item with your basket for better value.",
      legal: "Offer valid at participating checkout lanes."
    }
  },
  {
    id: "clearance",
    label: "Clear Overstock Inventory",
    description: "Prioritize conversion-focused templates for moving excess stock quickly.",
    creativeDefaults: {
      promotion: "Clearance markdown",
      badge: "Stock Reduction",
      cta: "Find in aisle now",
      subcopy: "Limited units left at this location.",
      legal: "Clearance stock and pricing are location-specific."
    }
  },
  {
    id: "premium",
    label: "Promote Premium Range",
    description: "Elevate hero-led creative for high-value and high-margin products.",
    creativeDefaults: {
      promotion: "Premium range highlight",
      badge: "Signature Collection",
      cta: "See premium display",
      subcopy: "Elevated quality and standout in-store presentation.",
      legal: "Premium assortment differs by location."
    }
  }
];
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
    defaultImage: "/assets/products/category-general.svg",
    defaultPromotion: "Storewide offer",
    defaultBadge: "In-Store Exclusive",
    defaultCta: "Find in aisle",
    defaultSubcopy: "Limited-time pricing available in this store.",
    defaultLegal: "While stock lasts."
  },
  {
    id: "fullscreen-hero",
    name: "Fullscreen Hero",
    description: "High-impact portrait/entrance creative with large product visual.",
    defaultScreenType: "Vertical Screen",
    defaultScreenSize: "1080x1920",
    defaultRefreshInterval: 30000,
    defaultFormatPrefix: "desktop-instore-hero",
    defaultImage: "/assets/products/category-electronics.svg",
    defaultPromotion: "Featured now",
    defaultBadge: "Featured Product",
    defaultCta: "See product display",
    defaultSubcopy: "Discover premium features and compare in-store.",
    defaultLegal: "Selection may vary by location."
  },
  {
    id: "carousel-banner",
    name: "Carousel Banner",
    description: "Rotating wide creative for aisle or wall-mounted horizontal screens.",
    defaultScreenType: "Horizontal Screen",
    defaultScreenSize: "1920x1080",
    defaultRefreshInterval: 20000,
    defaultFormatPrefix: "desktop-instore-carousel",
    defaultImage: "/assets/products/category-electronics.svg",
    defaultPromotion: "Weekly highlights",
    defaultBadge: "Trending Deals",
    defaultCta: "Browse this aisle",
    defaultSubcopy: "Auto-rotating offers curated for this aisle.",
    defaultLegal: "Offers rotate throughout the day."
  },
  {
    id: "kiosk-interactive",
    name: "Kiosk Assisted",
    description: "Staff-assisted kiosk signage with QR handoff for non-touch screens.",
    defaultScreenType: "Kiosk",
    defaultScreenSize: "1080x1920",
    defaultRefreshInterval: 15000,
    defaultFormatPrefix: "desktop-instore-kiosk",
    defaultImage: "/assets/products/category-general.svg",
    defaultPromotion: "Assisted kiosk offers",
    defaultBadge: "Kiosk Display",
    defaultCta: "Scan QR or ask staff",
    defaultSubcopy: "Use QR handoff or staff assistance to continue on mobile.",
    defaultLegal: "Digital offers applied at checkout."
  },
  {
    id: "shelf-spotlight",
    name: "Shelf Spotlight",
    description: "Compact creative for shelf-edge and endcap placements.",
    defaultScreenType: "Shelf Edge",
    defaultScreenSize: "1280x720",
    defaultRefreshInterval: 12000,
    defaultFormatPrefix: "desktop-instore-shelf",
    defaultImage: "/assets/products/category-aisle.svg",
    defaultPromotion: "Aisle special",
    defaultBadge: "Shelf Edge Deal",
    defaultCta: "Pick up nearby",
    defaultSubcopy: "Quick-grab promotions near the product shelf.",
    defaultLegal: "Price valid for this location only."
  },
  {
    id: "menu-loop",
    name: "Menu Loop",
    description: "Digital menu board rotation for food courts and service counters.",
    defaultScreenType: "Digital Menu Board",
    defaultScreenSize: "1920x1080",
    defaultRefreshInterval: 10000,
    defaultFormatPrefix: "desktop-instore-menu",
    defaultImage: "/assets/products/category-foodcourt.svg",
    defaultPromotion: "Now serving deals",
    defaultBadge: "Now Serving",
    defaultCta: "Order at counter",
    defaultSubcopy: "Fresh menu specials rotating throughout the day.",
    defaultLegal: "Preparation times may vary."
  }
];
const TEMPLATE_PRESET_MAP = new Map(TEMPLATE_PRESETS.map((entry) => [entry.id, entry]));
const GOAL_OBJECTIVE_MAP = new Map(GOAL_OBJECTIVES.map((entry) => [entry.id, entry]));
const DEFAULT_REFRESH_INTERVAL = 30000;
const DEFAULT_TRACKING_BASE_URL = "https://httpbin.org/get";
const SCREEN_SIZE_PATTERN = /^\d{3,5}x\d{3,5}$/i;
const AGENT_RUN_HISTORY_LIMIT = 40;
const GOAL_TARGET_SKU_LIMIT = 24;
const GOAL_INFERRED_PRODUCT_LIMIT = 8;
const GOAL_RELEVANCE_THRESHOLD = 0.24;
const GOAL_PROMPT_MIN_SCORE = 0.75;
const PRODUCT_FEED_FILE = path.resolve(process.cwd(), "data", "productFeed.json");
const PRODUCT_FEED_DEFAULT = [];
const PRODUCT_IMAGE_BASE_PATH = "/assets/products";
const DEMO_SKU_IMAGE_PREFIXES = ["LAP-", "WG-", "FS-", "GR-", "ACC-"];
const DEMO_CATEGORY_IMAGE_FALLBACKS = new Set([
  "electronics",
  "whitegoods",
  "aisle",
  "foodcourt",
  "general"
]);
const REMOTE_URL_PATTERN = /^https?:\/\//i;
const rotationState = new Map();
const TOUCH_FORWARD_CTA_PATTERN =
  /\b(tap|click|touch|swipe|press|shop now|learn more|buy now|start now|order now)\b/i;
const TOUCH_FORWARD_COPY_PATTERN = /\b(tap|click|touch|swipe|press)\b/i;
const IN_STORE_CTA_CUE_PATTERN =
  /\b(aisle|counter|shelf|staff|scan|checkout|nearby|display|store|in-store|desk|basket|pick up|pickup)\b/i;
const GOAL_PROMPT_STOPWORDS = new Set([
  "about",
  "across",
  "agent",
  "all",
  "and",
  "brief",
  "campaign",
  "can",
  "change",
  "changes",
  "day",
  "days",
  "demo",
  "drive",
  "for",
  "from",
  "goal",
  "goals",
  "have",
  "improve",
  "increase",
  "into",
  "inventory",
  "line",
  "lineup",
  "more",
  "new",
  "objective",
  "optimize",
  "our",
  "please",
  "product",
  "products",
  "promote",
  "push",
  "range",
  "sale",
  "sales",
  "screen",
  "screens",
  "section",
  "sections",
  "sell",
  "show",
  "store",
  "stores",
  "target",
  "targets",
  "that",
  "the",
  "their",
  "them",
  "this",
  "through",
  "today",
  "week",
  "weeks",
  "with"
]);

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
      defaultImage: "/assets/products/category-general.svg",
      defaultPromotion: "In-store special",
      defaultBadge: "In-Store Promotion",
      defaultCta: "Find in aisle",
      defaultSubcopy: "Available at this store location.",
      defaultLegal: "Subject to availability."
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

function normalizeSku(value) {
  return readOptionalString(value, 80).toUpperCase();
}

function readStringArray(value, maxItems = 20, itemMaxLength = 80) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => readOptionalString(entry, itemMaxLength))
      .filter(Boolean)
      .slice(0, maxItems);
  }

  const raw = readOptionalString(value, 1000);
  if (!raw) {
    return [];
  }

  return raw
    .split(/[,\n]+/)
    .map((entry) => readOptionalString(entry, itemMaxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function slugify(value) {
  return readOptionalString(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function tokenize(value) {
  return readOptionalString(value, 500)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((entry) => entry.length > 2);
}

function normalizeMatchToken(token) {
  const raw = readOptionalString(token, 80).toLowerCase();
  if (!raw) {
    return "";
  }
  if (raw.endsWith("ies") && raw.length > 4) {
    return `${raw.slice(0, -3)}y`;
  }
  if (raw.endsWith("es") && raw.length > 4 && !raw.endsWith("ses")) {
    return raw.slice(0, -2);
  }
  if (raw.endsWith("s") && raw.length > 3 && !raw.endsWith("ss")) {
    return raw.slice(0, -1);
  }
  return raw;
}

function tokenizeForMatch(value, dropStopwords = false) {
  const normalized = tokenize(value)
    .map((token) => normalizeMatchToken(token))
    .filter(Boolean);
  const deduped = [...new Set(normalized)];
  if (!dropStopwords) {
    return deduped;
  }
  return deduped.filter((token) => !GOAL_PROMPT_STOPWORDS.has(token));
}

function buildProductImagePathFromSku(sku) {
  const slug = slugify(sku) || "product";
  return `${PRODUCT_IMAGE_BASE_PATH}/${slug}.svg`;
}

function buildCategoryFallbackImagePath(category) {
  const slug = slugify(category) || "general";
  return `${PRODUCT_IMAGE_BASE_PATH}/category-${slug}.svg`;
}

function hasDemoSkuImage(sku) {
  return DEMO_SKU_IMAGE_PREFIXES.some((prefix) => sku.startsWith(prefix));
}

function resolveProductImagePath(
  imageValue,
  { sku = "", category = "", location = "", templateId = "fullscreen-banner" } = {}
) {
  const template = getTemplatePreset(templateId);
  const explicitImage = readOptionalString(imageValue, 500);
  const normalizedSku = normalizeSku(sku);
  const normalizedCategory = slugify(category || location || "");
  const skuFallback =
    normalizedSku && hasDemoSkuImage(normalizedSku) ? buildProductImagePathFromSku(normalizedSku) : "";
  const categoryFallback =
    normalizedCategory && DEMO_CATEGORY_IMAGE_FALLBACKS.has(normalizedCategory)
      ? buildCategoryFallbackImagePath(normalizedCategory)
      : "";
  const fallbackImage = skuFallback || categoryFallback || template.defaultImage;

  if (!explicitImage) {
    return fallbackImage;
  }
  if (explicitImage.startsWith("/assets/")) {
    return explicitImage;
  }
  if (REMOTE_URL_PATTERN.test(explicitImage)) {
    return fallbackImage;
  }
  return explicitImage;
}

function normalizeProductFeedItem(rawProduct, index) {
  const product = rawProduct && typeof rawProduct === "object" ? rawProduct : {};
  const sku = normalizeSku(product.sku || product.ProductId || `SKU-FEED-${index + 1}`);
  const name = readOptionalString(product.name || product.ProductName, 180) || `Feed Product ${index + 1}`;
  const category = readOptionalString(product.category, 80).toLowerCase() || "general";
  const brand = readOptionalString(product.brand, 80) || "Store Brand";
  const productPage =
    readOptionalString(product.productPage || product.ProductPage, 500) ||
    `https://store.example.com/products/${slugify(sku) || `sku-${index + 1}`}`;
  const imageInput = readOptionalString(product.image || product.Image, 500);
  const image = resolveProductImagePath(imageInput, {
    sku,
    category,
    location: category,
    templateId: "fullscreen-banner"
  });
  const price = readOptionalString(product.price || product.Price, 30) || "29.99";
  const comparePrice = readOptionalString(product.comparePrice || product.ComparePrice, 30) || "";
  const rating = readOptionalString(product.rating || product.Rating, 10) || "4.5";
  const advertiserId =
    readOptionalString(product.advertiserId || product.ClientAdvertiserId, 120) ||
    `advertiser-${slugify(brand) || "store"}`;
  const tags = readStringArray(product.tags, 12, 40).map((entry) => entry.toLowerCase());

  return {
    sku,
    name,
    category,
    brand,
    productPage,
    image,
    price,
    comparePrice,
    rating,
    advertiserId,
    tags
  };
}

async function readProductFeed() {
  try {
    const raw = await fs.readFile(PRODUCT_FEED_FILE, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
    const source = Array.isArray(parsed) ? parsed : PRODUCT_FEED_DEFAULT;
    return source.map((product, index) => normalizeProductFeedItem(product, index));
  } catch {
    return PRODUCT_FEED_DEFAULT.map((product, index) => normalizeProductFeedItem(product, index));
  }
}

function uniqueBySku(products) {
  const seen = new Set();
  const output = [];
  for (const product of products) {
    const sku = normalizeSku(product.sku);
    if (!sku || seen.has(sku)) {
      continue;
    }
    seen.add(sku);
    output.push({ ...product, sku });
  }
  return output;
}

function describeTargetSkus(targetProducts) {
  if (!Array.isArray(targetProducts) || !targetProducts.length) {
    return "";
  }
  const names = targetProducts.slice(0, 3).map((product) => product.name);
  const suffix = targetProducts.length > 3 ? ` +${targetProducts.length - 3} more` : "";
  return `${names.join(", ")}${suffix}`;
}

function describeTargetCategories(targetProducts) {
  if (!Array.isArray(targetProducts) || targetProducts.length === 0) {
    return "";
  }
  const categories = [
    ...new Set(
      targetProducts
        .map((product) => normalizeMatchToken(product.category))
        .filter(Boolean)
    )
  ];
  return categories.join(", ");
}

function buildScreenGoalContext(screen) {
  const raw = `${screen.pageId || ""} ${screen.location || ""} ${screen.screenType || ""}`.toLowerCase();
  const tokens = new Set(tokenizeForMatch(raw));
  const pageToken = normalizeMatchToken(screen.pageId);
  const locationToken = normalizeMatchToken(screen.location);
  if (pageToken) {
    tokens.add(pageToken);
  }
  if (locationToken) {
    tokens.add(locationToken);
  }
  return { raw, tokens };
}

function buildProductGoalContext(product) {
  const category = normalizeMatchToken(product.category);
  const brand = readOptionalString(product.brand, 80).toLowerCase();
  const sku = normalizeSku(product.sku).toLowerCase();
  const nameTokens = tokenizeForMatch(product.name);
  const categoryTokens = tokenizeForMatch(category);
  const brandTokens = tokenizeForMatch(brand);
  const tagTokens = tokenizeForMatch((product.tags || []).join(" "));
  const skuTokens = tokenizeForMatch(sku);
  const tokens = new Set([...nameTokens, ...categoryTokens, ...brandTokens, ...tagTokens, ...skuTokens]);
  if (category) {
    tokens.add(category);
  }

  return {
    category,
    brand,
    sku,
    nameTokens,
    categoryTokens,
    brandTokens,
    tagTokens,
    tokens
  };
}

function scoreProductForScreenContext(screenContext, productContext) {
  let score = 0;
  if (
    productContext.category &&
    (screenContext.raw.includes(productContext.category) || screenContext.tokens.has(productContext.category))
  ) {
    score += 0.58;
  }
  if (productContext.brand && screenContext.raw.includes(productContext.brand)) {
    score += 0.12;
  }
  if (productContext.sku && screenContext.raw.includes(productContext.sku)) {
    score += 0.1;
  }

  let tokenMatches = 0;
  for (const token of productContext.tokens) {
    if (screenContext.tokens.has(token)) {
      tokenMatches += 1;
    }
  }
  score += Math.min(0.28, tokenMatches * 0.08);

  const hasStrongContextMatch = Boolean(
    (productContext.category &&
      (screenContext.raw.includes(productContext.category) || screenContext.tokens.has(productContext.category))) ||
      tokenMatches >= 2
  );

  return {
    score: Math.max(0, Math.min(1, Number(score.toFixed(2)))),
    tokenMatches,
    hasStrongContextMatch
  };
}

function computeProductRelevanceForScreen(screen, targetProducts) {
  if (!Array.isArray(targetProducts) || targetProducts.length === 0) {
    return 0.58;
  }

  const screenContext = buildScreenGoalContext(screen);
  let bestScore = 0;

  for (const product of targetProducts) {
    const productContext = buildProductGoalContext(product);
    const scored = scoreProductForScreenContext(screenContext, productContext);
    bestScore = Math.max(bestScore, scored.score);
  }

  return Number(bestScore.toFixed(2));
}

function getTemplateProductLimit(templateId) {
  switch (templateId) {
    case "carousel-banner":
    case "menu-loop":
      return 3;
    default:
      return 1;
  }
}

function pickGoalProductsForScreen(screen, targetProducts, templateId) {
  if (!Array.isArray(targetProducts) || targetProducts.length === 0) {
    return [];
  }

  const screenContext = buildScreenGoalContext(screen);
  const scored = targetProducts.map((product) => {
    const productContext = buildProductGoalContext(product);
    const scoring = scoreProductForScreenContext(screenContext, productContext);

    return { product, score: scoring.score, hasStrongContextMatch: scoring.hasStrongContextMatch };
  });

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.product.name.localeCompare(right.product.name);
  });

  const limit = getTemplateProductLimit(templateId);
  const relevant = scored
    .filter((entry) => entry.hasStrongContextMatch && entry.score >= GOAL_RELEVANCE_THRESHOLD)
    .map((entry) => entry.product);
  return uniqueBySku(relevant).slice(0, limit);
}

function inferTargetProductsFromPrompt(prompt, feed, scopedScreens = []) {
  const promptText = readOptionalString(prompt, 280).toLowerCase();
  const promptTokens = new Set(tokenizeForMatch(promptText, true));
  if (!promptText || promptTokens.size === 0 || !Array.isArray(feed) || feed.length === 0) {
    return { products: [], matchedTerms: [] };
  }

  const scopedTokens = new Set();
  for (const screen of scopedScreens) {
    const context = buildScreenGoalContext(screen);
    for (const token of context.tokens) {
      scopedTokens.add(token);
    }
  }

  const scored = feed.map((rawProduct, index) => {
    const product = normalizeProductFeedItem(rawProduct, index);
    const context = buildProductGoalContext(product);
    let score = 0;
    const matchedTerms = new Set();

    if (context.sku && promptText.includes(context.sku)) {
      score += 3;
      matchedTerms.add(context.sku);
    }
    if (context.category && promptTokens.has(context.category)) {
      score += 1.5;
      matchedTerms.add(context.category);
    }

    let tagMatches = 0;
    for (const token of context.tagTokens) {
      if (promptTokens.has(token)) {
        tagMatches += 1;
        matchedTerms.add(token);
      }
    }
    score += Math.min(1.9, tagMatches * 0.95);

    let nameMatches = 0;
    for (const token of context.nameTokens) {
      if (promptTokens.has(token)) {
        nameMatches += 1;
        matchedTerms.add(token);
      }
    }
    score += Math.min(1.35, nameMatches * 0.45);

    let brandMatches = 0;
    for (const token of context.brandTokens) {
      if (promptTokens.has(token)) {
        brandMatches += 1;
        matchedTerms.add(token);
      }
    }
    score += Math.min(1.4, brandMatches * 0.7);

    if (context.category && scopedTokens.has(context.category)) {
      score += 0.12;
    }

    const tokenMatches = tagMatches + nameMatches + brandMatches;
    return {
      product,
      score: Number(score.toFixed(2)),
      tokenMatches,
      matchedTerms: [...matchedTerms]
    };
  });

  scored.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.product.name.localeCompare(right.product.name);
  });

  const strongMatches = scored.filter((entry) => entry.score >= GOAL_PROMPT_MIN_SCORE);
  const fallbackMatches =
    strongMatches.length > 0
      ? strongMatches
      : scored.filter((entry) => entry.score >= GOAL_PROMPT_MIN_SCORE * 0.75 && entry.tokenMatches >= 2);
  const inferredProducts = uniqueBySku(fallbackMatches.map((entry) => entry.product)).slice(0, GOAL_INFERRED_PRODUCT_LIMIT);
  const inferredSkuSet = new Set(inferredProducts.map((product) => normalizeSku(product.sku)));
  const matchedTerms = [
    ...new Set(
      fallbackMatches
        .filter((entry) => inferredSkuSet.has(normalizeSku(entry.product.sku)))
        .flatMap((entry) => entry.matchedTerms)
    )
  ]
    .filter((token) => token && token.length > 2)
    .slice(0, 10);

  return { products: inferredProducts, matchedTerms };
}

function screenContainsAnyTargetSku(screen, targetSkuIds) {
  if (!Array.isArray(targetSkuIds) || targetSkuIds.length === 0) {
    return false;
  }
  const targetSkuSet = new Set(targetSkuIds.map((sku) => normalizeSku(sku)));
  for (const lineItem of Array.isArray(screen.lineItems) ? screen.lineItems : []) {
    for (const product of Array.isArray(lineItem.products) ? lineItem.products : []) {
      const sku = normalizeSku(product.ProductId || product.productId || product.sku);
      if (sku && targetSkuSet.has(sku)) {
        return true;
      }
    }
  }
  return false;
}

function buildStorageProductFromFeed(feedProduct, screen, templateId, objectiveId) {
  const objective = GOAL_OBJECTIVE_MAP.get(objectiveId) || GOAL_OBJECTIVE_MAP.get("awareness");
  const goalProduct = normalizeProductFeedItem(feedProduct, 0);
  const product = buildStorageProduct(
    {
      ProductId: goalProduct.sku,
      ProductName: goalProduct.name,
      ProductPage: goalProduct.productPage,
      Image: goalProduct.image,
      Price: goalProduct.price,
      ComparePrice: goalProduct.comparePrice,
      Rating: goalProduct.rating,
      ClientAdvertiserId: goalProduct.advertiserId
    },
    screen.screenId,
    screen.location,
    templateId
  );

  product.RenderingAttributes = applyGoalCreativeAttributes(product, objectiveId, goalProduct);
  product.RenderingAttributes = normalizeRenderingAttributes({
    ...parseJsonObject(product.RenderingAttributes),
    targetSku: goalProduct.sku,
    targetCategory: goalProduct.category,
    targetBrand: goalProduct.brand,
    promotion: objective.creativeDefaults.promotion
  });

  return product;
}

function parseJsonObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value;
  }
  const raw = toTrimmedString(value);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function buildGoalLineItemForScreen(screen, templateId, objectiveId, goalProductsForScreen, fallbackFeedProduct = null) {
  const nextTemplate = getTemplatePreset(templateId);
  const now = new Date();
  const activeFrom = new Date(now.valueOf() - 60 * 1000).toISOString();
  const activeTo = new Date(now.valueOf() + 365 * 24 * 60 * 60 * 1000).toISOString();
  let products = [];
  if (Array.isArray(goalProductsForScreen) && goalProductsForScreen.length > 0) {
    products = goalProductsForScreen.map((product) =>
      buildStorageProductFromFeed(product, screen, nextTemplate.id, objectiveId)
    );
  } else if (fallbackFeedProduct) {
    products = [buildStorageProductFromFeed(fallbackFeedProduct, screen, nextTemplate.id, objectiveId)];
  } else {
    const fallbackProduct = buildStorageProduct({}, screen.screenId, screen.location, nextTemplate.id);
    fallbackProduct.RenderingAttributes = applyGoalCreativeAttributes(fallbackProduct, objectiveId);
    products = [fallbackProduct];
  }

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    lineItemId: `${screen.screenId}-LI-GOAL-${suffix}`.slice(0, 120),
    name: `${titleCase(screen.location)} Goal Agent Creative`,
    activeFrom,
    activeTo,
    templateId: nextTemplate.id,
    products
  };
}

function summarizeLiveProduct(product, templateId, location = "") {
  const template = getTemplatePreset(templateId);
  const sku =
    readOptionalString(product?.ProductId, 80) ||
    readOptionalString(product?.productId, 80) ||
    "SKU-UNKNOWN";
  const name =
    readOptionalString(product?.ProductName, 120) ||
    readOptionalString(product?.productName, 120) ||
    "In-Store Featured Product";
  const renderingAttributes = parseJsonObject(product?.RenderingAttributes ?? product?.renderingAttributes);
  const category =
    readOptionalString(product?.category, 80) || readOptionalString(renderingAttributes.targetCategory, 80);
  const image = resolveProductImagePath(
    readOptionalString(product?.Image, 500) || readOptionalString(product?.image, 500),
    {
      sku,
      category,
      location,
      templateId: template.id
    }
  );

  return {
    sku,
    name,
    image,
    price: readOptionalString(product?.Price, 30) || readOptionalString(product?.price, 30) || "",
    comparePrice:
      readOptionalString(product?.ComparePrice, 30) || readOptionalString(product?.comparePrice, 30) || "",
    rating: readOptionalString(product?.Rating, 10) || readOptionalString(product?.rating, 10) || ""
  };
}

function buildLiveScreenSnapshot(screen) {
  const now = new Date();
  const lineItems = Array.isArray(screen.lineItems) ? screen.lineItems : [];
  const activeLineItems = lineItems.filter((lineItem) => isLineItemActive(lineItem, now));
  const selectedLineItem = activeLineItems[0] || lineItems[0] || null;
  const templateId =
    readOptionalString(selectedLineItem?.templateId, 120) ||
    readOptionalString(screen.templateId, 120) ||
    "fullscreen-banner";
  const template = getTemplatePreset(templateId);
  const sourceProducts = Array.isArray(selectedLineItem?.products) ? selectedLineItem.products : [];
  const products = sourceProducts
    .slice(0, 3)
    .map((product) => summarizeLiveProduct(product, template.id, screen.location));
  const screenUrl = `/screen.html?screenId=${encodeURIComponent(screen.screenId)}`;

  return {
    screenId: screen.screenId,
    storeId: screen.storeId,
    pageId: screen.pageId,
    location: screen.location,
    screenType: screen.screenType,
    screenSize: screen.screenSize,
    templateId: template.id,
    templateName: template.name,
    format: readOptionalString(screen.format, 120) || buildDefaultFormat(template.id, screen.screenSize),
    refreshInterval: readRefreshInterval(screen.refreshInterval),
    lineItemCount: lineItems.length,
    activeLineItemId: selectedLineItem?.lineItemId || "",
    activeLineItemName: selectedLineItem?.name || "",
    productCount: sourceProducts.length,
    products,
    screenUrl,
    updatedAt: screen.updatedAt || ""
  };
}

function buildLiveScreensSnapshot(db, screenIds) {
  const uniqueIds = [...new Set((screenIds || []).map((entry) => readOptionalString(entry, 80)).filter(Boolean))];
  const screens = uniqueIds
    .map((screenId) => (db.screens || []).find((entry) => entry.screenId === screenId))
    .filter(Boolean)
    .sort((left, right) => left.screenId.localeCompare(right.screenId));
  return screens.map((screen) => buildLiveScreenSnapshot(screen));
}

function ensureAgentRunsArray(db) {
  if (!Array.isArray(db.agentRuns)) {
    db.agentRuns = [];
  }
  return db.agentRuns;
}

function generatePlanId() {
  const now = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 7);
  return `goal-${now}-${random}`;
}

function readGoalRequest(input) {
  const raw = input && typeof input === "object" ? input : {};
  const objective = (readOptionalString(raw.objective, 40) || "awareness").toLowerCase();
  if (!GOAL_OBJECTIVE_MAP.has(objective)) {
    throw new HttpError(
      400,
      `objective must be one of: ${GOAL_OBJECTIVES.map((entry) => entry.id).join(", ")}`
    );
  }

  const requestedAggressiveness = readOptionalString(raw.aggressiveness, 20) || "Balanced";
  const aggressiveness =
    GOAL_AGGRESSIVENESS_OPTIONS.find(
      (option) => option.toLowerCase() === requestedAggressiveness.toLowerCase()
    ) || "";
  if (!aggressiveness) {
    throw new HttpError(
      400,
      `aggressiveness must be one of: ${GOAL_AGGRESSIVENESS_OPTIONS.join(", ")}`
    );
  }

  const targetSkuIds = [
    ...new Set(
      readStringArray(raw.targetSkuIds, GOAL_TARGET_SKU_LIMIT, 80)
        .map((entry) => normalizeSku(entry))
        .filter(Boolean)
    )
  ];

  return {
    objective,
    aggressiveness,
    prompt: readOptionalString(raw.prompt, 280),
    storeId: readOptionalString(raw.storeId, 80),
    pageId: readOptionalString(raw.pageId, 40),
    targetSkuIds
  };
}

function resolveGoalTargetProducts(goal, feed, scopedScreens) {
  const normalizedFeed = Array.isArray(feed)
    ? feed.map((product, index) => normalizeProductFeedItem(product, index))
    : [];
  const requestedSkuIds = [
    ...new Set(
      readStringArray(goal.targetSkuIds, GOAL_TARGET_SKU_LIMIT, 80)
        .map((entry) => normalizeSku(entry))
        .filter(Boolean)
    )
  ];

  if (requestedSkuIds.length > 0) {
    const selectedProducts = normalizedFeed.filter((product) =>
      requestedSkuIds.includes(normalizeSku(product.sku))
    );
    const foundSkuSet = new Set(selectedProducts.map((product) => normalizeSku(product.sku)));
    const missingSkus = requestedSkuIds.filter((sku) => !foundSkuSet.has(normalizeSku(sku)));
    if (missingSkus.length > 0) {
      throw new HttpError(400, `Unknown targetSkuIds: ${missingSkus.join(", ")}`);
    }
    return {
      targetSkuIds: selectedProducts.map((product) => normalizeSku(product.sku)),
      targetProducts: selectedProducts,
      targetSource: "manual",
      inferredTerms: []
    };
  }

  const inferred = inferTargetProductsFromPrompt(goal.prompt, normalizedFeed, scopedScreens);
  if (inferred.products.length > 0) {
    return {
      targetSkuIds: inferred.products.map((product) => normalizeSku(product.sku)),
      targetProducts: inferred.products,
      targetSource: "prompt",
      inferredTerms: inferred.matchedTerms
    };
  }

  return {
    targetSkuIds: [],
    targetProducts: [],
    targetSource: "none",
    inferredTerms: []
  };
}

function computeGoalTemplateId(screen, objectiveId) {
  const screenType = toTrimmedString(screen.screenType).toLowerCase();
  const pageId = toTrimmedString(screen.pageId).toLowerCase();
  const location = toTrimmedString(screen.location).toLowerCase();

  if (screenType === "kiosk") {
    return "kiosk-interactive";
  }
  if (screenType === "digital menu board") {
    return "menu-loop";
  }
  if (screenType === "shelf edge" || screenType === "endcap") {
    return "shelf-spotlight";
  }

  const isVertical = screenType.includes("vertical");
  const isCheckoutContext = pageId.includes("checkout") || location.includes("checkout");
  const isAisleContext = pageId.includes("aisle") || location.includes("aisle");

  switch (objectiveId) {
    case "checkout-attach":
      if (isCheckoutContext) {
        return isVertical ? "fullscreen-hero" : "carousel-banner";
      }
      return isVertical ? "fullscreen-hero" : "fullscreen-banner";
    case "clearance":
      if (isAisleContext) {
        return "shelf-spotlight";
      }
      return isVertical ? "fullscreen-hero" : "carousel-banner";
    case "premium":
      return isVertical ? "fullscreen-hero" : "fullscreen-banner";
    case "awareness":
    default:
      return isVertical ? "fullscreen-hero" : "fullscreen-banner";
  }
}

function computeGoalRefreshInterval(templateId, aggressiveness) {
  const template = getTemplatePreset(templateId);
  const base = readRefreshInterval(template.defaultRefreshInterval);
  let multiplier = 1;

  switch (aggressiveness) {
    case "Conservative":
      multiplier = 1.2;
      break;
    case "Aggressive":
      multiplier = 0.78;
      break;
    case "Balanced":
    default:
      multiplier = 1;
      break;
  }

  const adjusted = Math.round((base * multiplier) / 1000) * 1000;
  return readRefreshInterval(adjusted);
}

function computeGoalConfidence(screen, objectiveId, productRelevance = 0.58) {
  const screenType = toTrimmedString(screen.screenType).toLowerCase();
  const pageId = toTrimmedString(screen.pageId).toLowerCase();
  const location = toTrimmedString(screen.location).toLowerCase();

  let score = 0.52 + productRelevance * 0.34;
  if (screenType === "kiosk" || screenType === "digital menu board") {
    score += 0.08;
  }
  if (objectiveId === "checkout-attach" && (pageId.includes("checkout") || location.includes("checkout"))) {
    score += 0.14;
  }
  if (objectiveId === "clearance" && (pageId.includes("aisle") || location.includes("aisle"))) {
    score += 0.12;
  }
  if (objectiveId === "premium" && screenType.includes("vertical")) {
    score += 0.1;
  }

  return Math.max(0.52, Math.min(0.96, Number(score.toFixed(2))));
}

function buildGoalReason(screen, objective, targetProducts = [], productRelevance = 0.58) {
  const objectiveDetails = GOAL_OBJECTIVE_MAP.get(objective);
  const location = titleCase(screen.location);
  const screenType = screen.screenType || "Screen";
  const skuFocus = describeTargetSkus(targetProducts);
  const relevanceLabel =
    productRelevance >= 0.6 ? "high context relevance" : productRelevance >= 0.35 ? "medium context relevance" : "low context relevance";

  switch (objective) {
    case "checkout-attach":
      return `${screenType} at ${location}: prioritize basket-building offers near conversion zones (${relevanceLabel}).${
        skuFocus ? ` SKU focus: ${skuFocus}.` : ""
      }`;
    case "clearance":
      return `${screenType} at ${location}: increase rotation pressure to move excess stock (${relevanceLabel}).${
        skuFocus ? ` SKU focus: ${skuFocus}.` : ""
      }`;
    case "premium":
      return `${screenType} at ${location}: emphasize hero-led premium storytelling (${relevanceLabel}).${
        skuFocus ? ` SKU focus: ${skuFocus}.` : ""
      }`;
    case "awareness":
    default:
      return `${screenType} at ${location}: maximize broad visibility with high-reach creative (${relevanceLabel}). ${objectiveDetails.description}${
        skuFocus ? ` SKU focus: ${skuFocus}.` : ""
      }`;
  }
}

function buildGoalPlan(goal, screens) {
  const objectiveDetails = GOAL_OBJECTIVE_MAP.get(goal.objective) || GOAL_OBJECTIVE_MAP.get("awareness");
  const targetProducts = Array.isArray(goal.targetProducts) ? goal.targetProducts : [];
  const targetSkuIds = targetProducts.map((product) => normalizeSku(product.sku)).filter(Boolean);
  const targetCategories = describeTargetCategories(targetProducts);
  const relevanceByScreen = new Map(
    screens.map((screen) => [screen.screenId, computeProductRelevanceForScreen(screen, targetProducts)])
  );
  const plannedScreens = [];
  const proposedChanges = [];
  const excludedScreens = [];

  for (const screen of screens) {
    const productRelevance = relevanceByScreen.get(screen.screenId) || 0.58;
    const currentTemplateId = readOptionalString(screen.templateId, 80) || "fullscreen-banner";
    const currentRefreshInterval = readRefreshInterval(screen.refreshInterval);
    const recommendedTemplateId = computeGoalTemplateId(screen, goal.objective);
    const recommendedRefreshInterval = computeGoalRefreshInterval(recommendedTemplateId, goal.aggressiveness);

    if (targetProducts.length > 0 && productRelevance < GOAL_RELEVANCE_THRESHOLD) {
      excludedScreens.push({
        screenId: screen.screenId,
        storeId: screen.storeId,
        pageId: screen.pageId,
        location: screen.location,
        productRelevance,
        reason: `Skipped by context guardrail. Screen context does not match target categories (${targetCategories || "selected SKUs"}).`
      });
      continue;
    }

    const goalProductsForScreen =
      targetProducts.length > 0
        ? pickGoalProductsForScreen(screen, targetProducts, recommendedTemplateId)
        : [];
    if (targetProducts.length > 0 && goalProductsForScreen.length === 0) {
      excludedScreens.push({
        screenId: screen.screenId,
        storeId: screen.storeId,
        pageId: screen.pageId,
        location: screen.location,
        productRelevance,
        reason: "Skipped by context guardrail. No compatible target products were found for this screen."
      });
      continue;
    }

    plannedScreens.push(screen);
    const templateChanged = currentTemplateId !== recommendedTemplateId;
    const refreshChanged = currentRefreshInterval !== recommendedRefreshInterval;
    const targetingChanged =
      targetSkuIds.length > 0 && !screenContainsAnyTargetSku(screen, targetSkuIds);

    if (!templateChanged && !refreshChanged && !targetingChanged) {
      continue;
    }

    proposedChanges.push({
      screenId: screen.screenId,
      storeId: screen.storeId,
      pageId: screen.pageId,
      location: screen.location,
      objective: goal.objective,
      confidence: computeGoalConfidence(screen, goal.objective, productRelevance),
      reason: buildGoalReason(screen, goal.objective, targetProducts, productRelevance),
      productRelevance,
      targetingChanged,
      recommendedTargetSkus: goalProductsForScreen.map((product) => normalizeSku(product.sku)),
      currentTemplateId,
      recommendedTemplateId,
      currentRefreshInterval,
      recommendedRefreshInterval
    });
  }

  const templateSwitches = proposedChanges.filter(
    (change) => change.currentTemplateId !== change.recommendedTemplateId
  ).length;
  const refreshUpdates = proposedChanges.filter(
    (change) => change.currentRefreshInterval !== change.recommendedRefreshInterval
  ).length;
  const skuTargetUpdates = proposedChanges.filter((change) => Boolean(change.targetingChanged)).length;

  const summary =
    proposedChanges.length > 0
      ? `Goal Agent found ${proposedChanges.length} change(s) for ${objectiveDetails.label}.`
      : `Goal Agent found no required changes for ${objectiveDetails.label}.`;

  const targetSourceLabel =
    goal.targetSource === "manual"
      ? "Manual SKU selection"
      : goal.targetSource === "prompt"
        ? "Prompt-inferred SKU selection"
        : "Objective-only optimization";
  const targetSummary =
    targetProducts.length > 0
      ? `${targetSourceLabel} on ${targetProducts.length} SKU(s): ${describeTargetSkus(targetProducts)}.`
      : goal.prompt
        ? "Prompt did not map confidently to product feed SKUs. Running objective-only optimization."
        : "No SKU targeting applied.";
  const inferredTermsSummary =
    goal.targetSource === "prompt" && Array.isArray(goal.inferredTerms) && goal.inferredTerms.length > 0
      ? `Prompt terms: ${goal.inferredTerms.slice(0, 6).join(", ")}.`
      : "";
  const exclusionSummary =
    excludedScreens.length > 0
      ? `${excludedScreens.length} screen(s) were skipped by context guardrails.`
      : targetProducts.length > 0
        ? "All scoped screens passed context guardrails."
        : "";

  return {
    summary: `${summary} ${targetSummary} ${inferredTermsSummary} ${exclusionSummary}`.replace(/\s+/g, " ").trim(),
    totals: {
      scopedScreens: screens.length,
      plannedScreens: plannedScreens.length,
      compatibleScreens: plannedScreens.length,
      excludedScreens: excludedScreens.length,
      targetSkus: targetProducts.length,
      proposedChanges: proposedChanges.length,
      templateSwitches,
      refreshUpdates,
      skuTargetUpdates
    },
    proposedChanges,
    excludedScreens
  };
}

function applyGoalCreativeAttributes(product, objectiveId, targetProduct = null) {
  const objective = GOAL_OBJECTIVE_MAP.get(objectiveId) || GOAL_OBJECTIVE_MAP.get("awareness");
  const current = parseJsonObject(product.RenderingAttributes);
  const dynamicSubcopy =
    targetProduct && targetProduct.brand
      ? `${objective.creativeDefaults.subcopy} Focus brand: ${targetProduct.brand}.`
      : objective.creativeDefaults.subcopy;
  return normalizeRenderingAttributes({
    ...current,
    promotion: objective.creativeDefaults.promotion,
    badge: objective.creativeDefaults.badge,
    cta: objective.creativeDefaults.cta,
    subcopy: dynamicSubcopy,
    legal: objective.creativeDefaults.legal,
    goalObjective: objective.id,
    goalTargetSku: targetProduct ? normalizeSku(targetProduct.sku) : current.goalTargetSku || ""
  });
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
  const renderingAttributes = parseJsonObject(product.RenderingAttributes ?? product.renderingAttributes);
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
  const image = resolveProductImagePath(readOptionalString(product.Image, 500) || readOptionalString(product.image, 500), {
    sku: productId,
    category: readOptionalString(product.category, 80) || readOptionalString(renderingAttributes.targetCategory, 80),
    location,
    templateId: template.id
  });

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
          badge: template.defaultBadge,
          cta: template.defaultCta,
          subcopy: template.defaultSubcopy,
          legal: template.defaultLegal,
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

function isInStoreSignageCta(value) {
  const cta = readOptionalString(value, 80);
  if (!cta) {
    return false;
  }
  if (TOUCH_FORWARD_CTA_PATTERN.test(cta)) {
    return false;
  }
  return IN_STORE_CTA_CUE_PATTERN.test(cta);
}

function sanitizeInStoreMessagingAttributes(rawAttributes, templateId) {
  const template = getTemplatePreset(templateId);
  const current = parseJsonObject(rawAttributes);
  const next = {
    ...current,
    templateId: readOptionalString(current.templateId, 80) || template.id
  };
  const cta = readOptionalString(current.cta, 80);
  const subcopy = readOptionalString(current.subcopy, 240);
  const promotion = readOptionalString(current.promotion, 180);
  const badge = readOptionalString(current.badge, 120);

  if (!isInStoreSignageCta(cta)) {
    next.cta = template.defaultCta;
  }
  if (!subcopy || TOUCH_FORWARD_COPY_PATTERN.test(subcopy)) {
    next.subcopy = template.defaultSubcopy;
  }
  if (!promotion || TOUCH_FORWARD_COPY_PATTERN.test(promotion)) {
    next.promotion = template.defaultPromotion;
  }
  if (!badge || /interactive|touch/i.test(badge)) {
    next.badge = template.defaultBadge;
  }
  if (!readOptionalString(current.legal, 280)) {
    next.legal = template.defaultLegal;
  }

  return normalizeRenderingAttributes(next);
}

function normalizeProductForDelivery(rawProduct, { screenId, lineItemId, index, templateId, location }) {
  const product = rawProduct && typeof rawProduct === "object" ? rawProduct : {};
  const template = getTemplatePreset(templateId);
  const adid =
    readOptionalString(product.adid, 120) || `${lineItemId}-${Date.now()}-${Math.max(index + 1, 1)}`;
  const productId =
    readOptionalString(product.ProductId, 80) ||
    readOptionalString(product.productId, 80) ||
    `${screenId}-SKU-${index + 1}`;
  const renderingAttributes = parseJsonObject(product.RenderingAttributes ?? product.renderingAttributes);
  const image = resolveProductImagePath(readOptionalString(product.Image, 500) || readOptionalString(product.image, 500), {
    sku: productId,
    category: readOptionalString(product.category, 80) || readOptionalString(renderingAttributes.targetCategory, 80),
    location,
    templateId: template.id
  });

  return {
    ProductId: productId,
    ProductName:
      readOptionalString(product.ProductName, 120) ||
      readOptionalString(product.productName, 120) ||
      "In-Store Featured Product",
    ProductPage:
      readOptionalString(product.ProductPage, 500) ||
      readOptionalString(product.productPage, 500) ||
      "https://store.example.com/products/featured",
    Image: image,
    Price: readOptionalString(product.Price, 30) || readOptionalString(product.price, 30) || "0.00",
    ComparePrice: readOptionalString(product.ComparePrice, 30) || readOptionalString(product.comparePrice, 30),
    Rating: readOptionalString(product.Rating, 10) || readOptionalString(product.rating, 10),
    adid,
    ClientAdvertiserId:
      readOptionalString(product.ClientAdvertiserId, 120) ||
      readOptionalString(product.clientAdvertiserId, 120) ||
      "demo-advertiser",
    RenderingAttributes: sanitizeInStoreMessagingAttributes(
      product.RenderingAttributes ?? product.renderingAttributes ?? { inStore: true },
      templateId
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
    templates: TEMPLATE_PRESETS,
    goalObjectives: GOAL_OBJECTIVES.map(({ id, label, description }) => ({ id, label, description })),
    goalAggressivenessOptions: GOAL_AGGRESSIVENESS_OPTIONS,
    goalSupportsSkuTargeting: true
  });
});

app.get("/api/products", async (req, res) => {
  try {
    const feed = await readProductFeed();
    const query = readOptionalString(req.query.q, 120).toLowerCase();
    const category = readOptionalString(req.query.category, 80).toLowerCase();
    const parsedLimit = Number(req.query.limit);
    const limit = Number.isInteger(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 300)) : 120;

    let products = [...feed];
    if (category) {
      products = products.filter((product) => product.category === category);
    }
    if (query) {
      products = products.filter((product) => {
        const searchText = [
          product.sku,
          product.name,
          product.category,
          product.brand,
          ...(Array.isArray(product.tags) ? product.tags : [])
        ]
          .join(" ")
          .toLowerCase();
        return searchText.includes(query);
      });
    }

    products.sort((left, right) => left.name.localeCompare(right.name));
    const categories = [...new Set(feed.map((product) => product.category))].sort((a, b) => a.localeCompare(b));
    res.json({
      products: products.slice(0, limit),
      total: products.length,
      categories
    });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
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

app.get("/api/agent/goals/runs", async (_req, res) => {
  const db = await readDb();
  const runs = Array.isArray(db.agentRuns) ? db.agentRuns : [];
  res.json({ runs: runs.slice(0, 20) });
});

app.get("/api/agent/goals/live", async (req, res) => {
  try {
    const planId = readRequiredString(req.query.planId, "planId", 120);
    const db = await readDb();
    const runs = Array.isArray(db.agentRuns) ? db.agentRuns : [];
    const run = runs.find((entry) => entry.planId === planId);
    if (!run) {
      throw new HttpError(404, `Plan ${planId} was not found.`);
    }

    const appliedScreenIds = readStringArray(run.appliedScreenIds, 500, 80).map((screenId) =>
      readOptionalString(screenId, 80)
    );
    const proposedChanges = Array.isArray(run.proposedChanges) ? run.proposedChanges : [];
    const fallbackScreenIds = proposedChanges.map((change) => readOptionalString(change.screenId, 80)).filter(Boolean);
    const screenIds = appliedScreenIds.length > 0 ? appliedScreenIds : fallbackScreenIds;
    const liveScreens = buildLiveScreensSnapshot(db, screenIds);

    res.json({
      planId,
      status: run.status || "planned",
      appliedAt: run.appliedAt || "",
      liveCount: liveScreens.length,
      liveScreens
    });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.post("/api/agent/goals/plan", async (req, res) => {
  try {
    const goal = readGoalRequest(req.body);
    const feed = await readProductFeed();

    const run = await mutateDb(async (db) => {
      const scopedScreens = (db.screens || []).filter((screen) => {
        if (goal.storeId && screen.storeId !== goal.storeId) {
          return false;
        }
        if (goal.pageId && screen.pageId !== goal.pageId) {
          return false;
        }
        return true;
      });

      if (!scopedScreens.length) {
        throw new HttpError(404, "No screens match this goal scope.");
      }

      const targetResolution = resolveGoalTargetProducts(goal, feed, scopedScreens);
      const resolvedGoal = {
        ...goal,
        ...targetResolution
      };
      const plan = buildGoalPlan(resolvedGoal, scopedScreens);
      const now = new Date().toISOString();
      const runRecord = {
        planId: generatePlanId(),
        status: "planned",
        createdAt: now,
        updatedAt: now,
        goal: resolvedGoal,
        summary: plan.summary,
        totals: plan.totals,
        proposedChanges: plan.proposedChanges,
        excludedScreens: plan.excludedScreens
      };

      const runs = ensureAgentRunsArray(db);
      runs.unshift(runRecord);
      db.agentRuns = runs.slice(0, AGENT_RUN_HISTORY_LIMIT);
      return runRecord;
    });

    res.status(201).json({ run });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.post("/api/agent/goals/apply", async (req, res) => {
  try {
    const planId = readRequiredString(req.body.planId, "planId", 120);
    const feed = await readProductFeed();

    const result = await mutateDb(async (db) => {
      const runs = ensureAgentRunsArray(db);
      const run = runs.find((entry) => entry.planId === planId);
      if (!run) {
        throw new HttpError(404, `Plan ${planId} was not found.`);
      }
      if (run.status === "applied") {
        const appliedScreenIds = readStringArray(run.appliedScreenIds, 500, 80).map((screenId) =>
          readOptionalString(screenId, 80)
        );
        const proposedChanges = Array.isArray(run.proposedChanges) ? run.proposedChanges : [];
        const fallbackScreenIds = proposedChanges
          .map((change) => readOptionalString(change.screenId, 80))
          .filter(Boolean);
        const screenIds = appliedScreenIds.length > 0 ? appliedScreenIds : fallbackScreenIds;
        const liveScreens = buildLiveScreensSnapshot(db, screenIds);
        run.appliedScreenIds = screenIds;
        run.liveScreens = liveScreens;
        run.liveCount = liveScreens.length;
        return {
          run,
          appliedCount: Number(run.appliedCount || 0),
          skippedCount: Number(run.skippedCount || 0),
          creativeGeneratedCount: Number(run.creativeGeneratedCount || 0),
          liveCount: liveScreens.length,
          liveScreens
        };
      }

      const changes = Array.isArray(run.proposedChanges) ? run.proposedChanges : [];
      const now = new Date().toISOString();
      const objectiveId = readOptionalString(run.goal?.objective, 40) || "awareness";
      const runTargetSkuIds = readStringArray(run.goal?.targetSkuIds, GOAL_TARGET_SKU_LIMIT, 80).map((sku) =>
        normalizeSku(sku)
      );
      const runTargetProductsRaw = Array.isArray(run.goal?.targetProducts) ? run.goal.targetProducts : [];
      const runTargetProducts =
        runTargetProductsRaw.length > 0
          ? runTargetProductsRaw.map((product, index) => normalizeProductFeedItem(product, index))
          : runTargetSkuIds.length > 0
            ? feed.filter((product) => runTargetSkuIds.includes(normalizeSku(product.sku)))
            : [];
      const hasGoalTargeting = runTargetProducts.length > 0;
      let appliedCount = 0;
      let skippedCount = 0;
      let creativeGeneratedCount = 0;
      const appliedScreenIds = [];

      for (const change of changes) {
        const screen = (db.screens || []).find((entry) => entry.screenId === change.screenId);
        if (!screen) {
          skippedCount += 1;
          continue;
        }

        const nextTemplateId = readOptionalString(change.recommendedTemplateId, 80) || screen.templateId;
        const nextTemplate = getTemplatePreset(nextTemplateId);
        const nextRefreshInterval = readRefreshInterval(change.recommendedRefreshInterval);
        const goalProductsForScreen = pickGoalProductsForScreen(screen, runTargetProducts, nextTemplate.id);
        if (hasGoalTargeting && goalProductsForScreen.length === 0) {
          skippedCount += 1;
          continue;
        }

        screen.templateId = nextTemplate.id;
        screen.refreshInterval = nextRefreshInterval;
        screen.format = buildDefaultFormat(nextTemplate.id, screen.screenSize);
        const existingLineItems = Array.isArray(screen.lineItems) ? screen.lineItems : [];
        if (existingLineItems.length === 0) {
          const fallbackFeedProduct = runTargetProducts[0] || null;
          screen.lineItems = [
            buildGoalLineItemForScreen(
              screen,
              nextTemplate.id,
              objectiveId,
              goalProductsForScreen,
              fallbackFeedProduct
            )
          ];
          creativeGeneratedCount += 1;
        } else {
          screen.lineItems = existingLineItems.map((lineItem) => {
            const products = Array.isArray(lineItem.products) ? lineItem.products : [];
            const mappedGoalProducts =
              goalProductsForScreen.length > 0
                ? goalProductsForScreen.map((product) =>
                    buildStorageProductFromFeed(product, screen, nextTemplate.id, objectiveId)
                  )
                : [];
            if (mappedGoalProducts.length > 0) {
              return {
                ...lineItem,
                templateId: nextTemplate.id,
                products: mappedGoalProducts
              };
            }
            if (products.length > 0) {
              return {
                ...lineItem,
                templateId: nextTemplate.id,
                products: products.map((product) => {
                  const normalizedProduct = buildStorageProduct(
                    product,
                    screen.screenId,
                    screen.location,
                    nextTemplate.id
                  );
                  normalizedProduct.RenderingAttributes = applyGoalCreativeAttributes(
                    normalizedProduct,
                    objectiveId
                  );
                  return normalizedProduct;
                })
              };
            }

            const fallbackFeedProduct = runTargetProducts[0] || null;
            const generated = buildGoalLineItemForScreen(
              screen,
              nextTemplate.id,
              objectiveId,
              goalProductsForScreen,
              fallbackFeedProduct
            );
            creativeGeneratedCount += 1;
            return {
              ...lineItem,
              templateId: nextTemplate.id,
              products: generated.products
            };
          });
        }
        screen.updatedAt = now;
        appliedScreenIds.push(screen.screenId);
        appliedCount += 1;
      }

      const uniqueAppliedScreenIds = [...new Set(appliedScreenIds)];
      const liveScreens = buildLiveScreensSnapshot(db, uniqueAppliedScreenIds);
      run.status = "applied";
      run.appliedAt = now;
      run.updatedAt = now;
      run.appliedCount = appliedCount;
      run.skippedCount = skippedCount;
      run.creativeGeneratedCount = creativeGeneratedCount;
      run.appliedScreenIds = uniqueAppliedScreenIds;
      run.liveScreens = liveScreens;
      run.liveCount = liveScreens.length;
      run.summary = `${run.summary} Applied ${appliedCount} screen update(s).${
        skippedCount > 0 ? ` Skipped ${skippedCount} screen(s) due to context guardrails.` : ""
      }${creativeGeneratedCount > 0 ? ` Auto-created creative on ${creativeGeneratedCount} screen(s).` : ""}`;

      return {
        run,
        appliedCount,
        skippedCount,
        creativeGeneratedCount,
        liveCount: liveScreens.length,
        liveScreens
      };
    });

    res.json(result);
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

    const selectedTemplateId =
      readOptionalString(selectedLineItem.templateId, 120) || screen.templateId || "fullscreen-banner";
    const selectedTemplate = getTemplatePreset(selectedTemplateId);
    const minProductCount = getTemplateProductLimit(selectedTemplate.id);
    const sourceProducts = Array.isArray(selectedLineItem.products) ? [...selectedLineItem.products] : [];
    if (sourceProducts.length < minProductCount) {
      const feed = await readProductFeed();
      const existingSkus = new Set(
        sourceProducts
          .map((product) =>
            normalizeSku(
              readOptionalString(product?.ProductId, 80) ||
                readOptionalString(product?.productId, 80) ||
                readOptionalString(product?.sku, 80)
            )
          )
          .filter(Boolean)
      );
      const screenCategory = normalizeMatchToken(screen.location) || normalizeMatchToken(screen.pageId);
      const categoryFeed =
        screenCategory.length > 0
          ? feed.filter((product) => normalizeMatchToken(product.category) === screenCategory)
          : [];
      const preferredFeed = categoryFeed.length > 0 ? categoryFeed : feed;

      for (const feedProduct of preferredFeed) {
        const sku = normalizeSku(feedProduct.sku);
        if (!sku || existingSkus.has(sku)) {
          continue;
        }
        sourceProducts.push(buildStorageProductFromFeed(feedProduct, screen, selectedTemplate.id, "awareness"));
        existingSkus.add(sku);
        if (sourceProducts.length >= minProductCount) {
          break;
        }
      }
    }

    const products = sourceProducts.map((product, index) =>
      normalizeProductForDelivery(product, {
        screenId,
        lineItemId: selectedLineItem.lineItemId,
        index,
        templateId: selectedTemplate.id,
        location: screen.location
      })
    );

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
