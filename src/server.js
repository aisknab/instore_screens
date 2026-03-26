import express from "express";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mutateDb, readDb, readSeedDb } from "./dataStore.js";
import {
  DEMO_ANCHOR_STORE,
  DEMO_STORE_IDS,
  DEMO_STORE_PROFILES,
  LEGACY_DEMO_STORE_IDS
} from "./demoStoreCatalog.js";

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
      promotion: "Seen across the store today",
      badge: "Store Feature",
      cta: "See it in this zone",
      subcopy: "In store today.",
      legal: "Pricing and availability vary by location."
    }
  },
  {
    id: "checkout-attach",
    label: "Increase Checkout Attach Rate",
    description: "Promote relevant add-ons and bundles close to checkout or decision points.",
    creativeDefaults: {
      promotion: "Easy add-on before checkout",
      badge: "Queue-Side Pick",
      cta: "Pick it up before you pay",
      subcopy: "Easy add-on before you pay.",
      legal: "Offer and assortment vary by checkout location."
    }
  },
  {
    id: "clearance",
    label: "Clear Overstock Inventory",
    description: "Prioritize conversion-focused templates for moving excess stock quickly.",
    creativeDefaults: {
      promotion: "Marked down in this store",
      badge: "Final Units",
      cta: "Find the clearance bay",
      subcopy: "Limited stock at this price.",
      legal: "Clearance pricing and stock are store-specific."
    }
  },
  {
    id: "premium",
    label: "Promote Premium Range",
    description: "Elevate hero-led creative for high-value and high-margin products.",
    creativeDefaults: {
      promotion: "Premium range feature",
      badge: "Signature Display",
      cta: "See the premium wall",
      subcopy: "See it on display today.",
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
const SCREEN_TYPE_DEFAULT_CPMS = {
  "Vertical Screen": 22,
  "Horizontal Screen": 18,
  "Shelf Edge": 15,
  Endcap: 18,
  Kiosk: 24,
  "Digital Menu Board": 20
};
const SCREEN_TYPE_IMPRESSION_FACTORS = {
  "Vertical Screen": 0.34,
  "Horizontal Screen": 0.29,
  "Shelf Edge": 0.17,
  Endcap: 0.22,
  Kiosk: 0.3,
  "Digital Menu Board": 0.27
};
const PLACEMENT_ROLE_IMPRESSION_FACTORS = {
  entrance: 0.95,
  category: 0.46,
  aisle: 0.38,
  checkout: 0.54,
  foodcourt: 0.62,
  general: 0.42
};
const GOAL_PRICING_MODEL = {
  id: "screen-type-cpm",
  label: "Retailer-set CPM by screen type",
  currencySymbol: "$",
  unit: "CPM",
  deliveryMetric: "estimated impressions"
};
const MAX_GOAL_FLIGHT_DAYS = 180;
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
    defaultPromotion: "Store arrival offer",
    defaultBadge: "At the Entrance",
    defaultCta: "Find it in store",
    defaultSubcopy: "In store today.",
    defaultLegal: "Pricing and availability vary by location."
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
    defaultPromotion: "Category feature",
    defaultBadge: "On the Feature Wall",
    defaultCta: "See the live display",
    defaultSubcopy: "See it on display today.",
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
    defaultPromotion: "Rotating range highlights",
    defaultBadge: "This Zone Today",
    defaultCta: "Explore the full range",
    defaultSubcopy: "See more in this range.",
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
    defaultPromotion: "Continue on your phone",
    defaultBadge: "Mobile Handoff",
    defaultCta: "Scan to keep this offer",
    defaultSubcopy: "Take this offer with you.",
    defaultLegal: "Digital offers and sign-in flows vary by store."
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
    defaultPromotion: "Shelf-side feature",
    defaultBadge: "Compare Here",
    defaultCta: "Scan for details",
    defaultSubcopy: "Check price and details here.",
    defaultLegal: "Price and availability are specific to this location."
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
    defaultPromotion: "Counter highlight",
    defaultBadge: "Today's Picks",
    defaultCta: "Scan for ingredients",
    defaultSubcopy: "Order at the counter.",
    defaultLegal: "Preparation times and availability may vary."
  }
];
const TEMPLATE_PRESET_MAP = new Map(TEMPLATE_PRESETS.map((entry) => [entry.id, entry]));
const GOAL_OBJECTIVE_MAP = new Map(GOAL_OBJECTIVES.map((entry) => [entry.id, entry]));
const SHARED_PLAYER_URL = "/screen.html";

const DEMO_PRESET_ID = "cyield-cmax-demo";
const DEMO_STORE_ID = readOptionalString(DEMO_ANCHOR_STORE?.storeId, 80) || DEMO_STORE_IDS[0] || "";
const DEMO_STORE_LABEL = readOptionalString(DEMO_ANCHOR_STORE?.storeLabel, 80) || DEMO_STORE_ID;
const DEMO_STORE_ID_SET = new Set(DEMO_STORE_IDS);
const LEGACY_DEMO_STORE_ID_SET = new Set(LEGACY_DEMO_STORE_IDS);
const DEFAULT_REFRESH_INTERVAL = 30000;
const DEFAULT_TRACKING_BASE_URL = "/collect";
const SCREEN_SHARE_SLOT_COUNT = 6;
const DEFAULT_SELLABLE_SHARE_SLOTS = 1;
const SCREEN_SHARE_SLOT_MAX = 12;
const GOAL_LINE_ITEM_SOURCE = "goal-share";
const MAX_GOAL_SCREEN_ID_LIST_ITEMS = 50000;

function clampNumber(value, min = 0, max = 1) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return min;
  }
  return Math.min(max, Math.max(min, parsed));
}

function normalizeRange(value, min, max, fallback = 0.5) {
  const parsedValue = Number(value);
  const parsedMin = Number(min);
  const parsedMax = Number(max);
  if (!Number.isFinite(parsedValue) || !Number.isFinite(parsedMin) || !Number.isFinite(parsedMax) || parsedMax <= parsedMin) {
    return fallback;
  }
  return clampNumber((parsedValue - parsedMin) / (parsedMax - parsedMin), 0, 1);
}

function readNumericValue(value, fallback = 0) {
  const normalized =
    typeof value === "string"
      ? value.replace(/[^0-9.-]+/g, "")
      : value;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function averageOf(values = [], fallback = 0) {
  const numeric = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (numeric.length === 0) {
    return fallback;
  }
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function formatCount(value) {
  return Math.max(0, Math.round(Number(value || 0))).toLocaleString("en-US");
}

function formatMoney(value) {
  return `$${Math.round(Number(value || 0)).toLocaleString("en-US")}`;
}

function formatDuration(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms || 0) / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return `${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function buildDemoStoreSalesSignalMap() {
  const rawEntries = DEMO_STORE_PROFILES.map((profile) => {
    const screenConfigs = Object.values(profile?.screenConfigs || {});
    const screenCount = screenConfigs.length;
    const verticalCount = screenConfigs.filter((config) => toTrimmedString(config?.screenType).toLowerCase().includes("vertical")).length;
    const kioskCount = screenConfigs.filter((config) => toTrimmedString(config?.screenType).toLowerCase() === "kiosk").length;
    const shelfCount = screenConfigs.filter((config) => {
      const screenType = toTrimmedString(config?.screenType).toLowerCase();
      return screenType.includes("shelf") || screenType.includes("endcap");
    }).length;
    const entranceCount = screenConfigs.filter((config, configIndex) => {
      const key = Object.keys(profile?.screenConfigs || {})[configIndex] || "";
      return String(key).toLowerCase().includes("entrance");
    }).length;
    const electronicsBias = Number(profile?.categoryBias?.electronics || 1);
    const whitegoodsBias = Number(profile?.categoryBias?.whitegoods || 1);
    const aisleBias = Number(profile?.categoryBias?.aisle || 1);
    const foodcourtBias = Number(profile?.categoryBias?.foodcourt || 1);
    const inventoryScale = getStoreInventoryScale(profile);
    const trafficScale = getStoreTrafficScale(profile);
    const marketVariance = (hashText(`${profile?.market || ""}-${profile?.tradeArea || ""}`) % 17) * 24000;
    const totalSales =
      2400000 +
      Number(profile?.stockBase || 0) * 42000 +
      inventoryScale * 1650000 +
      trafficScale * 1380000 +
      electronicsBias * 135000 +
      whitegoodsBias * 112000 +
      aisleBias * 54000 +
      foodcourtBias * 26000 +
      verticalCount * 42000 +
      kioskCount * 24000 +
      shelfCount * 16000 +
      screenCount * 12000 +
      marketVariance;
    const avgBasketValue =
      58 + Number(profile?.stockBase || 0) * 0.18 + whitegoodsBias * 12 + electronicsBias * 8 + aisleBias * 4 + trafficScale * 3;
    const estimatedTransactions = Math.max(1, Math.round(totalSales / Math.max(24, avgBasketValue)));
    const inferredFootTraffic = Math.round(estimatedTransactions * (1.24 + trafficScale * 0.18 + entranceCount * 0.07 + screenCount * 0.01));
    const checkoutIntent = estimatedTransactions * (0.32 + trafficScale * 0.05 + kioskCount * 0.08 + shelfCount * 0.03 + aisleBias * 0.05);
    const premiumDemand = totalSales * (0.08 + electronicsBias * 0.11 + inventoryScale * 0.05 + verticalCount * 0.05);
    const clearancePressure = Number(profile?.stockBase || 0) * 2.6 + inventoryScale * 24 + aisleBias * 22 + whitegoodsBias * 11 + shelfCount * 6;

    return {
      storeId: readOptionalString(profile?.storeId, 80),
      storeLabel: readOptionalString(profile?.storeLabel, 80) || readOptionalString(profile?.storeId, 80),
      totalSales: Math.round(totalSales),
      avgBasketValue: Number(avgBasketValue.toFixed(2)),
      estimatedTransactions,
      inferredFootTraffic,
      checkoutIntent: Number(checkoutIntent.toFixed(2)),
      premiumDemand: Number(premiumDemand.toFixed(2)),
      clearancePressure: Number(clearancePressure.toFixed(2))
    };
  }).filter((entry) => Boolean(entry.storeId));

  const salesValues = rawEntries.map((entry) => entry.totalSales);
  const footTrafficValues = rawEntries.map((entry) => entry.inferredFootTraffic);
  const checkoutValues = rawEntries.map((entry) => entry.checkoutIntent);
  const premiumValues = rawEntries.map((entry) => entry.premiumDemand);
  const clearanceValues = rawEntries.map((entry) => entry.clearancePressure);
  const salesMin = Math.min(...salesValues);
  const salesMax = Math.max(...salesValues);
  const footTrafficMin = Math.min(...footTrafficValues);
  const footTrafficMax = Math.max(...footTrafficValues);
  const checkoutMin = Math.min(...checkoutValues);
  const checkoutMax = Math.max(...checkoutValues);
  const premiumMin = Math.min(...premiumValues);
  const premiumMax = Math.max(...premiumValues);
  const clearanceMin = Math.min(...clearanceValues);
  const clearanceMax = Math.max(...clearanceValues);

  return new Map(
    rawEntries.map((entry) => [
      entry.storeId,
      {
        ...entry,
        salesIndex: Number(normalizeRange(entry.totalSales, salesMin, salesMax, 0.5).toFixed(2)),
        footTrafficIndex: Number(normalizeRange(entry.inferredFootTraffic, footTrafficMin, footTrafficMax, 0.5).toFixed(2)),
        checkoutIntentIndex: Number(normalizeRange(entry.checkoutIntent, checkoutMin, checkoutMax, 0.5).toFixed(2)),
        premiumDemandIndex: Number(normalizeRange(entry.premiumDemand, premiumMin, premiumMax, 0.5).toFixed(2)),
        clearancePressureIndex: Number(normalizeRange(entry.clearancePressure, clearanceMin, clearanceMax, 0.5).toFixed(2))
      }
    ])
  );
}

const DEMO_STORE_SALES_SIGNAL_MAP = buildDemoStoreSalesSignalMap();
const DEMO_STAGE_ORDER = ["cyield-supply", "cmax-demand", "monitoring"];
const DEMO_PAGE_SPECS = [
  {
    pageId: "ENTRANCE",
    pageType: "In-Store Zone",
    environment: "In-Store",
    verbosity: "Min",
    firePageBeacons: true,
    oneTagHybridIntegration: false,
    includeBidInResponse: false
  },
  {
    pageId: "ELECTRONICS",
    pageType: "Category",
    environment: "In-Store",
    verbosity: "Min",
    firePageBeacons: true,
    oneTagHybridIntegration: false,
    includeBidInResponse: false
  },
  {
    pageId: "WHITEGOODS",
    pageType: "Category",
    environment: "In-Store",
    verbosity: "Min",
    firePageBeacons: true,
    oneTagHybridIntegration: false,
    includeBidInResponse: false
  },
  {
    pageId: "AISLE",
    pageType: "In-Store Zone",
    environment: "In-Store",
    verbosity: "Min",
    firePageBeacons: true,
    oneTagHybridIntegration: false,
    includeBidInResponse: false
  },
  {
    pageId: "CHECKOUT",
    pageType: "Checkout",
    environment: "In-Store",
    verbosity: "Min",
    firePageBeacons: true,
    oneTagHybridIntegration: false,
    includeBidInResponse: false
  }
];
const DEMO_SCREEN_BLUEPRINTS = [
  {
    screenIdSuffix: "CYIELD_ENTRANCE_HERO",
    resolverSuffix: "entrance",
    stageId: "cyield-supply",
    stageLabel: "CYield Supply Setup",
    placementKey: "entrance",
    label: "Entrance Hero",
    pageId: "ENTRANCE",
    location: "entrance",
    screenType: "Horizontal Screen",
    screenSize: "1920x1080",
    templateId: "fullscreen-banner",
    refreshInterval: 30000,
    lineItemKey: "CYIELD-ENTRANCE",
    lineItemName: "CYield Entrance Supply Anchor",
    productSkus: ["LAP-ULTRA-13-001"],
    minimumProducts: 1,
    fallbackCategory: "electronics",
    creative: {
      badge: "CYield Supply",
      promotion: "Supply setup is live",
      cta: "Open the demo flow",
      subcopy: "Create one screen, then auto build the rest in one click for demo purposes.",
      legal: "Demo baseline only."
    }
  },
  {
    screenIdSuffix: "CYIELD_ELECTRONICS_V1",
    resolverSuffix: "electronics",
    stageId: "cyield-supply",
    stageLabel: "CYield Supply Setup",
    placementKey: "electronics",
    label: "Electronics Hero",
    pageId: "ELECTRONICS",
    location: "electronics",
    screenType: "Vertical Screen",
    screenSize: "1080x1920",
    templateId: "fullscreen-hero",
    refreshInterval: 30000,
    lineItemKey: "CYIELD-ELECTRONICS",
    lineItemName: "CYield Electronics Placement",
    productSkus: ["LAP-ULTRA-13-001"],
    minimumProducts: 1,
    fallbackCategory: "electronics",
    creative: {
      badge: "Store Inventory",
      promotion: "Electronics supply on the shelf",
      cta: "Show the placement",
      subcopy: "The first manual screen becomes the starting point for the demo auto-build.",
      legal: "Demo baseline only."
    }
  },
  {
    screenIdSuffix: "CYIELD_WHITEGOODS_LOOP",
    resolverSuffix: "whitegoods",
    stageId: "cyield-supply",
    stageLabel: "CYield Supply Setup",
    placementKey: "whitegoods",
    label: "Whitegoods Loop",
    pageId: "WHITEGOODS",
    location: "whitegoods",
    screenType: "Horizontal Screen",
    screenSize: "1920x1080",
    templateId: "carousel-banner",
    refreshInterval: 14000,
    lineItemKey: "CYIELD-WHITEGOODS",
    lineItemName: "CYield Whitegoods Coverage",
    productSkus: ["WG-FRIDGE-001", "WG-WASHER-002", "WG-OVEN-003"],
    minimumProducts: 3,
    fallbackCategory: "whitegoods",
    creative: {
      badge: "Coverage View",
      promotion: "Whitegoods range expansion",
      cta: "Rotate the range",
      subcopy: "Preset fills the floor with a complete retail story.",
      legal: "Demo baseline only."
    }
  },
  {
    screenIdSuffix: "CYIELD_AISLE_EDGE",
    resolverSuffix: "aisle",
    stageId: "cyield-supply",
    stageLabel: "CYield Supply Setup",
    placementKey: "aisle",
    label: "Aisle Edge",
    pageId: "AISLE",
    location: "aisle",
    screenType: "Shelf Edge",
    screenSize: "1280x720",
    templateId: "shelf-spotlight",
    refreshInterval: 12000,
    lineItemKey: "CYIELD-AISLE",
    lineItemName: "CYield Aisle Coverage",
    productSkus: ["GR-PROTEIN-001"],
    minimumProducts: 1,
    fallbackCategory: "aisle",
    creative: {
      badge: "Aisle Coverage",
      promotion: "Aisle-level supply proof",
      cta: "Keep it on shelf",
      subcopy: "A compact placement proves the inventory map.",
      legal: "Demo baseline only."
    }
  },
  {
    screenIdSuffix: "CMAX_CHECKOUT_KIOSK",
    resolverSuffix: "checkout",
    stageId: "cmax-demand",
    stageLabel: "CMax Buying / Demand",
    placementKey: "checkout",
    label: "Checkout Kiosk",
    pageId: "CHECKOUT",
    location: "checkout",
    screenType: "Kiosk",
    screenSize: "1080x1920",
    templateId: "kiosk-interactive",
    refreshInterval: 15000,
    lineItemKey: "CMAX-CHECKOUT",
    lineItemName: "CMax Demand Activation",
    productSkus: ["ACC-MOUSE-001", "ACC-DOCK-003"],
    minimumProducts: 2,
    fallbackCategory: "electronics",
    creative: {
      badge: "CMax Demand",
      promotion: "Checkout demand activation",
      cta: "Scan to continue",
      subcopy: "Turn supply into demand at the moment of purchase.",
      legal: "Demo baseline only."
    }
  }
];

function normalizeDemoStoreSlug(storeId) {
  return String(storeId || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildDemoScreenSpec(storeProfile, blueprint, storeIndex) {
  const config = storeProfile?.screenConfigs?.[blueprint.placementKey] || {};
  const storeId = readRequiredString(storeProfile?.storeId, "demo storeId", 80);
  const storeLabel = readOptionalString(storeProfile?.storeLabel, 80) || storeId.replace(/_/g, " ");
  const resolverStore = normalizeDemoStoreSlug(storeId) || `store-${storeIndex + 1}`;
  const defaultScreenShareSlots = 6;
  const defaultSellableShareSlots = 1;
  const screenShareSlots = readScreenShareSlotCount(config.screenShareSlots, defaultScreenShareSlots);
  const lineItemSuffix = String(blueprint.lineItemKey || blueprint.screenIdSuffix || `screen-${storeIndex + 1}`)
    .replace(/[^A-Z0-9-]+/gi, "-")
    .toUpperCase();

  return {
    ...blueprint,
    storeId,
    storeLabel,
    label: `${storeLabel} ${blueprint.label}`,
    screenId: `${storeId}_${blueprint.screenIdSuffix}`,
    resolverId: `tv-${resolverStore}-${blueprint.resolverSuffix}-01`,
    screenType: readOptionalString(config.screenType, 80) || blueprint.screenType,
    screenSize: readOptionalString(config.screenSize, 40) || blueprint.screenSize,
    templateId: readOptionalString(config.templateId, 80) || blueprint.templateId,
    refreshInterval: Number(config.refreshInterval || blueprint.refreshInterval),
    screenShareSlots,
    defaultSellableShareSlots: readSellableShareSlots(
      config.defaultSellableShareSlots,
      screenShareSlots,
      defaultSellableShareSlots
    ),
    lineItemId: `LI-DEMO-${storeId}-${lineItemSuffix}`.slice(0, 120),
    lineItemName: `${storeLabel} ${blueprint.lineItemName}`.slice(0, 120)
  };
}

const DEMO_SCREEN_SPECS = DEMO_STORE_PROFILES.flatMap((storeProfile, index) =>
  DEMO_SCREEN_BLUEPRINTS.map((blueprint) => buildDemoScreenSpec(storeProfile, blueprint, index))
);
const DEMO_SCREEN_ID_SET = new Set(DEMO_SCREEN_SPECS.map((screenSpec) => screenSpec.screenId));
const DEMO_SUPPLY_STARTER_SCREEN_ID = `${DEMO_STORE_ID}_CYIELD_ENTRANCE_HERO`;
const DEMO_BUYING_STARTER_SCREEN_ID = `${DEMO_STORE_ID}_CMAX_CHECKOUT_KIOSK`;
const DEMO_STAGE_TEMPLATES = [
  {
    id: "cyield-supply",
    label: "CYield Supply Setup",
    description: "Use the two-action supply flow to create one screen in CYield, then auto build the rest of the store for demo purposes.",
    actionLabel: "Auto build rest of screens",
    starterScreenId: DEMO_SUPPLY_STARTER_SCREEN_ID,
    proofPoints: [
      "Minimal CYield change",
      "One shared player URL",
      "Demo auto-build rolls out the store fast",
      "Retailer pricing stays on the supply side"
    ],
    supportingModules: [
      "2-action supply flow",
      "Auto-build summary plus retailer CPM card",
      "Supply handoff across stores and placements",
      "Advanced page and screen mapping details"
    ],
    demoActions: [
      "Click Create screen to show the only manual CYield step.",
      "Point to the shared player URL and explain that the resolver, not the retailer page model, identifies the installed screen.",
      "Click Auto build rest of screens to fan out entrance, electronics, whitegoods, aisle, and checkout coverage for demo purposes.",
      "Use the handoff card only if needed to quantify mapped placements, stores, and the shared player path."
    ],
    qaPrompts: [
      "If someone asks about implementation, open Advanced config and show the page, screen, and share fields behind the first screen.",
      "If someone asks about retailer control, point to the CPM card and explain that pricing still lives on the supply side.",
      "If someone asks about scale, use the handoff stats instead of walking screen by screen."
    ]
  },
  {
    id: "cmax-demand",
    label: "CMax Buying / Demand",
    description: "Switch into the planner, generate a goal-led line-up, edit the mix if needed, then fund the final activation.",
    actionLabel: "Generate buying plan",
    starterScreenId: DEMO_BUYING_STARTER_SCREEN_ID,
    goalDefaults: {
      objective: "checkout-attach",
      aggressiveness: "Balanced",
      storeId: "",
      pageId: "CHECKOUT",
      advertiserId: "advertiser-northfield",
      prompt: `Drive checkout demand for Northfield accessories in ${DEMO_STORE_LABEL}.`,
      targetSkuIds: ["ACC-MOUSE-001"]
    },
    proofPoints: [
      "Goal-led buying brief",
      "Auto-matched screen scope",
      "Editable line-up and budget control",
      "Applies even when the best screen already matches"
    ],
    supportingModules: [
      "Planner steps: brief, scope, assortment",
      "AI brief with SKU reasoning",
      "Decision logic and editable line-up",
      "Budget slider and launch state"
    ],
    demoActions: [
      "Set the advertiser and objective, then use the AI brief or manual SKU selection to create the shortlist.",
      "Call out any store or page auto-widening as planner logic, not as a hidden pre-baked setup.",
      "Use the recommendation summary to explain why placements are included, excluded, or already compatible.",
      "Move to the budget slider and approve the funded line-up so monitoring inherits the same campaign context."
    ],
    qaPrompts: [
      "If someone asks why a screen is missing, use the store logic, scope logic, or guardrail rationale in the decision panel.",
      "If someone asks what changed, distinguish between funded placements, held-by-budget placements, and placements still available to add back.",
      "If someone asks about commercials, point to the selected versus max spend and funded impression totals."
    ]
  },
  {
    id: "monitoring",
    label: "Monitoring",
    description: "Use the live brand dashboard, measurement board, preview rail, and campaign history to show operational proof after launch.",
    actionLabel: "Open monitoring",
    starterScreenId: DEMO_BUYING_STARTER_SCREEN_ID,
    proofPoints: [
      "Brand dashboard",
      "Measurement board",
      "Live preview rail",
      "Telemetry by screen and SKU",
      "Same shared player path end to end"
    ],
    supportingModules: [
      "Brand-scoped dashboard and KPI rail",
      "Measurement board with observed and modeled metrics",
      "Telemetry breakdowns by screen, template, and SKU",
      "Live screen snapshot, preview rail, and campaign history"
    ],
    demoActions: [
      "Open monitoring after apply and frame it as a brand dashboard, not just a telemetry dump.",
      "Use the KPI rail and measurement board to separate observed plays and exposure from modeled QR, incrementality, and sales impact.",
      "Show one live screen snapshot or preview card to prove the same shared player is now in market.",
      "Finish on the campaign timeline to show continuity from planning through launch."
    ],
    qaPrompts: [
      "If someone asks what is live versus modeled, use the measurement source note and metric tags to separate telemetry from modeled outcomes.",
      "If someone asks for proof, use the live screen snapshot, preview links, and breakdowns by screen, template, or SKU.",
      "If someone asks about optimization, point to the campaign history and plan-level before or after comparison story."
    ]
  }
];
const TELEMETRY_EVENT_TYPES = ["play", "exposure"];
const TELEMETRY_EVENT_LIMIT = 4000;
const TELEMETRY_BREAKDOWN_LIMIT = 6;
const SCREEN_SIZE_PATTERN = /^\d{3,5}x\d{3,5}$/i;
const AGENT_RUN_HISTORY_LIMIT = 40;
const GOAL_TARGET_SKU_LIMIT = 24;
const GOAL_INFERRED_PRODUCT_LIMIT = 8;
const GOAL_RELEVANCE_THRESHOLD = 0.24;
const GOAL_PROMPT_MIN_SCORE = 0.75;
const GOAL_PROMPT_AI_CANDIDATE_LIMIT = 32;
const GOAL_PROMPT_AI_TIMEOUT_MS = 12000;
const OPENAI_API_KEY = toTrimmedString(process.env.OPENAI_API_KEY);
const OPENAI_MODEL = toTrimmedString(process.env.OPENAI_MODEL) || "gpt-5-mini";
const OPENAI_BASE_URL = toTrimmedString(process.env.OPENAI_BASE_URL) || "https://api.openai.com/v1";
const GOAL_PROMPT_INTENT_KEYWORDS = {
  stock: ["stock", "inventory", "available", "availability", "in stock", "high stock", "surplus", "overstock"],
  value: ["value", "deal", "discount", "cheap", "budget", "affordable", "sale", "markdown"],
  premium: ["premium", "hero", "flagship", "luxury", "high end", "high-end", "best", "top tier"],
  rating: ["rating", "rated", "reviewed", "top rated", "best reviewed", "best-rated"],
  newness: ["new", "newest", "latest", "launch", "recent"]
};
const GOAL_PLANNING_THEME_KEYWORDS = {
  urgency: ["today", "now", "afternoon", "weekend", "launch", "rush", "limited", "immediate"],
  premium: ["premium", "hero", "flagship", "signature", "oled", "luxury", "new", "launch"],
  clearance: ["clearance", "markdown", "overstock", "sell", "through", "last", "chance"],
  bundle: ["attach", "addon", "add", "on", "bundle", "pair", "basket", "cross", "sell"],
  compare: ["compare", "range", "assortment", "browse", "collection", "lineup"],
  entrance: ["entrance", "entry", "arrival", "front", "door"],
  checkout: ["checkout", "register", "basket", "payment", "lane"],
  aisle: ["aisle", "shelf", "endcap", "bay"],
  foodcourt: ["foodcourt", "counter", "menu", "meal", "drink"],
  value: ["value", "save", "deal", "student", "budget"]
};
const DEFAULT_PRODUCT_FEED_FILE = path.resolve(process.cwd(), "data", "productFeed.json");
const DEFAULT_PRODUCT_IMAGE_MANIFEST_FILE = path.resolve(process.cwd(), "data", "productImageManifest.json");
const DEFAULT_PRODUCT_IMAGE_OUTPUT_DIR = path.resolve(process.cwd(), "public", "assets", "products", "generated");
const DEFAULT_BRAND_LOGO_MANIFEST_FILE = path.resolve(process.cwd(), "data", "brandLogoManifest.json");
const DEFAULT_BRAND_LOGO_OUTPUT_DIR = path.resolve(process.cwd(), "public", "assets", "brands", "generated");
const PRODUCT_GENERATED_IMAGE_BASE_PATH =
  toTrimmedString(process.env.PRODUCT_IMAGE_BASE_PATH) || "/assets/products/generated";
const BRAND_LOGO_BASE_PATH = toTrimmedString(process.env.BRAND_LOGO_BASE_PATH) || "/assets/brands/generated";
const PRODUCT_FEED_FILE = resolvePathFromEnv("PRODUCT_FEED_FILE", DEFAULT_PRODUCT_FEED_FILE);
const PRODUCT_IMAGE_MANIFEST_FILE = resolvePathFromEnv(
  "PRODUCT_IMAGE_MANIFEST_FILE",
  DEFAULT_PRODUCT_IMAGE_MANIFEST_FILE
);
const PRODUCT_IMAGE_OUTPUT_DIR = resolvePathFromEnv("PRODUCT_IMAGE_OUTPUT_DIR", DEFAULT_PRODUCT_IMAGE_OUTPUT_DIR);
const BRAND_LOGO_MANIFEST_FILE = resolvePathFromEnv("BRAND_LOGO_MANIFEST_FILE", DEFAULT_BRAND_LOGO_MANIFEST_FILE);
const BRAND_LOGO_OUTPUT_DIR = resolvePathFromEnv("BRAND_LOGO_OUTPUT_DIR", DEFAULT_BRAND_LOGO_OUTPUT_DIR);
const PRODUCT_IMAGE_GENERATOR_SCRIPT = path.resolve(process.cwd(), "scripts", "generate-product-images.mjs");
const BRAND_LOGO_GENERATOR_SCRIPT = path.resolve(process.cwd(), "scripts", "generate-brand-logos.mjs");
const PRODUCT_IMAGE_JOB_LOG_LIMIT = 200;
const BRAND_LOGO_JOB_LOG_LIMIT = 200;
const DEMO_STOCK_BY_SKU = Object.freeze({});
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
let productImageGenerationJob = null;
let brandLogoGenerationJob = null;
let cachedProductFeed = null;
let cachedProductFeedMtimeMs = null;
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

function hashText(value) {
  const input = String(value || "");
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) % 10007;
  }
  return hash;
}

function buildProductInventoryProfile({ sku = "", category = "", tags = [] }) {
  const normalizedSku = normalizeSku(sku);
  const normalizedCategory = readOptionalString(category, 80).toLowerCase();
  const tagSet = new Set((Array.isArray(tags) ? tags : []).map((entry) => readOptionalString(entry, 40).toLowerCase()));

  if (normalizedCategory === "foodcourt") {
    return { baseUnits: 180, variableUnits: 150, demandKey: "foodcourt" };
  }
  if (normalizedCategory === "aisle") {
    if (tagSet.has("coffee") || normalizedSku.startsWith("GR-BEAN") || normalizedSku.startsWith("GRWB-") || normalizedSku.startsWith("GRGD-")) {
      return { baseUnits: 96, variableUnits: 110, demandKey: "aisle" };
    }
    if (tagSet.has("protein") || normalizedSku.startsWith("GR-PROTEIN") || normalizedSku.startsWith("GRPW-") || normalizedSku.startsWith("GRBR-")) {
      return { baseUnits: 130, variableUnits: 150, demandKey: "aisle" };
    }
    return { baseUnits: 88, variableUnits: 120, demandKey: "aisle" };
  }
  if (normalizedCategory === "whitegoods") {
    if (
      tagSet.has("fridge") ||
      tagSet.has("washer") ||
      tagSet.has("dryer") ||
      tagSet.has("oven") ||
      tagSet.has("cooktop") ||
      normalizedSku.startsWith("WGFR-") ||
      normalizedSku.startsWith("WGFZ-") ||
      normalizedSku.startsWith("WGOV-") ||
      normalizedSku.startsWith("WGCT-") ||
      normalizedSku.startsWith("WGWA-") ||
      normalizedSku.startsWith("WGDR-") ||
      normalizedSku.startsWith("WGCM-") ||
      normalizedSku.startsWith("WGRG-")
    ) {
      return { baseUnits: 4, variableUnits: 11, demandKey: "whitegoods" };
    }
    return { baseUnits: 18, variableUnits: 34, demandKey: "whitegoods" };
  }
  if (normalizedCategory === "electronics") {
    if (tagSet.has("laptop") || normalizedSku.startsWith("LAP-")) {
      return { baseUnits: 10, variableUnits: 18, demandKey: "electronics" };
    }
    if (normalizedSku.startsWith("TAB-") || tagSet.has("tablet")) {
      return { baseUnits: 14, variableUnits: 22, demandKey: "electronics" };
    }
    if (normalizedSku.startsWith("MON-") || tagSet.has("monitor")) {
      return { baseUnits: 16, variableUnits: 20, demandKey: "electronics" };
    }
    if (normalizedSku.startsWith("ACC-") || tagSet.has("accessory")) {
      return { baseUnits: 42, variableUnits: 74, demandKey: "electronics" };
    }
    if (normalizedSku.startsWith("AUD-") || tagSet.has("audio")) {
      return { baseUnits: 24, variableUnits: 32, demandKey: "electronics" };
    }
    if (normalizedSku.startsWith("CAM-") || tagSet.has("camera") || tagSet.has("capture")) {
      return { baseUnits: 12, variableUnits: 18, demandKey: "electronics" };
    }
    return { baseUnits: 20, variableUnits: 24, demandKey: "electronics" };
  }

  return { baseUnits: 22, variableUnits: 16, demandKey: normalizedCategory || "general" };
}

function getStoreInventoryScale(storeProfile = {}) {
  const explicitScale = Number(storeProfile?.inventoryScale);
  if (Number.isFinite(explicitScale) && explicitScale > 0) {
    return explicitScale;
  }
  const stockBase = Number(storeProfile?.stockBase || 0);
  if (Number.isFinite(stockBase) && stockBase > 0) {
    return Math.max(0.72, Math.min(1.58, stockBase / 13));
  }
  return 1;
}

function getStoreTrafficScale(storeProfile = {}) {
  const explicitScale = Number(storeProfile?.trafficScale);
  if (Number.isFinite(explicitScale) && explicitScale > 0) {
    return explicitScale;
  }
  const inventoryScale = Number(storeProfile?.inventoryScale);
  if (Number.isFinite(inventoryScale) && inventoryScale > 0) {
    return inventoryScale;
  }
  return getStoreInventoryScale(storeProfile);
}

function estimateGeneratedStoreStockUnits(product = {}, storeProfile = {}) {
  const normalizedSku = normalizeSku(product?.sku || product?.ProductId);
  const inventoryProfile = buildProductInventoryProfile(product);
  const inventoryScale = getStoreInventoryScale(storeProfile);
  const trafficScale = getStoreTrafficScale(storeProfile);
  const categoryBias =
    Number(
      storeProfile?.categoryBias?.[inventoryProfile.demandKey] ||
        storeProfile?.categoryBias?.[readOptionalString(product?.category, 80).toLowerCase()] ||
        storeProfile?.categoryBias?.general ||
        1
    ) || 1;
  const skuVariability = hashText(`${normalizedSku}-${storeProfile?.storeId || ""}`) % Math.max(8, inventoryProfile.variableUnits);
  const areaVariability = (hashText(`${storeProfile?.tradeArea || storeProfile?.storeLabel || ""}-${normalizedSku}`) % 9) * 0.03;
  const tagSet = new Set(readStringArray(product?.tags, 16, 40).map((entry) => entry.toLowerCase()));
  const tagMultiplier = tagSet.has("premium")
    ? 0.84
    : tagSet.has("value")
      ? 1.12
      : tagSet.has("checkout-attach")
        ? 1.18
        : tagSet.has("clearance")
          ? 1.1
          : 1;
  const units =
    (inventoryProfile.baseUnits + skuVariability) *
    inventoryScale *
    (0.9 + trafficScale * 0.1) *
    categoryBias *
    tagMultiplier *
    (1 + areaVariability);

  return Math.max(0, Math.round(units));
}

function buildGeneratedDemoStockByStore(product = {}) {
  return Object.fromEntries(
    DEMO_STORE_PROFILES.map((storeProfile) => [storeProfile.storeId, estimateGeneratedStoreStockUnits(product, storeProfile)])
  );
}

function buildGeneratedDemoStockSummary(product = {}) {
  let totalStock = 0;
  let maxStoreStock = 0;

  for (const storeProfile of DEMO_STORE_PROFILES) {
    const quantity = estimateGeneratedStoreStockUnits(product, storeProfile);
    totalStock += quantity;
    if (quantity > maxStoreStock) {
      maxStoreStock = quantity;
    }
  }

  return {
    storeCount: DEMO_STORE_PROFILES.length,
    totalStock,
    maxStoreStock,
    averageStock: DEMO_STORE_PROFILES.length > 0 ? Math.round(totalStock / DEMO_STORE_PROFILES.length) : 0
  };
}

function getProductStockForStore(product = {}, storeId = "") {
  const normalizedStoreId = readOptionalString(storeId, 80);
  if (!normalizedStoreId) {
    return 0;
  }
  if (product?.stockByStore && typeof product.stockByStore === "object" && normalizedStoreId in product.stockByStore) {
    return Math.max(0, Number(product.stockByStore[normalizedStoreId]) || 0);
  }
  const storeProfile = DEMO_STORE_PROFILES.find((entry) => entry.storeId === normalizedStoreId);
  if (!storeProfile) {
    return 0;
  }
  return estimateGeneratedStoreStockUnits(product, storeProfile);
}

function normalizeBrandLogoPath(value) {
  const explicit = readOptionalString(value, 500);
  if (!explicit) {
    return "";
  }
  const generatedBasePath = BRAND_LOGO_BASE_PATH.replace(/\/+$/, "");
  if (explicit === generatedBasePath || explicit.startsWith(`${generatedBasePath}/`)) {
    return explicit;
  }
  return explicit.startsWith("/assets/") ? explicit : "";
}

function buildProductFeedResponseItem(product = {}, { includeStockByStore = false } = {}) {
  const responseItem = {
    sku: product.sku,
    name: product.name,
    category: product.category,
    brand: product.brand,
    logo: normalizeBrandLogoPath(product.logo || product.brandLogo),
    productPage: product.productPage,
    image: product.image,
    price: product.price,
    comparePrice: product.comparePrice,
    rating: product.rating,
    advertiserId: product.advertiserId,
    tags: Array.isArray(product.tags) ? product.tags : [],
    stockSummary:
      product.stockSummary && typeof product.stockSummary === "object"
        ? product.stockSummary
        : buildGeneratedDemoStockSummary(product)
  };

  if (includeStockByStore) {
    responseItem.stockByStore =
      product.stockByStore && typeof product.stockByStore === "object"
        ? product.stockByStore
        : buildGeneratedDemoStockByStore(product);
  }

  return responseItem;
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function toTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolvePathFromEnv(envName, fallbackPath) {
  const override = toTrimmedString(process.env[envName]);
  return override ? path.resolve(override) : fallbackPath;
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

function readScreenIdArray(value, maxItems = MAX_GOAL_SCREEN_ID_LIST_ITEMS) {
  return readStringArray(value, maxItems, 80)
    .map((screenId) => readOptionalString(screenId, 80))
    .filter(Boolean);
}

function readOptionalInteger(value, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function readProductImageGenerationOptions(body = {}) {
  const quality = readOptionalString(body?.quality, 20).toLowerCase() || "";
  const size = readOptionalString(body?.size, 20);
  const allowedQuality = new Set(["low", "medium", "high"]);
  const allowedSize = new Set(["1024x1024", "1536x1024", "1024x1536"]);

  if (quality && !allowedQuality.has(quality)) {
    throw new HttpError(400, "quality must be one of: low, medium, high.");
  }
  if (size && !allowedSize.has(size)) {
    throw new HttpError(400, "size must be one of: 1024x1024, 1536x1024, 1024x1536.");
  }

  return {
    skuFilter: readStringArray(body?.skus ?? body?.skuFilter ?? body?.sku, 2000, 120)
      .map((sku) => normalizeSku(sku))
      .filter(Boolean),
    limit: readOptionalInteger(body?.limit, null, { min: 1, max: 5000 }),
    force: readBoolean(body?.force, false),
    dryRun: readBoolean(body?.dryRun, false),
    concurrency: readOptionalInteger(body?.concurrency, 1, { min: 1, max: 8 }),
    quality: quality || "",
    size: size || "",
    timeoutMs: readOptionalInteger(body?.timeoutMs, null, { min: 1000, max: 900000 })
  };
}

function buildProductImageGenerationArgs(options = {}) {
  const args = [];
  const skuFilter = Array.isArray(options.skuFilter) ? options.skuFilter : [];
  if (skuFilter.length > 0) {
    args.push("--sku", skuFilter.join(","));
  }
  if (Number.isInteger(options.limit)) {
    args.push("--limit", String(options.limit));
  }
  if (readBoolean(options.force, false)) {
    args.push("--force");
  }
  if (readBoolean(options.dryRun, false)) {
    args.push("--dry-run");
  }
  if (Number.isInteger(options.concurrency) && options.concurrency > 1) {
    args.push("--concurrency", String(options.concurrency));
  }
  if (readOptionalString(options.quality, 20)) {
    args.push("--quality", options.quality);
  }
  if (readOptionalString(options.size, 20)) {
    args.push("--size", options.size);
  }
  if (Number.isInteger(options.timeoutMs)) {
    args.push("--timeout-ms", String(options.timeoutMs));
  }
  return args;
}

function appendProductImageJobLogs(job, source, chunk) {
  if (!job || !chunk) {
    return;
  }
  const lines = String(chunk)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return;
  }
  const logs = Array.isArray(job.logs) ? job.logs : [];
  for (const line of lines) {
    logs.push({
      at: new Date().toISOString(),
      source,
      message: line.slice(0, 1000)
    });
  }
  if (logs.length > PRODUCT_IMAGE_JOB_LOG_LIMIT) {
    logs.splice(0, logs.length - PRODUCT_IMAGE_JOB_LOG_LIMIT);
  }
  job.logs = logs;
  job.updatedAt = new Date().toISOString();
}

function buildProductImageJobSnapshot(job = productImageGenerationJob) {
  if (!job) {
    return {
      status: "idle",
      running: false,
      jobId: "",
      pid: null,
      startedAt: "",
      completedAt: "",
      exitCode: null,
      error: "",
      options: {},
      args: [],
      logs: []
    };
  }
  return {
    status: readOptionalString(job.status, 40) || "idle",
    running: readBoolean(job.running, false),
    jobId: readOptionalString(job.jobId, 120),
    pid: Number.isInteger(job.pid) ? job.pid : null,
    startedAt: readOptionalString(job.startedAt, 80),
    completedAt: readOptionalString(job.completedAt, 80),
    updatedAt: readOptionalString(job.updatedAt, 80),
    exitCode: Number.isInteger(job.exitCode) ? job.exitCode : null,
    signal: readOptionalString(job.signal, 40),
    error: readOptionalString(job.error, 500),
    options: job.options && typeof job.options === "object" ? { ...job.options } : {},
    args: Array.isArray(job.args) ? [...job.args] : [],
    logs: Array.isArray(job.logs) ? [...job.logs] : []
  };
}

function startProductImageGenerationJob(options = {}) {
  if (productImageGenerationJob?.running) {
    throw new HttpError(409, "A product image generation job is already running.");
  }

  const args = buildProductImageGenerationArgs(options);
  const now = new Date().toISOString();
  const child = spawn(process.execPath, [PRODUCT_IMAGE_GENERATOR_SCRIPT, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const job = {
    jobId: `product-images-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    running: true,
    status: "running",
    pid: child.pid,
    startedAt: now,
    completedAt: "",
    updatedAt: now,
    exitCode: null,
    signal: "",
    error: "",
    options: {
      ...options,
      skuFilter: Array.isArray(options.skuFilter) ? [...options.skuFilter] : []
    },
    args,
    logs: []
  };
  productImageGenerationJob = job;
  appendProductImageJobLogs(job, "system", `Started product image generation with PID ${child.pid || "pending"}.`);

  child.stdout?.on("data", (chunk) => {
    appendProductImageJobLogs(job, "stdout", chunk);
  });
  child.stderr?.on("data", (chunk) => {
    appendProductImageJobLogs(job, "stderr", chunk);
  });
  child.on("error", (error) => {
    job.running = false;
    job.status = "failed";
    job.error = readOptionalString(error?.message, 500) || "The generator process failed to start.";
    job.completedAt = new Date().toISOString();
    job.updatedAt = job.completedAt;
  });
  child.on("exit", (code, signal) => {
    job.running = false;
    job.exitCode = Number.isInteger(code) ? code : null;
    job.signal = readOptionalString(signal, 40);
    job.completedAt = new Date().toISOString();
    job.updatedAt = job.completedAt;
    job.status = code === 0 ? "completed" : "failed";
    if (code !== 0 && !job.error) {
      job.error = signal
        ? `Product image generation exited with signal ${signal}.`
        : `Product image generation exited with code ${code}.`;
    }
    appendProductImageJobLogs(
      job,
      "system",
      code === 0
        ? "Product image generation completed successfully."
        : job.error || "Product image generation exited unsuccessfully."
    );
  });

  return buildProductImageJobSnapshot(job);
}

function readBrandLogoGenerationOptions(body = {}) {
  const quality = readOptionalString(body?.quality, 20).toLowerCase() || "";
  const size = readOptionalString(body?.size, 20);
  const allowedQuality = new Set(["low", "medium", "high"]);
  const allowedSize = new Set(["1024x1024", "1536x1024", "1024x1536"]);

  if (quality && !allowedQuality.has(quality)) {
    throw new HttpError(400, "quality must be one of: low, medium, high.");
  }
  if (size && !allowedSize.has(size)) {
    throw new HttpError(400, "size must be one of: 1024x1024, 1536x1024, 1024x1536.");
  }

  return {
    brandFilter: readStringArray(body?.brands ?? body?.brandFilter ?? body?.brand, 2000, 120).filter(Boolean),
    advertiserFilter: readStringArray(body?.advertiserIds ?? body?.advertiserFilter ?? body?.advertiserId, 2000, 120).filter(Boolean),
    limit: readOptionalInteger(body?.limit, null, { min: 1, max: 5000 }),
    force: readBoolean(body?.force, false),
    dryRun: readBoolean(body?.dryRun, false),
    concurrency: readOptionalInteger(body?.concurrency, 1, { min: 1, max: 8 }),
    quality: quality || "",
    size: size || "",
    timeoutMs: readOptionalInteger(body?.timeoutMs, null, { min: 1000, max: 900000 })
  };
}

function buildBrandLogoGenerationArgs(options = {}) {
  const args = [];
  const brandFilter = Array.isArray(options.brandFilter) ? options.brandFilter : [];
  const advertiserFilter = Array.isArray(options.advertiserFilter) ? options.advertiserFilter : [];
  if (brandFilter.length > 0) {
    args.push("--brand", brandFilter.join(","));
  }
  if (advertiserFilter.length > 0) {
    args.push("--advertiser", advertiserFilter.join(","));
  }
  if (Number.isInteger(options.limit)) {
    args.push("--limit", String(options.limit));
  }
  if (readBoolean(options.force, false)) {
    args.push("--force");
  }
  if (readBoolean(options.dryRun, false)) {
    args.push("--dry-run");
  }
  if (Number.isInteger(options.concurrency) && options.concurrency > 1) {
    args.push("--concurrency", String(options.concurrency));
  }
  if (readOptionalString(options.quality, 20)) {
    args.push("--quality", options.quality);
  }
  if (readOptionalString(options.size, 20)) {
    args.push("--size", options.size);
  }
  if (Number.isInteger(options.timeoutMs)) {
    args.push("--timeout-ms", String(options.timeoutMs));
  }
  return args;
}

function appendBrandLogoJobLogs(job, source, chunk) {
  if (!job || !chunk) {
    return;
  }
  const lines = String(chunk)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) {
    return;
  }
  const logs = Array.isArray(job.logs) ? job.logs : [];
  for (const line of lines) {
    logs.push({
      at: new Date().toISOString(),
      source,
      message: line.slice(0, 1000)
    });
  }
  if (logs.length > BRAND_LOGO_JOB_LOG_LIMIT) {
    logs.splice(0, logs.length - BRAND_LOGO_JOB_LOG_LIMIT);
  }
  job.logs = logs;
  job.updatedAt = new Date().toISOString();
}

function buildBrandLogoJobSnapshot(job = brandLogoGenerationJob) {
  if (!job) {
    return {
      status: "idle",
      running: false,
      jobId: "",
      pid: null,
      startedAt: "",
      completedAt: "",
      exitCode: null,
      error: "",
      options: {},
      args: [],
      logs: []
    };
  }
  return {
    status: readOptionalString(job.status, 40) || "idle",
    running: readBoolean(job.running, false),
    jobId: readOptionalString(job.jobId, 120),
    pid: Number.isInteger(job.pid) ? job.pid : null,
    startedAt: readOptionalString(job.startedAt, 80),
    completedAt: readOptionalString(job.completedAt, 80),
    updatedAt: readOptionalString(job.updatedAt, 80),
    exitCode: Number.isInteger(job.exitCode) ? job.exitCode : null,
    signal: readOptionalString(job.signal, 40),
    error: readOptionalString(job.error, 500),
    options: job.options && typeof job.options === "object" ? { ...job.options } : {},
    args: Array.isArray(job.args) ? [...job.args] : [],
    logs: Array.isArray(job.logs) ? [...job.logs] : []
  };
}

function startBrandLogoGenerationJob(options = {}) {
  if (brandLogoGenerationJob?.running) {
    throw new HttpError(409, "A brand logo generation job is already running.");
  }

  const args = buildBrandLogoGenerationArgs(options);
  const now = new Date().toISOString();
  const child = spawn(process.execPath, [BRAND_LOGO_GENERATOR_SCRIPT, ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  const job = {
    jobId: `brand-logos-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    running: true,
    status: "running",
    pid: child.pid,
    startedAt: now,
    completedAt: "",
    updatedAt: now,
    exitCode: null,
    signal: "",
    error: "",
    options: {
      ...options,
      brandFilter: Array.isArray(options.brandFilter) ? [...options.brandFilter] : [],
      advertiserFilter: Array.isArray(options.advertiserFilter) ? [...options.advertiserFilter] : []
    },
    args,
    logs: []
  };
  brandLogoGenerationJob = job;
  appendBrandLogoJobLogs(job, "system", `Started brand logo generation with PID ${child.pid || "pending"}.`);

  child.stdout?.on("data", (chunk) => {
    appendBrandLogoJobLogs(job, "stdout", chunk);
  });
  child.stderr?.on("data", (chunk) => {
    appendBrandLogoJobLogs(job, "stderr", chunk);
  });
  child.on("error", (error) => {
    job.running = false;
    job.status = "failed";
    job.error = readOptionalString(error?.message, 500) || "The generator process failed to start.";
    job.completedAt = new Date().toISOString();
    job.updatedAt = job.completedAt;
  });
  child.on("exit", (code, signal) => {
    job.running = false;
    job.exitCode = Number.isInteger(code) ? code : null;
    job.signal = readOptionalString(signal, 40);
    job.completedAt = new Date().toISOString();
    job.updatedAt = job.completedAt;
    job.status = code === 0 ? "completed" : "failed";
    if (code !== 0 && !job.error) {
      job.error = signal
        ? `Brand logo generation exited with signal ${signal}.`
        : `Brand logo generation exited with code ${code}.`;
    }
    appendBrandLogoJobLogs(
      job,
      "system",
      code === 0
        ? "Brand logo generation completed successfully."
        : job.error || "Brand logo generation exited unsuccessfully."
    );
  });

  return buildBrandLogoJobSnapshot(job);
}

function readRequiredDateInput(value, fieldName) {
  const parsed = readRequiredString(value, fieldName, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
    throw new HttpError(400, `${fieldName} must be in YYYY-MM-DD format.`);
  }
  const date = new Date(`${parsed}T00:00:00Z`);
  if (Number.isNaN(date.valueOf())) {
    throw new HttpError(400, `${fieldName} must be a valid date.`);
  }
  return parsed;
}

function computeInclusiveDayCount(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return 0;
  }
  const diffDays = Math.floor((end.valueOf() - start.valueOf()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 ? diffDays + 1 : 0;
}

function buildDefaultGoalRateCard() {
  return Object.fromEntries(
    SCREEN_TYPES.map((screenType) => [screenType, Number(SCREEN_TYPE_DEFAULT_CPMS[screenType] || 10)])
  );
}

function getStoredScreenTypeRates(db) {
  return readGoalScreenTypeRateCard(db?.pricing?.screenTypeRates);
}

function readGoalScreenTypeRateCard(value) {
  const raw = value && typeof value === "object" ? value : {};
  const defaults = buildDefaultGoalRateCard();
  for (const screenType of SCREEN_TYPES) {
    const parsed = Number(raw[screenType]);
    defaults[screenType] = Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : defaults[screenType];
  }
  return defaults;
}

function getGoalScreenTypeCpm(rateCard, screenType) {
  const defaults = buildDefaultGoalRateCard();
  const normalizedType = readOptionalString(screenType, 80);
  const parsed = Number(rateCard?.[normalizedType]);
  if (Number.isFinite(parsed) && parsed >= 0) {
    return Math.round(parsed);
  }
  return Number(defaults[normalizedType] || 10);
}

function estimateGoalDailyImpressions(screen, placementRole, storeSignals = {}, options = {}) {
  const normalizedType = readOptionalString(screen?.screenType, 80) || "Horizontal Screen";
  const normalizedRole = readOptionalString(placementRole, 40) || getGoalScreenRole(screen);
  const refreshInterval =
    options && typeof options === "object"
      ? readRefreshInterval(options.refreshInterval)
      : readRefreshInterval(options);
  const shareOfScreen =
    options && typeof options === "object" ? clampNumber(Number(options.shareOfScreen ?? 1), 0.01, 1) : 1;
  const baseFootTraffic = Math.max(6000, Math.round(Number(storeSignals?.inferredFootTraffic || 26000)));
  const estimatedTransactions = Math.max(1, Math.round(Number(storeSignals?.estimatedTransactions || 20000)));
  const screenFactor = Number(SCREEN_TYPE_IMPRESSION_FACTORS[normalizedType] || 0.24);
  const roleFactor = Number(PLACEMENT_ROLE_IMPRESSION_FACTORS[normalizedRole] || PLACEMENT_ROLE_IMPRESSION_FACTORS.general);
  const cadence = readRefreshInterval(refreshInterval);
  const cadenceFactor = clampNumber(Math.sqrt(DEFAULT_REFRESH_INTERVAL / cadence), 0.85, 1.2);
  const footTrafficIndex = clampNumber(Number(storeSignals?.footTrafficIndex || 0.55), 0, 1);
  const checkoutIntentIndex = clampNumber(Number(storeSignals?.checkoutIntentIndex || 0.55), 0, 1);
  const demandFactor =
    normalizedRole === "checkout"
      ? clampNumber(0.95 + checkoutIntentIndex * 0.28, 0.95, 1.24)
      : normalizedRole === "entrance"
        ? clampNumber(0.94 + footTrafficIndex * 0.26, 0.94, 1.2)
        : clampNumber(0.92 + footTrafficIndex * 0.22, 0.92, 1.16);
  const transactionFloor = normalizedRole === "checkout" ? estimatedTransactions * 0.18 * shareOfScreen : 0;
  const fullScreenEstimate = Math.round(baseFootTraffic * screenFactor * roleFactor * cadenceFactor * demandFactor);
  const estimated = Math.round(fullScreenEstimate * shareOfScreen);
  const minimumEstimate = Math.max(80, Math.round(800 * shareOfScreen));
  const maximumEstimate = Math.max(minimumEstimate, Math.round(22000 * shareOfScreen));
  return Math.max(minimumEstimate, Math.min(maximumEstimate, Math.max(transactionFloor, estimated)));
}

function computeGoalPlacementCost(cpm, estimatedImpressions) {
  return Math.max(0, Math.round((Number(cpm || 0) * Math.max(0, Number(estimatedImpressions || 0))) / 1000));
}

function readLineItemShareSlots(value, fallback = null, maxSlots = SCREEN_SHARE_SLOT_MAX) {
  return readOptionalInteger(value, fallback, { min: 1, max: Math.max(1, Number(maxSlots || SCREEN_SHARE_SLOT_MAX)) });
}

function readScreenShareSlotCount(value, fallback = SCREEN_SHARE_SLOT_COUNT) {
  return readOptionalInteger(value, fallback, { min: 1, max: SCREEN_SHARE_SLOT_MAX });
}

function readSellableShareSlots(value, totalSlots, fallback = DEFAULT_SELLABLE_SHARE_SLOTS) {
  const resolvedTotalSlots = readScreenShareSlotCount(totalSlots, SCREEN_SHARE_SLOT_COUNT);
  return readOptionalInteger(value, fallback, { min: 1, max: resolvedTotalSlots });
}

function resolveScreenShareConfig(screen = {}) {
  const totalSlots = readScreenShareSlotCount(screen?.screenShareSlots, SCREEN_SHARE_SLOT_COUNT);
  const sellableShareSlots = readSellableShareSlots(
    screen?.defaultSellableShareSlots,
    totalSlots,
    Math.min(DEFAULT_SELLABLE_SHARE_SLOTS, totalSlots)
  );

  return {
    totalSlots,
    sellableShareSlots,
    shareRatio: sellableShareSlots / totalSlots,
    shareLabel: formatLineItemShareLabel(sellableShareSlots / totalSlots, totalSlots)
  };
}

function formatLineItemShareLabel(shareRatio, totalSlots = SCREEN_SHARE_SLOT_COUNT) {
  const normalizedRatio = clampNumber(Number(shareRatio || 0), 0, 1);
  if (normalizedRatio <= 0) {
    return "";
  }
  const scaledSlots = normalizedRatio * Math.max(1, totalSlots);
  const roundedSlots = Math.round(scaledSlots);
  if (Math.abs(scaledSlots - roundedSlots) <= 0.001 && roundedSlots >= 1 && roundedSlots <= totalSlots) {
    return `${roundedSlots}/${totalSlots} share`;
  }
  return `${Math.max(1, Math.round(normalizedRatio * 100))}% share`;
}

function resolveShareTurnCount(shareRatio, totalSlots = SCREEN_SHARE_SLOT_COUNT) {
  const normalizedRatio = clampNumber(Number(shareRatio || 0), 0, 1);
  const normalizedSlots = Math.max(1, readScreenShareSlotCount(totalSlots, SCREEN_SHARE_SLOT_COUNT));
  const scaledSlots = normalizedRatio * normalizedSlots;
  const roundedSlots = Math.round(scaledSlots);
  if (Math.abs(scaledSlots - roundedSlots) <= 0.001 && roundedSlots >= 0 && roundedSlots <= normalizedSlots) {
    return roundedSlots;
  }
  return 0;
}

function resolveLineItemDeliveryShares(lineItems = [], totalSlots = SCREEN_SHARE_SLOT_COUNT) {
  const source = Array.isArray(lineItems) ? lineItems.filter(Boolean) : [];
  if (source.length === 0) {
    return [];
  }

  const explicitEntries = source
    .map((lineItem) => ({
      lineItem,
      explicitSlots: readLineItemShareSlots(lineItem?.deliveryShareSlots, null, totalSlots)
    }))
    .filter((entry) => Number.isFinite(entry.explicitSlots) && entry.explicitSlots > 0);

  if (explicitEntries.length === 0) {
    const equalShare = 1 / source.length;
    return source.map((lineItem) => ({
      lineItem,
      weight: 1,
      shareRatio: equalShare,
      shareLabel: formatLineItemShareLabel(equalShare, source.length)
    }));
  }

  const explicitTotal = explicitEntries.reduce((sum, entry) => sum + Number(entry.explicitSlots || 0), 0);
  const implicitEntries = source.filter(
    (lineItem) => !explicitEntries.some((entry) => entry.lineItem === lineItem)
  );
  const remainingWeight = Math.max(0, totalSlots - explicitTotal);
  const implicitWeight = implicitEntries.length > 0 ? remainingWeight / implicitEntries.length : 0;
  const allocatedWeight = explicitTotal + implicitEntries.length * implicitWeight;
  const totalWeight = Math.max(totalSlots, allocatedWeight);

  if (allocatedWeight <= 0) {
    const equalShare = 1 / source.length;
    return source.map((lineItem) => ({
      lineItem,
      weight: 1,
      shareRatio: equalShare,
      shareLabel: formatLineItemShareLabel(equalShare, source.length)
    }));
  }

  return source.map((lineItem) => {
    const explicitSlots = readLineItemShareSlots(lineItem?.deliveryShareSlots, null, totalSlots);
    const weight = explicitSlots ?? implicitWeight;
    const shareRatio = weight > 0 ? weight / totalWeight : 0;
    return {
      lineItem,
      weight,
      shareRatio,
      shareLabel: formatLineItemShareLabel(shareRatio, totalSlots)
    };
  });
}

function isAutoSeededDemoLineItem(lineItem = {}) {
  const lineItemId = readOptionalString(lineItem?.lineItemId, 120);
  if (/^LI-DEMO-/i.test(lineItemId)) {
    return true;
  }

  const products = Array.isArray(lineItem?.products) ? lineItem.products : [];
  return products.some((product) => {
    const attributes = parseJsonObject(product?.RenderingAttributes ?? product?.renderingAttributes);
    return readOptionalString(attributes?.demoPresetId, 120) === DEMO_PRESET_ID;
  });
}

function getEffectiveScreenLineItems(screen = {}) {
  return (Array.isArray(screen?.lineItems) ? screen.lineItems : []).filter(
    (lineItem) => lineItem && !isAutoSeededDemoLineItem(lineItem)
  );
}

function lineItemOverlapsWindow(lineItem, window = {}) {
  const windowStartMs = Date.parse(readIsoDateOr(window?.activeFrom, "1970-01-01T00:00:00.000Z"));
  const windowEndMs = Date.parse(readIsoDateOr(window?.activeTo, "9999-12-31T23:59:59.999Z"));
  const lineItemStartMs = Date.parse(readIsoDateOr(lineItem?.activeFrom, "1970-01-01T00:00:00.000Z"));
  const lineItemEndMs = Date.parse(readIsoDateOr(lineItem?.activeTo, "9999-12-31T23:59:59.999Z"));
  return lineItemStartMs <= windowEndMs && lineItemEndMs >= windowStartMs;
}

function resolveScreenShareAvailability(screen, { goal = null, planId = "" } = {}) {
  const source = getEffectiveScreenLineItems(screen);
  const goalWindow = resolveGoalFlightWindow(goal || null);
  const shareConfig = resolveScreenShareConfig(screen);
  const overlappingLineItems = source.filter((lineItem) => lineItemOverlapsWindow(lineItem, goalWindow));
  const reservedSlots = overlappingLineItems.reduce((sum, lineItem) => {
    if (isManagedGoalLineItemForGoal(lineItem, goal || {}, planId)) {
      return sum;
    }
    return sum + Number(readLineItemShareSlots(lineItem?.deliveryShareSlots, 0, shareConfig.totalSlots) || 0);
  }, 0);
  const reclaimableSlots = overlappingLineItems.reduce((sum, lineItem) => {
    if (!isManagedGoalLineItemForGoal(lineItem, goal || {}, planId)) {
      return sum;
    }
    return sum + Number(readLineItemShareSlots(lineItem?.deliveryShareSlots, 0, shareConfig.totalSlots) || 0);
  }, 0);
  const availableSlots = Math.max(0, shareConfig.totalSlots - reservedSlots);

  return {
    goalWindow,
    overlappingLineItems,
    screenShareSlots: shareConfig.totalSlots,
    sellableShareSlots: shareConfig.sellableShareSlots,
    shareRatio: shareConfig.shareRatio,
    shareLabel: shareConfig.shareLabel,
    reservedSlots,
    reclaimableSlots,
    availableSlots,
    hasCapacity: availableSlots >= shareConfig.sellableShareSlots
  };
}

function rankGoalPlacementsForBudget(placements = []) {
  return [...(Array.isArray(placements) ? placements : [])].sort((left, right) => {
    return (
      Number(left?.budgetRank || 0) - Number(right?.budgetRank || 0) ||
      Number(right?.score || 0) - Number(left?.score || 0) ||
      Number(right?.confidence || 0) - Number(left?.confidence || 0) ||
      Number(left?.placementCost || 0) - Number(right?.placementCost || 0) ||
      readOptionalString(left?.screenId, 80).localeCompare(readOptionalString(right?.screenId, 80))
    );
  });
}

function resolveGoalBudgetSelection(placements = [], selectedSpend = Number.POSITIVE_INFINITY) {
  const orderedPlacements = rankGoalPlacementsForBudget(placements);
  const maxSpend = Math.round(
    orderedPlacements.reduce((sum, placement) => sum + Number(placement?.placementCost || 0), 0)
  );
  const maxEstimatedImpressions = Math.round(
    orderedPlacements.reduce((sum, placement) => sum + Number(placement?.estimatedImpressions || 0), 0)
  );
  const normalizedSelectedSpend = Number.isFinite(Number(selectedSpend))
    ? Math.max(0, Math.min(maxSpend, Math.round(Number(selectedSpend))))
    : maxSpend;
  const fundedPlacements = [];
  const heldBackPlacements = [];
  const fundedScreenIds = [];
  const heldBackScreenIds = [];
  let fundedSpend = 0;
  let fundedEstimatedImpressions = 0;

  for (const placement of orderedPlacements) {
    const placementCost = Math.max(0, Math.round(Number(placement?.placementCost || 0)));
    const estimatedImpressions = Math.max(0, Math.round(Number(placement?.estimatedImpressions || 0)));
    if (fundedSpend + placementCost <= normalizedSelectedSpend) {
      fundedPlacements.push(placement);
      fundedScreenIds.push(readOptionalString(placement?.screenId, 80));
      fundedSpend += placementCost;
      fundedEstimatedImpressions += estimatedImpressions;
    } else {
      heldBackPlacements.push(placement);
      heldBackScreenIds.push(readOptionalString(placement?.screenId, 80));
    }
  }

  return {
    maxSpend,
    maxEstimatedImpressions,
    selectedSpend: normalizedSelectedSpend,
    fundedSpend,
    fundedEstimatedImpressions,
    heldBackEstimatedImpressions: Math.max(0, maxEstimatedImpressions - fundedEstimatedImpressions),
    fundedPlacements,
    heldBackPlacements,
    fundedScreenIds: fundedScreenIds.filter(Boolean),
    heldBackScreenIds: heldBackScreenIds.filter(Boolean)
  };
}

function buildGoalBudget(goal, placements = [], selectedSpend = Number.POSITIVE_INFINITY) {
  const selection = resolveGoalBudgetSelection(placements, selectedSpend);
  return {
    pricingModelId: GOAL_PRICING_MODEL.id,
    pricingModelLabel: GOAL_PRICING_MODEL.label,
    currencySymbol: GOAL_PRICING_MODEL.currencySymbol,
    pricingUnit: GOAL_PRICING_MODEL.unit,
    deliveryMetric: GOAL_PRICING_MODEL.deliveryMetric,
    flightDays: Number(goal?.flightDays || 0),
    maxSpend: selection.maxSpend,
    maxEstimatedImpressions: selection.maxEstimatedImpressions,
    selectedSpend: selection.selectedSpend,
    fundedSpend: selection.fundedSpend,
    fundedEstimatedImpressions: selection.fundedEstimatedImpressions,
    heldBackEstimatedImpressions: selection.heldBackEstimatedImpressions,
    fundedPlacementCount: selection.fundedPlacements.length,
    heldBackPlacementCount: selection.heldBackPlacements.length,
    fundedScreenIds: selection.fundedScreenIds,
    heldBackScreenIds: selection.heldBackScreenIds
  };
}

function slugify(value) {
  return readOptionalString(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseScreenSize(value) {
  const normalized = readOptionalString(value, 20).toLowerCase();
  const match = normalized.match(/^(\d{3,5})x(\d{3,5})$/);
  if (!match) {
    return {
      width: 0,
      height: 0,
      normalized: "",
      orientation: ""
    };
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  return {
    width,
    height,
    normalized: `${width}x${height}`,
    orientation: width >= height ? "landscape" : "portrait"
  };
}

function inferDeviceUserAgentHints(screenType) {
  const normalizedType = slugify(screenType);
  if (normalizedType === "kiosk") {
    return ["android", "kiosk", "chrome"];
  }
  if (normalizedType === "digital-menu-board") {
    return ["tizen", "webos", "smart-tv", "tv"];
  }
  return ["tizen", "webos", "smart-tv", "tv"];
}

function buildScreenDeviceHints({
  screenId = "",
  storeId = "",
  pageId = "",
  location = "",
  screenType = "",
  screenSize = "",
  resolverId = "",
  rawHints = null
} = {}) {
  const size = parseScreenSize(screenSize);
  const hints = rawHints && typeof rawHints === "object" ? rawHints : {};
  const requestedUserAgentHints = readStringArray(hints.userAgentHints, 8, 40).map((entry) => entry.toLowerCase());
  const defaultResolverId =
    readOptionalString(resolverId, 120) ||
    [slugify(storeId), slugify(location), slugify(screenId)].filter(Boolean).join("-") ||
    slugify(screenId) ||
    "screen";

  return {
    sharedPlayerUrl: SHARED_PLAYER_URL,
    resolverId: readOptionalString(hints.resolverId, 120) || defaultResolverId.slice(0, 120),
    viewport: readOptionalString(hints.viewport, 20) || size.normalized,
    orientation: readOptionalString(hints.orientation, 20) || size.orientation,
    pageToken: readOptionalString(hints.pageToken, 80) || slugify(pageId),
    locationToken: readOptionalString(hints.locationToken, 80) || slugify(location),
    storeId: readOptionalString(hints.storeId, 80) || readOptionalString(storeId, 80),
    screenTypeToken: readOptionalString(hints.screenTypeToken, 80) || slugify(screenType),
    userAgentHints: requestedUserAgentHints.length > 0 ? requestedUserAgentHints : inferDeviceUserAgentHints(screenType)
  };
}

function getScreenDeviceHints(screen) {
  return buildScreenDeviceHints({
    screenId: readOptionalString(screen?.screenId, 80),
    storeId: readOptionalString(screen?.storeId, 80),
    pageId: readOptionalString(screen?.pageId, 40),
    location: readOptionalString(screen?.location, 80),
    screenType: readOptionalString(screen?.screenType, 80),
    screenSize: readOptionalString(screen?.screenSize, 20),
    rawHints: screen?.deviceHints
  });
}

function buildScreenRequestContext(req) {
  const userAgent = readOptionalString(req.get("user-agent"), 500).toLowerCase();
  const platform = readOptionalString(req.get("sec-ch-ua-platform") || req.query.platform, 80)
    .toLowerCase()
    .replaceAll('"', "");
  const language = readOptionalString(req.get("accept-language"), 120).toLowerCase();
  const viewport = parseScreenSize(req.query.viewport || req.get("x-screen-viewport"));
  const explicitResolverId = readOptionalString(req.query.deviceId || req.get("x-device-id"), 120)
    .toLowerCase();
  const deviceProfile = readOptionalString(req.query.deviceProfile || req.get("x-device-profile"), 120)
    .toLowerCase();
  const orientation =
    readOptionalString(req.query.orientation || req.get("x-screen-orientation"), 20).toLowerCase() ||
    viewport.orientation;

  return {
    userAgent,
    platform,
    language,
    viewport,
    orientation,
    explicitResolverId,
    deviceProfile
  };
}

function scoreScreenForRequest(screen, context) {
  const hints = getScreenDeviceHints(screen);
  const normalizedScreenId = readOptionalString(screen.screenId, 80).toLowerCase();
  const resolverId = readOptionalString(hints.resolverId, 120).toLowerCase();
  let score = 0;
  let resolvedBy = "shared-url fallback";

  if (context.explicitResolverId && (context.explicitResolverId === resolverId || context.explicitResolverId === normalizedScreenId)) {
    return { score: 100, resolvedBy: "resolver id", hints };
  }

  if (context.deviceProfile) {
    if (resolverId && context.deviceProfile.includes(resolverId)) {
      return { score: 90, resolvedBy: "device profile", hints };
    }
    if (hints.locationToken && context.deviceProfile.includes(hints.locationToken)) {
      score += 12;
      resolvedBy = "device profile";
    }
    if (hints.pageToken && context.deviceProfile.includes(hints.pageToken)) {
      score += 9;
      resolvedBy = "device profile";
    }
  }

  if (context.viewport.normalized && hints.viewport && context.viewport.normalized === hints.viewport) {
    score += 16;
    resolvedBy = "viewport fingerprint";
  }

  if (context.orientation && hints.orientation && context.orientation === hints.orientation) {
    score += 4;
    if (resolvedBy === "shared-url fallback") {
      resolvedBy = "orientation fingerprint";
    }
  }

  if (context.platform && /tv|smart/i.test(context.platform)) {
    score += 2;
  }

  let userAgentMatches = 0;
  for (const hint of Array.isArray(hints.userAgentHints) ? hints.userAgentHints : []) {
    if (hint && context.userAgent.includes(hint)) {
      userAgentMatches += 1;
    }
  }
  if (userAgentMatches > 0) {
    score += Math.min(6, userAgentMatches * 2);
    resolvedBy = "browser fingerprint";
  }

  if (hints.storeId && context.deviceProfile && context.deviceProfile.includes(slugify(hints.storeId))) {
    score += 2;
  }

  if (context.language.includes("en")) {
    score += 0.5;
  }

  return { score, resolvedBy, hints };
}

function resolveScreenRequest(db, req) {
  const explicitScreenId = readOptionalString(req.query.screenId, 80);
  if (explicitScreenId) {
    const screen = (db.screens || []).find((entry) => entry.screenId === explicitScreenId);
    if (!screen) {
      throw new HttpError(404, `Screen ${explicitScreenId} was not found.`);
    }
    return {
      screen,
      resolvedBy: "screenId override",
      requestContext: buildScreenRequestContext(req)
    };
  }

  const screens = Array.isArray(db.screens) ? db.screens : [];
  if (screens.length === 0) {
    throw new HttpError(404, "No screens are configured yet.");
  }

  const context = buildScreenRequestContext(req);
  const scored = screens
    .map((screen) => ({
      screen,
      ...scoreScreenForRequest(screen, context)
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.screen.screenId.localeCompare(right.screen.screenId);
    });

  const best = scored[0];
  if (!best) {
    throw new HttpError(404, "No screen match could be resolved.");
  }

  const topScore = Number(best.score || 0);
  const tiedMatches = scored.filter((entry) => Number(entry.score || 0) === topScore);
  if (!context.explicitResolverId) {
    if (topScore <= 0) {
      throw new HttpError(
        409,
        "Shared player URL could not resolve a screen. Provide a deviceId/x-device-id or a unique device profile."
      );
    }
    if (tiedMatches.length > 1 && topScore < 90) {
      throw new HttpError(
        409,
        `Shared player URL matched ${tiedMatches.length} screens equally. Provide a deviceId/x-device-id or a unique device profile.`
      );
    }
  }

  return {
    screen: best.screen,
    resolvedBy: best.resolvedBy,
    requestContext: context
  };
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

function normalizeProductFeedItem(rawProduct, index, { includeStockByStore = false } = {}) {
  const product = rawProduct && typeof rawProduct === "object" ? rawProduct : {};
  const sku = normalizeSku(product.sku || product.ProductId || `SKU-FEED-${index + 1}`);
  const name = readOptionalString(product.name || product.ProductName, 180) || `Feed Product ${index + 1}`;
  const category = readOptionalString(product.category, 80).toLowerCase() || "general";
  const brand = readOptionalString(product.brand, 80) || "Store Brand";
  const logo = normalizeBrandLogoPath(product.logo || product.brandLogo);
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
  const normalized = {
    sku,
    name,
    category,
    brand,
    logo,
    productPage,
    image,
    price,
    comparePrice,
    rating,
    advertiserId,
    tags,
    stockSummary: buildGeneratedDemoStockSummary({ sku, category, tags })
  };

  if (includeStockByStore) {
    normalized.stockByStore = DEMO_STOCK_BY_SKU[sku] || buildGeneratedDemoStockByStore({ sku, category, tags });
  }

  return normalized;
}

function cloneProductFeedItem(product = {}, { includeStockByStore = false } = {}) {
  const cloned = {
    ...product,
    tags: [...(product.tags || [])],
    stockSummary: { ...(product.stockSummary || {}) }
  };
  if (includeStockByStore && product.stockByStore && typeof product.stockByStore === "object") {
    cloned.stockByStore = { ...product.stockByStore };
  }
  return cloned;
}

async function readProductFeed(options = {}) {
  const includeStockByStore = readBoolean(options?.includeStockByStore, false);
  let currentMtimeMs = null;
  try {
    const stats = await fs.stat(PRODUCT_FEED_FILE);
    currentMtimeMs = Number.isFinite(stats?.mtimeMs) ? stats.mtimeMs : null;
  } catch {
    currentMtimeMs = null;
  }

  if (
    !includeStockByStore &&
    Array.isArray(cachedProductFeed) &&
    cachedProductFeedMtimeMs !== null &&
    currentMtimeMs !== null &&
    cachedProductFeedMtimeMs === currentMtimeMs
  ) {
    return cachedProductFeed.map((product) => cloneProductFeedItem(product));
  }

  try {
    const raw = await fs.readFile(PRODUCT_FEED_FILE, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
    const source = Array.isArray(parsed) ? parsed : PRODUCT_FEED_DEFAULT;
    const normalized = source.map((product, index) => normalizeProductFeedItem(product, index, { includeStockByStore }));
    if (!includeStockByStore) {
      cachedProductFeed = normalized;
      cachedProductFeedMtimeMs = currentMtimeMs;
    }
    return normalized;
  } catch {
    const normalized = PRODUCT_FEED_DEFAULT.map((product, index) => normalizeProductFeedItem(product, index, { includeStockByStore }));
    if (!includeStockByStore) {
      cachedProductFeed = normalized;
      cachedProductFeedMtimeMs = currentMtimeMs;
    }
    return normalized;
  }
}

function buildProductAccounts(feed = []) {
  return [
    ...new Map(
      (Array.isArray(feed) ? feed : [])
        .filter((product) => product.advertiserId)
        .map((product) => [
          product.advertiserId,
          {
            advertiserId: product.advertiserId,
            brand: product.brand,
            logo: normalizeBrandLogoPath(product.logo || product.brandLogo)
          }
        ])
    ).values()
  ].sort((left, right) => left.brand.localeCompare(right.brand) || left.advertiserId.localeCompare(right.advertiserId));
}

async function readProductImageManifest() {
  try {
    const raw = await fs.readFile(PRODUCT_IMAGE_MANIFEST_FILE, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
    return parsed && typeof parsed === "object" ? parsed : { items: {} };
  } catch {
    return { items: {} };
  }
}

async function readBrandLogoManifest() {
  try {
    const raw = await fs.readFile(BRAND_LOGO_MANIFEST_FILE, "utf8");
    const parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
    return parsed && typeof parsed === "object" ? parsed : { items: {} };
  } catch {
    return { items: {} };
  }
}

async function buildProductImageProgressSnapshot() {
  const [feed, manifest] = await Promise.all([readProductFeed(), readProductImageManifest()]);
  const items = manifest?.items && typeof manifest.items === "object" ? Object.values(manifest.items) : [];
  const total = Array.isArray(feed) ? feed.length : 0;
  const generatedBasePath = PRODUCT_GENERATED_IMAGE_BASE_PATH.replace(/\/+$/, "");
  const generatedSkuSet = new Set(
    (Array.isArray(feed) ? feed : [])
      .filter((product) => {
        const image = readOptionalString(product?.image, 500);
        return image === generatedBasePath || image.startsWith(`${generatedBasePath}/`);
      })
      .map((product) => normalizeSku(product?.sku))
      .filter(Boolean)
  );
  const generated = generatedSkuSet.size;
  const failed = items.filter((entry) => {
    const sku = normalizeSku(entry?.sku);
    return readOptionalString(entry?.status, 40) === "failed" && (!sku || !generatedSkuSet.has(sku));
  }).length;
  const remaining = Math.max(0, total - generated);
  const untouched = Math.max(0, remaining - failed);
  const processed = generated;
  const percentage = total > 0 ? Math.round((generated / total) * 1000) / 10 : 0;

  return {
    total,
    generated,
    failed,
    processed,
    remaining,
    untouched,
    percentage,
    running: Boolean(productImageGenerationJob?.running),
    jobId: readOptionalString(productImageGenerationJob?.jobId, 120),
    updatedAt: readOptionalString(manifest?.updatedAt, 80)
  };
}

async function buildBrandLogoProgressSnapshot() {
  const [feed, manifest] = await Promise.all([readProductFeed(), readBrandLogoManifest()]);
  const accounts = buildProductAccounts(feed);
  const items = manifest?.items && typeof manifest.items === "object" ? Object.values(manifest.items) : [];
  const total = accounts.length;
  const generatedBasePath = BRAND_LOGO_BASE_PATH.replace(/\/+$/, "");
  const generatedAccountIds = new Set(
    accounts
      .filter((account) => {
        const logo = readOptionalString(account?.logo, 500);
        return logo === generatedBasePath || logo.startsWith(`${generatedBasePath}/`);
      })
      .map((account) => readOptionalString(account?.advertiserId, 120))
      .filter(Boolean)
  );
  const generated = generatedAccountIds.size;
  const failed = items.filter((entry) => {
    const advertiserId = readOptionalString(entry?.advertiserId, 120);
    return readOptionalString(entry?.status, 40) === "failed" && (!advertiserId || !generatedAccountIds.has(advertiserId));
  }).length;
  const remaining = Math.max(0, total - generated);
  const untouched = Math.max(0, remaining - failed);
  const processed = generated;
  const percentage = total > 0 ? Math.round((generated / total) * 1000) / 10 : 0;

  return {
    total,
    generated,
    failed,
    processed,
    remaining,
    untouched,
    percentage,
    running: Boolean(brandLogoGenerationJob?.running),
    jobId: readOptionalString(brandLogoGenerationJob?.jobId, 120),
    updatedAt: readOptionalString(manifest?.updatedAt, 80)
  };
}

function buildProductFeedLookup(feed = []) {
  return new Map(
    (Array.isArray(feed) ? feed : [])
      .map((product) => [normalizeSku(product?.sku), product])
      .filter(([sku]) => Boolean(sku))
  );
}

function preferFeedImageForProduct(product, feedLookup) {
  const sku = normalizeSku(
    readOptionalString(product?.ProductId, 80) ||
      readOptionalString(product?.productId, 80) ||
      readOptionalString(product?.sku, 80)
  );
  if (!sku || !(feedLookup instanceof Map) || !feedLookup.has(sku)) {
    return product;
  }
  const feedProduct = feedLookup.get(sku);
  const feedImage = readOptionalString(feedProduct?.image, 500);
  const feedLogo = normalizeBrandLogoPath(feedProduct?.logo || feedProduct?.brandLogo);
  if (!feedImage) {
    return feedLogo
      ? {
          ...product,
          BrandLogo: feedLogo,
          brandLogo: feedLogo
        }
      : product;
  }
  return {
    ...product,
    Image: feedImage,
    image: feedImage,
    BrandLogo: feedLogo || readOptionalString(product?.BrandLogo || product?.brandLogo, 500),
    brandLogo: feedLogo || readOptionalString(product?.BrandLogo || product?.brandLogo, 500)
  };
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
  const targetSkuIds = targetProducts.map((product) => normalizeSku(product.sku)).filter(Boolean);
  if (targetSkuIds.length > 0 && screenContainsAnyTargetSku(screen, targetSkuIds)) {
    return 0.72;
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
  const existingMatches = getExistingTargetProductsForScreen(screen, targetProducts);
  const relevant = scored
    .filter((entry) => entry.hasStrongContextMatch && entry.score >= GOAL_RELEVANCE_THRESHOLD)
    .map((entry) => entry.product);
  return uniqueBySku([...existingMatches, ...relevant]).slice(0, limit);
}

function isObjectivePreferredScreen(screen, objectiveId) {
  const pageId = readOptionalString(screen?.pageId, 40).toLowerCase();
  const location = readOptionalString(screen?.location, 80).toLowerCase();
  const screenType = readOptionalString(screen?.screenType, 80).toLowerCase();

  switch (objectiveId) {
    case "checkout-attach":
      return pageId.includes("checkout") || location.includes("checkout") || screenType.includes("kiosk");
    case "clearance":
      return pageId.includes("aisle") || location.includes("aisle") || screenType.includes("shelf") || screenType.includes("endcap");
    case "premium":
      return pageId.includes("entrance") || location.includes("entrance") || screenType.includes("vertical");
    case "awareness":
    default:
      return pageId.includes("entrance") || location.includes("entrance") || pageId.includes("electronics") || screenType.includes("vertical");
  }
}

function pickGoalProductsForScreenWithObjective(screen, targetProducts, templateId, objectiveId) {
  const matchedProducts = pickGoalProductsForScreen(screen, targetProducts, templateId);
  if (matchedProducts.length > 0) {
    return matchedProducts;
  }
  if (!isObjectivePreferredScreen(screen, objectiveId)) {
    return [];
  }

  const limit = getTemplateProductLimit(templateId);
  return uniqueBySku(targetProducts).slice(0, limit);
}

function filterGoalScopeScreens(screens, goal, { ignorePage = false } = {}) {
  return (Array.isArray(screens) ? screens : []).filter((screen) => {
    if (goal.storeId && screen.storeId !== goal.storeId) {
      return false;
    }
    if (!ignorePage && goal.pageId && screen.pageId !== goal.pageId) {
      return false;
    }
    return true;
  });
}

function filterScreensByStoreIds(screens, storeIds = []) {
  const allowedStoreIds = new Set((Array.isArray(storeIds) ? storeIds : []).map((storeId) => readOptionalString(storeId, 80)).filter(Boolean));
  if (allowedStoreIds.size === 0) {
    return Array.isArray(screens) ? [...screens] : [];
  }
  return (Array.isArray(screens) ? screens : []).filter((screen) => allowedStoreIds.has(readOptionalString(screen.storeId, 80)));
}

function findCompatibleGoalScreens(goal, screens, targetProducts) {
  if (!Array.isArray(targetProducts) || targetProducts.length === 0) {
    return Array.isArray(screens) ? [...screens] : [];
  }
  return (Array.isArray(screens) ? screens : []).filter((screen) => {
    const relevance = computeProductRelevanceForScreen(screen, targetProducts);
    const preferredForObjective = isObjectivePreferredScreen(screen, goal.objective);
    if (relevance < GOAL_RELEVANCE_THRESHOLD && !preferredForObjective) {
      return false;
    }
    const recommendedTemplateId = computeGoalTemplateId(screen, goal.objective);
    return pickGoalProductsForScreenWithObjective(screen, targetProducts, recommendedTemplateId, goal.objective).length > 0;
  });
}

function getGoalScreenRole(screen) {
  const pageId = readOptionalString(screen?.pageId, 40).toLowerCase();
  const location = readOptionalString(screen?.location, 80).toLowerCase();
  const screenType = readOptionalString(screen?.screenType, 80).toLowerCase();
  if (pageId.includes("checkout") || location.includes("checkout") || screenType.includes("kiosk")) {
    return "checkout";
  }
  if (pageId.includes("aisle") || location.includes("aisle") || screenType.includes("shelf") || screenType.includes("endcap")) {
    return "aisle";
  }
  if (pageId.includes("entrance") || location.includes("entrance")) {
    return "entrance";
  }
  if (pageId.includes("foodcourt") || location.includes("foodcourt") || screenType.includes("menu")) {
    return "foodcourt";
  }
  if (pageId.includes("electronics") || pageId.includes("whitegoods") || location.includes("electronics") || location.includes("whitegoods")) {
    return "category";
  }
  return "general";
}

function buildGoalPlanningSignals(goal, targetProducts = []) {
  const assortmentCategory = readOptionalString(goal?.assortmentCategory, 80).toLowerCase();
  const promptTokens = new Set(tokenizeForMatch(readOptionalString(goal?.prompt, 280), true));
  const targetCategories = [
    ...new Set(
      targetProducts
        .map((product) => normalizeMatchToken(product?.category))
        .filter(Boolean)
    )
  ];
  const targetTagTokens = new Set(
    targetProducts.flatMap((product) => tokenizeForMatch(readStringArray(product?.tags, 12, 40).join(" "), true))
  );
  if (assortmentCategory) {
    promptTokens.add(assortmentCategory);
  }
  const allTokens = new Set([...promptTokens, ...targetTagTokens, ...targetCategories]);
  const briefThemes = new Set();
  for (const [theme, keywords] of Object.entries(GOAL_PLANNING_THEME_KEYWORDS)) {
    if (keywords.some((keyword) => allTokens.has(keyword))) {
      briefThemes.add(theme);
    }
  }

  const prices = targetProducts.map((product) => readNumericValue(product?.price, 0)).filter((value) => value > 0);
  const ratings = targetProducts.map((product) => readNumericValue(product?.rating, 0)).filter((value) => value > 0);
  const discountRates = targetProducts
    .map((product) => {
      const price = readNumericValue(product?.price, 0);
      const comparePrice = readNumericValue(product?.comparePrice, 0);
      if (comparePrice <= 0 || comparePrice <= price) {
        return 0;
      }
      return clampNumber((comparePrice - price) / comparePrice, 0, 0.95);
    })
    .filter((value) => Number.isFinite(value));

  const avgPrice = averageOf(prices, 0);
  const avgRating = averageOf(ratings, 0);
  const avgDiscountRate = averageOf(discountRates, 0);
  if (goal?.objective === "awareness") {
    briefThemes.add("reach");
    briefThemes.add("entrance");
  }
  if (goal?.objective === "checkout-attach") {
    briefThemes.add("bundle");
    briefThemes.add("checkout");
  }
  if (goal?.objective === "clearance") {
    briefThemes.add("clearance");
    briefThemes.add("aisle");
  }
  if (goal?.objective === "premium") {
    briefThemes.add("premium");
    briefThemes.add("entrance");
  }
  if (avgPrice >= 1200 || avgRating >= 4.75) {
    briefThemes.add("premium");
  }
  if (avgDiscountRate >= 0.18) {
    briefThemes.add("value");
  }
  if (targetProducts.length > 1) {
    briefThemes.add("assortment");
  }
  if (targetProducts.length >= 3) {
    briefThemes.add("compare");
  }
  if (promptTokens.has("afternoon") || promptTokens.has("today") || promptTokens.has("now") || promptTokens.has("weekend")) {
    briefThemes.add("urgency");
  }

  const primaryCategory = assortmentCategory || targetCategories[0] || "";
  const stageHints = [
    ...new Set(
      [
        briefThemes.has("entrance") ? "entrance" : "",
        briefThemes.has("checkout") ? "checkout" : "",
        briefThemes.has("aisle") ? "aisle" : "",
        primaryCategory === "electronics" || primaryCategory === "whitegoods" ? "category" : ""
      ].filter(Boolean)
    )
  ];

  let strategyMode = "Objective-led placement plan";
  let trafficModel = "balanced-signal";
  switch (goal?.objective) {
    case "awareness":
      strategyMode = "Footfall-weighted awareness plan";
      trafficModel = "sales-to-footfall";
      break;
    case "checkout-attach":
      strategyMode = "Basket-builder conversion plan";
      trafficModel = "sales-to-trip-and-checkout-intent";
      break;
    case "clearance":
      strategyMode = "Stock-pressure sell-through plan";
      trafficModel = "stock-and-clearance-pressure";
      break;
    case "premium":
      strategyMode = "Hero-led premium demand plan";
      trafficModel = "sales-to-premium-demand";
      break;
    default:
      break;
  }

  return {
    assortmentCategory,
    primaryCategory,
    targetCategories,
    briefThemes: [...briefThemes],
    stageHints,
    avgPrice: Number(avgPrice.toFixed(2)),
    avgRating: Number(avgRating.toFixed(2)),
    avgDiscountRate: Number(avgDiscountRate.toFixed(2)),
    wantsHeroMoment: briefThemes.has("premium") || targetProducts.length <= 1,
    wantsAssortmentRotation: briefThemes.has("compare") || targetProducts.length >= 3,
    wantsFastCadence:
      goal?.aggressiveness === "Aggressive" ||
      goal?.objective === "clearance" ||
      briefThemes.has("urgency") ||
      briefThemes.has("clearance"),
    strategyMode,
    trafficModel
  };
}

function buildGoalPlanningProfile(goal, planningSignals = {}) {
  const baseWeightsByObjective = {
    awareness: {
      objectiveFit: 0.18,
      assortmentFit: 0.12,
      stockFit: 0.08,
      trafficFit: 0.28,
      capabilityFit: 0.18,
      continuityFit: 0.08,
      scopeFit: 0.08
    },
    "checkout-attach": {
      objectiveFit: 0.24,
      assortmentFit: 0.2,
      stockFit: 0.1,
      trafficFit: 0.16,
      capabilityFit: 0.14,
      continuityFit: 0.08,
      scopeFit: 0.08
    },
    clearance: {
      objectiveFit: 0.18,
      assortmentFit: 0.16,
      stockFit: 0.28,
      trafficFit: 0.08,
      capabilityFit: 0.14,
      continuityFit: 0.08,
      scopeFit: 0.08
    },
    premium: {
      objectiveFit: 0.22,
      assortmentFit: 0.18,
      stockFit: 0.08,
      trafficFit: 0.16,
      capabilityFit: 0.22,
      continuityFit: 0.08,
      scopeFit: 0.06
    }
  };
  const aggressivenessProfiles = {
    Conservative: { minPlanScore: 0.62, minAssortmentFit: 0.24, offPageScopeFit: 0.42, maxPlacementsPerStore: 1 },
    Balanced: { minPlanScore: 0.54, minAssortmentFit: 0.2, offPageScopeFit: 0.64, maxPlacementsPerStore: 2 },
    Aggressive: { minPlanScore: 0.46, minAssortmentFit: 0.15, offPageScopeFit: 0.78, maxPlacementsPerStore: 3 }
  };
  const weights = {
    ...(baseWeightsByObjective[goal?.objective] || baseWeightsByObjective.awareness)
  };
  const profile = {
    ...(aggressivenessProfiles[goal?.aggressiveness] || aggressivenessProfiles.Balanced)
  };

  if (goal?.aggressiveness === "Conservative") {
    weights.continuityFit += 0.06;
    weights.scopeFit += 0.04;
  } else if (goal?.aggressiveness === "Aggressive") {
    weights.objectiveFit += 0.03;
    weights.trafficFit += 0.03;
    weights.capabilityFit += 0.02;
  }
  if (planningSignals.wantsAssortmentRotation) {
    weights.capabilityFit += 0.03;
  }
  if (planningSignals.wantsHeroMoment) {
    weights.objectiveFit += 0.02;
  }
  if (planningSignals.wantsFastCadence) {
    weights.trafficFit += 0.02;
    weights.stockFit += 0.02;
  }
  if (Array.isArray(planningSignals.briefThemes) && planningSignals.briefThemes.includes("value")) {
    weights.stockFit += 0.02;
  }

  const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0);
  profile.weights = Object.fromEntries(
    Object.entries(weights).map(([key, value]) => [key, Number((value / totalWeight).toFixed(4))])
  );
  return profile;
}

function computeGoalStoreObjectiveCapability(storeScreens, objectiveId) {
  const screens = Array.isArray(storeScreens) ? storeScreens : [];
  if (screens.length === 0) {
    return 0.5;
  }
  const roleCounts = screens.reduce(
    (accumulator, screen) => {
      const role = getGoalScreenRole(screen);
      accumulator[role] = (accumulator[role] || 0) + 1;
      return accumulator;
    },
    { entrance: 0, category: 0, aisle: 0, checkout: 0, foodcourt: 0, general: 0 }
  );
  const totalScreens = screens.length;
  const verticalShare = screens.filter((screen) => readOptionalString(screen?.screenType, 80).toLowerCase().includes("vertical")).length / totalScreens;
  const kioskShare = screens.filter((screen) => readOptionalString(screen?.screenType, 80).toLowerCase().includes("kiosk")).length / totalScreens;
  const shelfShare = screens.filter((screen) => {
    const screenType = readOptionalString(screen?.screenType, 80).toLowerCase();
    return screenType.includes("shelf") || screenType.includes("endcap");
  }).length / totalScreens;
  const heroShare = screens.filter((screen) => readOptionalString(screen?.templateId, 80) === "fullscreen-hero").length / totalScreens;
  const diversity = new Set(screens.map((screen) => getGoalScreenRole(screen))).size / 5;
  const hasRole = (role) => ((roleCounts[role] || 0) > 0 ? 1 : 0);

  switch (objectiveId) {
    case "checkout-attach":
      return clampNumber(hasRole("checkout") * 0.45 + hasRole("aisle") * 0.22 + kioskShare * 0.18 + hasRole("category") * 0.1 + diversity * 0.05);
    case "clearance":
      return clampNumber(hasRole("aisle") * 0.48 + shelfShare * 0.2 + hasRole("category") * 0.18 + hasRole("checkout") * 0.06 + diversity * 0.08);
    case "premium":
      return clampNumber(hasRole("entrance") * 0.34 + hasRole("category") * 0.28 + verticalShare * 0.22 + heroShare * 0.1 + diversity * 0.06);
    case "awareness":
    default:
      return clampNumber(hasRole("entrance") * 0.42 + hasRole("category") * 0.24 + verticalShare * 0.18 + diversity * 0.16);
  }
}

function computeGoalStoreContinuityFit(storeScreens, targetProducts, objectiveId) {
  const screens = Array.isArray(storeScreens) ? storeScreens : [];
  if (screens.length === 0) {
    return 0.45;
  }
  const targetSkuIds = Array.isArray(targetProducts) ? targetProducts.map((product) => normalizeSku(product?.sku)).filter(Boolean) : [];
  if (targetSkuIds.length > 0 && screens.some((screen) => screenContainsAnyTargetSku(screen, targetSkuIds))) {
    return 0.94;
  }
  const alignedTemplates = screens.filter((screen) => {
    const currentTemplateId = readOptionalString(screen?.templateId, 80);
    return currentTemplateId && currentTemplateId === computeGoalTemplateId(screen, objectiveId);
  }).length;
  return clampNumber(0.4 + (alignedTemplates / screens.length) * 0.36 + computeGoalStoreObjectiveCapability(screens, objectiveId) * 0.12);
}

function computeGoalCategoryDemandFit(storeId, primaryCategory = "") {
  const storeProfile = DEMO_STORE_PROFILES.find((profile) => profile.storeId === storeId);
  if (!storeProfile) {
    return primaryCategory ? 0.58 : 0.55;
  }
  const bias = Number(storeProfile?.categoryBias?.[primaryCategory] || storeProfile?.categoryBias?.general || 1);
  return clampNumber(0.35 + (bias - 0.8) / 0.6);
}

function buildGoalStoreStrategy(goal, targetProducts, screens, planningSignals = {}) {
  const screensByStore = new Map();
  for (const screen of Array.isArray(screens) ? screens : []) {
    const storeId = readOptionalString(screen?.storeId, 80);
    if (!storeId) {
      continue;
    }
    const bucket = screensByStore.get(storeId) || [];
    bucket.push(screen);
    screensByStore.set(storeId, bucket);
  }

  const stockEntries = [...screensByStore.keys()].map((storeId) => {
    const stockUnits = Array.isArray(targetProducts)
      ? targetProducts.reduce((sum, product) => sum + getProductStockForStore(product, storeId), 0)
      : 0;
    const stockedSkuCount =
      Array.isArray(targetProducts) && targetProducts.length > 0
        ? targetProducts.filter((product) => getProductStockForStore(product, storeId) > 0).length
        : 0;
    return {
      storeId,
      stockUnits,
      stockedSkuCount,
      stockCoverage:
        Array.isArray(targetProducts) && targetProducts.length > 0 ? stockedSkuCount / Math.max(1, targetProducts.length) : 0
    };
  });
  const maxStockUnits = Math.max(1, ...stockEntries.map((entry) => entry.stockUnits));

  const rankings = stockEntries
    .map((stockEntry) => {
      const storeScreens = screensByStore.get(stockEntry.storeId) || [];
      const backend =
        DEMO_STORE_SALES_SIGNAL_MAP.get(stockEntry.storeId) || {
          storeId: stockEntry.storeId,
          storeLabel: stockEntry.storeId,
          totalSales: 780000 + storeScreens.length * 48000,
          avgBasketValue: 39,
          estimatedTransactions: 20000,
          inferredFootTraffic: 26000,
          salesIndex: 0.55,
          footTrafficIndex: 0.55,
          checkoutIntentIndex: 0.55,
          premiumDemandIndex: 0.55,
          clearancePressureIndex: 0.55
        };
      const capabilityFit = computeGoalStoreObjectiveCapability(storeScreens, goal?.objective);
      const continuityFit = computeGoalStoreContinuityFit(storeScreens, targetProducts, goal?.objective);
      const categoryDemandFit = computeGoalCategoryDemandFit(stockEntry.storeId, planningSignals.primaryCategory);
      const stockFit =
        Array.isArray(targetProducts) && targetProducts.length > 0
          ? clampNumber((stockEntry.stockUnits / maxStockUnits) * 0.72 + stockEntry.stockCoverage * 0.28)
          : clampNumber(0.48 + categoryDemandFit * 0.32);
      let trafficFit = clampNumber(backend.footTrafficIndex * 0.7 + backend.salesIndex * 0.3);
      let score =
        trafficFit * 0.44 +
        capabilityFit * 0.22 +
        categoryDemandFit * 0.14 +
        stockFit * 0.06 +
        continuityFit * 0.14;

      if (goal?.objective === "checkout-attach") {
        trafficFit = clampNumber(backend.checkoutIntentIndex * 0.72 + backend.footTrafficIndex * 0.18 + capabilityFit * 0.1);
        score =
          trafficFit * 0.3 +
          capabilityFit * 0.28 +
          stockFit * 0.16 +
          continuityFit * 0.16 +
          categoryDemandFit * 0.1;
      } else if (goal?.objective === "clearance") {
        trafficFit = clampNumber(backend.clearancePressureIndex * 0.6 + stockFit * 0.3 + capabilityFit * 0.1);
        score =
          stockFit * 0.44 +
          capabilityFit * 0.18 +
          trafficFit * 0.12 +
          continuityFit * 0.1 +
          categoryDemandFit * 0.16;
      } else if (goal?.objective === "premium") {
        trafficFit = clampNumber(backend.premiumDemandIndex * 0.72 + backend.salesIndex * 0.18 + capabilityFit * 0.1);
        score =
          trafficFit * 0.24 +
          capabilityFit * 0.3 +
          categoryDemandFit * 0.22 +
          continuityFit * 0.12 +
          stockFit * 0.12;
      }

      return {
        storeId: stockEntry.storeId,
        storeLabel: backend.storeLabel || stockEntry.storeId,
        totalSales: backend.totalSales,
        footTrafficIndex: backend.footTrafficIndex,
        checkoutIntentIndex: backend.checkoutIntentIndex,
        premiumDemandIndex: backend.premiumDemandIndex,
        clearancePressureIndex: backend.clearancePressureIndex,
        stockUnits: stockEntry.stockUnits,
        stockCoverage: Number(stockEntry.stockCoverage.toFixed(2)),
        stockFit: Number(stockFit.toFixed(2)),
        trafficFit: Number(trafficFit.toFixed(2)),
        capabilityFit: Number(capabilityFit.toFixed(2)),
        continuityFit: Number(continuityFit.toFixed(2)),
        categoryDemandFit: Number(categoryDemandFit.toFixed(2)),
        score: Number(score.toFixed(2))
      };
    })
    .sort((left, right) => right.score - left.score || left.storeId.localeCompare(right.storeId));

  const requestedStoreId = readOptionalString(goal?.storeId, 80);
  if (requestedStoreId) {
    const requestedEntry = rankings.find((entry) => entry.storeId === requestedStoreId) || {
      storeId: requestedStoreId,
      storeLabel: requestedStoreId,
      totalSales: 0,
      footTrafficIndex: 0.5,
      checkoutIntentIndex: 0.5,
      premiumDemandIndex: 0.5,
      clearancePressureIndex: 0.5,
      stockUnits: 0,
      stockCoverage: 0,
      stockFit: 0.5,
      trafficFit: 0.5,
      capabilityFit: 0.5,
      continuityFit: 0.5,
      categoryDemandFit: 0.5,
      score: 0.5
    };
    const focusLabel = describeTargetSkus(targetProducts) || `${targetProducts.length || 0} priority SKU(s)`;
    return {
      requestedStoreId,
      effectiveStoreId: requestedStoreId,
      effectiveStoreIds: [requestedStoreId],
      storeFocusLabel: requestedStoreId,
      stockMessage:
        goal?.objective === "clearance" && Array.isArray(targetProducts) && targetProducts.length > 0 && requestedEntry.stockUnits > 0
          ? `Store focus: ${requestedStoreId} has ${requestedEntry.stockUnits} unit(s) on hand for ${focusLabel}.`
          : "",
      storeSelectionReason: `Store scope stayed on ${requestedStoreId} because the planner was explicitly pinned to that store.`,
      storeRankings: rankings
    };
  }

  const ratioByObjective = {
    awareness: { Conservative: 0.3, Balanced: 0.5, Aggressive: 0.7 },
    "checkout-attach": { Conservative: 0.25, Balanced: 0.4, Aggressive: 0.55 },
    clearance: { Conservative: 0.25, Balanced: 0.4, Aggressive: 0.55 },
    premium: { Conservative: 0.2, Balanced: 0.35, Aggressive: 0.45 }
  };
  const ratio =
    ratioByObjective[goal?.objective]?.[goal?.aggressiveness] ||
    ratioByObjective.awareness.Balanced;
  const extraStore =
    Array.isArray(planningSignals.briefThemes) && planningSignals.briefThemes.includes("urgency")
      ? 1
      : 0;
  const selectedCount = Math.min(rankings.length, Math.max(1, Math.ceil(rankings.length * ratio) + extraStore));
  const selectedEntries = rankings.slice(0, selectedCount);
  const focusLabel = describeTargetSkus(targetProducts) || `${targetProducts.length || 0} priority SKU(s)`;
  let storeSelectionReason = `Selected ${selectedEntries.length} stores with the strongest blended planning score.`;
  if (goal?.objective === "awareness") {
    storeSelectionReason = `Selected ${selectedEntries.length} stores with the highest inferred foot traffic, using synthetic total sales and transaction volume from the demo backend.`;
  } else if (goal?.objective === "checkout-attach") {
    storeSelectionReason = `Selected ${selectedEntries.length} stores with the strongest checkout intent, combining sales-derived trips with checkout-capable screens.`;
  } else if (goal?.objective === "clearance") {
    storeSelectionReason = `Selected ${selectedEntries.length} stores with the highest stock pressure and on-hand units for ${focusLabel}.`;
  } else if (goal?.objective === "premium") {
    storeSelectionReason = `Selected ${selectedEntries.length} stores with the strongest premium demand index and hero-capable screens.`;
  }
  const topStore = selectedEntries[0] || null;
  if (topStore && goal?.objective === "awareness") {
    storeSelectionReason += ` Lead store: ${topStore.storeLabel} (${Math.round(topStore.totalSales).toLocaleString("en-US")} in modeled sales).`;
  }

  return {
    requestedStoreId: "",
    effectiveStoreId: selectedEntries.length === 1 ? selectedEntries[0].storeId : "",
    effectiveStoreIds: selectedEntries.map((entry) => entry.storeId),
    storeFocusLabel: selectedEntries.length === 1 ? selectedEntries[0].storeId : `Top ${selectedEntries.length} stores`,
    stockMessage:
      goal?.objective === "clearance" && Array.isArray(targetProducts) && targetProducts.length > 0
        ? `Store focus: top ${selectedEntries.length} stores by stock pressure and on-hand units for ${focusLabel}.`
        : "",
    storeSelectionReason,
    storeRankings: rankings
  };
}

function computeGoalPageScopeFit(screen, goal) {
  const requestedPageId = readOptionalString(goal?.requestedPageId || goal?.pageId, 40);
  if (!requestedPageId) {
    return 1;
  }
  if (readOptionalString(screen?.pageId, 40) === requestedPageId) {
    return 1;
  }
  switch (goal?.aggressiveness) {
    case "Conservative":
      return 0.42;
    case "Aggressive":
      return 0.78;
    case "Balanced":
    default:
      return 0.64;
  }
}

function computeGoalObjectiveFit(screen, objectiveId, planningSignals = {}) {
  const role = getGoalScreenRole(screen);
  const screenType = readOptionalString(screen?.screenType, 80).toLowerCase();
  let score = 0.54;
  switch (objectiveId) {
    case "checkout-attach":
      score = role === "checkout" ? 0.96 : role === "aisle" ? 0.84 : role === "category" ? 0.68 : role === "entrance" ? 0.56 : 0.5;
      if (screenType.includes("kiosk")) {
        score += 0.06;
      }
      break;
    case "clearance":
      score = role === "aisle" ? 0.96 : role === "category" ? 0.78 : role === "checkout" ? 0.52 : role === "entrance" ? 0.5 : 0.46;
      if (screenType.includes("shelf") || screenType.includes("endcap")) {
        score += 0.06;
      }
      break;
    case "premium":
      score = role === "entrance" ? 0.95 : role === "category" ? 0.88 : role === "checkout" ? 0.54 : role === "foodcourt" ? 0.5 : 0.48;
      if (screenType.includes("vertical")) {
        score += 0.05;
      }
      break;
    case "awareness":
    default:
      score = role === "entrance" ? 0.94 : role === "category" ? 0.82 : role === "aisle" ? 0.66 : role === "checkout" ? 0.58 : 0.52;
      if (screenType.includes("vertical")) {
        score += 0.04;
      }
      break;
  }

  if (Array.isArray(planningSignals.stageHints)) {
    if (planningSignals.stageHints.includes(role)) {
      score += 0.04;
    }
    if (planningSignals.stageHints.includes("category") && role === "category") {
      score += 0.04;
    }
  }
  if (planningSignals.wantsHeroMoment && (role === "entrance" || screenType.includes("vertical"))) {
    score += 0.03;
  }
  return clampNumber(score);
}

function computeGoalCapabilityFit(screen, templateId, planningSignals = {}, goalProductsForScreen = []) {
  const screenType = readOptionalString(screen?.screenType, 80).toLowerCase();
  const role = getGoalScreenRole(screen);
  const productLimit = getTemplateProductLimit(templateId);
  let score = 0.52;
  if (role === "checkout" && templateId === "kiosk-interactive") {
    score += 0.2;
  }
  if (role === "aisle" && templateId === "shelf-spotlight") {
    score += 0.2;
  }
  if (role === "entrance" && (templateId === "fullscreen-banner" || templateId === "fullscreen-hero")) {
    score += 0.16;
  }
  if (role === "category" && (templateId === "carousel-banner" || templateId === "fullscreen-hero" || templateId === "fullscreen-banner")) {
    score += 0.12;
  }
  if (planningSignals.wantsAssortmentRotation && productLimit > 1) {
    score += 0.16;
  }
  if (!planningSignals.wantsAssortmentRotation && productLimit === 1) {
    score += 0.08;
  }
  if (planningSignals.wantsHeroMoment && templateId === "fullscreen-hero") {
    score += 0.14;
  }
  if (screenType.includes("vertical") && (templateId === "fullscreen-hero" || templateId === "kiosk-interactive")) {
    score += 0.05;
  }
  if (goalProductsForScreen.length > 1 && productLimit > 1) {
    score += 0.05;
  }
  return clampNumber(score);
}

function computeGoalContinuityFit(screen, recommendedTemplateId, targetProducts, objectiveId) {
  const currentTemplateId = readOptionalString(screen?.templateId, 80);
  const targetSkuIds = Array.isArray(targetProducts) ? targetProducts.map((product) => normalizeSku(product?.sku)).filter(Boolean) : [];
  let score = currentTemplateId === recommendedTemplateId ? 0.82 : 0.48;
  if (targetSkuIds.length > 0 && screenContainsAnyTargetSku(screen, targetSkuIds)) {
    score += 0.14;
  }
  if (isObjectivePreferredScreen(screen, objectiveId)) {
    score += 0.04;
  }
  return clampNumber(score);
}

function computeGoalPlacementBudget(candidateCount, storeCount, goal) {
  if (candidateCount <= 0) {
    return 0;
  }
  if (candidateCount <= storeCount) {
    return candidateCount;
  }
  const multiplierByObjective = {
    awareness: { Conservative: 1, Balanced: 1.3, Aggressive: 1.8 },
    "checkout-attach": { Conservative: 1.15, Balanced: 1.45, Aggressive: 2 },
    clearance: { Conservative: 1.1, Balanced: 1.4, Aggressive: 1.8 },
    premium: { Conservative: 1, Balanced: 1.2, Aggressive: 1.5 }
  };
  let multiplier =
    multiplierByObjective[goal?.objective]?.[goal?.aggressiveness] ||
    multiplierByObjective.awareness.Balanced;
  if (goal?.requestedPageId && goal?.aggressiveness !== "Aggressive") {
    multiplier = Math.min(multiplier, 1.05);
  }
  return Math.min(candidateCount, Math.max(1, Math.ceil(storeCount * multiplier)));
}

function selectGoalPlacementCandidates(candidates, goal, planningProfile) {
  const sorted = [...(Array.isArray(candidates) ? candidates : [])].sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }
    return left.screenId.localeCompare(right.screenId);
  });
  const storeCount = new Set(sorted.map((candidate) => candidate.storeId)).size;
  const placementBudget = computeGoalPlacementBudget(sorted.length, storeCount, goal);
  const selected = [];
  const selectedIds = new Set();
  const storeCounts = new Map();
  const storeRoles = new Set();

  for (let pass = 0; pass < 2 && selected.length < placementBudget; pass += 1) {
    for (const candidate of sorted) {
      if (selected.length >= placementBudget || selectedIds.has(candidate.screenId)) {
        continue;
      }
      const storeCountForCandidate = storeCounts.get(candidate.storeId) || 0;
      if (pass === 0 && storeCountForCandidate > 0) {
        continue;
      }
      if (pass === 1 && storeCountForCandidate >= planningProfile.maxPlacementsPerStore) {
        continue;
      }
      const roleKey = `${candidate.storeId}:${candidate.placementRole}`;
      if (pass === 1 && storeRoles.has(roleKey)) {
        continue;
      }
      selected.push(candidate);
      selectedIds.add(candidate.screenId);
      storeCounts.set(candidate.storeId, storeCountForCandidate + 1);
      storeRoles.add(roleKey);
    }
  }

  return {
    placementBudget,
    selected: selected.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.screenId.localeCompare(right.screenId);
    })
  };
}

function buildGoalTemplateRationale(screen, templateId, goal, planningSignals = {}, goalProductsForScreen = []) {
  const template = getTemplatePreset(templateId);
  const role = getGoalScreenRole(screen);
  if (role === "checkout" && templateId === "kiosk-interactive") {
    return `Uses ${template.name} because checkout placements work best with assisted, high-intent creative.`;
  }
  if (role === "aisle" && templateId === "shelf-spotlight") {
    return `Uses ${template.name} because aisle placements need compact, near-product messaging.`;
  }
  if (planningSignals.wantsAssortmentRotation && getTemplateProductLimit(templateId) > 1) {
    return `Uses ${template.name} to rotate multiple priority SKUs across the same placement.`;
  }
  if (planningSignals.wantsHeroMoment && templateId === "fullscreen-hero") {
    return `Uses ${template.name} to give the brief a stronger hero moment on a portrait-capable screen.`;
  }
  return `Uses ${template.name} because it best matches the ${goal?.objective || "goal"} brief for this screen.`;
}

function buildGoalShareRationale(shareRatio, refreshInterval, totalSlots = SCREEN_SHARE_SLOT_COUNT) {
  const seconds = Math.round(Number(refreshInterval || 0) / 1000);
  const shareLabel = formatLineItemShareLabel(shareRatio, totalSlots) || "screen share";
  return `Buys ${shareLabel} of the screen rotation while keeping the installed ${seconds}s screen cadence unchanged.`;
}

function buildGoalExpectedOutcome(screen, goal) {
  const location = titleCase(screen?.location || screen?.pageId || "store");
  switch (goal?.objective) {
    case "checkout-attach":
      return `Expected outcome: lift add-on consideration close to the basket decision in ${location}.`;
    case "clearance":
      return `Expected outcome: accelerate sell-through where inventory pressure is highest in ${location}.`;
    case "premium":
      return `Expected outcome: strengthen premium storytelling before shoppers compare alternatives in ${location}.`;
    case "awareness":
    default:
      return `Expected outcome: expand upper-funnel reach in ${location} using higher-footfall coverage.`;
  }
}

function buildGoalReasonShort(screen, goal, candidate) {
  const location = titleCase(screen?.location || screen?.pageId || "store");
  switch (goal?.objective) {
    case "checkout-attach":
      return `Ranks strongly in ${location} because it connects category intent to the final basket decision.`;
    case "clearance":
      return `Ranks strongly in ${location} because stock depth and proximity to the shelf support faster sell-through.`;
    case "premium":
      return `Ranks strongly in ${location} because it gives the range a stronger hero-style premium moment.`;
    case "awareness":
    default:
      return candidate?.trafficFit >= 0.7
        ? `Ranks strongly in ${location} because this store carries the highest inferred foot traffic from modeled sales.`
        : `Ranks strongly in ${location} because it expands in-store reach with strong shopper flow.`;
  }
}

function summarizeGoalScopeFromPlacements(goal, recommendedPlacements, candidateInsights = {}) {
  const requestedPageId = readOptionalString(goal?.requestedPageId || goal?.pageId, 40);
  if (!requestedPageId) {
    return {
      scopeMode: "requested",
      effectivePageId: "",
      scopeMessage: "",
      scopeSelectionReason: "Placement scope remained open across all mapped pages."
    };
  }

  const selectedPageIds = [
    ...new Set(
      (Array.isArray(recommendedPlacements) ? recommendedPlacements : [])
        .map((entry) => readOptionalString(entry?.pageId, 40))
        .filter(Boolean)
    )
  ];
  if (Number(candidateInsights.requestedCandidateCount || 0) === 0) {
    return {
      scopeMode: "missing-page",
      effectivePageId: "",
      scopeMessage: `No mapped placements were found for ${titleCase(requestedPageId)}, so the recommendation widened the scope automatically.`,
      scopeSelectionReason: `The requested ${requestedPageId} scope did not exist in the selected store set, so the planner widened to mapped placements with valid inventory and screen coverage.`
    };
  }
  if (selectedPageIds.length === 0) {
    return {
      scopeMode: "requested",
      effectivePageId: requestedPageId,
      scopeMessage: "",
      scopeSelectionReason: `The requested ${requestedPageId} scope stayed in play, but no placements cleared the planning threshold.`
    };
  }
  if (selectedPageIds.length === 1 && selectedPageIds[0] === requestedPageId) {
    return {
      scopeMode: "requested",
      effectivePageId: requestedPageId,
      scopeMessage: "",
      scopeSelectionReason: `Placement scope stayed on ${requestedPageId} because those screens remained competitive under ${goal?.aggressiveness || "Balanced"} planning.`
    };
  }

  const selectedPageId = selectedPageIds.length === 1 ? selectedPageIds[0] : "";
  const scoreDelta = Number((Number(candidateInsights.bestSelectedScore || 0) - Number(candidateInsights.requestedPageBestScore || 0)).toFixed(2));
  if (selectedPageId) {
    return {
      scopeMode: "auto-matched",
      effectivePageId: selectedPageId,
      scopeMessage: `Selected SKUs align more naturally with ${titleCase(selectedPageId)} placements than ${titleCase(requestedPageId)}, so the recommendation widened the scope automatically.`,
      scopeSelectionReason: `${goal?.aggressiveness || "Balanced"} planning widened from ${requestedPageId} to ${selectedPageId} because the stronger page scored ${scoreDelta > 0 ? scoreDelta : 0.08} points higher on fit.`
    };
  }
  return {
    scopeMode: "auto-matched",
    effectivePageId: "",
    scopeMessage: "Selected SKUs span multiple mapped placements, so the recommendation widened the scope automatically.",
    scopeSelectionReason: `${goal?.aggressiveness || "Balanced"} planning widened beyond ${requestedPageId} because multiple pages materially outscored the requested scope for this brief.`
  };
}

function buildGoalStockSummary(goal, targetProducts, screens) {
  if (goal.objective !== "clearance" || !Array.isArray(targetProducts) || targetProducts.length === 0) {
    return {
      requestedStoreId: readOptionalString(goal.storeId, 80),
      effectiveStoreId: readOptionalString(goal.storeId, 80),
      effectiveStoreIds: readOptionalString(goal.storeId, 80) ? [readOptionalString(goal.storeId, 80)] : [],
      storeFocusLabel: readOptionalString(goal.storeId, 80),
      stockMessage: ""
    };
  }

  const screenStoreIds = [...new Set((Array.isArray(screens) ? screens : []).map((screen) => readOptionalString(screen.storeId, 80)).filter(Boolean))];
  if (screenStoreIds.length === 0) {
    return {
      requestedStoreId: readOptionalString(goal.storeId, 80),
      effectiveStoreId: readOptionalString(goal.storeId, 80),
      effectiveStoreIds: readOptionalString(goal.storeId, 80) ? [readOptionalString(goal.storeId, 80)] : [],
      storeFocusLabel: readOptionalString(goal.storeId, 80),
      stockMessage: ""
    };
  }

  const requestedStoreId = readOptionalString(goal.storeId, 80);
  const consideredStoreIds = requestedStoreId ? [requestedStoreId] : screenStoreIds;
  const totalsByStore = consideredStoreIds.map((storeId) => ({
    storeId,
    totalUnits: targetProducts.reduce((sum, product) => sum + getProductStockForStore(product, storeId), 0)
  }));
  totalsByStore.sort((left, right) => right.totalUnits - left.totalUnits || left.storeId.localeCompare(right.storeId));
  const best = totalsByStore[0] || { storeId: requestedStoreId || screenStoreIds[0] || "", totalUnits: 0 };
  const focusLabel = describeTargetSkus(targetProducts) || `${targetProducts.length} priority SKU(s)`;

  if (requestedStoreId) {
    return {
      requestedStoreId,
      effectiveStoreId: requestedStoreId,
      effectiveStoreIds: [requestedStoreId],
      storeFocusLabel: requestedStoreId,
      stockMessage:
        best.totalUnits > 0
          ? `Store focus: ${requestedStoreId} has ${best.totalUnits} unit(s) on hand for ${focusLabel}.`
          : ""
    };
  }

  const recommendedStoreCount = Math.max(1, Math.ceil(totalsByStore.length / 2));
  const recommendedStoreIds = totalsByStore.slice(0, recommendedStoreCount).map((entry) => entry.storeId).filter(Boolean);

  return {
    requestedStoreId: "",
    effectiveStoreId: "",
    effectiveStoreIds: recommendedStoreIds,
    storeFocusLabel: `Top ${recommendedStoreIds.length} stores`,
    stockMessage:
      recommendedStoreIds.length > 0
        ? `Store focus: top ${recommendedStoreIds.length} stores by on-hand stock for ${focusLabel}.`
        : ""
  };
}

function summarizeGoalScope(goal, scopedScreens, compatibleScreens, requestedPageId) {
  if (!requestedPageId) {
    return {
      scopeMode: "requested",
      effectivePageId: "",
      scopeMessage: ""
    };
  }
  if (compatibleScreens.length > 0) {
    const pageIds = [...new Set(compatibleScreens.map((screen) => readOptionalString(screen.pageId, 40)).filter(Boolean))];
    const effectivePageId = pageIds.length === 1 ? pageIds[0] : "";
    return {
      scopeMode: "auto-matched",
      effectivePageId,
      scopeMessage: effectivePageId && effectivePageId !== requestedPageId
        ? `Selected SKUs align more naturally with ${titleCase(effectivePageId)} placements than ${titleCase(requestedPageId)}, so the recommendation widened the scope automatically.`
        : pageIds.length > 1
          ? "Selected SKUs span multiple mapped placements, so the recommendation widened the scope automatically."
          : ""
    };
  }
  if (scopedScreens.length === 0) {
    return {
      scopeMode: "missing-page",
      effectivePageId: "",
      scopeMessage: `No mapped placements were found for ${titleCase(requestedPageId)}, so the recommendation widened the scope automatically.`
    };
  }
  return {
    scopeMode: "requested",
    effectivePageId: requestedPageId,
    scopeMessage: ""
  };
}

function promptIncludesIntentKeyword(promptText, promptTokens, keyword) {
  const normalizedKeyword = readOptionalString(keyword, 80).toLowerCase();
  if (!normalizedKeyword) {
    return false;
  }
  return normalizedKeyword.includes(" ")
    ? promptText.includes(normalizedKeyword)
    : promptTokens.has(normalizeMatchToken(normalizedKeyword));
}

function buildGoalPromptIntentSignals(promptText, promptTokens) {
  return Object.fromEntries(
    Object.entries(GOAL_PROMPT_INTENT_KEYWORDS).map(([intent, keywords]) => [
      intent,
      keywords.some((keyword) => promptIncludesIntentKeyword(promptText, promptTokens, keyword))
    ])
  );
}

function buildMetricRange(values = []) {
  const numericValues = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (numericValues.length === 0) {
    return { min: 0, max: 0 };
  }
  return {
    min: Math.min(...numericValues),
    max: Math.max(...numericValues)
  };
}

function summarizeProductStockSignals(product, storeId = "") {
  const stockSummary =
    product?.stockSummary && typeof product.stockSummary === "object"
      ? product.stockSummary
      : buildGeneratedDemoStockSummary(product);
  const normalizedStoreId = readOptionalString(storeId, 80);
  const storeStock = normalizedStoreId ? getProductStockForStore(product, normalizedStoreId) : 0;
  const totalStock = Math.max(0, Number(stockSummary.totalStock) || 0);
  const maxStoreStock = Math.max(0, Number(stockSummary.maxStoreStock) || 0);
  return {
    storeStock,
    totalStock,
    maxStoreStock,
    relevantStock: normalizedStoreId ? storeStock : totalStock
  };
}

function buildGoalPromptScoredCandidates(prompt, feed, scopedScreens = [], goal = {}) {
  const promptText = readOptionalString(prompt, 280).toLowerCase();
  const promptTokens = new Set(tokenizeForMatch(promptText, true));
  if (!promptText || promptTokens.size === 0 || !Array.isArray(feed) || feed.length === 0) {
    return {
      promptText,
      promptTokens,
      intentSignals: buildGoalPromptIntentSignals(promptText, promptTokens),
      hasIntentSignals: false,
      scored: []
    };
  }

  const scopedTokens = new Set();
  for (const screen of scopedScreens) {
    const context = buildScreenGoalContext(screen);
    for (const token of context.tokens) {
      scopedTokens.add(token);
    }
  }

  const candidateMetrics = feed.map((rawProduct, index) => {
    const product = normalizeProductFeedItem(rawProduct, index);
    const context = buildProductGoalContext(product);
    const stockSignals = summarizeProductStockSignals(product, goal?.storeId);
    const priceValue = Math.max(0, readNumericValue(product?.price, 0));
    const comparePriceValue = Math.max(0, readNumericValue(product?.comparePrice, 0));
    const discountRate =
      comparePriceValue > 0 && comparePriceValue > priceValue
        ? clampNumber((comparePriceValue - priceValue) / comparePriceValue, 0, 0.95)
        : 0;
    const ratingValue = clampNumber(readNumericValue(product?.rating, 0) / 5, 0, 1);
    const isNewnessTagged = context.tagTokens.some((token) => token === "new" || token === "new-range" || token === "launch");

    return {
      product,
      context,
      stockSignals,
      priceValue,
      discountRate,
      ratingValue,
      isNewnessTagged
    };
  });

  const intentSignals = buildGoalPromptIntentSignals(promptText, promptTokens);
  const hasIntentSignals = Object.values(intentSignals).some(Boolean);
  const stockRange = buildMetricRange(candidateMetrics.map((entry) => entry.stockSignals.relevantStock));
  const priceRange = buildMetricRange(candidateMetrics.map((entry) => entry.priceValue));
  const discountRange = buildMetricRange(candidateMetrics.map((entry) => entry.discountRate));

  const scored = candidateMetrics.map((entry) => {
    const { product, context } = entry;
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

    const highPriceScore =
      entry.priceValue > 0 ? normalizeRange(entry.priceValue, priceRange.min, priceRange.max, 0.5) : 0;
    const lowPriceScore = entry.priceValue > 0 ? clampNumber(1 - highPriceScore, 0, 1) : 0;
    const stockScore =
      entry.stockSignals.relevantStock > 0
        ? normalizeRange(entry.stockSignals.relevantStock, stockRange.min, stockRange.max, 0.55)
        : 0;
    const discountScore =
      entry.discountRate > 0 ? normalizeRange(entry.discountRate, discountRange.min, discountRange.max, 0.5) : 0;
    const premiumScore = Math.max(highPriceScore, entry.ratingValue, entry.isNewnessTagged ? 0.72 : 0);

    if (intentSignals.stock) {
      score += stockScore * 1.55;
      if (entry.stockSignals.relevantStock > 0) {
        matchedTerms.add("high-stock");
      }
    }
    if (intentSignals.value) {
      score += Math.max(discountScore, lowPriceScore) * 1.2;
      if (entry.discountRate > 0 || entry.priceValue > 0) {
        matchedTerms.add("value");
      }
    }
    if (intentSignals.premium) {
      score += premiumScore * 1.05;
      if (premiumScore >= 0.6) {
        matchedTerms.add("premium");
      }
    }
    if (intentSignals.rating) {
      score += entry.ratingValue * 0.9;
      if (entry.ratingValue >= 0.7) {
        matchedTerms.add("top-rated");
      }
    }
    if (intentSignals.newness && entry.isNewnessTagged) {
      score += 0.85;
      matchedTerms.add("new");
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

  return {
    promptText,
    promptTokens,
    intentSignals,
    hasIntentSignals,
    scored
  };
}

function inferTargetProductsFromPromptHeuristic(prompt, feed, scopedScreens = [], goal = {}) {
  const analysis = buildGoalPromptScoredCandidates(prompt, feed, scopedScreens, goal);
  if (!analysis.promptText || analysis.scored.length === 0) {
    return { products: [], matchedTerms: [], provider: "heuristic", reasoning: "" };
  }

  const strongMatches = analysis.scored.filter((entry) => entry.score >= GOAL_PROMPT_MIN_SCORE);
  const relaxedMatches = analysis.scored.filter((entry) =>
    entry.score >= (analysis.hasIntentSignals ? 0.35 : GOAL_PROMPT_MIN_SCORE * 0.75) &&
    (analysis.hasIntentSignals || entry.tokenMatches >= 2 || entry.matchedTerms.length > 0)
  );
  const fallbackMatches =
    strongMatches.length > 0
      ? strongMatches
      : relaxedMatches.length > 0
        ? relaxedMatches
        : analysis.hasIntentSignals
          ? analysis.scored.filter((entry) => entry.score > 0.2).slice(0, GOAL_INFERRED_PRODUCT_LIMIT)
          : [];
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

  return { products: inferredProducts, matchedTerms, provider: "heuristic", reasoning: "" };
}

function readChatCompletionTextContent(content) {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (typeof part === "string") {
        return part;
      }
      if (part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("");
}

async function inferTargetProductsFromPromptWithAi(prompt, feed, scopedScreens = [], goal = {}) {
  if (!OPENAI_API_KEY) {
    return null;
  }

  const analysis = buildGoalPromptScoredCandidates(prompt, feed, scopedScreens, goal);
  if (!analysis.promptText || analysis.scored.length === 0) {
    return null;
  }

  const candidateEntries = analysis.scored.slice(0, GOAL_PROMPT_AI_CANDIDATE_LIMIT);
  const candidateProducts = candidateEntries.map((entry) => entry.product);
  const candidateBySku = new Map(candidateProducts.map((product) => [normalizeSku(product.sku), product]));
  const scopedPlacementHints = scopedScreens.slice(0, 8).map((screen) => ({
    screenId: readOptionalString(screen?.screenId, 80),
    storeId: readOptionalString(screen?.storeId, 80),
    pageId: readOptionalString(screen?.pageId, 40),
    location: readOptionalString(screen?.location, 80),
    screenType: readOptionalString(screen?.screenType, 80)
  }));
  const candidates = candidateEntries.map((entry) => ({
    sku: normalizeSku(entry.product.sku),
    name: readOptionalString(entry.product.name, 180),
    brand: readOptionalString(entry.product.brand, 80),
    category: readOptionalString(entry.product.category, 80),
    tags: readStringArray(entry.product.tags, 12, 40),
    price: readNumericValue(entry.product.price, 0),
    comparePrice: readNumericValue(entry.product.comparePrice, 0),
    rating: readNumericValue(entry.product.rating, 0),
    relevantStock: summarizeProductStockSignals(entry.product, goal?.storeId).relevantStock,
    totalStock: summarizeProductStockSignals(entry.product, "").totalStock
  }));

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), GOAL_PROMPT_AI_TIMEOUT_MS);

  try {
    const response = await fetch(`${OPENAI_BASE_URL.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You select SKUs for an in-store retail media planner. Use the brief semantically, not only exact token overlap. Prefer products that fit the user's intent, including stock, value, premium, rating, and freshness signals when mentioned. If the brief suggests beginners, simplicity, low confidence with technology, or mainstream ease-of-use, prefer simple everyday consumer products and avoid creator, capture, studio, pro interface, or specialist gear unless the brief clearly asks for them. Only choose from the supplied candidates. Return an empty list if nothing is a confident fit. Explain the selection briefly."
          },
          {
            role: "user",
            content: JSON.stringify({
              prompt: analysis.promptText,
              objective: readOptionalString(goal?.objective, 40),
              advertiserId: readOptionalString(goal?.advertiserId, 120),
              brand: readOptionalString(goal?.brand, 80),
              assortmentCategory: readOptionalString(goal?.assortmentCategory, 80),
              storeId: readOptionalString(goal?.storeId, 80),
              pageId: readOptionalString(goal?.pageId, 40),
              shortlistLimit: GOAL_INFERRED_PRODUCT_LIMIT,
              scopedPlacementHints,
              candidates
            })
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "goal_sku_selection",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                selectedSkus: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: GOAL_INFERRED_PRODUCT_LIMIT
                },
                matchedConcepts: {
                  type: "array",
                  items: { type: "string" },
                  maxItems: 8
                },
                reasoning: {
                  type: "string",
                  maxLength: 240
                }
              },
              required: ["selectedSkus", "matchedConcepts", "reasoning"]
            }
          }
        }
      })
    });

    const responseText = await response.text();
    let payload = null;
    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      throw new Error(payload?.error?.message || `OpenAI request failed with status ${response.status}.`);
    }

    const completionText = readChatCompletionTextContent(payload?.choices?.[0]?.message?.content);
    const parsed = completionText ? JSON.parse(completionText) : {};
    const selectedSkus = readStringArray(parsed?.selectedSkus, GOAL_INFERRED_PRODUCT_LIMIT, 80)
      .map((sku) => normalizeSku(sku))
      .filter((sku) => candidateBySku.has(sku));
    const selectedProducts = uniqueBySku(
      selectedSkus
        .map((sku) => candidateBySku.get(sku))
        .filter(Boolean)
    ).slice(0, GOAL_INFERRED_PRODUCT_LIMIT);
    const matchedTerms = readStringArray(parsed?.matchedConcepts, 8, 40)
      .map((term) => readOptionalString(term, 40).toLowerCase())
      .filter(Boolean);

    return {
      products: selectedProducts,
      matchedTerms,
      provider: "openai",
      reasoning: readOptionalString(parsed?.reasoning, 240),
      model: OPENAI_MODEL
    };
  } catch (error) {
    const message = error?.name === "AbortError" ? "request timed out" : error?.message || "unknown error";
    // eslint-disable-next-line no-console
    console.warn(`OpenAI SKU inference failed; falling back to heuristic matching (${message}).`);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function inferTargetProductsFromPrompt(prompt, feed, scopedScreens = [], goal = {}) {
  const aiSelection = await inferTargetProductsFromPromptWithAi(prompt, feed, scopedScreens, goal);
  if (aiSelection) {
    return aiSelection;
  }
  return inferTargetProductsFromPromptHeuristic(prompt, feed, scopedScreens, goal);
}

function screenContainsAnyTargetSku(screen, targetSkuIds) {
  if (!Array.isArray(targetSkuIds) || targetSkuIds.length === 0) {
    return false;
  }
  const targetSkuSet = new Set(targetSkuIds.map((sku) => normalizeSku(sku)));
  for (const lineItem of getEffectiveScreenLineItems(screen)) {
    for (const product of Array.isArray(lineItem.products) ? lineItem.products : []) {
      const sku = normalizeSku(product.ProductId || product.productId || product.sku);
      if (sku && targetSkuSet.has(sku)) {
        return true;
      }
    }
  }
  return false;
}

function getExistingTargetProductsForScreen(screen, targetProducts) {
  if (!Array.isArray(targetProducts) || targetProducts.length === 0) {
    return [];
  }
  const targetSkuIds = targetProducts.map((product) => normalizeSku(product.sku)).filter(Boolean);
  if (!screenContainsAnyTargetSku(screen, targetSkuIds)) {
    return [];
  }
  const matchedSkuIds = new Set();
  for (const lineItem of getEffectiveScreenLineItems(screen)) {
    for (const product of Array.isArray(lineItem.products) ? lineItem.products : []) {
      const sku = normalizeSku(product.ProductId || product.productId || product.sku);
      if (sku) {
        matchedSkuIds.add(sku);
      }
    }
  }
  return targetProducts.filter((product) => matchedSkuIds.has(normalizeSku(product.sku)));
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
      BrandLogo: goalProduct.logo,
      Price: goalProduct.price,
      ComparePrice: goalProduct.comparePrice,
      Rating: goalProduct.rating,
      ClientAdvertiserId: goalProduct.advertiserId,
      advertiserId: goalProduct.advertiserId,
      brand: goalProduct.brand,
      category: goalProduct.category
    },
    screen.screenId,
    screen.location,
    templateId
  );

  product.RenderingAttributes = applyGoalCreativeAttributes(product, objectiveId, goalProduct, screen, templateId);
  product.RenderingAttributes = normalizeRenderingAttributes({
    ...parseJsonObject(product.RenderingAttributes),
    targetSku: goalProduct.sku,
    targetCategory: goalProduct.category,
    targetBrand: goalProduct.brand,
    brandLogo: normalizeBrandLogoPath(goalProduct.logo),
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

function resolveGoalFlightWindow(goal = null) {
  const flightStartDate = readOptionalString(goal?.flightStartDate, 10);
  const flightEndDate = readOptionalString(goal?.flightEndDate, 10);
  if (flightStartDate && flightEndDate) {
    return {
      activeFrom: new Date(`${flightStartDate}T00:00:00.000Z`).toISOString(),
      activeTo: new Date(`${flightEndDate}T23:59:59.999Z`).toISOString()
    };
  }

  const now = new Date();
  return {
    activeFrom: new Date(now.valueOf() - 60 * 1000).toISOString(),
    activeTo: new Date(now.valueOf() + 365 * 24 * 60 * 60 * 1000).toISOString()
  };
}

function buildGoalLineItemForScreen(screen, templateId, objectiveId, goalProductsForScreen, fallbackFeedProduct = null, goal = null) {
  const nextTemplate = getTemplatePreset(templateId);
  const { activeFrom, activeTo } = resolveGoalFlightWindow(goal);
  const goalAdvertiserId = readOptionalString(goal?.advertiserId, 120);
  const goalBrand = readOptionalString(goal?.brand, 120);
  const shareConfig = resolveScreenShareConfig(screen);
  let products = [];
  if (Array.isArray(goalProductsForScreen) && goalProductsForScreen.length > 0) {
    products = goalProductsForScreen.map((product) =>
      buildStorageProductFromFeed(product, screen, nextTemplate.id, objectiveId)
    );
  } else if (fallbackFeedProduct) {
    products = [buildStorageProductFromFeed(fallbackFeedProduct, screen, nextTemplate.id, objectiveId)];
  } else {
    const fallbackProduct = buildStorageProduct({}, screen.screenId, screen.location, nextTemplate.id);
    fallbackProduct.RenderingAttributes = applyGoalCreativeAttributes(
      fallbackProduct,
      objectiveId,
      null,
      screen,
      nextTemplate.id
    );
    products = [fallbackProduct];
  }

  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return {
    lineItemId: `${screen.screenId}-LI-GOAL-${suffix}`.slice(0, 120),
    name: `${goalBrand || titleCase(screen.location)} Sponsored Share`,
    activeFrom,
    activeTo,
    templateId: nextTemplate.id,
    deliverySource: GOAL_LINE_ITEM_SOURCE,
    deliveryShareSlots: shareConfig.sellableShareSlots,
    goalPlanId: readOptionalString(goal?.planId, 120),
    goalAdvertiserId,
    goalObjective: readOptionalString(objectiveId, 40),
    products
  };
}

function pickFallbackFeedProductForScreen(screen, feed = []) {
  const source = Array.isArray(feed) ? feed : [];
  if (source.length === 0) {
    return null;
  }
  const pageToken = normalizeMatchToken(screen?.pageId);
  const locationToken = normalizeMatchToken(screen?.location);
  return (
    source.find((product) => {
      const categoryToken = normalizeMatchToken(product?.category);
      return categoryToken && (categoryToken === pageToken || categoryToken === locationToken);
    }) ||
    source[0] ||
    null
  );
}

function buildBaselineRotationLineItemForScreen(screen, feed = [], nowIso = new Date().toISOString()) {
  const templateId = readOptionalString(screen?.templateId, 80) || "fullscreen-banner";
  const fallbackFeedProduct = pickFallbackFeedProductForScreen(screen, feed);
  const fallbackProduct = fallbackFeedProduct
    ? buildStorageProductFromFeed(fallbackFeedProduct, screen, templateId, "awareness")
    : buildStorageProduct({}, screen.screenId, screen.location, templateId);
  const activeFrom = new Date(Date.parse(nowIso) - 5 * 60 * 1000).toISOString();
  const activeTo = new Date(Date.parse(nowIso) + 365 * 24 * 60 * 60 * 1000).toISOString();

  return normalizeLineItemForStorage(
    {
      name: `${titleCase(screen.location || screen.pageId || "store")} Existing Rotation`,
      activeFrom,
      activeTo,
      templateId,
      products: [fallbackProduct]
    },
    {
      screenId: screen.screenId,
      templateId,
      location: screen.location,
      fallbackProduct
    },
    0
  );
}

function isManagedGoalLineItem(lineItem) {
  return readOptionalString(lineItem?.deliverySource, 40) === GOAL_LINE_ITEM_SOURCE;
}

function isManagedGoalLineItemForGoal(lineItem, goal = {}, planId = "") {
  if (!isManagedGoalLineItem(lineItem)) {
    return false;
  }
  const normalizedPlanId = readOptionalString(planId || goal?.planId, 120);
  const normalizedAdvertiserId = readOptionalString(goal?.advertiserId, 120);
  const lineItemPlanId = readOptionalString(lineItem?.goalPlanId, 120);
  const lineItemAdvertiserId = readOptionalString(lineItem?.goalAdvertiserId, 120);
  return (
    (normalizedPlanId && lineItemPlanId === normalizedPlanId) ||
    (normalizedAdvertiserId && lineItemAdvertiserId === normalizedAdvertiserId)
  );
}

function findPreferredLineItem(lineItems = [], { lineItemId = "", goalPlanId = "", advertiserId = "" } = {}) {
  const source = Array.isArray(lineItems) ? lineItems.filter(Boolean) : [];
  const normalizedLineItemId = readOptionalString(lineItemId, 120);
  if (normalizedLineItemId) {
    return source.find((entry) => readOptionalString(entry?.lineItemId, 120) === normalizedLineItemId) || null;
  }
  const normalizedGoalPlanId = readOptionalString(goalPlanId, 120);
  if (normalizedGoalPlanId) {
    return source.find((entry) => readOptionalString(entry?.goalPlanId, 120) === normalizedGoalPlanId) || null;
  }
  const normalizedAdvertiserId = readOptionalString(advertiserId, 120);
  if (normalizedAdvertiserId) {
    return source.find((entry) => readOptionalString(entry?.goalAdvertiserId, 120) === normalizedAdvertiserId) || null;
  }
  return null;
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

function buildLiveRotationEntry(screen, shareEntry, selectedLineItem, totalSlots) {
  const lineItem = shareEntry?.lineItem;
  const templateId =
    readOptionalString(lineItem?.templateId, 120) ||
    readOptionalString(screen?.templateId, 120) ||
    "fullscreen-banner";
  const template = getTemplatePreset(templateId);
  const sourceProducts = Array.isArray(lineItem?.products) ? lineItem.products : [];
  const deliverySource = readOptionalString(lineItem?.deliverySource, 40);
  const isSelected = Boolean(selectedLineItem && lineItem === selectedLineItem);
  const lineItemName = readOptionalString(lineItem?.name, 180) || template.name;
  const isAutoDefaultRotation =
    !isSelected &&
    deliverySource !== GOAL_LINE_ITEM_SOURCE &&
    /default rotation/i.test(lineItemName);

  return {
    lineItemId: readOptionalString(lineItem?.lineItemId, 120),
    name: isAutoDefaultRotation ? "Unallocated screen time" : lineItemName,
    templateId: template.id,
    templateName: template.name,
    shareRatio: Number(shareEntry?.shareRatio || 0),
    shareLabel: readOptionalString(shareEntry?.shareLabel, 40),
    shareTurnCount: resolveShareTurnCount(shareEntry?.shareRatio, totalSlots),
    role: isSelected ? "selected" : isAutoDefaultRotation ? "unallocated" : deliverySource === GOAL_LINE_ITEM_SOURCE ? "campaign" : "rotation",
    roleLabel: isSelected ? "Live campaign share" : isAutoDefaultRotation ? "Unallocated share" : deliverySource === GOAL_LINE_ITEM_SOURCE ? "Other campaign share" : "Other screen rotation",
    productCount: isAutoDefaultRotation ? 0 : sourceProducts.length,
    products: isAutoDefaultRotation ? [] : sourceProducts.slice(0, 3).map((product) => summarizeLiveProduct(product, template.id, screen.location))
  };
}

function buildLiveScreenSnapshot(screen, options = {}) {
  const now = new Date();
  const lineItems = getEffectiveScreenLineItems(screen);
  const activeLineItems = lineItems.filter((lineItem) => isLineItemActive(lineItem, now));
  const candidateLineItems = activeLineItems.length > 0 ? activeLineItems : lineItems;
  const shareConfig = resolveScreenShareConfig(screen);
  const deliveryShares = resolveLineItemDeliveryShares(candidateLineItems, shareConfig.totalSlots);
  const shareByLineItemId = new Map(
    deliveryShares.map((entry) => [readOptionalString(entry.lineItem?.lineItemId, 120), entry])
  );
  const selectedLineItem =
    findPreferredLineItem(candidateLineItems, options) ||
    candidateLineItems[0] ||
    null;
  const selectedShare = shareByLineItemId.get(readOptionalString(selectedLineItem?.lineItemId, 120)) || null;
  const templateId =
    readOptionalString(selectedLineItem?.templateId, 120) ||
    readOptionalString(screen.templateId, 120) ||
    "fullscreen-banner";
  const template = getTemplatePreset(templateId);
  const sourceProducts = Array.isArray(selectedLineItem?.products) ? selectedLineItem.products : [];
  const products = sourceProducts
    .slice(0, 3)
    .map((product) => summarizeLiveProduct(product, template.id, screen.location));
  const rotationBreakdown = deliveryShares.map((entry) =>
    buildLiveRotationEntry(screen, entry, selectedLineItem, shareConfig.totalSlots)
  );
  const allocatedTurns = rotationBreakdown.reduce((sum, entry) => sum + Number(entry?.shareTurnCount || 0), 0);
  const remainingTurns = Math.max(0, shareConfig.totalSlots - allocatedTurns);
  if (remainingTurns > 0) {
    const remainingShareRatio = remainingTurns / Math.max(1, shareConfig.totalSlots);
    rotationBreakdown.push({
      lineItemId: "",
      name: "Unallocated screen time",
      templateId: "",
      templateName: "",
      shareRatio: Number(remainingShareRatio.toFixed(4)),
      shareLabel: formatLineItemShareLabel(remainingShareRatio, shareConfig.totalSlots),
      shareTurnCount: remainingTurns,
      role: "unallocated",
      roleLabel: "Unallocated share",
      productCount: 0,
      products: []
    });
  }
  const deviceHints = getScreenDeviceHints(screen);
  const debugScreenUrl = `/screen.html?screenId=${encodeURIComponent(screen.screenId)}`;
  const screenUrl = buildSharedPlayerUrl(deviceHints.resolverId);

  return {
    screenId: screen.screenId,
    storeId: screen.storeId,
    pageId: screen.pageId,
    location: screen.location,
    screenType: screen.screenType,
    screenSize: screen.screenSize,
    templateId: template.id,
    templateName: template.name,
    format: buildDefaultFormat(template.id, screen.screenSize),
    refreshInterval: readRefreshInterval(screen.refreshInterval),
    lineItemCount: lineItems.length,
    activeLineItemId: selectedLineItem?.lineItemId || "",
    activeLineItemName: selectedLineItem?.name || "",
    activeLineItemShareRatio: Number(selectedShare?.shareRatio || 0),
    activeLineItemShareLabel: readOptionalString(selectedShare?.shareLabel, 40),
    screenShareSlots: shareConfig.totalSlots,
    defaultSellableShareSlots: shareConfig.sellableShareSlots,
    defaultSellableShareLabel: shareConfig.shareLabel,
    productCount: sourceProducts.length,
    products,
    rotationBreakdown,
    sharedPlayerUrl: SHARED_PLAYER_URL,
    debugScreenUrl,
    resolverId: deviceHints.resolverId,
    screenUrl,
    updatedAt: screen.updatedAt || ""
  };
}

function buildLiveScreensSnapshot(db, screenIds, options = {}) {
  const uniqueIds = [...new Set((screenIds || []).map((entry) => readOptionalString(entry, 80)).filter(Boolean))];
  const screens = uniqueIds
    .map((screenId) => (db.screens || []).find((entry) => entry.screenId === screenId))
    .filter(Boolean)
    .sort((left, right) => left.screenId.localeCompare(right.screenId));
  return screens.map((screen) => buildLiveScreenSnapshot(screen, options));
}

function ensureAgentRunsArray(db) {
  if (!Array.isArray(db.agentRuns)) {
    db.agentRuns = [];
  }
  return db.agentRuns;
}

function resolveGoalRunScreenIds(run) {
  const appliedScreenIds = readScreenIdArray(run?.appliedScreenIds);
  if (appliedScreenIds.length > 0) {
    return appliedScreenIds;
  }
  const plannedScreenIds = readScreenIdArray(run?.plannedScreenIds);
  if (plannedScreenIds.length > 0) {
    return plannedScreenIds;
  }
  const proposedChanges = Array.isArray(run?.proposedChanges) ? run.proposedChanges : [];
  return proposedChanges.map((change) => readOptionalString(change.screenId, 80)).filter(Boolean);
}

function ensureTelemetryEventsArray(db) {
  if (!Array.isArray(db.telemetryEvents)) {
    db.telemetryEvents = [];
  }
  return db.telemetryEvents;
}

function createTelemetryEventId() {
  const now = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `evt-${now}-${random}`;
}

function safeDateMs(value) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.valueOf();
}

function readTelemetryTimestamp(value, fallbackIso = new Date().toISOString()) {
  const source = readOptionalString(value, 80) || fallbackIso;
  const parsed = new Date(source);
  if (Number.isNaN(parsed.valueOf())) {
    return fallbackIso;
  }
  return parsed.toISOString();
}

function readTelemetryEventType(value) {
  const event = normalizeTelemetryEventType(value);
  if (!TELEMETRY_EVENT_TYPES.includes(event)) {
    throw new HttpError(400, `event must be one of: ${TELEMETRY_EVENT_TYPES.join(", ")}`);
  }
  return event;
}

function normalizeTelemetryEventType(value) {
  const rawEvent = readOptionalString(value, 40).toLowerCase();
  if (rawEvent === "load") {
    return "play";
  }
  if (rawEvent === "view") {
    return "exposure";
  }
  return rawEvent;
}

function readTelemetryExposureMs(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return Math.min(Math.round(parsed), 24 * 60 * 60 * 1000);
}

function recordTelemetryEvent(db, rawInput) {
  const input = rawInput && typeof rawInput === "object" ? rawInput : {};
  const event = readTelemetryEventType(input.event);
  const screenId = readRequiredString(input.screenId, "screenId", 80);
  const screen = (db.screens || []).find((entry) => entry.screenId === screenId) || null;
  const matchedLineItem =
    findPreferredLineItem(getEffectiveScreenLineItems(screen), {
      lineItemId: readOptionalString(input.lineItemId, 120),
      goalPlanId: readOptionalString(input.goalPlanId, 120),
      advertiserId: readOptionalString(input.goalAdvertiserId ?? input.advertiserId, 120)
    }) || null;
  const productId = readOptionalString(input.productId, 80) || readOptionalString(input.sku, 80);
  const nowIso = new Date().toISOString();
  const positionValue = Number(input.position);
  const telemetryEvent = {
    eventId: createTelemetryEventId(),
    event,
    occurredAt: readTelemetryTimestamp(input.occurredAt ?? input.timestamp, nowIso),
    collectedAt: nowIso,
    screenId,
    storeId: readOptionalString(input.storeId, 80) || readOptionalString(screen?.storeId, 80),
    pageId: readOptionalString(input.pageId, 40) || readOptionalString(screen?.pageId, 40),
    location: readOptionalString(input.location, 80) || readOptionalString(screen?.location, 80),
    templateId: readOptionalString(input.templateId, 80) || readOptionalString(screen?.templateId, 80),
    lineItemId: readOptionalString(input.lineItemId, 120) || readOptionalString(matchedLineItem?.lineItemId, 120),
    goalPlanId: readOptionalString(input.goalPlanId, 120) || readOptionalString(matchedLineItem?.goalPlanId, 120),
    goalAdvertiserId:
      readOptionalString(input.goalAdvertiserId ?? input.advertiserId, 120) ||
      readOptionalString(matchedLineItem?.goalAdvertiserId, 120),
    adid: readOptionalString(input.adid, 160),
    productId,
    sku: normalizeSku(input.sku || productId),
    productName: readOptionalString(input.productName, 180),
    productPage: readOptionalString(input.productPage, 500),
    source: readOptionalString(input.source, 40) || "screen-player",
    reason: readOptionalString(input.reason, 120),
    exposureMs: readTelemetryExposureMs(input.exposureMs),
    position: Number.isInteger(positionValue) ? Math.max(0, positionValue) : 0
  };

  const telemetryEvents = ensureTelemetryEventsArray(db);
  telemetryEvents.push(telemetryEvent);
  db.telemetryEvents = telemetryEvents.slice(-TELEMETRY_EVENT_LIMIT);
  return telemetryEvent;
}

function summarizeTelemetryCounts(events) {
  const summary = {
    total: 0,
    playCount: 0,
    exposureEventCount: 0,
    exposureMs: 0,
    avgExposureMs: 0,
    screenCount: 0,
    templateCount: 0,
    skuCount: 0,
    lastSeenAt: ""
  };
  const screenIds = new Set();
  const templateIds = new Set();
  const skuIds = new Set();

  for (const event of events) {
    const normalizedEvent = normalizeTelemetryEventType(event.event);
    if (!TELEMETRY_EVENT_TYPES.includes(normalizedEvent)) {
      continue;
    }
    summary.total += 1;
    if (normalizedEvent === "play") {
      summary.playCount += 1;
    }
    if (normalizedEvent === "exposure") {
      summary.exposureEventCount += 1;
      summary.exposureMs += readTelemetryExposureMs(event.exposureMs);
    }

    const screenId = readOptionalString(event.screenId, 80);
    const templateId = readOptionalString(event.templateId, 80);
    const sku = normalizeSku(event.sku || event.productId);
    if (screenId) {
      screenIds.add(screenId);
    }
    if (templateId) {
      templateIds.add(templateId);
    }
    if (sku) {
      skuIds.add(sku);
    }

    const eventTimestamp = readOptionalString(event.occurredAt, 80) || readOptionalString(event.collectedAt, 80);
    const eventMs = safeDateMs(eventTimestamp);
    const currentLastSeenMs = safeDateMs(summary.lastSeenAt);
    if (eventMs !== null && (currentLastSeenMs === null || eventMs > currentLastSeenMs)) {
      summary.lastSeenAt = eventTimestamp;
    }
  }

  summary.screenCount = screenIds.size;
  summary.templateCount = templateIds.size;
  summary.skuCount = skuIds.size;
  summary.avgExposureMs =
    summary.exposureEventCount > 0 ? Math.round(summary.exposureMs / summary.exposureEventCount) : 0;
  return summary;
}

function formatTelemetryPercent(value, fractionDigits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return "0.0%";
  }
  return `${(numeric * 100).toFixed(fractionDigits)}%`;
}

function formatTelemetryRatio(value, fractionDigits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return `0.${"0".repeat(Math.max(0, fractionDigits))}x`;
  }
  return `${numeric.toFixed(fractionDigits)}x`;
}

function formatTelemetrySignedDuration(ms) {
  const numeric = Number(ms);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "0s";
  }
  const prefix = numeric > 0 ? "+" : "-";
  return `${prefix}${formatDuration(Math.abs(numeric))}`;
}

function formatTelemetrySignedMoney(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "$0";
  }
  const prefix = numeric > 0 ? "+" : "-";
  return `${prefix}$${Math.round(Math.abs(numeric)).toLocaleString()}`;
}

function formatTelemetrySignedPercent(value, fractionDigits = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "0.0 pp";
  }
  const prefix = numeric > 0 ? "+" : "-";
  return `${prefix}${Math.abs(numeric * 100).toFixed(fractionDigits)} pp`;
}

function formatTelemetryComparisonValue(unit, value) {
  switch (unit) {
    case "percent":
      return formatTelemetryPercent(value);
    case "ratio":
      return formatTelemetryRatio(value);
    case "duration":
      return formatDuration(Math.max(0, Number(value) || 0));
    case "currency":
      return `$${Math.round(Number(value) || 0).toLocaleString()}`;
    case "count":
    default:
      return formatCount(value);
  }
}

function formatTelemetryComparisonDelta(unit, value) {
  switch (unit) {
    case "percent":
      return formatTelemetrySignedPercent(value);
    case "ratio":
      return `${Number(value) >= 0 ? "+" : "-"}${Math.abs(Number(value) || 0).toFixed(1)}x`;
    case "duration":
      return formatTelemetrySignedDuration(value);
    case "currency":
      return formatTelemetrySignedMoney(value);
    case "count":
    default:
      return `${Number(value) >= 0 ? "+" : "-"}${Math.abs(Math.round(Number(value) || 0)).toLocaleString()}`;
  }
}

function buildTelemetryComparison(currentValue, baselineValue, unit = "count") {
  const current = Number(currentValue);
  const baseline = Number(baselineValue);
  if (!Number.isFinite(current) || !Number.isFinite(baseline)) {
    return null;
  }
  const delta = current - baseline;
  return {
    baselineValue: baseline,
    baselineText: formatTelemetryComparisonValue(unit, baseline),
    currentValue: current,
    currentText: formatTelemetryComparisonValue(unit, current),
    deltaValue: delta,
    deltaText: formatTelemetryComparisonDelta(unit, delta),
    deltaPercent: baseline !== 0 ? delta / baseline : null,
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat"
  };
}

function buildTelemetryMetric({
  key,
  label,
  description,
  value,
  unit,
  formula,
  sourceTags = [],
  numerator = null,
  denominator = null,
  numeratorLabel = "",
  denominatorLabel = "",
  comparison = null,
  secondaryValue = null,
  secondaryLabel = ""
}) {
  const normalizedValue = Number(value);
  const normalizedSecondaryValue = Number(secondaryValue);
  return {
    key,
    label,
    description,
    value: Number.isFinite(normalizedValue) ? normalizedValue : 0,
    valueText: formatTelemetryComparisonValue(unit, normalizedValue),
    unit,
    formula,
    sourceTags,
    numerator: Number.isFinite(Number(numerator)) ? Number(numerator) : null,
    denominator: Number.isFinite(Number(denominator)) ? Number(denominator) : null,
    numeratorLabel,
    denominatorLabel,
    secondaryValue: Number.isFinite(normalizedSecondaryValue) ? normalizedSecondaryValue : null,
    secondaryValueText: Number.isFinite(normalizedSecondaryValue)
      ? formatTelemetryComparisonValue(secondaryLabel === "currency" ? "currency" : secondaryLabel || unit, normalizedSecondaryValue)
      : "",
    secondaryLabel,
    comparison,
    model: "modeled"
  };
}

function resolveTelemetryMeasurementRun(db, planId) {
  const runs = ensureAgentRunsArray(db);
  const requestedPlanId = readOptionalString(planId, 120);
  if (requestedPlanId) {
    return runs.find((entry) => entry.planId === requestedPlanId) || null;
  }
  return null;
}

function collectMeasurementScreenIds(run, planComparison = null) {
  const screenIds = [
    ...(Array.isArray(run?.appliedScreenIds) ? run.appliedScreenIds : []),
    ...(Array.isArray(run?.liveScreens) ? run.liveScreens.map((screen) => screen.screenId) : []),
    ...(Array.isArray(run?.plannedScreenIds) ? run.plannedScreenIds : []),
    ...(Array.isArray(run?.selectedPlacementScreenIds) ? run.selectedPlacementScreenIds : []),
    ...(Array.isArray(planComparison?.affectedScreens) ? planComparison.affectedScreens : [])
  ]
    .map((screenId) => readOptionalString(screenId, 80))
    .filter(Boolean);
  return [...new Set(screenIds)];
}

function getMeasurementScreens(db, run, planComparison = null) {
  const screenMap = new Map((Array.isArray(db?.screens) ? db.screens : []).map((screen) => [readOptionalString(screen.screenId, 80), screen]));
  return collectMeasurementScreenIds(run, planComparison)
    .map((screenId) => screenMap.get(screenId))
    .filter(Boolean);
}

function getMeasurementStoreIds(run, screens = []) {
  const storeIds = [
    readOptionalString(run?.goal?.storeId, 80),
    ...(Array.isArray(screens) ? screens.map((screen) => readOptionalString(screen?.storeId, 80)) : [])
  ]
    .filter(Boolean);
  return [...new Set(storeIds)];
}

function aggregateDemoStoreSignals(storeIds = []) {
  const signals = [...new Set((Array.isArray(storeIds) ? storeIds : []).map((storeId) => readOptionalString(storeId, 80)).filter(Boolean))]
    .map((storeId) => DEMO_STORE_SALES_SIGNAL_MAP.get(storeId))
    .filter(Boolean);

  if (signals.length === 0) {
    return {
      storeCount: 0,
      totalSales: 0,
      avgBasketValue: 42,
      salesIndex: 0.5,
      footTrafficIndex: 0.5,
      checkoutIntentIndex: 0.5,
      premiumDemandIndex: 0.5,
      clearancePressureIndex: 0.5
    };
  }

  return {
    storeCount: signals.length,
    totalSales: Math.round(averageOf(signals.map((signal) => signal.totalSales), 0)),
    avgBasketValue: Number(averageOf(signals.map((signal) => signal.avgBasketValue), 42).toFixed(2)),
    salesIndex: Number(averageOf(signals.map((signal) => signal.salesIndex), 0.5).toFixed(2)),
    footTrafficIndex: Number(averageOf(signals.map((signal) => signal.footTrafficIndex), 0.5).toFixed(2)),
    checkoutIntentIndex: Number(averageOf(signals.map((signal) => signal.checkoutIntentIndex), 0.5).toFixed(2)),
    premiumDemandIndex: Number(averageOf(signals.map((signal) => signal.premiumDemandIndex), 0.5).toFixed(2)),
    clearancePressureIndex: Number(averageOf(signals.map((signal) => signal.clearancePressureIndex), 0.5).toFixed(2))
  };
}

function getMeasurementTargetProducts(run) {
  const rawProducts = Array.isArray(run?.goal?.targetProducts) ? run.goal.targetProducts : [];
  return rawProducts
    .map((product, index) => normalizeProductFeedItem(product, index))
    .filter((product) => Boolean(product?.sku));
}

function getMeasurementObjectiveBoost(objective) {
  switch (objective) {
    case "checkout-attach":
      return 0.07;
    case "clearance":
      return 0.06;
    case "premium":
      return 0.08;
    case "awareness":
    default:
      return 0.05;
  }
}

function buildTelemetryMeasurementScenario({ totals = {}, run = null, storeSignal = null, targetProducts = [] } = {}) {
  const playCount = Math.max(0, Math.round(Number(totals.playCount || 0)));
  const exposureMs = Math.max(0, Math.round(Number(totals.exposureMs || 0)));
  const exposureEventCount = Math.max(0, Math.round(Number(totals.exposureEventCount || 0)));
  const avgExposureMs =
    Number.isFinite(Number(totals.avgExposureMs)) && Number(totals.avgExposureMs) > 0
      ? Math.round(Number(totals.avgExposureMs))
      : exposureEventCount > 0
        ? Math.round(exposureMs / exposureEventCount)
        : 0;
  const impressionProxy = Math.max(playCount, Math.round(exposureMs / 30000));
  const objective = readOptionalString(run?.goal?.objective, 40) || "awareness";
  const selectedSpend = Math.max(0, Math.round(Number(run?.budget?.selectedSpend || 0)));
  const maxSpend = Math.max(selectedSpend, Math.round(Number(run?.budget?.maxSpend || 0)));
  const budgetUtilization = maxSpend > 0 ? clampNumber(selectedSpend / maxSpend, 0, 1) : 0.5;
  const avgPrice = Number(averageOf(targetProducts.map((product) => readNumericValue(product?.price, 0)), 0).toFixed(2));
  const targetBrands = [...new Set(targetProducts.map((product) => readOptionalString(product?.brand, 80)).filter(Boolean))];
  const brandDiversity = targetProducts.length > 0 ? clampNumber(targetBrands.length / Math.max(targetProducts.length, 1), 0, 1) : 0.35;
  const priceBoost = clampNumber(avgPrice / 1000, 0.05, 0.7);
  const exposureBoost = clampNumber(avgExposureMs / 30000, 0.8, 1.35);
  const salesMultiple =
    1.85 +
    Number(storeSignal?.salesIndex || 0.5) * 0.9 +
    Number(storeSignal?.footTrafficIndex || 0.5) * 0.55 +
    Number(storeSignal?.checkoutIntentIndex || 0.5) * 0.4 +
    priceBoost * 0.6 +
    getMeasurementObjectiveBoost(objective) +
    budgetUtilization * 0.35 +
    (exposureBoost - 1) * 0.4;
  const modeledInStoreSales = Math.max(0, Math.round(impressionProxy * salesMultiple));
  const qrScanRate = clampNumber(
    0.014 +
      Number(storeSignal?.checkoutIntentIndex || 0.5) * 0.022 +
      Number(storeSignal?.footTrafficIndex || 0.5) * 0.01 +
      Math.min(0.018, targetProducts.length * 0.003) +
      (exposureBoost - 1) * 0.01,
    0.01,
    0.08
  );
  const qrScans = Math.max(0, Math.round(impressionProxy * qrScanRate));
  const loyaltyActions = Math.max(0, Math.round(qrScans * clampNumber(0.18 + budgetUtilization * 0.08 + brandDiversity * 0.08, 0.12, 0.42)));
  const interactionActions = qrScans + loyaltyActions;
  const interactionRate = impressionProxy > 0 ? interactionActions / impressionProxy : 0;
  const incrementalityRate = clampNumber(
    0.08 +
      Number(storeSignal?.salesIndex || 0.5) * 0.05 +
      Number(storeSignal?.checkoutIntentIndex || 0.5) * 0.05 +
      budgetUtilization * 0.08 +
      interactionRate * 0.28 +
      getMeasurementObjectiveBoost(objective) * 0.4,
    0.06,
    0.3
  );
  const incrementalSales = Math.max(0, Math.round(modeledInStoreSales * incrementalityRate));
  const baselineSales = Math.max(0, modeledInStoreSales - incrementalSales);
  const newBuyerRate = clampNumber(
    0.07 +
      Number(storeSignal?.footTrafficIndex || 0.5) * 0.04 +
      brandDiversity * 0.08 +
      priceBoost * 0.05 +
      getMeasurementObjectiveBoost(objective) * 0.25,
    0.05,
    0.24
  );
  const newBuyerSales = Math.max(0, Math.round(modeledInStoreSales * newBuyerRate));
  const newBuyerTransactions = Math.max(0, Math.round(newBuyerSales / Math.max(1, Number(storeSignal?.avgBasketValue || 42))));
  const inStoreROAS = selectedSpend > 0 ? modeledInStoreSales / selectedSpend : 0;

  return {
    objective,
    selectedSpend,
    maxSpend,
    budgetUtilization,
    avgPrice,
    targetBrands,
    targetBrandCount: targetBrands.length,
    targetSkuCount: targetProducts.length,
    storeSignal,
    impressionProxy,
    playCount,
    exposureMs,
    avgExposureMs,
    qrScans,
    loyaltyActions,
    interactionActions,
    interactionRate,
    modeledInStoreSales,
    baselineSales,
    incrementalSales,
    incrementalityRate,
    newBuyerSales,
    newBuyerTransactions,
    newBuyerRate,
    inStoreROAS
  };
}

function buildTelemetryMeasurementBoard(db, telemetryTotals, planComparison, planId) {
  const run = resolveTelemetryMeasurementRun(db, planId);
  const screens = getMeasurementScreens(db, run, planComparison);
  const storeIds = getMeasurementStoreIds(run, screens);
  const storeSignal = aggregateDemoStoreSignals(storeIds);
  const targetProducts = getMeasurementTargetProducts(run);
  const currentTotals = planComparison?.afterApply || telemetryTotals;
  const baselineTotals = planComparison?.beforeApply || null;
  const currentScenario = buildTelemetryMeasurementScenario({
    totals: currentTotals,
    run,
    storeSignal,
    targetProducts
  });
  const baselineScenario = baselineTotals
    ? buildTelemetryMeasurementScenario({
        totals: baselineTotals,
        run,
        storeSignal,
        targetProducts
      })
    : null;

  const metrics = [
    buildTelemetryMetric({
      key: "interactionRate",
      label: "Shopper interaction rate",
      description: "Estimated share of live plays that drove a QR scan or loyalty action.",
      value: currentScenario.interactionRate,
      unit: "percent",
      formula: "(QR scans + loyalty actions) / ad plays",
      sourceTags: ["telemetry", "modeled", "engagement"],
      numerator: currentScenario.interactionActions,
      denominator: currentScenario.impressionProxy,
      numeratorLabel: "Engagement actions",
      denominatorLabel: "Ad plays",
      comparison: baselineScenario ? buildTelemetryComparison(currentScenario.interactionRate, baselineScenario.interactionRate, "percent") : null,
      secondaryValue: currentScenario.loyaltyActions,
      secondaryLabel: "count"
    }),
    buildTelemetryMetric({
      key: "qrScans",
      label: "Estimated QR scans",
      description: "Estimated coupon or product-detail opens modeled from live delivery.",
      value: currentScenario.qrScans,
      unit: "count",
      formula: "Impression proxy x modeled QR scan rate",
      sourceTags: ["telemetry", "modeled", "qr"],
      numerator: currentScenario.qrScans,
      denominator: currentScenario.impressionProxy,
      numeratorLabel: "Scans",
      denominatorLabel: "Impression proxy",
      comparison: baselineScenario ? buildTelemetryComparison(currentScenario.qrScans, baselineScenario.qrScans, "count") : null,
      secondaryValue: currentScenario.loyaltyActions,
      secondaryLabel: "count"
    }),
    buildTelemetryMetric({
      key: "incrementality",
      label: "Incremental sales",
      description: "Estimated sales lift attributable to advertising versus a no-media baseline.",
      value: currentScenario.incrementalSales,
      unit: "currency",
      formula: "Modeled in-store sales x incrementality rate",
      sourceTags: ["telemetry", "plan", "sales-signal", "model"],
      numerator: currentScenario.incrementalSales,
      denominator: currentScenario.modeledInStoreSales,
      numeratorLabel: "Incremental sales",
      denominatorLabel: "Modeled sales",
      comparison: baselineScenario ? buildTelemetryComparison(currentScenario.incrementalSales, baselineScenario.incrementalSales, "currency") : null,
      secondaryValue: currentScenario.baselineSales,
      secondaryLabel: "currency"
    }),
    buildTelemetryMetric({
      key: "newBuyerAcquisition",
      label: "New-to-brand sales",
      description: "Estimated first-time brand purchase value modeled from store sales signals and the target mix.",
      value: currentScenario.newBuyerSales,
      unit: "currency",
      formula: "Modeled in-store sales x new-to-brand rate",
      sourceTags: ["telemetry", "pos-model", "sales-signal", "model"],
      numerator: currentScenario.newBuyerSales,
      denominator: currentScenario.modeledInStoreSales,
      numeratorLabel: "New-to-brand sales",
      denominatorLabel: "Modeled sales",
      comparison: baselineScenario ? buildTelemetryComparison(currentScenario.newBuyerSales, baselineScenario.newBuyerSales, "currency") : null,
      secondaryValue: currentScenario.newBuyerTransactions,
      secondaryLabel: "count"
    }),
    buildTelemetryMetric({
      key: "inStoreROAS",
      label: "Return on spend",
      description: "Estimated in-store sales divided by the selected campaign spend.",
      value: currentScenario.inStoreROAS,
      unit: "ratio",
      formula: "Modeled in-store sales / selected spend",
      sourceTags: ["plan", "sales-signal", "model"],
      numerator: currentScenario.modeledInStoreSales,
      denominator: currentScenario.selectedSpend,
      numeratorLabel: "Modeled sales",
      denominatorLabel: "Selected spend",
      comparison: baselineScenario ? buildTelemetryComparison(currentScenario.inStoreROAS, baselineScenario.inStoreROAS, "ratio") : null
    }),
    buildTelemetryMetric({
      key: "totalExposureTime",
      label: "Total exposure time",
      description: "Total visible dwell time captured from exposure beacons.",
      value: currentScenario.exposureMs,
      unit: "duration",
      formula: "Sum of exposure beacon dwell time",
      sourceTags: ["telemetry"],
      numerator: currentScenario.exposureMs,
      denominator: currentScenario.playCount,
      numeratorLabel: "Exposure time",
      denominatorLabel: "Ad plays",
      comparison: baselineScenario ? buildTelemetryComparison(currentScenario.exposureMs, baselineScenario.exposureMs, "duration") : null
    }),
    buildTelemetryMetric({
      key: "totalAdPlays",
      label: "Total Ad Plays",
      description: "All proof-of-play events counted for the selected scope.",
      value: currentScenario.playCount,
      unit: "count",
      formula: "Count of play beacon events",
      sourceTags: ["telemetry"],
      numerator: currentScenario.playCount,
      denominator: currentScenario.playCount,
      numeratorLabel: "Play events",
      denominatorLabel: "Play events",
      comparison: baselineScenario ? buildTelemetryComparison(currentScenario.playCount, baselineScenario.playCount, "count") : null
    })
  ];

  const scopeScreenIds = collectMeasurementScreenIds(run, planComparison);
  const scopeLabel = scopeScreenIds.length > 0 ? `${scopeScreenIds.length} scoped screen${scopeScreenIds.length === 1 ? "" : "s"}` : "all live telemetry";
  const trendParts = [];
  if (baselineScenario) {
    trendParts.push(
      `${formatCount(currentScenario.playCount)} plays vs ${formatCount(baselineScenario.playCount)} before apply`,
      `${formatDuration(currentScenario.exposureMs)} exposure vs ${formatDuration(baselineScenario.exposureMs)} before apply`
    );
  } else {
    trendParts.push(`${formatCount(currentScenario.playCount)} plays`, `${formatDuration(currentScenario.exposureMs)} exposure`);
  }
  trendParts.push(`${formatMoney(currentScenario.incrementalSales)} incremental sales`);

  return {
    modelType: "modeled-demo",
    generatedAt: new Date().toISOString(),
    scope: {
      planId: readOptionalString(planId, 120),
      runStatus: readOptionalString(run?.status, 40),
      scopeLabel,
      screenCount: scopeScreenIds.length > 0 ? scopeScreenIds.length : Number(telemetryTotals.screenCount || 0),
      storeCount: storeSignal.storeCount,
      storeIds,
      targetSkuCount: currentScenario.targetSkuCount,
      targetBrandCount: currentScenario.targetBrandCount,
      objective: currentScenario.objective,
      selectedSpend: currentScenario.selectedSpend,
      maxSpend: currentScenario.maxSpend,
      budgetUtilization: currentScenario.budgetUtilization,
      sourceTags: [...new Set(metrics.flatMap((metric) => metric.sourceTags))]
    },
    current: {
      playCount: currentScenario.playCount,
      exposureMs: currentScenario.exposureMs,
      impressionProxy: currentScenario.impressionProxy,
      modeledInStoreSales: currentScenario.modeledInStoreSales,
      incrementalSales: currentScenario.incrementalSales,
      newBuyerSales: currentScenario.newBuyerSales,
      inStoreROAS: currentScenario.inStoreROAS
    },
    baseline: baselineScenario
      ? {
          playCount: baselineScenario.playCount,
          exposureMs: baselineScenario.exposureMs,
          impressionProxy: baselineScenario.impressionProxy,
          modeledInStoreSales: baselineScenario.modeledInStoreSales,
          incrementalSales: baselineScenario.incrementalSales,
          newBuyerSales: baselineScenario.newBuyerSales,
          inStoreROAS: baselineScenario.inStoreROAS
        }
      : null,
    narrative: {
      headline: scopeScreenIds.length > 0 ? `Measurement readout for ${scopeLabel}` : "Measurement readout for all live telemetry",
      summary:
        "Live plays and exposure anchor the board, while shopper response, sales lift, new-to-brand value, and return on spend are estimated from the active plan and store sales signals.",
      comparisonStory: baselineScenario
        ? `Compared with the pre-apply window, the scoped inventory is showing ${formatTelemetrySignedPercent(
            currentScenario.interactionRate - baselineScenario.interactionRate
          )} interaction-rate change, ${formatTelemetrySignedMoney(currentScenario.incrementalSales - baselineScenario.incrementalSales)} incremental sales change, and ${formatTelemetrySignedDuration(
            currentScenario.exposureMs - baselineScenario.exposureMs
          )} exposure change.`
        : `Estimated from the current telemetry set, with ${formatCount(currentScenario.qrScans)} QR scans and ${formatMoney(
            currentScenario.incrementalSales
          )} incremental sales.`,
      sourceNote:
        "Estimated shopper actions and retail outcomes use the same live telemetry, plan budget, and store sales inputs used elsewhere in the demo.",
      trend: trendParts.join(" | ")
    },
    metrics
  };
}

function buildTelemetryBreakdown(events, keySelector, decorate, limit = TELEMETRY_BREAKDOWN_LIMIT) {
  const entries = new Map();

  for (const event of events) {
    const normalizedEvent = normalizeTelemetryEventType(event.event);
    if (!TELEMETRY_EVENT_TYPES.includes(normalizedEvent)) {
      continue;
    }
    const key = readOptionalString(keySelector(event), 120);
    if (!key) {
      continue;
    }

    let summary = entries.get(key);
    if (!summary) {
      summary = {
        key,
        total: 0,
        playCount: 0,
        exposureEventCount: 0,
        exposureMs: 0,
        avgExposureMs: 0,
        lastSeenAt: "",
        ...(typeof decorate === "function" ? decorate(event, key) : {})
      };
      entries.set(key, summary);
    }

    summary.total += 1;
    if (normalizedEvent === "play") {
      summary.playCount += 1;
    }
    if (normalizedEvent === "exposure") {
      summary.exposureEventCount += 1;
      summary.exposureMs += readTelemetryExposureMs(event.exposureMs);
    }

    const eventTimestamp = readOptionalString(event.occurredAt, 80) || readOptionalString(event.collectedAt, 80);
    const eventMs = safeDateMs(eventTimestamp);
    const currentLastSeenMs = safeDateMs(summary.lastSeenAt);
    if (eventMs !== null && (currentLastSeenMs === null || eventMs > currentLastSeenMs)) {
      summary.lastSeenAt = eventTimestamp;
    }
  }

  return [...entries.values()]
    .sort((left, right) => {
      if (right.exposureMs !== left.exposureMs) {
        return right.exposureMs - left.exposureMs;
      }
      if (right.playCount !== left.playCount) {
        return right.playCount - left.playCount;
      }
      if (right.total !== left.total) {
        return right.total - left.total;
      }
      const rightMs = safeDateMs(right.lastSeenAt) ?? 0;
      const leftMs = safeDateMs(left.lastSeenAt) ?? 0;
      if (rightMs !== leftMs) {
        return rightMs - leftMs;
      }
      return String(left.key).localeCompare(String(right.key));
    })
    .map((entry) => ({
      ...entry,
      avgExposureMs:
        entry.exposureEventCount > 0 ? Math.round(entry.exposureMs / entry.exposureEventCount) : 0
    }))
    .slice(0, limit);
}

function filterTelemetryEventsForPlan(db, planId, events) {
  const normalizedPlanId = readOptionalString(planId, 120);
  const run = resolveTelemetryMeasurementRun(db, normalizedPlanId);
  if (!normalizedPlanId || !run) {
    return [];
  }

  const appliedMs = safeDateMs(run.appliedAt);
  if (appliedMs === null) {
    return [];
  }

  const scopedScreenIds = new Set(collectMeasurementScreenIds(run));
  const candidateEvents = events.filter((event) => {
    const eventMs =
      safeDateMs(readOptionalString(event.occurredAt, 80) || readOptionalString(event.collectedAt, 80)) ?? 0;
    if (eventMs < appliedMs) {
      return false;
    }

    const eventPlanId = readOptionalString(event.goalPlanId, 120);
    if (eventPlanId) {
      return eventPlanId === normalizedPlanId;
    }

    const eventScreenId = readOptionalString(event.screenId, 80);
    return scopedScreenIds.size > 0 && scopedScreenIds.has(eventScreenId);
  });
  const attributedEvents = candidateEvents.filter(
    (event) => readOptionalString(event.goalPlanId, 120) === normalizedPlanId
  );
  return attributedEvents.length > 0 ? attributedEvents : candidateEvents;
}

function buildPlanTelemetryComparison(db, planId, events) {
  const runs = ensureAgentRunsArray(db);
  const run = runs.find((entry) => entry.planId === planId);
  if (!run) {
    return null;
  }

  const appliedScreenIds = readScreenIdArray(run.appliedScreenIds);
  const proposedChanges = Array.isArray(run.proposedChanges) ? run.proposedChanges : [];
  const fallbackScreenIds = proposedChanges.map((change) => readOptionalString(change.screenId, 80)).filter(Boolean);
  const screenIds = [...new Set((appliedScreenIds.length > 0 ? appliedScreenIds : fallbackScreenIds).filter(Boolean))];
  const scopedEvents = events.filter((event) => screenIds.includes(readOptionalString(event.screenId, 80)));
  const appliedMs = safeDateMs(run.appliedAt);
  if (appliedMs === null) {
    return {
      planId,
      status: run.status || "planned",
      createdAt: run.createdAt || "",
      appliedAt: run.appliedAt || "",
      screenCount: screenIds.length,
      affectedScreens: screenIds.slice(0, TELEMETRY_BREAKDOWN_LIMIT),
      beforeApply: null,
      afterApply: null
    };
  }

  const createdMs = safeDateMs(run.createdAt);
  const beforeApplyEvents = scopedEvents.filter((event) => {
    const eventMs =
      safeDateMs(readOptionalString(event.occurredAt, 80) || readOptionalString(event.collectedAt, 80)) ?? 0;
    if (createdMs !== null && eventMs < createdMs) {
      return false;
    }
    return eventMs < appliedMs;
  });
  const candidateAfterApplyEvents = scopedEvents.filter((event) => {
    const eventMs =
      safeDateMs(readOptionalString(event.occurredAt, 80) || readOptionalString(event.collectedAt, 80)) ?? 0;
    return eventMs >= appliedMs;
  });
  const attributedAfterApplyEvents = candidateAfterApplyEvents.filter(
    (event) => readOptionalString(event.goalPlanId, 120) === planId
  );
  const afterApplyEvents =
    attributedAfterApplyEvents.length > 0 ? attributedAfterApplyEvents : candidateAfterApplyEvents;

  return {
    planId,
    status: run.status || "planned",
    createdAt: run.createdAt || "",
    appliedAt: run.appliedAt || "",
    screenCount: screenIds.length,
    affectedScreens: screenIds.slice(0, TELEMETRY_BREAKDOWN_LIMIT),
    beforeApply: summarizeTelemetryCounts(beforeApplyEvents),
    afterApply: summarizeTelemetryCounts(afterApplyEvents)
  };
}

function buildTelemetrySummary(db, planId = "") {
  const telemetryEvents = [...ensureTelemetryEventsArray(db)].sort((left, right) => {
    const rightMs =
      safeDateMs(readOptionalString(right.occurredAt, 80) || readOptionalString(right.collectedAt, 80)) ?? 0;
    const leftMs =
      safeDateMs(readOptionalString(left.occurredAt, 80) || readOptionalString(left.collectedAt, 80)) ?? 0;
    return rightMs - leftMs;
  });
  const scopedTelemetryEvents = planId ? filterTelemetryEventsForPlan(db, planId, telemetryEvents) : telemetryEvents;
  const telemetryTotals = summarizeTelemetryCounts(scopedTelemetryEvents);
  const planComparison = planId ? buildPlanTelemetryComparison(db, planId, telemetryEvents) : null;

  return {
    totals: telemetryTotals,
    byScreen: buildTelemetryBreakdown(
      scopedTelemetryEvents,
      (event) => event.screenId,
      (event, key) => ({
        screenId: key,
        templateId: readOptionalString(event.templateId, 80),
        storeId: readOptionalString(event.storeId, 80),
        pageId: readOptionalString(event.pageId, 40)
      })
    ),
    byTemplate: buildTelemetryBreakdown(
      scopedTelemetryEvents,
      (event) => event.templateId,
      (_event, key) => {
        const template = getTemplatePreset(key);
        return {
          templateId: key,
          templateName: template.name
        };
      }
    ),
    bySku: buildTelemetryBreakdown(
      scopedTelemetryEvents,
      (event) => normalizeSku(event.sku || event.productId),
      (event, key) => ({
        sku: key,
        productName: readOptionalString(event.productName, 180)
      })
    ),
    planComparison,
    measurementBoard: buildTelemetryMeasurementBoard(db, telemetryTotals, planComparison, planId)
  };
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
  const flightStartDate = readRequiredDateInput(raw.flightStartDate, "flightStartDate");
  const flightEndDate = readRequiredDateInput(raw.flightEndDate, "flightEndDate");
  const flightDays = computeInclusiveDayCount(flightStartDate, flightEndDate);
  if (!flightDays) {
    throw new HttpError(400, "flightEndDate must be on or after flightStartDate.");
  }
  if (flightDays > MAX_GOAL_FLIGHT_DAYS) {
    throw new HttpError(400, `flight range must be ${MAX_GOAL_FLIGHT_DAYS} days or fewer.`);
  }

  return {
    objective,
    aggressiveness,
    prompt: readOptionalString(raw.prompt, 280),
    storeId: readOptionalString(raw.storeId, 80),
    pageId: readOptionalString(raw.pageId, 40),
    flightStartDate,
    flightEndDate,
    flightDays,
    assortmentCategory: readOptionalString(raw.assortmentCategory, 80).toLowerCase(),
    advertiserId: readRequiredString(raw.advertiserId, "advertiserId", 120),
    brand: readOptionalString(raw.brand, 80),
    pricingModelId: GOAL_PRICING_MODEL.id,
    pricingModelLabel: GOAL_PRICING_MODEL.label,
    targetSkuIds
  };
}

async function resolveGoalTargetProducts(goal, feed, scopedScreens, options = {}) {
  const allowAccountFallback = options.allowAccountFallback !== false;
  const normalizedFeed = Array.isArray(feed)
    ? feed.map((product, index) => normalizeProductFeedItem(product, index))
    : [];
  const requestedAdvertiserId = readOptionalString(goal.advertiserId, 120);
  const requestedBrand = readOptionalString(goal.brand, 80).toLowerCase();
  const requestedCategory = readOptionalString(goal.assortmentCategory, 80).toLowerCase();
  const filteredFeed = normalizedFeed.filter((product) => {
    if (requestedAdvertiserId && product.advertiserId !== requestedAdvertiserId) {
      return false;
    }
    if (requestedBrand && product.brand.toLowerCase() !== requestedBrand) {
      return false;
    }
    if (requestedCategory && normalizeMatchToken(product.category) !== requestedCategory) {
      return false;
    }
    return true;
  });
  const requestedSkuIds = [
    ...new Set(
      readStringArray(goal.targetSkuIds, GOAL_TARGET_SKU_LIMIT, 80)
        .map((entry) => normalizeSku(entry))
        .filter(Boolean)
    )
  ];

  if (requestedSkuIds.length > 0) {
    const selectedProducts = filteredFeed.filter((product) =>
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
      inferredTerms: [],
      inferenceReasoning: "",
      inferenceModel: ""
    };
  }

  const inferenceFeed = filteredFeed.length > 0 ? filteredFeed : normalizedFeed;
  const inferred = await inferTargetProductsFromPrompt(goal.prompt, inferenceFeed, scopedScreens, goal);
  if (inferred.products.length > 0) {
    return {
      targetSkuIds: inferred.products.map((product) => normalizeSku(product.sku)),
      targetProducts: inferred.products,
      targetSource: inferred.provider === "openai" ? "prompt-ai" : "prompt",
      inferredTerms: inferred.matchedTerms,
      inferenceReasoning: inferred.reasoning || "",
      inferenceModel: inferred.model || ""
    };
  }

  if ((requestedAdvertiserId || requestedBrand) && filteredFeed.length > 0 && allowAccountFallback) {
    const accountProducts = filteredFeed.slice(0, GOAL_TARGET_SKU_LIMIT);
    return {
      targetSkuIds: accountProducts.map((product) => normalizeSku(product.sku)),
      targetProducts: accountProducts,
      targetSource: "account",
      inferredTerms: [],
      inferenceReasoning: goal.prompt
        ? "The brief did not map confidently to a specific SKU shortlist, so the planner widened back to the broader brand assortment."
        : "",
      inferenceModel: ""
    };
  }

  return {
    targetSkuIds: [],
    targetProducts: [],
    targetSource: "none",
    inferredTerms: [],
    inferenceReasoning: goal.prompt
      ? "The brief was too ambiguous to produce a confident SKU shortlist. Try describing simpler shopper needs such as easy setup, everyday use, budget, premium, or high stock."
      : "",
    inferenceModel: ""
  };
}

function computeGoalTemplateId(screen, objectiveId, context = {}) {
  const screenType = toTrimmedString(screen.screenType).toLowerCase();
  const pageId = toTrimmedString(screen.pageId).toLowerCase();
  const location = toTrimmedString(screen.location).toLowerCase();
  const planningSignals = context?.planningSignals && typeof context.planningSignals === "object" ? context.planningSignals : {};
  const goalProductsForScreen = Array.isArray(context?.goalProductsForScreen) ? context.goalProductsForScreen : [];
  const wantsRotation = Boolean(planningSignals.wantsAssortmentRotation || goalProductsForScreen.length > 1);
  const wantsHeroMoment = Boolean(planningSignals.wantsHeroMoment);

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
        return isVertical ? "fullscreen-hero" : wantsRotation ? "carousel-banner" : "fullscreen-banner";
      }
      return isVertical ? "fullscreen-hero" : wantsRotation ? "carousel-banner" : "fullscreen-banner";
    case "clearance":
      if (isAisleContext) {
        return "shelf-spotlight";
      }
      return isVertical ? "fullscreen-hero" : wantsRotation ? "carousel-banner" : "fullscreen-banner";
    case "premium":
      return wantsHeroMoment || isVertical ? "fullscreen-hero" : "fullscreen-banner";
    case "awareness":
    default:
      if (wantsRotation && !isVertical && !isCheckoutContext) {
        return "carousel-banner";
      }
      return isVertical || wantsHeroMoment ? "fullscreen-hero" : "fullscreen-banner";
  }
}

function computeGoalConfidence(screen, objectiveId, productRelevance = 0.58, planningScore = 0.58, scoreBreakdown = {}) {
  const screenType = toTrimmedString(screen.screenType).toLowerCase();
  const pageId = toTrimmedString(screen.pageId).toLowerCase();
  const location = toTrimmedString(screen.location).toLowerCase();

  let score =
    0.42 +
    productRelevance * 0.14 +
    clampNumber(planningScore) * 0.28 +
    clampNumber(scoreBreakdown.objectiveFit, 0, 1) * 0.08 +
    clampNumber(scoreBreakdown.trafficFit, 0, 1) * 0.06 +
    clampNumber(scoreBreakdown.capabilityFit, 0, 1) * 0.04;
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

function buildGoalReason(screen, objective, targetProducts = [], productRelevance = 0.58, context = {}) {
  const objectiveDetails = GOAL_OBJECTIVE_MAP.get(objective);
  const location = titleCase(screen.location);
  const screenType = screen.screenType || "Screen";
  const skuFocus = describeTargetSkus(targetProducts);
  const relevanceLabel =
    productRelevance >= 0.6 ? "high context relevance" : productRelevance >= 0.35 ? "medium context relevance" : "low context relevance";
  const reasonShort = readOptionalString(context?.reasonShort, 240);
  if (reasonShort) {
    return `${reasonShort}${skuFocus ? ` SKU focus: ${skuFocus}.` : ""}`;
  }

  switch (objective) {
    case "checkout-attach":
      return `${screenType} at ${location}: prioritize basket-building offers near conversion zones (${relevanceLabel}).${
        skuFocus ? ` SKU focus: ${skuFocus}.` : ""
      }`;
    case "clearance":
      return `${screenType} at ${location}: increase on-screen presence to move excess stock (${relevanceLabel}).${
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
  const targetCategories = describeTargetCategories(targetProducts) || readOptionalString(goal?.assortmentCategory, 80);
  const planningSignals = goal?.planningSignals && typeof goal.planningSignals === "object"
    ? goal.planningSignals
    : buildGoalPlanningSignals(goal, targetProducts);
  const planningProfile = buildGoalPlanningProfile(goal, planningSignals);
  const storeRankingMap = new Map(
    (Array.isArray(goal?.storeRankings) ? goal.storeRankings : []).map((entry) => [readOptionalString(entry?.storeId, 80), entry])
  );
  const scoredCandidates = [];
  const proposedChanges = [];
  const excludedScreens = [];

  for (const screen of screens) {
    const productRelevance = computeProductRelevanceForScreen(screen, targetProducts);
    const currentTemplateId = readOptionalString(screen.templateId, 80) || "fullscreen-banner";
    const currentRefreshInterval = readRefreshInterval(screen.refreshInterval);
    const placementRole = getGoalScreenRole(screen);
    const screenType = readOptionalString(screen.screenType, 80) || "Horizontal Screen";
    const shareAvailability = resolveScreenShareAvailability(screen, { goal });
    const plannedShareRatio = Number(shareAvailability.shareRatio || 0);
    const plannedShareLabel = readOptionalString(shareAvailability.shareLabel, 40) || "configured screen share";
    const screenShareSlots = Number(shareAvailability.screenShareSlots || SCREEN_SHARE_SLOT_COUNT);
    const sellableShareSlots = Number(shareAvailability.sellableShareSlots || DEFAULT_SELLABLE_SHARE_SLOTS);
    const reservedShareSlots = Number(shareAvailability.reservedSlots || 0);
    const availableShareSlots = Number(shareAvailability.availableSlots || 0);
    const shareRationale = buildGoalShareRationale(plannedShareRatio, currentRefreshInterval, screenShareSlots);
    if (!shareAvailability.hasCapacity) {
      excludedScreens.push({
        screenId: screen.screenId,
        storeId: screen.storeId,
        pageId: screen.pageId,
        location: screen.location,
        screenType,
        placementRole,
        objective: goal.objective,
        currentTemplateId,
        recommendedTemplateId: currentTemplateId,
        screenRefreshInterval: currentRefreshInterval,
        shareOfScreen: Number(plannedShareRatio.toFixed(4)),
        shareLabel: plannedShareLabel,
        screenShareSlots,
        sellableShareSlots,
        reservedShareSlots,
        availableShareSlots,
        reasonCode: "share-capacity",
        reasonShort: `Held out because this screen's ${plannedShareLabel} inventory is already fully allocated for the selected flight window.`,
        reason: `Skipped by supply guardrail. ${screen.screenId} already has ${reservedShareSlots}/${screenShareSlots} sold share slot(s), so there is no open ${plannedShareLabel} to buy in the selected flight window.`,
        shareRationale
      });
      continue;
    }
    const storeId = readOptionalString(screen.storeId, 80);
    const backendStoreSignals = DEMO_STORE_SALES_SIGNAL_MAP.get(storeId) || {};
    const storeSignals = storeRankingMap.get(storeId) || {
      trafficFit: 0.55,
      stockFit: 0.55,
      footTrafficIndex: Number(backendStoreSignals.footTrafficIndex || 0.55),
      checkoutIntentIndex: Number(backendStoreSignals.checkoutIntentIndex || 0.55)
    };
    let recommendedTemplateId = computeGoalTemplateId(screen, goal.objective, { planningSignals });
    let goalProductsForScreen =
      targetProducts.length > 0
        ? pickGoalProductsForScreenWithObjective(screen, targetProducts, recommendedTemplateId, goal.objective)
        : [];
    recommendedTemplateId = computeGoalTemplateId(screen, goal.objective, { planningSignals, goalProductsForScreen });
    goalProductsForScreen =
      targetProducts.length > 0
        ? pickGoalProductsForScreenWithObjective(screen, targetProducts, recommendedTemplateId, goal.objective)
        : [];
    const billingSignals = {
      inferredFootTraffic: Number(backendStoreSignals.inferredFootTraffic || 26000),
      estimatedTransactions: Number(backendStoreSignals.estimatedTransactions || 20000),
      footTrafficIndex: Number(storeSignals.footTrafficIndex ?? backendStoreSignals.footTrafficIndex ?? 0.55),
      checkoutIntentIndex: Number(storeSignals.checkoutIntentIndex ?? backendStoreSignals.checkoutIntentIndex ?? 0.55)
    };
    const cpm = getGoalScreenTypeCpm(goal.screenTypeRates, screenType);
    const estimatedDailyImpressions = estimateGoalDailyImpressions(
      screen,
      placementRole,
      billingSignals,
      {
        refreshInterval: currentRefreshInterval,
        shareOfScreen: plannedShareRatio
      }
    );
    const estimatedImpressions = Math.max(0, Math.round(estimatedDailyImpressions * Math.max(1, Number(goal.flightDays || 1))));
    const placementCost = computeGoalPlacementCost(cpm, estimatedImpressions);
    const objectiveFit = computeGoalObjectiveFit(screen, goal.objective, planningSignals);
    const assortmentFit =
      targetProducts.length > 0
        ? clampNumber(Math.max(productRelevance, goalProductsForScreen.length > 0 ? 0.52 : 0))
        : planningSignals.primaryCategory
          ? clampNumber(
              normalizeMatchToken(screen.pageId) === planningSignals.primaryCategory ||
                normalizeMatchToken(screen.location) === planningSignals.primaryCategory
                ? 0.82
                : 0.58
            )
          : 0.6;
    const stockFit = clampNumber(storeSignals.stockFit, 0, 1);
    const trafficFit = clampNumber(storeSignals.trafficFit, 0, 1);
    const capabilityFit = computeGoalCapabilityFit(screen, recommendedTemplateId, planningSignals, goalProductsForScreen);
    const continuityFit = computeGoalContinuityFit(screen, recommendedTemplateId, targetProducts, goal.objective);
    const scopeFit = computeGoalPageScopeFit(screen, goal);
    const scoreBreakdown = {
      objectiveFit: Number(objectiveFit.toFixed(2)),
      assortmentFit: Number(assortmentFit.toFixed(2)),
      stockFit: Number(stockFit.toFixed(2)),
      trafficFit: Number(trafficFit.toFixed(2)),
      capabilityFit: Number(capabilityFit.toFixed(2)),
      continuityFit: Number(continuityFit.toFixed(2)),
      scopeFit: Number(scopeFit.toFixed(2))
    };
    const score = Number(
      (
        scoreBreakdown.objectiveFit * planningProfile.weights.objectiveFit +
        scoreBreakdown.assortmentFit * planningProfile.weights.assortmentFit +
        scoreBreakdown.stockFit * planningProfile.weights.stockFit +
        scoreBreakdown.trafficFit * planningProfile.weights.trafficFit +
        scoreBreakdown.capabilityFit * planningProfile.weights.capabilityFit +
        scoreBreakdown.continuityFit * planningProfile.weights.continuityFit +
        scoreBreakdown.scopeFit * planningProfile.weights.scopeFit
      ).toFixed(2)
    );
    const templateChanged = currentTemplateId !== recommendedTemplateId;
    const targetingChanged =
      targetSkuIds.length > 0 && !screenContainsAnyTargetSku(screen, targetSkuIds);
    const reasonShort = buildGoalReasonShort(screen, goal, { trafficFit });
    const expectedOutcome = buildGoalExpectedOutcome(screen, goal);
    const templateRationale = buildGoalTemplateRationale(screen, recommendedTemplateId, goal, planningSignals, goalProductsForScreen);
    const confidence = computeGoalConfidence(screen, goal.objective, productRelevance, score, scoreBreakdown);
    const reason = buildGoalReason(screen, goal.objective, targetProducts, productRelevance, { reasonShort });
    const recommendedTargetSkus = goalProductsForScreen.map((product) => normalizeSku(product.sku));
    const candidateBase = {
      screenId: screen.screenId,
      storeId: screen.storeId,
      pageId: screen.pageId,
      location: screen.location,
      screenType,
      placementRole,
      objective: goal.objective,
      confidence,
      score,
      reason,
      reasonShort,
      expectedOutcome,
      productRelevance,
      scoreBreakdown,
      objectiveFit: scoreBreakdown.objectiveFit,
      assortmentFit: scoreBreakdown.assortmentFit,
      stockFit: scoreBreakdown.stockFit,
      trafficFit,
      capabilityFit: scoreBreakdown.capabilityFit,
      continuityFit: scoreBreakdown.continuityFit,
      targetingChanged,
      templateChanged,
      recommendedTargetSkus,
      currentTemplateId,
      recommendedTemplateId,
      screenRefreshInterval: currentRefreshInterval,
      shareOfScreen: Number(plannedShareRatio.toFixed(4)),
      shareLabel: plannedShareLabel,
      screenShareSlots,
      sellableShareSlots,
      reservedShareSlots,
      availableShareSlots,
      cpm,
      estimatedDailyImpressions,
      estimatedImpressions,
      placementCost,
      templateRationale,
      shareRationale
    };

    if (targetProducts.length > 0 && goalProductsForScreen.length === 0 && assortmentFit < planningProfile.minAssortmentFit && !isObjectivePreferredScreen(screen, goal.objective)) {
      excludedScreens.push({
        ...candidateBase,
        reasonCode: "low-assortment-fit",
        reasonShort: "Held out because the screen context did not fit the selected SKU assortment strongly enough.",
        productRelevance,
        scoreBreakdown,
        reason: `Skipped by context guardrail. Screen context does not match target categories (${targetCategories || "selected SKUs"}).`
      });
      continue;
    }

    if (goal.requestedPageId && scopeFit < planningProfile.offPageScopeFit && goal.aggressiveness === "Conservative" && readOptionalString(screen.pageId, 40) !== goal.requestedPageId) {
      excludedScreens.push({
        ...candidateBase,
        reasonCode: "scope-guardrail",
        reasonShort: `Held out because Conservative planning kept the recommendation anchored to ${goal.requestedPageId}.`,
        productRelevance,
        scoreBreakdown,
        reason: `Skipped by scope guardrail. Conservative planning kept the recommendation anchored to ${goal.requestedPageId}.`
      });
      continue;
    }

    if (score < planningProfile.minPlanScore) {
      excludedScreens.push({
        ...candidateBase,
        reasonCode: "score-below-threshold",
        reasonShort: "Held out because stronger placements scored higher on the planning model.",
        productRelevance,
        scoreBreakdown,
        reason: "Held out because this screen did not clear the current planning threshold."
      });
      continue;
    }

    scoredCandidates.push(candidateBase);
  }

  const selection = selectGoalPlacementCandidates(scoredCandidates, goal, planningProfile);
  const recommendedPlacements = selection.selected;
  const budgetRankMap = new Map(
    rankGoalPlacementsForBudget(recommendedPlacements).map((candidate, index) => [candidate.screenId, index + 1])
  );
  const rankedRecommendedPlacements = recommendedPlacements.map((candidate) => ({
    ...candidate,
    budgetRank: Number(budgetRankMap.get(candidate.screenId) || 0)
  }));
  const selectedScreenIds = new Set(rankedRecommendedPlacements.map((entry) => entry.screenId));
  for (const candidate of scoredCandidates) {
    if (selectedScreenIds.has(candidate.screenId)) {
      continue;
    }
    excludedScreens.push({
      ...candidate,
      reasonCode: "below-cutline",
      reasonShort: "Held out because higher-ranked placements covered the same planning scenario more efficiently.",
      productRelevance: candidate.productRelevance,
      scoreBreakdown: candidate.scoreBreakdown,
      reason: "Held out because higher-ranked placements covered the same planning scenario more efficiently."
    });
  }

  for (const candidate of rankedRecommendedPlacements) {
    proposedChanges.push({
      screenId: candidate.screenId,
      storeId: candidate.storeId,
      pageId: candidate.pageId,
      location: candidate.location,
      screenType: candidate.screenType,
      placementRole: candidate.placementRole,
      objective: candidate.objective,
      confidence: candidate.confidence,
      score: candidate.score,
      budgetRank: candidate.budgetRank,
      reason: candidate.reason,
      reasonShort: candidate.reasonShort,
      expectedOutcome: candidate.expectedOutcome,
      productRelevance: candidate.productRelevance,
      scoreBreakdown: candidate.scoreBreakdown,
      objectiveFit: candidate.objectiveFit,
      assortmentFit: candidate.assortmentFit,
      stockFit: candidate.stockFit,
      trafficFit: candidate.trafficFit,
      capabilityFit: candidate.capabilityFit,
      continuityFit: candidate.continuityFit,
      targetingChanged: candidate.targetingChanged,
      recommendedTargetSkus: candidate.recommendedTargetSkus,
      currentTemplateId: candidate.currentTemplateId,
      recommendedTemplateId: candidate.recommendedTemplateId,
      screenRefreshInterval: candidate.screenRefreshInterval,
      shareOfScreen: candidate.shareOfScreen,
      shareLabel: candidate.shareLabel,
      cpm: candidate.cpm,
      estimatedDailyImpressions: candidate.estimatedDailyImpressions,
      estimatedImpressions: candidate.estimatedImpressions,
      placementCost: candidate.placementCost,
      templateRationale: candidate.templateRationale,
      shareRationale: candidate.shareRationale
    });
  }

  const templateSwitches = proposedChanges.filter(
    (change) => change.currentTemplateId !== change.recommendedTemplateId
  ).length;
  const skuTargetUpdates = proposedChanges.filter((change) => Boolean(change.targetingChanged)).length;
  const averageScore = averageOf(rankedRecommendedPlacements.map((entry) => Number(entry.score || 0)), 0);
  const averageConfidence = averageOf(rankedRecommendedPlacements.map((entry) => Number(entry.confidence || 0)), 0);
  const budget = buildGoalBudget(goal, rankedRecommendedPlacements);
  const shareCapacityExclusions = excludedScreens.filter((entry) => entry.reasonCode === "share-capacity").length;
  const shareLabelsUsed = [
    ...new Set(
      [...rankedRecommendedPlacements, ...excludedScreens]
        .map((entry) => readOptionalString(entry?.shareLabel, 40))
        .filter(Boolean)
    )
  ];
  const shareSummaryLabel = shareLabelsUsed.length === 1 ? shareLabelsUsed[0] : "configured screen share";
  const soldOutSharePhrase = shareLabelsUsed.length === 1 ? shareLabelsUsed[0] : "their configured screen share";
  const deliverySummaryLine =
    shareLabelsUsed.length === 1
      ? `Delivery: fixed ${shareSummaryLabel} with installed screen cadence left unchanged.`
      : "Delivery: screen-specific share settings with installed screen cadence left unchanged.";
  const supplyGuardrailLine =
    shareLabelsUsed.length === 1
      ? `Supply guardrail: only screens with an open ${shareSummaryLabel} in the selected flight window were eligible.`
      : "Supply guardrail: only screens with an open configured share in the selected flight window were eligible.";
  const spendSummarySharePhrase =
    shareLabelsUsed.length === 1 ? `${shareSummaryLabel} of screen rotation` : "the configured share setting on each screen";

  const summary =
    rankedRecommendedPlacements.length > 0
      ? `CMax recommends ${rankedRecommendedPlacements.length} sponsored ${shareSummaryLabel} placement(s) for ${objectiveDetails.label}.`
      : shareCapacityExclusions > 0 && shareCapacityExclusions === excludedScreens.length
        ? `CMax could not identify an in-scope placement line-up for ${objectiveDetails.label} because the best-fit screens are already fully allocated at ${soldOutSharePhrase}.`
        : `CMax could not identify an in-scope placement line-up for ${objectiveDetails.label}.`;

  const targetSourceLabel =
    goal.targetSource === "manual"
      ? "Manual SKU shortlist"
      : goal.targetSource === "account"
        ? "Brand-led assortment"
      : goal.targetSource === "prompt-ai"
        ? "AI brief-selected SKU shortlist"
        : goal.targetSource === "prompt"
          ? "Brief-inferred SKU shortlist"
        : "Objective-led recommendation";
  const targetSummary =
    targetProducts.length > 0
      ? `${targetSourceLabel}: ${targetProducts.length} priority SKU(s), including ${describeTargetSkus(targetProducts)}.`
      : goal.prompt
        ? "The brief did not resolve to a confident SKU shortlist, so CMax used objective-led placement selection."
        : "No priority SKU shortlist applied.";
  const inferredTermsSummary =
    (goal.targetSource === "prompt" || goal.targetSource === "prompt-ai") &&
    Array.isArray(goal.inferredTerms) &&
    goal.inferredTerms.length > 0
      ? `Prompt terms: ${goal.inferredTerms.slice(0, 6).join(", ")}.`
      : "";
  const exclusionSummary =
    shareCapacityExclusions > 0 && excludedScreens.length > shareCapacityExclusions
      ? `${shareCapacityExclusions} placement(s) were held out because ${soldOutSharePhrase} was already sold for the selected flight window. ${
          excludedScreens.length - shareCapacityExclusions
        } more were left out because they did not fit the brief.`
      : shareCapacityExclusions > 0
        ? `${shareCapacityExclusions} placement(s) were held out because ${soldOutSharePhrase} was already sold for the selected flight window.`
        : excludedScreens.length > 0
          ? `${excludedScreens.length} placement(s) were left out because they did not fit the brief.`
          : targetProducts.length > 0
            ? "All in-scope placements fit the brief."
            : "";
  const spendSummary =
    budget.maxSpend > 0
      ? `Estimated max spend ${GOAL_PRICING_MODEL.currencySymbol}${budget.maxSpend.toLocaleString()} over ${goal.flightDays} day(s) from ${formatCount(
          budget.maxEstimatedImpressions
        )} modeled impressions at ${spendSummarySharePhrase}.`
      : "";
  let strategyHeadline = "The planner selected the strongest placements for the brief.";
  switch (goal.objective) {
    case "awareness":
      strategyHeadline = "Bias the buy into higher-footfall stores inferred from modeled sales, then keep the strongest entrance and category screens.";
      break;
    case "checkout-attach":
      strategyHeadline = "Bias the buy into checkout and aisle bridge screens in stores with stronger sales-derived trip intent.";
      break;
    case "clearance":
      strategyHeadline = "Bias the buy into stock-heavy stores and shelf-proximate screens to accelerate sell-through.";
      break;
    case "premium":
      strategyHeadline = "Bias the buy into premium-demand stores and hero-capable placements to frame value earlier.";
      break;
    default:
      break;
  }
  const summaryBullets = [
    readOptionalString(goal.storeSelectionReason, 280),
    planningSignals.assortmentCategory ? `Assortment category anchor: ${titleCase(planningSignals.assortmentCategory)}.` : "",
    "Pricing: retailer-set CPM by screen type against modeled impression delivery.",
    deliverySummaryLine,
    supplyGuardrailLine,
    Array.isArray(planningSignals.briefThemes) && planningSignals.briefThemes.length > 0
      ? `Brief themes: ${planningSignals.briefThemes.slice(0, 4).join(", ")}.`
      : ""
  ].filter(Boolean);
  const requestedPageBestScore = scoredCandidates
    .filter((candidate) => readOptionalString(candidate.pageId, 40) === readOptionalString(goal.requestedPageId || goal.pageId, 40))
    .reduce((best, candidate) => Math.max(best, Number(candidate.score || 0)), 0);
  const bestSelectedScore = rankedRecommendedPlacements.reduce((best, candidate) => Math.max(best, Number(candidate.score || 0)), 0);

  return {
    summary: `${summary} ${targetSummary} ${inferredTermsSummary} ${exclusionSummary} ${spendSummary}`.replace(/\s+/g, " ").trim(),
    strategy: {
      mode: planningSignals.strategyMode || "Objective-led placement plan",
      headline: strategyHeadline,
      summaryBullets
    },
    totals: {
      scopedScreens: screens.length,
      plannedScreens: rankedRecommendedPlacements.length,
      compatibleScreens: scoredCandidates.length,
      excludedScreens: excludedScreens.length,
      targetSkus: targetProducts.length,
      proposedChanges: proposedChanges.length,
      templateSwitches,
      refreshUpdates: 0,
      skuTargetUpdates,
      flightDays: goal.flightDays,
      maxSpend: budget.maxSpend,
      estimatedImpressions: budget.maxEstimatedImpressions,
      avgScore: Number(averageScore.toFixed(2)),
      avgConfidence: Number(averageConfidence.toFixed(2))
    },
    plannedScreenIds: rankedRecommendedPlacements.map((entry) => readOptionalString(entry.screenId, 80)).filter(Boolean),
    recommendedPlacements: rankedRecommendedPlacements,
    proposedChanges,
    excludedScreens,
    budget,
    selectionInsights: {
      placementBudget: selection.placementBudget,
      requestedCandidateCount: (Array.isArray(screens) ? screens : []).filter(
        (screen) => readOptionalString(screen.pageId, 40) === readOptionalString(goal.requestedPageId || goal.pageId, 40)
      ).length,
      requestedPageBestScore,
      bestSelectedScore
    }
  };
}

function describeGoalScreenRole(role) {
  switch (readOptionalString(role, 40)) {
    case "checkout":
      return "queue-side shoppers";
    case "aisle":
      return "decision-point aisle traffic";
    case "entrance":
      return "front-of-store traffic";
    case "foodcourt":
      return "counter and pickup traffic";
    case "category":
      return "high-intent category shoppers";
    default:
      return "active store traffic";
  }
}

function buildTemplateQrMetadata(templateId, objectiveId = "", location = "") {
  const normalizedTemplateId = readOptionalString(templateId, 80);
  const normalizedObjectiveId = readOptionalString(objectiveId, 80);
  const normalizedLocation = readOptionalString(location, 80).toLowerCase();

  if (normalizedTemplateId === "kiosk-interactive") {
    return {
      qrVariant: "mobile-handoff",
      qrLabel: "Scan to keep this offer",
      qrCaption: "Continue on your phone and bring the offer back to checkout.",
      qrAsset: "/assets/qr/qr-mobile-handoff.svg",
      qrPlacement: "primary",
      qrDestinationType: "mobile-offer"
    };
  }

  if (normalizedTemplateId === "shelf-spotlight") {
    return {
      qrVariant: "shelf-callout",
      qrLabel: "Scan for price and details",
      qrCaption: "Open specs, ratings, and product comparison on your phone.",
      qrAsset: "/assets/qr/qr-shelf-callout.svg",
      qrPlacement: "supporting-card",
      qrDestinationType: "product-details"
    };
  }

  if (normalizedTemplateId === "menu-loop" || normalizedLocation.includes("foodcourt")) {
    return {
      qrVariant: "menu-board",
      qrLabel: "Scan for ingredients",
      qrCaption: "View ingredients, allergy notes, and menu offers on mobile.",
      qrAsset: "/assets/qr/qr-menu-board.svg",
      qrPlacement: "supporting-card",
      qrDestinationType: "menu-details"
    };
  }

  if (normalizedObjectiveId === "clearance" && normalizedTemplateId === "fullscreen-banner") {
    return {
      qrVariant: "clearance",
      qrLabel: "Scan for clearance map",
      qrCaption: "Show markdown locations and related products on your phone.",
      qrAsset: "/assets/qr/qr-clearance.svg",
      qrPlacement: "supporting-card",
      qrDestinationType: "clearance-map"
    };
  }

  return {};
}

function applyGoalCreativeAttributes(product, objectiveId, targetProduct = null, screen = null, templateId = "") {
  const objective = GOAL_OBJECTIVE_MAP.get(objectiveId) || GOAL_OBJECTIVE_MAP.get("awareness");
  const current = parseJsonObject(product.RenderingAttributes);
  const resolvedTemplateId =
    readOptionalString(templateId, 80) ||
    readOptionalString(current.templateId, 80) ||
    "fullscreen-banner";
  const brand = readOptionalString(targetProduct?.brand, 80);
  const qrMetadata = buildTemplateQrMetadata(resolvedTemplateId, objective.id, readOptionalString(screen?.location, 80));
  const dynamicSubcopy = (() => {
    switch (objective.id) {
      case "checkout-attach":
        return brand ? `Add ${brand} before you pay.` : "Easy add-on before you pay.";
      case "clearance":
        return brand ? `${brand} while stock lasts.` : "Limited stock at this price.";
      case "premium":
        return brand ? `${brand} on display today.` : "See it on display today.";
      default:
        return brand ? `${brand} in store today.` : "In store today.";
    }
  })();

  return normalizeRenderingAttributes({
    ...qrMetadata,
    ...current,
    promotion: objective.creativeDefaults.promotion,
    badge: objective.creativeDefaults.badge,
    cta: readOptionalString(qrMetadata.qrLabel, 80) || objective.creativeDefaults.cta,
    subcopy: dynamicSubcopy,
    legal: objective.creativeDefaults.legal,
    goalObjective: objective.id,
    goalTargetSku: targetProduct ? normalizeSku(targetProduct.sku) : current.goalTargetSku || "",
    templateId: readOptionalString(current.templateId, 80) || resolvedTemplateId
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

function buildBeaconUrl(event, screenId, adid, baseOverride = "") {
  const base = readOptionalString(baseOverride, 500) || process.env.TRACKING_BASE_URL || DEFAULT_TRACKING_BASE_URL;
  try {
    const beaconUrl = base.startsWith("/") ? new URL(base, "http://local-tracker") : new URL(base);
    beaconUrl.searchParams.set("event", event);
    beaconUrl.searchParams.set("screenId", screenId);
    beaconUrl.searchParams.set("adid", adid);
    if (base.startsWith("/")) {
      return `${beaconUrl.pathname}${beaconUrl.search}`;
    }
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
  const brandLogo = normalizeBrandLogoPath(
    product.BrandLogo || product.brandLogo || renderingAttributes.brandLogo || renderingAttributes.logo
  );
  const qrMetadata = buildTemplateQrMetadata(
    template.id,
    readOptionalString(renderingAttributes.goalObjective, 80),
    location
  );
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
    BrandLogo: brandLogo,
    brand: readOptionalString(product.brand, 80) || readOptionalString(renderingAttributes.targetBrand, 80),
    category: readOptionalString(product.category, 80) || readOptionalString(renderingAttributes.targetCategory, 80),
    Price: readOptionalString(product.Price, 30) || readOptionalString(product.price, 30) || "29.99",
    ComparePrice:
      readOptionalString(product.ComparePrice, 30) || readOptionalString(product.comparePrice, 30) || "39.99",
    Rating: readOptionalString(product.Rating, 10) || readOptionalString(product.rating, 10) || "4.5",
    adid: readOptionalString(product.adid, 120),
    ClientAdvertiserId:
      readOptionalString(product.ClientAdvertiserId, 120) ||
      readOptionalString(product.clientAdvertiserId, 120) ||
      "demo-advertiser",
    RenderingAttributes: normalizeRenderingAttributes({
      ...qrMetadata,
      ...renderingAttributes,
      promotion: readOptionalString(renderingAttributes.promotion, 180) || template.defaultPromotion,
      badge: readOptionalString(renderingAttributes.badge, 120) || template.defaultBadge,
      cta: readOptionalString(renderingAttributes.cta, 80) || readOptionalString(qrMetadata.qrLabel, 80) || template.defaultCta,
      subcopy: readOptionalString(renderingAttributes.subcopy, 240) || template.defaultSubcopy,
      legal: readOptionalString(renderingAttributes.legal, 280) || template.defaultLegal,
      brandLogo,
      templateId: readOptionalString(renderingAttributes.templateId, 80) || template.id
    }),
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
    deliverySource: readOptionalString(lineItem.deliverySource, 40),
    deliveryShareSlots: readLineItemShareSlots(lineItem.deliveryShareSlots, null),
    goalPlanId: readOptionalString(lineItem.goalPlanId, 120),
    goalAdvertiserId: readOptionalString(lineItem.goalAdvertiserId, 120),
    goalObjective: readOptionalString(lineItem.goalObjective, 40),
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
  const trackingBaseUrl = readOptionalString(process.env.TRACKING_BASE_URL, 500) || DEFAULT_TRACKING_BASE_URL;
  const productId =
    readOptionalString(product.ProductId, 80) ||
    readOptionalString(product.productId, 80) ||
    `${screenId}-SKU-${index + 1}`;
  const renderingAttributes = parseJsonObject(product.RenderingAttributes ?? product.renderingAttributes);
  const brandLogo = normalizeBrandLogoPath(
    product.BrandLogo || product.brandLogo || renderingAttributes.brandLogo || renderingAttributes.logo
  );
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
    BrandLogo: brandLogo,
    brand: readOptionalString(product.brand, 80) || readOptionalString(renderingAttributes.targetBrand, 80),
    category: readOptionalString(product.category, 80) || readOptionalString(renderingAttributes.targetCategory, 80),
    Price: readOptionalString(product.Price, 30) || readOptionalString(product.price, 30) || "0.00",
    ComparePrice: readOptionalString(product.ComparePrice, 30) || readOptionalString(product.comparePrice, 30),
    Rating: readOptionalString(product.Rating, 10) || readOptionalString(product.rating, 10),
    adid,
    ClientAdvertiserId:
      readOptionalString(product.ClientAdvertiserId, 120) ||
      readOptionalString(product.clientAdvertiserId, 120) ||
      "demo-advertiser",
    advertiserId:
      readOptionalString(product.advertiserId, 120) ||
      readOptionalString(product.ClientAdvertiserId, 120) ||
      readOptionalString(product.clientAdvertiserId, 120) ||
      "demo-advertiser",
    RenderingAttributes: sanitizeInStoreMessagingAttributes(
      {
        ...parseJsonObject(product.RenderingAttributes ?? product.renderingAttributes ?? { inStore: true }),
        brandLogo
      },
      templateId
    ),
    OnLoadBeacon: buildBeaconUrl("play", screenId, adid, trackingBaseUrl),
    OnViewBeacon: buildBeaconUrl("exposure", screenId, adid, trackingBaseUrl),
    OnClickBeacon: readOptionalString(product.OnClickBeacon, 500),
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

function pickLineItem(screenId, lineItems, totalSlots = SCREEN_SHARE_SLOT_COUNT) {
  const deliveryShares = resolveLineItemDeliveryShares(lineItems, totalSlots).filter((entry) => Number(entry?.weight || 0) > 0);
  if (deliveryShares.length === 0) {
    return null;
  }
  const signature = deliveryShares
    .map((entry, index) => `${readOptionalString(entry.lineItem?.lineItemId, 120) || `${screenId}-li-${index}`}:${Number(entry.weight || 0).toFixed(4)}`)
    .join("|");
  let state = rotationState.get(screenId);
  if (!state || typeof state !== "object" || state.signature !== signature) {
    state = {
      signature,
      currents: Object.create(null)
    };
  }

  const totalWeight = deliveryShares.reduce((sum, entry) => sum + Number(entry.weight || 0), 0);
  let selectedEntry = null;
  let selectedId = "";
  let highestCurrent = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < deliveryShares.length; index += 1) {
    const entry = deliveryShares[index];
    const entryId = readOptionalString(entry.lineItem?.lineItemId, 120) || `${screenId}-li-${index}`;
    const nextCurrent = Number(state.currents[entryId] || 0) + Number(entry.weight || 0);
    state.currents[entryId] = nextCurrent;
    if (!selectedEntry || nextCurrent > highestCurrent) {
      selectedEntry = entry;
      selectedId = entryId;
      highestCurrent = nextCurrent;
    }
  }

  if (!selectedEntry) {
    return null;
  }

  state.currents[selectedId] = Number(state.currents[selectedId] || 0) - totalWeight;
  rotationState.set(screenId, state);
  return selectedEntry.lineItem;
}

function normalizeError(error) {
  if (error instanceof HttpError) {
    return { status: error.status, message: error.message };
  }
  return { status: 500, message: "Unexpected error." };
}

const WORKSPACE_SESSION_COOKIE = "instore_demo_session";
const WORKSPACE_SESSION_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const WORKSPACE_LEASE_MS = 60 * 60 * 1000;
const WORKSPACE_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const WORKSPACE_ACTIVITY_HEARTBEAT_INTERVAL_MS = 60 * 1000;
const WORKSPACE_ACTIVITY_ACTIVE_GRACE_MS = WORKSPACE_ACTIVITY_HEARTBEAT_INTERVAL_MS + 5000;
const DEMO_WORKSPACES = [
  { id: "atlas", label: "Atlas", initials: "AT", accent: "#ef7c63" },
  { id: "nova", label: "Nova", initials: "NV", accent: "#4fa7ff" },
  { id: "sora", label: "Sora", initials: "SR", accent: "#46b98e" },
  { id: "flint", label: "Flint", initials: "FL", accent: "#f2a65a" },
  { id: "juno", label: "Juno", initials: "JN", accent: "#ff8fb1" },
  { id: "vega", label: "Vega", initials: "VG", accent: "#7c8cff" },
  { id: "cairo", label: "Cairo", initials: "CA", accent: "#54c2c2" },
  { id: "marlo", label: "Marlo", initials: "MR", accent: "#d184ff" },
  { id: "piper", label: "Piper", initials: "PP", accent: "#ffb85c" },
  { id: "rowan", label: "Rowan", initials: "RW", accent: "#7ad06d" },
  { id: "quinn", label: "Quinn", initials: "QN", accent: "#56b0f7" },
  { id: "tatum", label: "Tatum", initials: "TT", accent: "#ff9970" }
];
const DEMO_WORKSPACE_MAP = new Map(DEMO_WORKSPACES.map((workspace) => [workspace.id, workspace]));

function parseCookies(rawCookieHeader = "") {
  const source = typeof rawCookieHeader === "string" ? rawCookieHeader : "";
  return source.split(";").reduce((cookies, entry) => {
    const [rawName, ...rawValueParts] = entry.split("=");
    const name = String(rawName || "").trim();
    if (!name) {
      return cookies;
    }
    const value = rawValueParts.join("=");
    cookies[name] = decodeURIComponent(String(value || "").trim());
    return cookies;
  }, {});
}

function serializeCookie(name, value, { maxAgeSeconds = null, httpOnly = true } = {}) {
  const segments = [`${name}=${encodeURIComponent(String(value || ""))}`, "Path=/", "SameSite=Lax"];
  if (httpOnly) {
    segments.push("HttpOnly");
  }
  if (Number.isFinite(Number(maxAgeSeconds)) && Number(maxAgeSeconds) >= 0) {
    segments.push(`Max-Age=${Math.max(0, Math.floor(Number(maxAgeSeconds)))}`);
  }
  return segments.join("; ");
}

function readSessionId(req) {
  const cookies = parseCookies(req.headers?.cookie || "");
  return readOptionalString(cookies[WORKSPACE_SESSION_COOKIE], 120);
}

function ensureSessionId(req, res) {
  const existing = readSessionId(req);
  if (existing) {
    return existing;
  }
  const sessionId = randomUUID();
  res.append(
    "Set-Cookie",
    serializeCookie(WORKSPACE_SESSION_COOKIE, sessionId, {
      maxAgeSeconds: WORKSPACE_SESSION_COOKIE_MAX_AGE_SECONDS
    })
  );
  return sessionId;
}

function clearSessionCookie(res) {
  res.append(
    "Set-Cookie",
    serializeCookie(WORKSPACE_SESSION_COOKIE, "", {
      maxAgeSeconds: 0
    })
  );
}

function normalizeWorkspaceState(data) {
  const source = data && typeof data === "object" ? data : {};
  return {
    pages: Array.isArray(source.pages) ? source.pages : [],
    screens: Array.isArray(source.screens)
      ? source.screens.map((screen) => ({
          ...screen,
          lineItems: getEffectiveScreenLineItems(screen)
        }))
      : [],
    agentRuns: Array.isArray(source.agentRuns) ? source.agentRuns : [],
    telemetryEvents: Array.isArray(source.telemetryEvents) ? source.telemetryEvents : [],
    pricing: source.pricing && typeof source.pricing === "object" ? source.pricing : {}
  };
}

function ensureWorkspaceRoot(db) {
  if (!db.workspaces || typeof db.workspaces !== "object") {
    db.workspaces = {};
  }
  if (!db.workspaceClaims || typeof db.workspaceClaims !== "object") {
    db.workspaceClaims = {};
  }
}

function buildWorkspaceSeedState(sourceDb) {
  const seededScreens = Array.isArray(sourceDb.screens)
    ? structuredClone(sourceDb.screens).map((screen) => ({
        ...screen,
        lineItems: []
      }))
    : [];
  return {
    pages: structuredClone(Array.isArray(sourceDb.pages) ? sourceDb.pages : []),
    screens: seededScreens,
    agentRuns: [],
    telemetryEvents: [],
    pricing: structuredClone(sourceDb.pricing && typeof sourceDb.pricing === "object" ? sourceDb.pricing : {})
  };
}

function getWorkspaceState(rootDb, workspaceId, { create = false, seedState = null } = {}) {
  ensureWorkspaceRoot(rootDb);
  const normalizedWorkspaceId = readOptionalString(workspaceId, 80).toLowerCase();
  if (!normalizedWorkspaceId || !DEMO_WORKSPACE_MAP.has(normalizedWorkspaceId)) {
    return normalizeWorkspaceState({});
  }

  const existing = rootDb.workspaces[normalizedWorkspaceId];
  if (existing && typeof existing === "object") {
    const normalized = normalizeWorkspaceState(existing);
    rootDb.workspaces[normalizedWorkspaceId] = normalized;
    return normalized;
  }

  const seeded = normalizeWorkspaceState(buildWorkspaceSeedState(seedState || rootDb));
  if (create) {
    rootDb.workspaces[normalizedWorkspaceId] = seeded;
    return rootDb.workspaces[normalizedWorkspaceId];
  }
  return seeded;
}

function resetWorkspaceState(rootDb, workspaceId) {
  ensureWorkspaceRoot(rootDb);
  const normalizedWorkspaceId = readOptionalString(workspaceId, 80).toLowerCase();
  if (!normalizedWorkspaceId || !DEMO_WORKSPACE_MAP.has(normalizedWorkspaceId)) {
    return;
  }
  delete rootDb.workspaces[normalizedWorkspaceId];
}

function pruneOrphanedWorkspaceStates(rootDb) {
  ensureWorkspaceRoot(rootDb);
  for (const workspaceId of Object.keys(rootDb.workspaces)) {
    const normalizedWorkspaceId = readOptionalString(workspaceId, 80).toLowerCase();
    if (!normalizedWorkspaceId || !DEMO_WORKSPACE_MAP.has(normalizedWorkspaceId)) {
      delete rootDb.workspaces[workspaceId];
      continue;
    }

    const normalizedState = normalizeWorkspaceState(rootDb.workspaces[workspaceId]);
    if (workspaceId !== normalizedWorkspaceId) {
      delete rootDb.workspaces[workspaceId];
    }

    if (!rootDb.workspaceClaims[normalizedWorkspaceId]) {
      delete rootDb.workspaces[normalizedWorkspaceId];
      continue;
    }

    rootDb.workspaces[normalizedWorkspaceId] = normalizedState;
  }
}

function getWorkspaceClaimLastActivityAt(claim) {
  return readOptionalString(claim?.lastActivityAt, 80) || readOptionalString(claim?.claimedAt, 80);
}

function readWorkspaceInactivityBudgetMs(claim) {
  const remainingMs = Number(claim?.inactivityRemainingMs);
  if (Number.isFinite(remainingMs)) {
    return Math.max(0, remainingMs);
  }
  return WORKSPACE_INACTIVITY_TIMEOUT_MS;
}

function getWorkspaceActivityGraceUntilMs(claim) {
  const parsed = Date.parse(readOptionalString(claim?.activeUntilAt, 80));
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  return Date.parse(getWorkspaceClaimLastActivityAt(claim));
}

function formatWorkspaceInactivityRemainingMs(claim, now = Date.now()) {
  const remainingBudgetMs = readWorkspaceInactivityBudgetMs(claim);
  const activeUntilMs = getWorkspaceActivityGraceUntilMs(claim);
  const idleElapsedMs = Number.isFinite(activeUntilMs) ? Math.max(0, now - activeUntilMs) : 0;
  return Math.max(0, remainingBudgetMs - idleElapsedMs);
}

function commitWorkspaceInactivityBudget(claim, now = Date.now()) {
  claim.inactivityRemainingMs = formatWorkspaceInactivityRemainingMs(claim, now);
  claim.activeUntilAt = new Date(now).toISOString();
}

function getWorkspaceClaimExpiration(claim, now = Date.now()) {
  const leaseExpiryAt = Date.parse(readOptionalString(claim?.expiresAt, 80));
  const activityGraceUntilMs = getWorkspaceActivityGraceUntilMs(claim);
  const inactivityExpiryAt = Number.isFinite(activityGraceUntilMs)
    ? activityGraceUntilMs + readWorkspaceInactivityBudgetMs(claim)
    : NaN;
  const leaseExpired = !Number.isFinite(leaseExpiryAt) || leaseExpiryAt <= now;
  const inactivityExpired = formatWorkspaceInactivityRemainingMs(claim, now) <= 0;

  if (!leaseExpired && !inactivityExpired) {
    return null;
  }

  if (
    inactivityExpired &&
    (!leaseExpired || (Number.isFinite(inactivityExpiryAt) && (!Number.isFinite(leaseExpiryAt) || inactivityExpiryAt <= leaseExpiryAt)))
  ) {
    return {
      status: 409,
      code: "WORKSPACE_INACTIVE",
      message: "This avatar expired after 30 minutes of inactivity. Pick an avatar again."
    };
  }

  return {
    status: 409,
    code: "WORKSPACE_EXPIRED",
    message: "This avatar lease expired after 1 hour. Pick an avatar again."
  };
}

function expireWorkspaceClaim(rootDb, claim) {
  ensureWorkspaceRoot(rootDb);
  const workspaceId = readOptionalString(claim?.workspaceId, 80).toLowerCase();
  if (!workspaceId) {
    return;
  }
  delete rootDb.workspaceClaims[workspaceId];
  resetWorkspaceState(rootDb, workspaceId);
}

function findWorkspaceClaimBySession(rootDb, sessionId) {
  ensureWorkspaceRoot(rootDb);
  const normalizedSessionId = readOptionalString(sessionId, 120);
  if (!normalizedSessionId) {
    return null;
  }
  return (
    Object.values(rootDb.workspaceClaims).find((claim) => readOptionalString(claim?.sessionId, 120) === normalizedSessionId) || null
  );
}

function isWorkspaceClaimExpired(claim, now = Date.now()) {
  return Boolean(getWorkspaceClaimExpiration(claim, now));
}

function pruneExpiredWorkspaceClaims(rootDb, now = Date.now()) {
  ensureWorkspaceRoot(rootDb);
  for (const workspace of DEMO_WORKSPACES) {
    const claim = rootDb.workspaceClaims[workspace.id];
    if (claim && getWorkspaceClaimExpiration(claim, now)) {
      expireWorkspaceClaim(rootDb, claim);
    }
  }
  pruneOrphanedWorkspaceStates(rootDb);
}

function formatLeaseRemainingMs(expiresAt, now = Date.now()) {
  const parsed = Date.parse(readOptionalString(expiresAt, 80));
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.max(0, parsed - now);
}

function buildWorkspaceStatusPayload(rootDb, sessionId) {
  ensureWorkspaceRoot(rootDb);
  const now = Date.now();
  pruneExpiredWorkspaceClaims(rootDb, now);
  const currentClaim = findWorkspaceClaimBySession(rootDb, sessionId);

  const workspaces = DEMO_WORKSPACES.map((workspace) => {
    const claim = rootDb.workspaceClaims[workspace.id] || null;
    const storedWorkspace = rootDb.workspaces?.[workspace.id];
    const state = storedWorkspace && typeof storedWorkspace === "object" ? normalizeWorkspaceState(storedWorkspace) : null;
    const claimedByCurrentSession =
      Boolean(currentClaim) && readOptionalString(currentClaim?.workspaceId, 80) === workspace.id;
    const remainingMs = claim ? formatLeaseRemainingMs(claim.expiresAt, now) : 0;

    return {
      ...workspace,
      status: claim ? (claimedByCurrentSession ? "claimed-by-you" : "claimed") : "available",
      claimed: Boolean(claim),
      claimedByCurrentSession,
      claimedAt: readOptionalString(claim?.claimedAt, 80),
      lastActivityAt: getWorkspaceClaimLastActivityAt(claim),
      expiresAt: readOptionalString(claim?.expiresAt, 80),
      remainingMs,
      hasSavedJourney: Boolean(storedWorkspace),
      counts: {
        pages: state ? state.pages.length : 0,
        screens: state ? state.screens.length : 0,
        agentRuns: state ? state.agentRuns.length : 0,
        telemetryEvents: state ? state.telemetryEvents.length : 0
      }
    };
  });

  return {
    sessionId: readOptionalString(sessionId, 120),
    leaseDurationMs: WORKSPACE_LEASE_MS,
    inactivityTimeoutMs: WORKSPACE_INACTIVITY_TIMEOUT_MS,
    activityGraceMs: WORKSPACE_ACTIVITY_ACTIVE_GRACE_MS,
    currentWorkspace:
      currentClaim && DEMO_WORKSPACE_MAP.has(readOptionalString(currentClaim.workspaceId, 80))
        ? {
            ...DEMO_WORKSPACE_MAP.get(readOptionalString(currentClaim.workspaceId, 80)),
            claimedAt: readOptionalString(currentClaim.claimedAt, 80),
            lastActivityAt: getWorkspaceClaimLastActivityAt(currentClaim),
            activeUntilAt: readOptionalString(currentClaim.activeUntilAt, 80) || getWorkspaceClaimLastActivityAt(currentClaim),
            expiresAt: readOptionalString(currentClaim.expiresAt, 80),
            remainingMs: formatLeaseRemainingMs(currentClaim.expiresAt, now),
            inactivityRemainingMs: formatWorkspaceInactivityRemainingMs(currentClaim, now)
          }
        : null,
    workspaces
  };
}

function sendWorkspaceError(res, status, message, code = "WORKSPACE_REQUIRED") {
  res.status(status).json({
    error: message,
    code,
    workspaceSelectionRequired: true
  });
}

async function requireWorkspaceClaim(req, res, next) {
  try {
    const sessionId = readSessionId(req);
    if (!sessionId) {
      sendWorkspaceError(res, 401, "Select an avatar before opening the demo workspace.");
      return;
    }

    const rootDb = await readDb();
    const claim = findWorkspaceClaimBySession(rootDb, sessionId);
    if (!claim) {
      sendWorkspaceError(res, 401, "Select an avatar before opening the demo workspace.");
      return;
    }
    const expiration = getWorkspaceClaimExpiration(claim);
    if (expiration) {
      await mutateDb(async (mutableRootDb) => {
        const mutableClaim = findWorkspaceClaimBySession(mutableRootDb, sessionId);
        if (mutableClaim && getWorkspaceClaimExpiration(mutableClaim, Date.now())) {
          expireWorkspaceClaim(mutableRootDb, mutableClaim);
        }
      });
      clearSessionCookie(res);
      sendWorkspaceError(res, expiration.status, expiration.message, expiration.code);
      return;
    }

    req.demoSessionId = sessionId;
    req.demoWorkspaceId = readOptionalString(claim.workspaceId, 80);
    next();
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
}

function buildSharedPlayerUrl(resolverId = "") {
  const params = new URLSearchParams();
  const normalizedResolverId = readOptionalString(resolverId, 120);
  if (normalizedResolverId) {
    params.set("deviceId", normalizedResolverId);
  }
  const query = params.toString();
  return `${SHARED_PLAYER_URL}${query ? `?${query}` : ""}`;
}

function getDemoScreenSpec(screenId) {
  return DEMO_SCREEN_SPECS.find((screenSpec) => screenSpec.screenId === screenId) || null;
}

function buildDemoScreenUrl(screenId) {
  const screenSpec = getDemoScreenSpec(screenId);
  if (!screenSpec) {
    return buildSharedPlayerUrl(screenId);
  }

  const deviceHints = buildScreenDeviceHints({
    screenId: screenSpec.screenId,
    storeId: screenSpec.storeId,
    pageId: screenSpec.pageId,
    location: screenSpec.location,
    screenType: screenSpec.screenType,
    screenSize: screenSpec.screenSize,
    resolverId: screenSpec.resolverId || screenSpec.screenId
  });

  return buildSharedPlayerUrl(deviceHints.resolverId);
}

function getDemoStageDefinitions() {
  const stageScreenIds = new Map();
  for (const screenSpec of DEMO_SCREEN_SPECS) {
    const current = stageScreenIds.get(screenSpec.stageId) || [];
    current.push(screenSpec.screenId);
    stageScreenIds.set(screenSpec.stageId, current);
  }

  return DEMO_STAGE_TEMPLATES.map((stage) => {
    const screenIds = stage.id === "monitoring" ? DEMO_SCREEN_SPECS.map((screenSpec) => screenSpec.screenId) : stageScreenIds.get(stage.id) || [];
    return {
      ...stage,
      screenIds,
      screenCount: screenIds.length
    };
  });
}

function findDemoFeedProduct(feed, sku) {
  const normalizedSku = normalizeSku(sku);
  if (!normalizedSku) {
    return null;
  }
  return (Array.isArray(feed) ? feed : []).find((product) => normalizeSku(product.sku) === normalizedSku) || null;
}

function selectDemoFeedProducts(feed, screenSpec) {
  const requestedSkus = Array.isArray(screenSpec.productSkus) ? screenSpec.productSkus : [];
  const minimumProducts = Math.max(1, Number(screenSpec.minimumProducts || 1));
  const fallbackCategory = readOptionalString(screenSpec.fallbackCategory, 80).toLowerCase();
  const selected = [];
  const seenSkus = new Set();

  for (const sku of requestedSkus) {
    const product = findDemoFeedProduct(feed, sku);
    const normalizedSku = normalizeSku(product?.sku);
    if (product && normalizedSku && !seenSkus.has(normalizedSku)) {
      selected.push(product);
      seenSkus.add(normalizedSku);
    }
  }

  const feedProducts = Array.isArray(feed) ? feed : [];
  const addProduct = (product) => {
    const normalizedSku = normalizeSku(product?.sku);
    if (!normalizedSku || seenSkus.has(normalizedSku)) {
      return;
    }
    selected.push(product);
    seenSkus.add(normalizedSku);
  };

  if (selected.length < minimumProducts && fallbackCategory) {
    for (const product of feedProducts) {
      if (readOptionalString(product.category, 80).toLowerCase() !== fallbackCategory) {
        continue;
      }
      addProduct(product);
      if (selected.length >= minimumProducts) {
        break;
      }
    }
  }

  if (selected.length < minimumProducts) {
    for (const product of feedProducts) {
      addProduct(product);
      if (selected.length >= minimumProducts) {
        break;
      }
    }
  }

  return selected;
}

function buildDemoProductInput(feedProduct, screenSpec, index) {
  const renderingAttributes = {
    badge: screenSpec.creative.badge,
    promotion: screenSpec.creative.promotion,
    cta: screenSpec.creative.cta,
    subcopy: screenSpec.creative.subcopy,
    legal: screenSpec.creative.legal,
    demoPresetId: DEMO_PRESET_ID,
    demoStageId: screenSpec.stageId,
    demoStageLabel: screenSpec.stageLabel,
    demoScreenId: screenSpec.screenId,
    demoScreenLabel: screenSpec.label,
    demoProductIndex: index + 1,
    templateId: screenSpec.templateId,
    brandLogo: normalizeBrandLogoPath(feedProduct.logo || feedProduct.brandLogo)
  };

  return {
    ProductId: feedProduct.sku,
    ProductName: feedProduct.name,
    ProductPage: feedProduct.productPage,
    Image: feedProduct.image,
    BrandLogo: normalizeBrandLogoPath(feedProduct.logo || feedProduct.brandLogo),
    Price: feedProduct.price,
    ComparePrice: feedProduct.comparePrice,
    Rating: feedProduct.rating,
    adid: `${screenSpec.lineItemId}-${index + 1}`.slice(0, 120),
    ClientAdvertiserId: feedProduct.advertiserId,
    category: feedProduct.category,
    brand: feedProduct.brand,
    RenderingAttributes: renderingAttributes
  };
}

function buildDemoScreenRecord(screenSpec, feed, nowIso) {
  return {
    screenId: screenSpec.screenId,
    storeId: screenSpec.storeId,
    location: screenSpec.location,
    pageId: screenSpec.pageId,
    screenType: screenSpec.screenType,
    screenSize: screenSpec.screenSize,
    format: buildDefaultFormat(screenSpec.templateId, screenSpec.screenSize),
    templateId: screenSpec.templateId,
    refreshInterval: readRefreshInterval(screenSpec.refreshInterval),
    screenShareSlots: readScreenShareSlotCount(screenSpec.screenShareSlots, SCREEN_SHARE_SLOT_COUNT),
    defaultSellableShareSlots: readSellableShareSlots(
      screenSpec.defaultSellableShareSlots,
      screenSpec.screenShareSlots,
      DEFAULT_SELLABLE_SHARE_SLOTS
    ),
    deviceHints: buildScreenDeviceHints({
      screenId: screenSpec.screenId,
      storeId: screenSpec.storeId,
      pageId: screenSpec.pageId,
      location: screenSpec.location,
      screenType: screenSpec.screenType,
      screenSize: screenSpec.screenSize,
      resolverId: screenSpec.resolverId || screenSpec.screenId
    }),
    lineItems: []
  };
}

function upsertDemoPageRecord(db, pageSpec, nowIso) {
  const targetId = String(pageSpec.pageId || "").toLowerCase();
  const index = (db.pages || []).findIndex((page) => String(page.pageId || "").toLowerCase() === targetId);
  const existing = index >= 0 ? db.pages[index] : null;
  const record = {
    ...pageSpec,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso
  };

  if (index >= 0) {
    db.pages[index] = record;
    return { action: "updated", page: record };
  }

  db.pages.push(record);
  return { action: "created", page: record };
}

function upsertDemoScreenRecord(db, screenSpec, feed, nowIso) {
  const targetId = String(screenSpec.screenId || "").toLowerCase();
  const index = (db.screens || []).findIndex((screen) => String(screen.screenId || "").toLowerCase() === targetId);
  const existing = index >= 0 ? db.screens[index] : null;
  const baseRecord = buildDemoScreenRecord(screenSpec, feed, nowIso);
  const record = {
    ...baseRecord,
    createdAt: existing?.createdAt || nowIso,
    updatedAt: nowIso
  };

  if (index >= 0) {
    db.screens[index] = record;
    return { action: "updated", screen: record };
  }

  db.screens.push(record);
  return { action: "created", screen: record };
}

function buildDemoPlanningScreenRecord(screenSpec, current = null) {
  if (current && typeof current === "object") {
    return current;
  }

  return {
    screenId: screenSpec.screenId,
    storeId: screenSpec.storeId,
    location: screenSpec.location,
    pageId: screenSpec.pageId,
    screenType: screenSpec.screenType,
    screenSize: screenSpec.screenSize,
    format: buildDefaultFormat(screenSpec.templateId, screenSpec.screenSize),
    templateId: screenSpec.templateId,
    refreshInterval: readRefreshInterval(screenSpec.refreshInterval),
    screenShareSlots: readScreenShareSlotCount(screenSpec.screenShareSlots, SCREEN_SHARE_SLOT_COUNT),
    defaultSellableShareSlots: readSellableShareSlots(
      screenSpec.defaultSellableShareSlots,
      screenSpec.screenShareSlots,
      DEFAULT_SELLABLE_SHARE_SLOTS
    ),
    deviceHints: buildScreenDeviceHints({
      screenId: screenSpec.screenId,
      storeId: screenSpec.storeId,
      pageId: screenSpec.pageId,
      location: screenSpec.location,
      screenType: screenSpec.screenType,
      screenSize: screenSpec.screenSize,
      resolverId: screenSpec.resolverId || screenSpec.screenId
    }),
    lineItems: []
  };
}

function buildDemoPlanningScreens(db) {
  const screens = Array.isArray(db?.screens) ? db.screens : [];
  const currentById = new Map(
    screens.map((screen) => [readOptionalString(screen?.screenId, 80), screen]).filter(([screenId]) => Boolean(screenId))
  );
  return DEMO_SCREEN_SPECS.map((screenSpec) => buildDemoPlanningScreenRecord(screenSpec, currentById.get(screenSpec.screenId) || null));
}

function sampleList(items = [], limit = 0) {
  const source = Array.isArray(items) ? items : [];
  const maxItems = Math.max(0, Number(limit) || 0);
  if (maxItems === 0 || source.length <= maxItems) {
    return [...source];
  }

  const sampled = [];
  const lastIndex = source.length - 1;
  for (let index = 0; index < maxItems; index += 1) {
    const sampleIndex = Math.min(lastIndex, Math.round((index * lastIndex) / Math.max(1, maxItems - 1)));
    sampled.push(source[sampleIndex]);
  }

  return sampled.filter((item, index) => sampled.indexOf(item) === index);
}

function buildDemoConfigSnapshot(db) {
  const stageScreenSampleLimit = 36;
  const pageScreenSampleLimit = 24;
  const screenSummarySampleLimit = 72;
  const quickLinkSampleLimit = 48;
  const storeIdSampleLimit = 240;
  const pages = Array.isArray(db.pages) ? db.pages : [];
  const screens = Array.isArray(db.screens) ? db.screens : [];
  const pageMap = new Map(pages.map((page) => [page.pageId, page]));
  const screenMap = new Map(screens.map((screen) => [screen.screenId, screen]));
  const stageDefinitions = getDemoStageDefinitions().map((stage) => {
    const configuredScreenIds = stage.screenIds.filter((screenId) => screenMap.has(screenId));
    const sampledScreenIds = sampleList(stage.screenIds, stageScreenSampleLimit);
    return {
      ...stage,
      goalDefaults: stage.goalDefaults || null,
      screenIds: sampledScreenIds,
      screenCount: stage.screenCount,
      configuredScreenIds: sampledScreenIds.filter((screenId) => screenMap.has(screenId)),
      configuredScreenCount: configuredScreenIds.length,
      missingScreenIds: sampledScreenIds.filter((screenId) => !screenMap.has(screenId)),
      missingScreenCount: Math.max(0, stage.screenIds.length - configuredScreenIds.length),
      configured: configuredScreenIds.length === stage.screenIds.length,
      completed: configuredScreenIds.length === stage.screenIds.length,
      sampled: sampledScreenIds.length < stage.screenIds.length,
      quickLinks: sampledScreenIds.map((screenId) => {
        const screenSpec = getDemoScreenSpec(screenId);
        const current = screenMap.get(screenId);
        const deviceHints = current
          ? getScreenDeviceHints(current)
          : buildScreenDeviceHints({
              screenId,
              storeId: screenSpec?.storeId || DEMO_STORE_ID,
              pageId: screenSpec?.pageId,
              location: screenSpec?.location,
              screenType: screenSpec?.screenType,
              screenSize: screenSpec?.screenSize,
              resolverId: screenSpec?.resolverId || screenId
            });

        return {
          screenId,
          screenUrl: buildSharedPlayerUrl(deviceHints.resolverId),
          resolverId: deviceHints.resolverId,
          configured: screenMap.has(screenId)
        };
      })
    };
  });

  const pageSummaries = DEMO_PAGE_SPECS.map((pageSpec) => ({
    ...pageSpec,
    configured: pageMap.has(pageSpec.pageId),
    screenIds: sampleList(
      DEMO_SCREEN_SPECS.filter((screenSpec) => screenSpec.pageId === pageSpec.pageId).map((screenSpec) => screenSpec.screenId),
      pageScreenSampleLimit
    ),
    screenCount: DEMO_SCREEN_SPECS.filter((screenSpec) => screenSpec.pageId === pageSpec.pageId).length,
    updatedAt: pageMap.get(pageSpec.pageId)?.updatedAt || "",
    createdAt: pageMap.get(pageSpec.pageId)?.createdAt || ""
  }));

  const allScreenSummaries = DEMO_SCREEN_SPECS.map((screenSpec) => {
    const current = screenMap.get(screenSpec.screenId);
    const deviceHints = current
      ? getScreenDeviceHints(current)
      : buildScreenDeviceHints({
          screenId: screenSpec.screenId,
          storeId: screenSpec.storeId,
          pageId: screenSpec.pageId,
          location: screenSpec.location,
          screenType: screenSpec.screenType,
          screenSize: screenSpec.screenSize,
          resolverId: screenSpec.resolverId || screenSpec.screenId
        });
    const lineItems = Array.isArray(current?.lineItems) ? current.lineItems : [];
    const products = lineItems.flatMap((lineItem) => (Array.isArray(lineItem.products) ? lineItem.products : []));
    return {
      screenId: screenSpec.screenId,
      storeId: current?.storeId || screenSpec.storeId,
      stageId: screenSpec.stageId,
      stageLabel: screenSpec.stageLabel,
      label: screenSpec.label,
      pageId: current?.pageId || screenSpec.pageId,
      location: current?.location || screenSpec.location,
      screenType: current?.screenType || screenSpec.screenType,
      screenSize: current?.screenSize || screenSpec.screenSize,
      templateId: current?.templateId || screenSpec.templateId,
      refreshInterval: readRefreshInterval(current?.refreshInterval ?? screenSpec.refreshInterval),
      screenShareSlots: readScreenShareSlotCount(current?.screenShareSlots ?? screenSpec.screenShareSlots, SCREEN_SHARE_SLOT_COUNT),
      defaultSellableShareSlots: readSellableShareSlots(
        current?.defaultSellableShareSlots ?? screenSpec.defaultSellableShareSlots,
        current?.screenShareSlots ?? screenSpec.screenShareSlots,
        DEFAULT_SELLABLE_SHARE_SLOTS
      ),
      sharedPlayerUrl: SHARED_PLAYER_URL,
      screenUrl: buildSharedPlayerUrl(deviceHints.resolverId),
      resolverId: deviceHints.resolverId,
      configured: Boolean(current),
      lineItemCount: lineItems.length,
      productCount: products.length,
      createdAt: current?.createdAt || "",
      updatedAt: current?.updatedAt || ""
    };
  });
  const screenSummaries = sampleList(allScreenSummaries, screenSummarySampleLimit);

  const counts = {
    baselinePages: DEMO_PAGE_SPECS.length,
    baselineScreens: DEMO_SCREEN_SPECS.length,
    configuredPages: pageSummaries.filter((entry) => entry.configured).length,
    configuredScreens: allScreenSummaries.filter((entry) => entry.configured).length,
    agentRuns: Array.isArray(db.agentRuns) ? db.agentRuns.length : 0,
    telemetryEvents: Array.isArray(db.telemetryEvents) ? db.telemetryEvents.length : 0
  };

  return {
    presetId: DEMO_PRESET_ID,
    storeId: DEMO_STORE_ID,
    storeIds: [...DEMO_STORE_IDS],
    storeCount: DEMO_STORE_IDS.length,
    title: "CYield / CMax guided demo",
    stageOrder: DEMO_STAGE_ORDER,
    stages: stageDefinitions,
    pages: pageSummaries,
    screens: screenSummaries,
    goalDefaults:
      stageDefinitions.find((stage) => stage.id === "cmax-demand")?.goalDefaults || {
        objective: "checkout-attach",
        aggressiveness: "Balanced",
        storeId: "",
        pageId: "CHECKOUT",
        advertiserId: "advertiser-northfield",
        prompt: `Drive checkout demand for Northfield accessories in ${DEMO_STORE_LABEL}.`,
        targetSkuIds: ["ACC-MOUSE-001"]
      },
    counts,
    actions: {
      preset: "/api/demo/preset",
      reset: "/api/demo/reset"
    },
    quickLinks: sampleList(screenSummaries, quickLinkSampleLimit).map((screen) => ({
      screenId: screen.screenId,
      label: screen.label,
      stageId: screen.stageId,
      screenUrl: screen.screenUrl,
      resolverId: screen.resolverId,
      configured: screen.configured
    })),
    samples: {
      storeIds: Math.min(storeIdSampleLimit, DEMO_STORE_IDS.length),
      stageScreens: stageScreenSampleLimit,
      pageScreens: pageScreenSampleLimit,
      screenSummaries: screenSummaries.length,
      quickLinks: Math.min(quickLinkSampleLimit, screenSummaries.length)
    }
  };
}

function isManagedDemoScreen(screen = {}) {
  const screenId = readOptionalString(screen?.screenId, 80);
  const storeId = readOptionalString(screen?.storeId, 80);
  return DEMO_SCREEN_ID_SET.has(screenId) || DEMO_STORE_ID_SET.has(storeId) || LEGACY_DEMO_STORE_ID_SET.has(storeId);
}

async function applyDemoPresetToDb(db, { feed = [], reset = false } = {}) {
  const nowIso = new Date().toISOString();
  const result = {
    demoId: DEMO_PRESET_ID,
    storeId: DEMO_STORE_ID,
    seededStoreIds: DEMO_STORE_IDS,
    prunedScreenIds: [],
    createdPageIds: [],
    updatedPageIds: [],
    createdScreenIds: [],
    updatedScreenIds: [],
    clearedAgentRuns: 0,
    clearedTelemetryEvents: 0
  };

  if (!Array.isArray(db.pages)) {
    db.pages = [];
  }
  if (!Array.isArray(db.screens)) {
    db.screens = [];
  }
  if (!Array.isArray(db.agentRuns)) {
    db.agentRuns = [];
  }
  if (!Array.isArray(db.telemetryEvents)) {
    db.telemetryEvents = [];
  }

  db.screens = db.screens.filter((screen) => {
    if (!isManagedDemoScreen(screen)) {
      return true;
    }
    result.prunedScreenIds.push(readOptionalString(screen?.screenId, 80));
    return false;
  });

  for (const pageSpec of DEMO_PAGE_SPECS) {
    const existingIndex = db.pages.findIndex((page) => page.pageId === pageSpec.pageId);
    const mutation = upsertDemoPageRecord(db, pageSpec, nowIso);
    if (mutation.action === "created") {
      result.createdPageIds.push(pageSpec.pageId);
    } else if (existingIndex >= 0) {
      result.updatedPageIds.push(pageSpec.pageId);
    }
  }

  for (const screenSpec of DEMO_SCREEN_SPECS) {
    const existingIndex = db.screens.findIndex((screen) => screen.screenId === screenSpec.screenId);
    const mutation = upsertDemoScreenRecord(db, screenSpec, feed, nowIso);
    if (mutation.action === "created") {
      result.createdScreenIds.push(screenSpec.screenId);
    } else if (existingIndex >= 0) {
      result.updatedScreenIds.push(screenSpec.screenId);
    }
  }

  rotationState.clear();

  if (reset) {
    result.clearedAgentRuns = db.agentRuns.length;
    result.clearedTelemetryEvents = db.telemetryEvents.length;
    db.agentRuns = [];
    db.telemetryEvents = [];
  }

  return {
    result,
    demo: buildDemoConfigSnapshot(db)
  };
}

async function resetDemoInDb(db) {
  const result = {
    demoId: DEMO_PRESET_ID,
    storeId: DEMO_STORE_ID,
    removedStoreIds: [...new Set([...DEMO_STORE_IDS, ...LEGACY_DEMO_STORE_IDS])],
    removedScreenIds: [],
    clearedAgentRuns: 0,
    clearedTelemetryEvents: 0
  };

  if (!Array.isArray(db.screens)) {
    db.screens = [];
  }
  if (!Array.isArray(db.agentRuns)) {
    db.agentRuns = [];
  }
  if (!Array.isArray(db.telemetryEvents)) {
    db.telemetryEvents = [];
  }

  const retainedScreens = [];
  for (const screen of db.screens) {
    if (isManagedDemoScreen(screen)) {
      result.removedScreenIds.push(readOptionalString(screen?.screenId, 80));
      continue;
    }
    retainedScreens.push(screen);
  }
  db.screens = retainedScreens;

  result.clearedAgentRuns = db.agentRuns.length;
  result.clearedTelemetryEvents = db.telemetryEvents.length;
  db.agentRuns = [];
  db.telemetryEvents = [];
  rotationState.clear();

  return {
    result,
    demo: buildDemoConfigSnapshot(db)
  };
}

const app = express();
const REQUESTED_PORT = Number(process.env.PORT) || 3000;
const REQUESTED_HOST =
  typeof process.env.HOST === "string" && process.env.HOST.trim().length > 0
    ? process.env.HOST.trim()
    : "0.0.0.0";
const HAS_EXPLICIT_PORT = Boolean(process.env.PORT);
const PORT_FALLBACK_LIMIT = 20;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json({ limit: "1mb" }));
app.use(PRODUCT_GENERATED_IMAGE_BASE_PATH, express.static(PRODUCT_IMAGE_OUTPUT_DIR));
app.use(BRAND_LOGO_BASE_PATH, express.static(BRAND_LOGO_OUTPUT_DIR));
app.use(express.static(path.resolve(__dirname, "../public")));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/product-images/status", (_req, res) => {
  res.json({ job: buildProductImageJobSnapshot() });
});

app.get("/api/brand-logos/status", (_req, res) => {
  res.json({ job: buildBrandLogoJobSnapshot() });
});

app.get("/api/product-images/progress", async (_req, res) => {
  try {
    res.json({
      progress: await buildProductImageProgressSnapshot(),
      job: buildProductImageJobSnapshot()
    });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.get("/api/brand-logos/progress", async (_req, res) => {
  try {
    res.json({
      progress: await buildBrandLogoProgressSnapshot(),
      job: buildBrandLogoJobSnapshot()
    });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.post("/api/product-images/generate", async (req, res) => {
  try {
    const job = startProductImageGenerationJob(readProductImageGenerationOptions(req.body));
    res.status(202).json({ job });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({
      error: normalized.message,
      job: buildProductImageJobSnapshot()
    });
  }
});

app.post("/api/brand-logos/generate", async (req, res) => {
  try {
    const job = startBrandLogoGenerationJob(readBrandLogoGenerationOptions(req.body));
    res.status(202).json({ job });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({
      error: normalized.message,
      job: buildBrandLogoJobSnapshot()
    });
  }
});

app.get("/api/workspaces", async (req, res) => {
  try {
    const sessionId = ensureSessionId(req, res);
    const payload = await mutateDb(async (rootDb) => buildWorkspaceStatusPayload(rootDb, sessionId));
    res.json(payload);
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.post("/api/workspaces/claim", async (req, res) => {
  try {
    const sessionId = ensureSessionId(req, res);
    const requestedWorkspaceId = readRequiredString(req.body?.workspaceId, "workspaceId", 80).toLowerCase();
    const seedDb = await readSeedDb();
    if (!DEMO_WORKSPACE_MAP.has(requestedWorkspaceId)) {
      throw new HttpError(404, `Workspace ${requestedWorkspaceId} was not found.`);
    }

    const payload = await mutateDb(async (rootDb) => {
      pruneExpiredWorkspaceClaims(rootDb);
      ensureWorkspaceRoot(rootDb);
      const currentClaim = findWorkspaceClaimBySession(rootDb, sessionId);
      if (currentClaim && readOptionalString(currentClaim.workspaceId, 80) !== requestedWorkspaceId) {
        delete rootDb.workspaceClaims[readOptionalString(currentClaim.workspaceId, 80)];
        resetWorkspaceState(rootDb, currentClaim.workspaceId);
      }

      const existingClaim = rootDb.workspaceClaims[requestedWorkspaceId];
      if (
        existingClaim &&
        readOptionalString(existingClaim.sessionId, 120) !== sessionId &&
        !isWorkspaceClaimExpired(existingClaim)
      ) {
        throw new HttpError(409, `${DEMO_WORKSPACE_MAP.get(requestedWorkspaceId)?.label || "This avatar"} is already in use.`);
      }

      const claimedAt = new Date();
      rootDb.workspaceClaims[requestedWorkspaceId] = {
        workspaceId: requestedWorkspaceId,
        sessionId,
        claimedAt: claimedAt.toISOString(),
        lastActivityAt: claimedAt.toISOString(),
        activeUntilAt: new Date(claimedAt.getTime() + WORKSPACE_ACTIVITY_ACTIVE_GRACE_MS).toISOString(),
        inactivityRemainingMs: WORKSPACE_INACTIVITY_TIMEOUT_MS,
        expiresAt: new Date(claimedAt.getTime() + WORKSPACE_LEASE_MS).toISOString()
      };
      resetWorkspaceState(rootDb, requestedWorkspaceId);
      getWorkspaceState(rootDb, requestedWorkspaceId, { create: true, seedState: seedDb });
      return buildWorkspaceStatusPayload(rootDb, sessionId);
    });

    res.json(payload);
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.post("/api/workspaces/activity", async (req, res) => {
  try {
    const sessionId = ensureSessionId(req, res);
    const now = Date.now();
    let workspaceError = null;
    const payload = await mutateDb(async (rootDb) => {
      pruneExpiredWorkspaceClaims(rootDb, now);
      const claim = findWorkspaceClaimBySession(rootDb, sessionId);
      if (!claim) {
        workspaceError = {
          status: 401,
          code: "WORKSPACE_REQUIRED",
          message: "Select an avatar before opening the demo workspace."
        };
        return null;
      }

      const expiration = getWorkspaceClaimExpiration(claim, now);
      if (expiration) {
        expireWorkspaceClaim(rootDb, claim);
        workspaceError = expiration;
        return null;
      }

      commitWorkspaceInactivityBudget(claim, now);
      claim.lastActivityAt = new Date(now).toISOString();
      claim.activeUntilAt = new Date(now + WORKSPACE_ACTIVITY_ACTIVE_GRACE_MS).toISOString();
      return buildWorkspaceStatusPayload(rootDb, sessionId);
    });

    if (!payload) {
      clearSessionCookie(res);
      sendWorkspaceError(
        res,
        workspaceError?.status || 401,
        workspaceError?.message || "Select an avatar before opening the demo workspace.",
        workspaceError?.code || "WORKSPACE_REQUIRED"
      );
      return;
    }

    res.json(payload);
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.post("/api/workspaces/release", async (req, res) => {
  try {
    const sessionId = ensureSessionId(req, res);
    const payload = await mutateDb(async (rootDb) => {
      pruneExpiredWorkspaceClaims(rootDb);
      const currentClaim = findWorkspaceClaimBySession(rootDb, sessionId);
      if (currentClaim) {
        delete rootDb.workspaceClaims[readOptionalString(currentClaim.workspaceId, 80)];
        resetWorkspaceState(rootDb, currentClaim.workspaceId);
      }
      pruneOrphanedWorkspaceStates(rootDb);
      return buildWorkspaceStatusPayload(rootDb, sessionId);
    });
    clearSessionCookie(res);
    res.json(payload);
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.use("/api", requireWorkspaceClaim);
app.use("/collect", requireWorkspaceClaim);

app.get("/api/options", async (req, res) => {
  try {
    const rootDb = await readDb();
    const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
    res.json({
      pageTypes: PAGE_TYPES,
      environments: ENVIRONMENTS,
      verbosityOptions: VERBOSITY_OPTIONS,
      screenTypes: SCREEN_TYPES,
      screenTypePricingDefaults: getStoredScreenTypeRates(db),
      goalPricingModel: GOAL_PRICING_MODEL,
      templates: TEMPLATE_PRESETS,
      goalObjectives: GOAL_OBJECTIVES.map(({ id, label, description }) => ({ id, label, description })),
      goalAggressivenessOptions: GOAL_AGGRESSIVENESS_OPTIONS,
      goalSupportsSkuTargeting: true,
      goalPromptInferenceProvider: OPENAI_API_KEY ? "openai" : "heuristic",
      goalPromptInferenceModel: OPENAI_API_KEY ? OPENAI_MODEL : "",
      telemetryEventTypes: TELEMETRY_EVENT_TYPES
    });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.put("/api/pricing/screen-types", async (req, res) => {
  try {
    const screenTypeRates = readGoalScreenTypeRateCard(req.body?.screenTypeRates);
    const pricing = await mutateDb(async (rootDb) => {
      const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
      if (!db.pricing || typeof db.pricing !== "object") {
        db.pricing = {};
      }
      db.pricing.screenTypeRates = screenTypeRates;
      return {
        screenTypeRates: db.pricing.screenTypeRates
      };
    });

    res.json(pricing);
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.get("/api/demo/config", async (req, res) => {
  try {
    const rootDb = await readDb();
    const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
    res.json(buildDemoConfigSnapshot(db));
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.post("/api/demo/preset", async (req, res) => {
  try {
    const feed = await readProductFeed();
    const payload = await mutateDb(async (rootDb) => {
      const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
      return applyDemoPresetToDb(db, { feed, reset: false });
    });
    res.json(payload);
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.post("/api/demo/reset", async (req, res) => {
  try {
    const payload = await mutateDb(async (rootDb) => {
      const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
      return resetDemoInDb(db);
    });
    res.json(payload);
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

async function handleTelemetryCollect(req, input, res, { responseMode = "json" } = {}) {
  try {
    const event = await mutateDb(async (rootDb) => {
      const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
      return recordTelemetryEvent(db, input);
    });
    if (responseMode === "empty") {
      res.status(204).end();
      return;
    }
    res.status(202).json({ recorded: true, eventId: event.eventId });
  } catch (error) {
    const normalized = normalizeError(error);
    if (responseMode === "empty") {
      res.status(normalized.status).end();
      return;
    }
    res.status(normalized.status).json({ error: normalized.message });
  }
}

app.get("/collect", async (req, res) => {
  await handleTelemetryCollect(req, req.query, res, { responseMode: "empty" });
});

app.post("/collect", async (req, res) => {
  await handleTelemetryCollect(req, req.body, res);
});

app.get("/api/telemetry/summary", async (req, res) => {
  try {
    const rootDb = await readDb();
    const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
    const planId = readOptionalString(req.query.planId, 120);
    res.json(buildTelemetrySummary(db, planId));
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const feed = await readProductFeed();
    const query = readOptionalString(req.query.q, 120).toLowerCase();
    const category = readOptionalString(req.query.category, 80).toLowerCase();
    const parsedLimit = Number(req.query.limit);
    const limit = Number.isInteger(parsedLimit) ? Math.max(1, Math.min(parsedLimit, 2000)) : 120;
    const includeStockByStore = readBoolean(req.query.includeStockByStore, false);

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
    const accounts = buildProductAccounts(feed);
    res.json({
      products: products.slice(0, limit).map((product) => buildProductFeedResponseItem(product, { includeStockByStore })),
      total: products.length,
      categories,
      accounts
    });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.post("/api/goal-skus/infer", async (req, res) => {
  try {
    const goal = {
      objective: readOptionalString(req.body?.objective, 40),
      aggressiveness: readOptionalString(req.body?.aggressiveness, 20),
      storeId: readOptionalString(req.body?.storeId, 80),
      pageId: readOptionalString(req.body?.pageId, 40),
      assortmentCategory: readOptionalString(req.body?.assortmentCategory, 80).toLowerCase(),
      prompt: readOptionalString(req.body?.prompt, 280),
      advertiserId: readOptionalString(req.body?.advertiserId, 120),
      brand: readOptionalString(req.body?.brand, 80)
    };
    if (!goal.prompt) {
      res.json({
        products: [],
        targetSkuIds: [],
        targetSource: "none",
        matchedTerms: [],
        inferenceProvider: OPENAI_API_KEY ? "openai" : "heuristic",
        inferenceModel: OPENAI_API_KEY ? OPENAI_MODEL : "",
        inferenceReasoning: ""
      });
      return;
    }

    const [rootDb, feed] = await Promise.all([readDb(), readProductFeed()]);
    const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
    const allScreens = Array.isArray(db.screens) ? db.screens : [];
    const scopedScreens = filterGoalScopeScreens(allScreens, goal);
    const resolved = await resolveGoalTargetProducts(goal, feed, scopedScreens.length > 0 ? scopedScreens : allScreens, {
      allowAccountFallback: false
    });
    res.json({
      products: resolved.targetProducts,
      targetSkuIds: resolved.targetSkuIds,
      targetSource: resolved.targetSource,
      matchedTerms: resolved.inferredTerms,
      inferenceProvider: resolved.targetSource === "prompt-ai" ? "openai" : "heuristic",
      inferenceModel: resolved.inferenceModel || (resolved.targetSource === "prompt-ai" ? OPENAI_MODEL : ""),
      inferenceReasoning: resolved.inferenceReasoning || ""
    });
  } catch (error) {
    const normalized = normalizeError(error);
    res.status(normalized.status).json({ error: normalized.message });
  }
});

app.get("/api/pages", async (req, res) => {
  const rootDb = await readDb();
  const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
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

    const page = await mutateDb(async (rootDb) => {
      const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
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
  const rootDb = await readDb();
  const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
  const pageIdFilter = toTrimmedString(req.query.pageId);
  const storeIdFilter = toTrimmedString(req.query.storeId);
  const includeLineItems = readBoolean(req.query.includeLineItems, false);
  let screens = [...db.screens];

  if (pageIdFilter) {
    screens = screens.filter((screen) => screen.pageId === pageIdFilter);
  }
  if (storeIdFilter) {
    screens = screens.filter((screen) => screen.storeId === storeIdFilter);
  }

  screens.sort((a, b) => a.screenId.localeCompare(b.screenId));
  res.json({
    screens: includeLineItems
      ? screens
      : screens.map((screen) => ({
          screenId: screen.screenId,
          storeId: screen.storeId,
          location: screen.location,
          pageId: screen.pageId,
          screenType: screen.screenType,
          screenSize: screen.screenSize,
          format: screen.format,
          templateId: screen.templateId,
          refreshInterval: screen.refreshInterval,
          screenShareSlots: readScreenShareSlotCount(screen.screenShareSlots, SCREEN_SHARE_SLOT_COUNT),
          defaultSellableShareSlots: readSellableShareSlots(
            screen.defaultSellableShareSlots,
            screen.screenShareSlots,
            DEFAULT_SELLABLE_SHARE_SLOTS
          ),
          resolverId: getScreenDeviceHints(screen).resolverId,
          createdAt: screen.createdAt,
          updatedAt: screen.updatedAt
        }))
  });
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
    const screenShareSlots = readScreenShareSlotCount(req.body.screenShareSlots, SCREEN_SHARE_SLOT_COUNT);
    const defaultSellableShareSlots = readSellableShareSlots(
      req.body.defaultSellableShareSlots,
      screenShareSlots,
      DEFAULT_SELLABLE_SHARE_SLOTS
    );
    const rawLineItems = Array.isArray(req.body.lineItems) ? req.body.lineItems : [];

    const screen = await mutateDb(async (rootDb) => {
      const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
      const page = db.pages.find((entry) => entry.pageId === pageId);
      if (!page) {
        throw new HttpError(400, `Page ${pageId} does not exist. Create the page first.`);
      }
      const exists = db.screens.some((entry) => entry.screenId.toLowerCase() === screenId.toLowerCase());
      if (exists) {
        throw new HttpError(409, `Screen ${screenId} already exists.`);
      }

      const lineItems = rawLineItems.map((lineItem, index) =>
        normalizeLineItemForStorage(
          lineItem,
          {
            screenId,
            templateId,
            location,
            fallbackProduct: buildStorageProduct(req.body.product, screenId, location, template.id)
          },
          index
        )
      );

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
        screenShareSlots,
        defaultSellableShareSlots,
        deviceHints: buildScreenDeviceHints({
          screenId,
          storeId,
          pageId,
          location,
          screenType,
          screenSize,
          rawHints: req.body.deviceHints
        }),
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
    const screen = await mutateDb(async (rootDb) => {
      const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
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
      const nextScreenShareSlots =
        req.body.screenShareSlots === undefined
          ? readScreenShareSlotCount(record.screenShareSlots, SCREEN_SHARE_SLOT_COUNT)
          : readScreenShareSlotCount(req.body.screenShareSlots, SCREEN_SHARE_SLOT_COUNT);
      const nextDefaultSellableShareSlots =
        req.body.defaultSellableShareSlots === undefined
          ? readSellableShareSlots(
              record.defaultSellableShareSlots,
              nextScreenShareSlots,
              DEFAULT_SELLABLE_SHARE_SLOTS
            )
          : readSellableShareSlots(
              req.body.defaultSellableShareSlots,
              nextScreenShareSlots,
              DEFAULT_SELLABLE_SHARE_SLOTS
            );

      const shouldReplacePrimaryProduct = req.body.product !== undefined;
      const currentLineItems = Array.isArray(record.lineItems) ? record.lineItems : [];
      const updatedLineItems =
        currentLineItems.length > 0
          ? currentLineItems.map((lineItem, index) => {
              const sourceProducts = Array.isArray(lineItem.products) ? lineItem.products : [];
              const nextProducts =
                shouldReplacePrimaryProduct && index === 0
                  ? [buildStorageProduct(req.body.product, screenId, nextLocation, template.id)]
                  : sourceProducts.length > 0
                    ? sourceProducts.map((product) => buildStorageProduct(product, screenId, nextLocation, template.id))
                    : [];

              return {
                ...lineItem,
                templateId: template.id,
                products: nextProducts
              };
            })
          : [];

      record.storeId = nextStoreId;
      record.location = nextLocation;
      record.pageId = nextPageId;
      record.screenType = nextScreenType;
      record.screenSize = nextScreenSize;
      record.templateId = template.id;
      record.format = nextFormat;
      record.refreshInterval = nextRefreshInterval;
      record.screenShareSlots = nextScreenShareSlots;
      record.defaultSellableShareSlots = nextDefaultSellableShareSlots;
      record.deviceHints = buildScreenDeviceHints({
        screenId,
        storeId: nextStoreId,
        pageId: nextPageId,
        location: nextLocation,
        screenType: nextScreenType,
        screenSize: nextScreenSize,
        rawHints: req.body.deviceHints || record.deviceHints
      });
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
    const deleted = await mutateDb(async (rootDb) => {
      const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
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
    const lineItem = await mutateDb(async (rootDb) => {
      const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
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

app.get("/api/agent/goals/runs", async (req, res) => {
  const rootDb = await readDb();
  const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
  const runs = Array.isArray(db.agentRuns) ? db.agentRuns : [];
  res.json({ runs: runs.slice(0, 20) });
});

app.get("/api/agent/goals/live", async (req, res) => {
  try {
    const planId = readRequiredString(req.query.planId, "planId", 120);
    const rootDb = await readDb();
    const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
    const runs = Array.isArray(db.agentRuns) ? db.agentRuns : [];
    const run = runs.find((entry) => entry.planId === planId);
    if (!run) {
      throw new HttpError(404, `Plan ${planId} was not found.`);
    }

    const screenIds = resolveGoalRunScreenIds(run);
    const liveScreens = buildLiveScreensSnapshot(db, screenIds, {
      goalPlanId: run.planId,
      advertiserId: readOptionalString(run?.goal?.advertiserId, 120)
    });

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

    const run = await mutateDb(async (rootDb) => {
      const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
      const allStoreScreens = Array.isArray(db.screens) ? db.screens : [];
      const screenTypeRates = getStoredScreenTypeRates(db);
      const shouldUseDemoInventory = DEMO_SCREEN_SPECS.length > 0 && (!goal.storeId || DEMO_STORE_ID_SET.has(goal.storeId));
      const allScreens = shouldUseDemoInventory ? buildDemoPlanningScreens(db) : allStoreScreens;
      const requestedPageId = readOptionalString(goal.pageId, 40);
      const initialScopedScreens = filterGoalScopeScreens(allScreens, goal);
      const targetResolution = await resolveGoalTargetProducts(goal, feed, initialScopedScreens.length > 0 ? initialScopedScreens : allScreens);
      const planningSignals = buildGoalPlanningSignals(goal, targetResolution.targetProducts);
      const storeStrategy = buildGoalStoreStrategy(goal, targetResolution.targetProducts, allScreens, planningSignals);
      const planningScreenPool = filterScreensByStoreIds(allScreens, storeStrategy.effectiveStoreIds);
      const planningGoal = {
        ...goal,
        screenTypeRates,
        storeId: readOptionalString(goal.storeId, 80),
        requestedPageId,
        planningSignals,
        storeSelectionReason: storeStrategy.storeSelectionReason,
        storeRankings: storeStrategy.storeRankings
      };
      if (!planningScreenPool.length) {
        throw new HttpError(404, "No screens match this goal scope.");
      }

      const preResolvedGoal = {
        ...planningGoal,
        ...targetResolution,
        requestedStoreId: readOptionalString(goal.storeId, 80),
        effectiveStoreId: storeStrategy.effectiveStoreId || "",
        effectiveStoreIds: Array.isArray(storeStrategy.effectiveStoreIds) ? storeStrategy.effectiveStoreIds : [],
        storeFocusLabel: storeStrategy.storeFocusLabel || readOptionalString(goal.storeId, 80),
        stockMessage: storeStrategy.stockMessage,
        requestedPageId,
        effectivePageId: requestedPageId,
        scopeMode: "requested",
        scopeMessage: ""
      };
      const plan = buildGoalPlan(preResolvedGoal, planningScreenPool);
      const scopeSummary = summarizeGoalScopeFromPlacements(preResolvedGoal, plan.recommendedPlacements, plan.selectionInsights);
      const resolvedGoal = {
        ...preResolvedGoal,
        effectivePageId:
          scopeSummary.scopeMode === "auto-matched" ? scopeSummary.effectivePageId : scopeSummary.effectivePageId || requestedPageId,
        scopeMode: scopeSummary.scopeMode,
        scopeMessage: scopeSummary.scopeMessage,
        scopeSelectionReason: scopeSummary.scopeSelectionReason
      };
      const strategy = {
        ...(plan.strategy || {}),
        summaryBullets: [
          ...new Set([...(Array.isArray(plan.strategy?.summaryBullets) ? plan.strategy.summaryBullets : []), resolvedGoal.scopeSelectionReason].filter(Boolean))
        ]
      };
      const now = new Date().toISOString();
      const runRecord = {
        planId: generatePlanId(),
        status: "planned",
        createdAt: now,
        updatedAt: now,
        goal: resolvedGoal,
        summary: plan.summary,
        strategy,
        totals: plan.totals,
        plannedScreenIds: plan.plannedScreenIds,
        selectedPlacementScreenIds: plan.plannedScreenIds,
        recommendedPlacements: plan.recommendedPlacements,
        proposedChanges: plan.proposedChanges,
        excludedScreens: plan.excludedScreens,
        budget: plan.budget
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
    const requestedBudgetSpend = Number(req.body.budgetSpend);
    const requestedSelectedScreenIds = readScreenIdArray(req.body.selectedScreenIds);
    const feed = await readProductFeed();

    const result = await mutateDb(async (rootDb) => {
      const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
      const runs = ensureAgentRunsArray(db);
      const run = runs.find((entry) => entry.planId === planId);
      if (!run) {
        throw new HttpError(404, `Plan ${planId} was not found.`);
      }
      if (run.status === "applied") {
        const screenIds = resolveGoalRunScreenIds(run);
        const liveScreens = buildLiveScreensSnapshot(db, screenIds, {
          goalPlanId: run.planId,
          advertiserId: readOptionalString(run?.goal?.advertiserId, 120)
        });
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

      const placementPool = new Map();
      for (const placement of [
        ...(Array.isArray(run.recommendedPlacements) ? run.recommendedPlacements : []),
        ...(Array.isArray(run.excludedScreens) ? run.excludedScreens : [])
      ]) {
        const screenId = readOptionalString(placement?.screenId, 80);
        if (screenId && !placementPool.has(screenId)) {
          placementPool.set(screenId, placement);
        }
      }
      const persistedSelectedScreenIds = readScreenIdArray(run.selectedPlacementScreenIds).filter((screenId) =>
        placementPool.has(screenId)
      );
      const fallbackSelectedScreenIds = (Array.isArray(run.recommendedPlacements) ? run.recommendedPlacements : [])
        .map((placement) => readOptionalString(placement?.screenId, 80))
        .filter((screenId) => placementPool.has(screenId));
      const selectedPlacementScreenIds = [
        ...new Set(
          (
            requestedSelectedScreenIds.length > 0
              ? requestedSelectedScreenIds
              : persistedSelectedScreenIds.length > 0
                ? persistedSelectedScreenIds
                : fallbackSelectedScreenIds
          ).filter((screenId) => placementPool.has(screenId))
        )
      ];
      const selectedPlacements = selectedPlacementScreenIds
        .map((screenId, index) => {
          const placement = placementPool.get(screenId);
          if (!placement) {
            return null;
          }
          return {
            ...placement,
            screenId,
            budgetRank: index + 1
          };
        })
        .filter(Boolean);
      const budgetSelection = buildGoalBudget(run.goal || {}, selectedPlacements, requestedBudgetSpend);
      if (budgetSelection.fundedScreenIds.length === 0) {
        throw new HttpError(400, "The selected budget does not fund any placements.");
      }

      const fundedScreenIdSet = new Set(budgetSelection.fundedScreenIds);
      const changeMap = new Map(
        (Array.isArray(run.proposedChanges) ? run.proposedChanges : [])
          .filter((change) => fundedScreenIdSet.has(readOptionalString(change?.screenId, 80)))
          .map((change) => [readOptionalString(change?.screenId, 80), change])
      );
      const manualSelectionScreenIdSet = new Set(
        selectedPlacementScreenIds.filter((screenId) => fundedScreenIdSet.has(screenId) && !changeMap.has(screenId))
      );
      const plannedScreenIds = budgetSelection.fundedScreenIds;
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
      let capacitySkippedCount = 0;
      let creativeGeneratedCount = 0;
      const appliedScreenIds = [];

      for (const screenId of plannedScreenIds) {
        let screen = (db.screens || []).find((entry) => entry.screenId === screenId);
        if (!screen) {
          const screenSpec = getDemoScreenSpec(screenId);
          if (screenSpec) {
            const pageSpec = DEMO_PAGE_SPECS.find((page) => page.pageId === screenSpec.pageId) || null;
            if (pageSpec) {
              upsertDemoPageRecord(db, pageSpec, now);
            }
            screen = upsertDemoScreenRecord(db, screenSpec, feed, now).screen;
          }
        }
        if (!screen) {
          skippedCount += 1;
          continue;
        }

        const change = changeMap.get(screenId) || null;
        const nextTemplateId = readOptionalString(change?.recommendedTemplateId, 80) || screen.templateId;
        const nextTemplate = getTemplatePreset(nextTemplateId);
        const goalProductsForScreen = pickGoalProductsForScreenWithObjective(screen, runTargetProducts, nextTemplate.id, objectiveId);
        if (hasGoalTargeting && goalProductsForScreen.length === 0 && !manualSelectionScreenIdSet.has(screenId)) {
          skippedCount += 1;
          continue;
        }

        const shareAvailability = resolveScreenShareAvailability(screen, {
          goal: {
            ...(run.goal || {}),
            planId: run.planId
          },
          planId: run.planId
        });
        if (!shareAvailability.hasCapacity) {
          capacitySkippedCount += 1;
          continue;
        }

        const existingLineItems = getEffectiveScreenLineItems(screen);
        const hadManagedGoalLineItem = existingLineItems.some((lineItem) =>
          isManagedGoalLineItemForGoal(lineItem, run.goal || {}, run.planId)
        );
        const preservedLineItems = existingLineItems.filter(
          (lineItem) => !isManagedGoalLineItemForGoal(lineItem, run.goal || {}, run.planId)
        );
        const fallbackFeedProduct = runTargetProducts[0] || null;
        const goalLineItem = buildGoalLineItemForScreen(
          screen,
          nextTemplate.id,
          objectiveId,
          goalProductsForScreen,
          fallbackFeedProduct,
          {
            ...(run.goal || {}),
            planId: run.planId
          }
        );
        screen.lineItems = [...preservedLineItems, goalLineItem];
        if (!hadManagedGoalLineItem) {
          creativeGeneratedCount += 1;
        }
        screen.updatedAt = now;
        appliedScreenIds.push(screen.screenId);
        appliedCount += 1;
      }

      if (appliedCount === 0) {
        if (capacitySkippedCount > 0) {
          throw new HttpError(
            409,
            "No funded screens had an open configured screen share available for the selected flight window. Refresh the plan and choose different screens."
          );
        }
        throw new HttpError(409, "No funded screens could be applied.");
      }

      const uniqueAppliedScreenIds = [...new Set(appliedScreenIds)];
      const liveScreens = buildLiveScreensSnapshot(db, uniqueAppliedScreenIds, {
        goalPlanId: run.planId,
        advertiserId: readOptionalString(run?.goal?.advertiserId, 120)
      });
      run.status = "applied";
      run.appliedAt = now;
      run.updatedAt = now;
      run.appliedCount = appliedCount;
      run.skippedCount = skippedCount;
      run.capacitySkippedCount = capacitySkippedCount;
      run.creativeGeneratedCount = creativeGeneratedCount;
      run.selectedPlacementScreenIds = selectedPlacementScreenIds;
      run.budget = budgetSelection;
      run.appliedScreenIds = uniqueAppliedScreenIds;
      run.liveScreens = liveScreens;
      run.liveCount = liveScreens.length;
      run.summary = `${run.summary} Approved ${GOAL_PRICING_MODEL.currencySymbol}${budgetSelection.selectedSpend.toLocaleString()} across ${budgetSelection.fundedPlacementCount} placement(s). Applied ${appliedCount} sponsored share update(s).${
        skippedCount > 0 ? ` Skipped ${skippedCount} screen(s) due to context guardrails.` : ""
      }${capacitySkippedCount > 0 ? ` Skipped ${capacitySkippedCount} screen(s) because no open configured screen share remained at launch.` : ""}${
        creativeGeneratedCount > 0 ? ` Auto-created creative on ${creativeGeneratedCount} screen(s).` : ""
      }`;

      return {
        run,
        appliedCount,
        skippedCount,
        capacitySkippedCount,
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
    const rootDb = await readDb();
    const db = getWorkspaceState(rootDb, req.demoWorkspaceId, { create: true });
    const feed = await readProductFeed();
    const feedLookup = buildProductFeedLookup(feed);
    const resolved = resolveScreenRequest(db, req);
    const screen = resolved.screen;
    const screenId = screen.screenId;

    const now = new Date();
    const lineItems = getEffectiveScreenLineItems(screen);
    const activeLineItems = lineItems.filter((lineItem) => isLineItemActive(lineItem, now));
    const candidateLineItems = activeLineItems.length > 0 ? activeLineItems : lineItems;
    const shareConfig = resolveScreenShareConfig(screen);
    const deliveryShares = resolveLineItemDeliveryShares(candidateLineItems, shareConfig.totalSlots);
    const shareByLineItemId = new Map(
      deliveryShares.map((entry) => [readOptionalString(entry.lineItem?.lineItemId, 120), entry])
    );
    const selectedLineItem =
      findPreferredLineItem(candidateLineItems, {
        lineItemId: req.query.lineItemId,
        goalPlanId: req.query.goalPlanId,
        advertiserId: req.query.advertiserId
      }) ||
      pickLineItem(screenId, candidateLineItems, shareConfig.totalSlots);
    if (!selectedLineItem) {
      throw new HttpError(404, `Screen ${screenId} has no line items configured.`);
    }
    const selectedShare = shareByLineItemId.get(readOptionalString(selectedLineItem?.lineItemId, 120)) || null;

    const selectedTemplateId =
      readOptionalString(selectedLineItem.templateId, 120) || screen.templateId || "fullscreen-banner";
    const selectedTemplate = getTemplatePreset(selectedTemplateId);
    const sourceProducts = Array.isArray(selectedLineItem.products) ? [...selectedLineItem.products] : [];

    const products = sourceProducts.map((product, index) =>
      normalizeProductForDelivery(preferFeedImageForProduct(product, feedLookup), {
        screenId,
        lineItemId: selectedLineItem.lineItemId,
        index,
        templateId: selectedTemplate.id,
        location: screen.location
      })
    );

    res.json({
      format: buildDefaultFormat(selectedTemplate.id, screen.screenSize),
      products,
      settings: {
        templateId: selectedTemplate.id,
        templateName: selectedTemplate.name,
        loopIntervalMs: getTemplateLoopIntervalMs(selectedTemplate.id),
        refreshInterval: readRefreshInterval(screen.refreshInterval),
        screenId: screen.screenId,
        storeId: screen.storeId,
        screenType: screen.screenType,
        screenSize: screen.screenSize,
        pageId: screen.pageId,
        location: screen.location,
        lineItemId: selectedLineItem.lineItemId,
        goalPlanId: readOptionalString(selectedLineItem.goalPlanId, 120),
        goalAdvertiserId: readOptionalString(selectedLineItem.goalAdvertiserId, 120),
        deliveryShareRatio: Number(selectedShare?.shareRatio || 0),
        deliveryShareLabel: readOptionalString(selectedShare?.shareLabel, 40),
        screenShareSlots: shareConfig.totalSlots,
        defaultSellableShareSlots: shareConfig.sellableShareSlots,
        defaultSellableShareLabel: shareConfig.shareLabel,
        lineItemCount: lineItems.length,
        activeLineItemCount: candidateLineItems.length,
        sharedPlayerUrl: SHARED_PLAYER_URL,
        resolverId: getScreenDeviceHints(screen).resolverId,
        resolvedBy: resolved.resolvedBy,
        requestViewport: resolved.requestContext.viewport.normalized || "",
        requestOrientation: resolved.requestContext.orientation || ""
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

function startServer(port, attempt = 0) {
  const server = app.listen(port, REQUESTED_HOST);

  server.on("listening", () => {
    const address = server.address();
    const activePort =
      address && typeof address === "object" && "port" in address ? Number(address.port) : Number(port);
    // eslint-disable-next-line no-console
    console.log(`In-store middleware listening on http://${REQUESTED_HOST}:${activePort}`);
  });

  server.on("error", (error) => {
    if (error?.code === "EADDRINUSE") {
      if (HAS_EXPLICIT_PORT) {
        // eslint-disable-next-line no-console
        console.error(`Port ${port} is already in use. Set PORT to a free port and restart.`);
        process.exitCode = 1;
        return;
      }

      if (attempt >= PORT_FALLBACK_LIMIT) {
        // eslint-disable-next-line no-console
        console.error(`No free port found in the range ${REQUESTED_PORT}-${REQUESTED_PORT + PORT_FALLBACK_LIMIT}.`);
        process.exitCode = 1;
        return;
      }

      const nextPort = port + 1;
      // eslint-disable-next-line no-console
      console.warn(`Port ${port} is busy. Retrying on http://localhost:${nextPort}`);
      startServer(nextPort, attempt + 1);
      return;
    }

    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  });

  return server;
}

startServer(REQUESTED_PORT);
