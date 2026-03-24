const UI_STAGES = ["supply", "buying", "monitoring"];
const SHARED_PLAYER_URL = "/screen.html";
const PRESENTER_CHANNEL_NAME = "instore-demo-presenter";
const PRESENTER_SNAPSHOT_KEY = "instore-demo-presenter-snapshot";
let presenterChannel = null;

const MANUAL_SUPPLY = {
  page: {
    pageId: "ENTRANCE",
    pageType: "Homepage",
    environment: "In-Store",
    firePageBeacons: true,
    oneTagHybridIntegration: false,
    includeBidInResponse: false
  },
  screen: {
    screenId: "STORE_42_CYIELD_ENTRANCE_HERO",
    storeId: "STORE_42",
    location: "entrance",
    pageId: "ENTRANCE",
    screenType: "Horizontal Screen",
    screenSize: "1920x1080",
    templateId: "fullscreen-banner",
    refreshInterval: 30000
  }
};

const DEFAULT_GOAL_DEFAULTS = {
  objective: "checkout-attach",
  aggressiveness: "Balanced",
  storeId: "",
  pageId: "CHECKOUT",
  advertiserId: "advertiser-northfield",
  prompt: "Drive checkout demand for Northfield accessories in STORE_42.",
  targetSkuIds: ["ACC-MOUSE-001"]
};

const DEFAULT_SCREEN_TYPE_DAILY_RATES = {
  "Vertical Screen": 180,
  "Horizontal Screen": 150,
  "Shelf Edge": 65,
  Endcap: 95,
  Kiosk: 130,
  "Digital Menu Board": 120
};
const DEFAULT_GOAL_FLIGHT_DAYS = 7;

function createDefaultStage(id, label, description, starterScreenId, actionLabel) {
  return {
    id,
    label,
    description,
    starterScreenId,
    actionLabel,
    goalDefaults: null,
    screenIds: [],
    configuredScreenIds: [],
    missingScreenIds: [],
    quickLinks: [],
    screenCount: 0,
    configured: false,
    completed: false
  };
}

const DEFAULT_DEMO_CONFIG = {
  presetId: "cyield-cmax-demo",
  storeId: "STORE_42",
  title: "CYield / CMax guided demo",
  goalDefaults: { ...DEFAULT_GOAL_DEFAULTS },
  stages: {
    supply: createDefaultStage(
      "cyield-supply",
      "CYield Supply Setup",
      "Treat screens like pages, then load the preset inventory in one click.",
      "STORE_42_CYIELD_ENTRANCE_HERO",
      "Load supply preset"
    ),
    buying: createDefaultStage(
      "cmax-demand",
      "CMax Buying / Demand",
      "Generate demand against the configured supply and apply it.",
      "STORE_42_CMAX_CHECKOUT_KIOSK",
      "Generate buying plan"
    ),
    monitoring: createDefaultStage(
      "monitoring",
      "Monitoring",
      "Review campaign delivery, shopper engagement, and in-store outcomes.",
      "STORE_42_CMAX_CHECKOUT_KIOSK",
      "Open monitoring"
    )
  },
  pages: [],
  screens: [],
  quickLinks: [],
  counts: {
    baselinePages: 0,
    baselineScreens: 0,
    configuredPages: 0,
    configuredScreens: 0,
    agentRuns: 0,
    telemetryEvents: 0
  }
};

const state = {
  stage: "supply",
  options: null,
  demo: { ...DEFAULT_DEMO_CONFIG },
  pages: [],
  screens: [],
  productFeed: [],
  productAccounts: [],
  productCategories: [],
  selectedGoalSkuIds: new Set(),
  agentRuns: [],
  activeGoalPlan: null,
  telemetrySummary: null,
  lastDemoAction: null,
  editingScreenId: "",
  manualSupplyConfirmed: false,
  presetLoadedInSession: false,
  goalPlanningStep: 1,
  goalScopeStepAcknowledged: false,
  goalRetailerRateCard: null,
  goalPlacementSelections: new Map(),
  goalBudgetPlanId: "",
  goalBudgetSpend: null,
  sessionPlanIds: new Set(),
  toastTimeoutId: null,
  previewRailKey: ""
};

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return [...document.querySelectorAll(selector)];
}

const elements = {
  statusText: qs("#statusText"),
  toast: qs("#toast"),
  demoScreenLink: qs("#demoScreenLink"),
  presenterNotesLink: qs("#presenterNotesLink"),
  monitorPreviewLink: qs("#monitorPreviewLink"),
  supplySection: qs("#stage-supply"),
  buyingSection: qs("#stage-buying"),
  monitoringSection: qs("#stage-monitoring"),
  supplyStagePill: qs("#supplyStagePill"),
  buyingStagePill: qs("#buyingStagePill"),
  monitoringStagePill: qs("#monitoringStagePill"),
  createAnchorBtn: qs("#createAnchorBtn"),
  supplySummaryCards: qs("#supplySummaryCards"),
  presetSummary: qs("#presetSummary"),
  pagesList: qs("#pagesList"),
  screensList: qs("#screensList"),
  pageForm: qs("#page-form"),
  pageId: qs("#pageId"),
  pageIdCount: qs("#pageIdCount"),
  pageTypeGrid: qs("#pageTypeGrid"),
  environmentGrid: qs("#environmentGrid"),
  firePageBeacons: qs("#firePageBeacons"),
  oneTagHybridIntegration: qs("#oneTagHybridIntegration"),
  includeBidInResponse: qs("#includeBidInResponse"),
  screenForm: qs("#screen-form"),
  editScreenId: qs("#editScreenId"),
  screenId: qs("#screenId"),
  storeId: qs("#storeId"),
  location: qs("#location"),
  pageIdSelect: qs("#pageIdSelect"),
  screenType: qs("#screenType"),
  screenSize: qs("#screenSize"),
  templateId: qs("#templateId"),
  refreshInterval: qs("#refreshInterval"),
  templatePreview: qs("#templatePreview"),
  retailerRateCard: qs("#retailerRateCard"),
  saveRetailerRatesBtn: qs("#saveRetailerRatesBtn"),
  screenSubmitBtn: qs("#screenSubmitBtn"),
  screenCancelBtn: qs("#screenCancelBtn"),
  goalAgentForm: qs("#goalAgentForm"),
  goalObjective: qs("#goalObjective"),
  goalAggressiveness: qs("#goalAggressiveness"),
  goalRateCard: qs("#goalRateCard"),
  goalStoreScope: qs("#goalStoreScope"),
  goalPageScope: qs("#goalPageScope"),
  goalFlightStart: qs("#goalFlightStart"),
  goalFlightEnd: qs("#goalFlightEnd"),
  goalPrompt: qs("#goalPrompt"),
  goalBrandAccount: qs("#goalBrandAccount"),
  goalProductCategory: qs("#goalProductCategory"),
  goalProductSearch: qs("#goalProductSearch"),
  goalSelectedSkuHeadline: qs("#goalSelectedSkuHeadline"),
  goalSelectedSkus: qs("#goalSelectedSkus"),
  goalSelectCategoryBtn: qs("#goalSelectCategoryBtn"),
  goalClearSkusBtn: qs("#goalClearSkusBtn"),
  goalProductList: qs("#goalProductList"),
  goalSkuCount: qs("#goalSkuCount"),
  goalStep1NextBtn: qs("#goalStep1NextBtn"),
  goalStep2NextBtn: qs("#goalStep2NextBtn"),
  goalPlanBtn: qs("#goalPlanBtn"),
  goalApplyBtn: qs("#goalApplyBtn"),
  goalPlanSummary: qs("#goalPlanSummary"),
  goalPlanChanges: qs("#goalPlanChanges"),
  goalPlanBudget: qs("#goalPlanBudget"),
  goalLiveSummary: qs("#goalLiveSummary"),
  goalLiveScreens: qs("#goalLiveScreens"),
  telemetrySummary: qs("#telemetrySummary"),
  measurementBoardGrid: qs("#measurementBoardGrid"),
  telemetryByScreen: qs("#telemetryByScreen"),
  telemetryByTemplate: qs("#telemetryByTemplate"),
  telemetryBySku: qs("#telemetryBySku"),
  monitoringOverviewKicker: qs("#monitoringOverviewKicker"),
  monitoringOverviewTitle: qs("#monitoringOverviewTitle"),
  monitoringOverviewLede: qs("#monitoringOverviewLede"),
  monitoringOverviewSignals: qs("#monitoringOverviewSignals"),
  monitoringOverviewAsideEyebrow: qs("#monitoringOverviewAsideEyebrow"),
  monitoringOverviewAsideTitle: qs("#monitoringOverviewAsideTitle"),
  monitoringOverviewAsideCopy: qs("#monitoringOverviewAsideCopy"),
  monitoringMeasurementTitle: qs("#monitoringMeasurementTitle"),
  monitoringMeasurementIntro: qs("#monitoringMeasurementIntro"),
  measurementBriefTitle: qs("#measurementBriefTitle"),
  measurementBriefCopy: qs("#measurementBriefCopy"),
  monitorPreviewRail: qs("#monitorPreviewRail"),
  monitoringNarrative: qs("#monitoringNarrative"),
  monitorKpiPlays: qs("#monitorKpiPlays"),
  monitorKpiExposure: qs("#monitorKpiExposure"),
  monitorKpiScreens: qs("#monitorKpiScreens"),
  monitorKpiPlans: qs("#monitorKpiPlans"),
  agentRunsList: qs("#agentRunsList"),
  refreshInventoryBtn: qs("#refreshBtn"),
  refreshRunsBtn: qs("#agentRefreshBtn"),
  refreshTelemetryBtn: qs("#telemetryRefreshBtn")
};

const DEFAULT_MEASUREMENT_BOARD_GRID_HTML = elements.measurementBoardGrid?.innerHTML || "";

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function defaultValue(options, preferred) {
  if (!Array.isArray(options) || options.length === 0) {
    return preferred || "";
  }
  return options.includes(preferred) ? preferred : options[0];
}

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function formatMoney(value) {
  return `$${Math.round(Number(value || 0)).toLocaleString()}`;
}

function parseDateInputValue(value) {
  const raw = String(value || "").trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.valueOf()) ? null : date;
}

function formatDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.valueOf())) {
    return "";
  }
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTodayDateInputValue() {
  const today = new Date();
  return formatDateInputValue(new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())));
}

function shiftDateInputValue(value, dayOffset) {
  const date = parseDateInputValue(value) || parseDateInputValue(getTodayDateInputValue());
  if (!date) {
    return "";
  }
  date.setUTCDate(date.getUTCDate() + Number(dayOffset || 0));
  return formatDateInputValue(date);
}

function formatDateLabel(value) {
  const parsed = parseDateInputValue(value);
  if (!parsed) {
    return "";
  }
  return parsed.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC"
  });
}

function getGoalFlightDayCount(startValue, endValue) {
  const start = parseDateInputValue(startValue);
  const end = parseDateInputValue(endValue);
  if (!start || !end) {
    return 0;
  }
  const diffDays = Math.floor((end.valueOf() - start.valueOf()) / (24 * 60 * 60 * 1000));
  return diffDays >= 0 ? diffDays + 1 : 0;
}

function hasValidGoalFlightDates() {
  return getGoalFlightDayCount(elements.goalFlightStart?.value, elements.goalFlightEnd?.value) > 0;
}

function formatGoalFlightSummary(startValue = elements.goalFlightStart?.value, endValue = elements.goalFlightEnd?.value) {
  const flightDays = getGoalFlightDayCount(startValue, endValue);
  if (!flightDays) {
    return "Choose a start and end date.";
  }
  return `${formatDateLabel(startValue)} - ${formatDateLabel(endValue)} (${flightDays} day${flightDays === 1 ? "" : "s"})`;
}

function getGoalRateCardScreenTypes() {
  return Array.isArray(state.options?.screenTypes) && state.options.screenTypes.length > 0
    ? state.options.screenTypes
    : Object.keys(DEFAULT_SCREEN_TYPE_DAILY_RATES);
}

function getGoalRateCardDefaults() {
  const serverDefaults = state.options?.screenTypePricingDefaults || {};
  return Object.fromEntries(
    getGoalRateCardScreenTypes().map((screenType) => {
      const fallback = Number(DEFAULT_SCREEN_TYPE_DAILY_RATES[screenType] || 100);
      const configured = Number(serverDefaults?.[screenType]);
      return [screenType, Number.isFinite(configured) ? Math.max(0, Math.round(configured)) : fallback];
    })
  );
}

function sanitizeGoalRateCard(rateCard = {}) {
  const defaults = getGoalRateCardDefaults();
  const normalized = {};
  for (const screenType of getGoalRateCardScreenTypes()) {
    const candidate = Number(rateCard?.[screenType]);
    normalized[screenType] = Number.isFinite(candidate) && candidate >= 0 ? Math.round(candidate) : defaults[screenType];
  }
  return normalized;
}

function readGoalRateCard() {
  return sanitizeGoalRateCard(state.goalRetailerRateCard || state.options?.screenTypePricingDefaults || {});
}

function readRetailerRateCardInputs() {
  const raw = {};
  for (const input of qsa(".js-retailer-rate-input")) {
    const screenType = String(input.dataset.screenType || "").trim();
    if (screenType) {
      raw[screenType] = Number(input.value);
    }
  }
  return sanitizeGoalRateCard(raw);
}

function renderGoalRateCard(rateCardSeed = null) {
  const rateCard = sanitizeGoalRateCard(
    rateCardSeed && typeof rateCardSeed === "object" ? rateCardSeed : readGoalRateCard()
  );
  state.goalRetailerRateCard = rateCard;
  if (!elements.goalRateCard) {
    return;
  }
  elements.goalRateCard.innerHTML = getGoalRateCardScreenTypes()
    .map(
      (screenType) => `<article class="summary-card">
        <span class="kpi-card__label">${escapeHtml(screenType)}</span>
        <strong>${escapeHtml(formatMoney(rateCard[screenType] || 0))}</strong>
        <span>Per screen / day</span>
      </article>`
    )
    .join("");
}

function renderRetailerRateCard(rateCardSeed = null) {
  if (!elements.retailerRateCard) {
    return;
  }
  const rateCard = sanitizeGoalRateCard(
    rateCardSeed && typeof rateCardSeed === "object" ? rateCardSeed : state.options?.screenTypePricingDefaults || {}
  );
  elements.retailerRateCard.innerHTML = getGoalRateCardScreenTypes()
    .map(
      (screenType, index) => `<div class="field">
        <label for="retailerRateCard-${escapeHtml(String(index))}">${escapeHtml(screenType)}</label>
        <span class="goal-money-input">
          <input
            id="retailerRateCard-${escapeHtml(String(index))}"
            type="number"
            min="0"
            step="5"
            inputmode="numeric"
            class="js-retailer-rate-input"
            data-screen-type="${escapeHtml(screenType)}"
            value="${escapeHtml(String(rateCard[screenType] || 0))}"
          >
        </span>
        <p class="field__meta">Per screen / day</p>
      </div>`
    )
    .join("");
}

function summarizeGoalRateCard() {
  const rates = Object.values(readGoalRateCard()).filter((value) => Number.isFinite(value));
  if (rates.length === 0) {
    return "Rate card not set.";
  }
  const min = Math.min(...rates);
  const max = Math.max(...rates);
  return `${formatMoney(min)}-${formatMoney(max)} per screen / day`;
}

function getDemoStoreCount() {
  const storeIds = [
    ...new Set(
      (state.demo.screens || [])
        .map((screen) => String(screen?.storeId || "").trim())
        .filter(Boolean)
    )
  ];
  return storeIds.length || 1;
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

function formatTimestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? "Unknown time" : date.toLocaleString();
}

function normalizeSku(value) {
  return String(value || "").trim().toUpperCase();
}

function titleCase(value) {
  const text = String(value || "").trim().replace(/[_-]+/g, " ");
  if (!text) {
    return "";
  }
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function normalizeMatchToken(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getSelectedGoalProducts() {
  return (state.productFeed || []).filter((product) => state.selectedGoalSkuIds.has(normalizeSku(product.sku)));
}

function buildProductAccountsFromProducts(products = []) {
  const accounts = new Map();
  for (const product of products || []) {
    const advertiserId = String(product?.advertiserId || "").trim();
    if (!advertiserId) {
      continue;
    }
    if (!accounts.has(advertiserId)) {
      accounts.set(advertiserId, {
        advertiserId,
        brand: String(product?.brand || "").trim() || "Store Brand"
      });
    }
  }
  return [...accounts.values()].sort(
    (left, right) => left.brand.localeCompare(right.brand) || left.advertiserId.localeCompare(right.advertiserId)
  );
}

function getProductAccountLabel(account) {
  const brand = String(account?.brand || "").trim();
  const advertiserId = String(account?.advertiserId || "").trim();
  if (brand && advertiserId) {
    return `${brand} | ${advertiserId}`;
  }
  return brand || advertiserId || "Account required";
}

function getSelectedGoalAdvertiserId() {
  return String(elements.goalBrandAccount?.value || "").trim();
}

function getGoalAccountByAdvertiserId(advertiserId = getSelectedGoalAdvertiserId()) {
  const normalizedId = String(advertiserId || "").trim();
  if (!normalizedId) {
    return null;
  }
  return (state.productAccounts || []).find((entry) => entry.advertiserId === normalizedId) || null;
}

function getBrandScopedProducts(advertiserId = getSelectedGoalAdvertiserId()) {
  const normalizedId = String(advertiserId || "").trim();
  return (state.productFeed || []).filter((product) => !normalizedId || product.advertiserId === normalizedId);
}

function formatSentenceList(values, limit = values?.length || 0) {
  const items = (values || []).filter(Boolean);
  const visible = limit > 0 ? items.slice(0, limit) : items;
  if (visible.length === 0) {
    return "";
  }
  if (visible.length === 1) {
    return visible[0];
  }
  if (visible.length === 2) {
    return `${visible[0]} and ${visible[1]}`;
  }
  return `${visible.slice(0, -1).join(", ")}, and ${visible[visible.length - 1]}`;
}

function getProductLabelBySku(sku) {
  const normalizedSku = normalizeSku(sku);
  if (!normalizedSku) {
    return "";
  }
  const product = (state.productFeed || []).find((entry) => normalizeSku(entry.sku) === normalizedSku);
  return product?.name || normalizedSku;
}

function screenContainsAnyTargetSkuLocal(screen, targetSkuIds) {
  const targetSkuSet = new Set((targetSkuIds || []).map((sku) => normalizeSku(sku)).filter(Boolean));
  if (targetSkuSet.size === 0) {
    return false;
  }
  for (const lineItem of Array.isArray(screen?.lineItems) ? screen.lineItems : []) {
    for (const product of Array.isArray(lineItem.products) ? lineItem.products : []) {
      const sku = normalizeSku(product?.ProductId || product?.productId || product?.sku);
      if (sku && targetSkuSet.has(sku)) {
        return true;
      }
    }
  }
  return false;
}

function isScreenCompatibleWithProductsLocal(screen, products) {
  if (!screen || !Array.isArray(products) || products.length === 0) {
    return false;
  }
  const targetSkuIds = products.map((product) => normalizeSku(product.sku)).filter(Boolean);
  if (screenContainsAnyTargetSkuLocal(screen, targetSkuIds)) {
    return true;
  }
  const context = normalizeMatchToken([screen.pageId, screen.location, screen.screenType].filter(Boolean).join(" "));
  return products.some((product) => {
    const category = normalizeMatchToken(product.category);
    return Boolean(category && context.includes(category));
  });
}

function getTemplateById(templateId) {
  return (state.options?.templates || []).find((entry) => entry.id === templateId) || null;
}

function objectiveLabelById(objectiveId) {
  return (state.options?.goalObjectives || []).find((entry) => entry.id === objectiveId)?.label || objectiveId || "Goal";
}

function goalTargetSourceLabel(source) {
  switch (source) {
    case "manual":
      return "Manual SKU shortlist";
    case "account":
      return "Brand-led assortment";
    case "prompt":
      return "Brief-inferred SKU shortlist";
    default:
      return "Objective-led recommendation";
  }
}

function showStatus(message, isError = false) {
  if (!elements.statusText) {
    return;
  }
  elements.statusText.textContent = message;
  elements.statusText.style.color = isError ? "#b84235" : "#5f6f87";
}

function showToast(message, isError = false) {
  if (!elements.toast) {
    return;
  }
  if (state.toastTimeoutId) {
    clearTimeout(state.toastTimeoutId);
  }
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  elements.toast.classList.toggle("is-error", isError);
  state.toastTimeoutId = window.setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2800);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const text = await response.text();
  let payload = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    const error = new Error(payload.error || `Request failed with status ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function requestOptionalJson(url, options = {}) {
  try {
    return await requestJson(url, options);
  } catch (error) {
    if (error?.status === 404 || error?.status === 405) {
      return null;
    }
    throw error;
  }
}

function normalizeStage(rawStage, fallbackStage) {
  const stage = rawStage && typeof rawStage === "object" ? rawStage : {};
  const screenIds = Array.isArray(stage.screenIds) ? stage.screenIds : [];
  const configuredScreenIds = Array.isArray(stage.configuredScreenIds) ? stage.configuredScreenIds : [];
  const missingScreenIds = Array.isArray(stage.missingScreenIds)
    ? stage.missingScreenIds
    : screenIds.filter((screenId) => !configuredScreenIds.includes(screenId));
  const quickLinks = Array.isArray(stage.quickLinks) ? stage.quickLinks : [];

  return {
    ...fallbackStage,
    ...stage,
    screenIds,
    configuredScreenIds,
    missingScreenIds,
    quickLinks,
    screenCount: Number(stage.screenCount || screenIds.length || fallbackStage.screenCount || 0),
    configured: Boolean(stage.configured ?? (screenIds.length > 0 && configuredScreenIds.length === screenIds.length)),
    completed: Boolean(stage.completed ?? (screenIds.length > 0 && configuredScreenIds.length === screenIds.length))
  };
}

function pickStage(stages, matcher, fallbackIndex) {
  return stages.find(matcher) || stages[fallbackIndex] || null;
}

function normalizeDemoConfig(response) {
  const source = response && typeof response === "object" ? response : {};
  const stages = Array.isArray(source.stages) ? source.stages : [];
  const supplyStage = pickStage(
    stages,
    (stage) => /supply/i.test(String(stage.id || "")) || /cyield/i.test(String(stage.label || "")),
    0
  );
  const buyingStage = pickStage(
    stages,
    (stage) => /demand/i.test(String(stage.id || "")) || /cmax/i.test(String(stage.label || "")),
    1
  );
  const monitoringStage = pickStage(
    stages,
    (stage) => /monitor/i.test(String(stage.id || "")) || /monitor/i.test(String(stage.label || "")),
    2
  );

  const goalDefaults = {
    ...DEFAULT_GOAL_DEFAULTS,
    storeId: String(source.storeId || DEFAULT_GOAL_DEFAULTS.storeId),
    ...(buyingStage?.goalDefaults || {}),
    ...(source.goalDefaults || {})
  };

  return {
    presetId: String(source.presetId || DEFAULT_DEMO_CONFIG.presetId),
    storeId: String(source.storeId || DEFAULT_DEMO_CONFIG.storeId),
    title: String(source.title || DEFAULT_DEMO_CONFIG.title),
    goalDefaults,
    stages: {
      supply: normalizeStage(supplyStage, DEFAULT_DEMO_CONFIG.stages.supply),
      buying: normalizeStage(buyingStage, DEFAULT_DEMO_CONFIG.stages.buying),
      monitoring: normalizeStage(monitoringStage, DEFAULT_DEMO_CONFIG.stages.monitoring)
    },
    pages: Array.isArray(source.pages) ? source.pages : [],
    screens: Array.isArray(source.screens) ? source.screens : [],
    quickLinks: Array.isArray(source.quickLinks) ? source.quickLinks : [],
    counts: {
      ...DEFAULT_DEMO_CONFIG.counts,
      ...(source.counts || {})
    }
  };
}

function getSupplyStage() {
  return state.demo.stages.supply;
}

function getBuyingStage() {
  return state.demo.stages.buying;
}

function getMonitoringStage() {
  return state.demo.stages.monitoring;
}

function getGoalDraftForDisplay() {
  const advertiserId = getSelectedGoalAdvertiserId();
  const account = getGoalAccountByAdvertiserId(advertiserId);
  const pageId = String(elements.goalPageScope?.value || "").trim();
  const storeId = String(elements.goalStoreScope?.value || "").trim();
  const flightStartDate = String(elements.goalFlightStart?.value || "").trim();
  const flightEndDate = String(elements.goalFlightEnd?.value || "").trim();
  return {
    advertiserId,
    brand: account?.brand || "",
    objective: String(elements.goalObjective?.value || "").trim(),
    aggressiveness: String(elements.goalAggressiveness?.value || "").trim(),
    storeId,
    requestedStoreId: storeId,
    pageId,
    requestedPageId: pageId,
    effectivePageId: pageId,
    flightStartDate,
    flightEndDate,
    flightDays: getGoalFlightDayCount(flightStartDate, flightEndDate),
    prompt: String(elements.goalPrompt?.value || "").trim(),
    targetSkuIds: [...state.selectedGoalSkuIds]
  };
}

function getManualSupplyConfig() {
  return {
    page: {
      ...MANUAL_SUPPLY.page,
      pageType: defaultValue(state.options?.pageTypes || [], MANUAL_SUPPLY.page.pageType),
      environment: defaultValue(state.options?.environments || [], MANUAL_SUPPLY.page.environment)
    },
    screen: {
      ...MANUAL_SUPPLY.screen,
      storeId: state.demo.storeId || MANUAL_SUPPLY.screen.storeId,
      screenType: defaultValue(state.options?.screenTypes || [], MANUAL_SUPPLY.screen.screenType),
      templateId: defaultValue(
        (state.options?.templates || []).map((template) => template.id),
        MANUAL_SUPPLY.screen.templateId
      )
    }
  };
}

function pageRecordMap() {
  return new Map((state.pages || []).map((page) => [page.pageId, page]));
}

function screenRecordMap() {
  return new Map((state.screens || []).map((screen) => [screen.screenId, screen]));
}

function getRelevantPageSummaries() {
  const manual = getManualSupplyConfig().page;
  const pageMap = pageRecordMap();
  const summaries = [
    {
      pageId: manual.pageId,
      pageType: manual.pageType,
      environment: manual.environment,
      configured: pageMap.has(manual.pageId),
      isManual: true
    },
    ...(state.demo.pages || []).map((page) => ({
      ...page,
      configured: Boolean(page.configured || pageMap.has(page.pageId)),
      isManual: false
    }))
  ];

  const seen = new Set();
  return summaries.filter((entry) => {
    if (seen.has(entry.pageId)) {
      return false;
    }
    seen.add(entry.pageId);
    return true;
  });
}

function getRelevantScreenSummaries() {
  const manual = getManualSupplyConfig().screen;
  const screenMap = screenRecordMap();
  const summaries = [
    {
      screenId: manual.screenId,
      label: "Manual first placement",
      storeId: manual.storeId,
      pageId: manual.pageId,
      location: manual.location,
      screenType: manual.screenType,
      screenSize: manual.screenSize,
      templateId: manual.templateId,
      refreshInterval: manual.refreshInterval,
      resolverId: getScreenResolverId(manual.screenId),
      screenUrl: buildSharedPreviewUrl(manual.screenId),
      configured: screenMap.has(manual.screenId),
      isManual: true
    },
    ...(state.demo.screens || []).map((screen) => ({
      ...screen,
      configured: Boolean(screen.configured || screenMap.has(screen.screenId)),
      isManual: false
    }))
  ];

  const seen = new Set();
  return summaries.filter((entry) => {
    if (seen.has(entry.screenId)) {
      return false;
    }
    seen.add(entry.screenId);
    return true;
  });
}

function isManualSupplyConfirmed() {
  return Boolean(state.manualSupplyConfirmed);
}

function isSupplyPresetReady() {
  const supplyStage = getSupplyStage();
  const configured = Number(supplyStage.configuredScreenIds?.length || 0);
  const total = Number(supplyStage.screenCount || supplyStage.screenIds?.length || 0);
  return Boolean(state.presetLoadedInSession && total > 0 && configured >= total);
}

function getScreenResolverId(screenRef) {
  if (screenRef && typeof screenRef === "object") {
    const directResolverId = String(screenRef.resolverId || screenRef.deviceHints?.resolverId || "").trim();
    if (directResolverId) {
      return directResolverId;
    }
  }

  const screenId =
    typeof screenRef === "string"
      ? screenRef.trim()
      : String(screenRef?.screenId || "").trim();
  if (!screenId) {
    return "";
  }

  const liveScreen = (state.activeGoalPlan?.liveScreens || []).find((screen) => screen.screenId === screenId);
  const inventoryScreen = (state.screens || []).find((screen) => screen.screenId === screenId);
  const demoScreen = (state.demo.screens || []).find((screen) => screen.screenId === screenId);
  const quickLink = (state.demo.quickLinks || []).find((screen) => screen.screenId === screenId);

  return String(
    liveScreen?.resolverId ||
      inventoryScreen?.deviceHints?.resolverId ||
      demoScreen?.resolverId ||
      quickLink?.resolverId ||
      ""
  ).trim();
}

function buildSharedPreviewUrl(screenRef, { rmjs = "off" } = {}) {
  const params = new URLSearchParams();
  const resolverId = getScreenResolverId(screenRef);
  if (resolverId) {
    params.set("deviceId", resolverId);
  }
  if (rmjs) {
    params.set("rmjs", rmjs);
  }
  const query = params.toString();
  return `${SHARED_PLAYER_URL}${query ? `?${query}` : ""}`;
}

function getPreferredPreviewScreenIds() {
  const liveIds = (state.activeGoalPlan?.liveScreens || []).map((screen) => screen.screenId).filter(Boolean);
  const configuredDemoIds = state.presetLoadedInSession
    ? (state.demo.quickLinks || [])
        .filter((entry) => entry?.configured)
        .map((entry) => entry.screenId)
        .filter(Boolean)
    : isManualSupplyConfirmed()
      ? [getManualSupplyConfig().screen.screenId]
      : [];
  const fallbackIds =
    state.presetLoadedInSession || liveIds.length > 0
      ? (state.screens || []).map((screen) => screen.screenId).filter(Boolean)
      : [];
  return [...new Set([...liveIds, ...configuredDemoIds, ...fallbackIds])];
}

function getPrimaryScreenId() {
  return getPreferredPreviewScreenIds()[0] || getSupplyStage().starterScreenId || getManualSupplyConfig().screen.screenId;
}

function buildDebugScreenUrl(screenId) {
  return `${SHARED_PLAYER_URL}?screenId=${encodeURIComponent(screenId)}&rmjs=off`;
}

function countPlannedScreens(plan) {
  if (!plan) {
    return 0;
  }
  const selectedIds = getGoalPlacementSelectionIds(plan);
  if (selectedIds.length > 0 || state.goalPlacementSelections.has(plan.planId || "")) {
    return selectedIds.length;
  }
  return Array.isArray(plan?.plannedScreenIds) ? plan.plannedScreenIds.length : Number(plan?.totals?.compatibleScreens || 0);
}

function sanitizeGoalPlacementIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function normalizeGoalPlacementEntry(entry = {}, index = 0) {
  const screenId = String(entry?.screenId || "").trim();
  return {
    ...(entry || {}),
    screenId,
    placementCost: Math.max(0, Math.round(Number(entry?.placementCost || 0))),
    budgetRank: Number(entry?.budgetRank || 0),
    score: Number(entry?.score || 0),
    confidence: Number(entry?.confidence || 0),
    recommendedTargetSkus: Array.isArray(entry?.recommendedTargetSkus) ? entry.recommendedTargetSkus : [],
    _fallbackIndex: index
  };
}

function sortGoalPlacementEntries(entries = []) {
  return entries
    .slice()
    .sort((left, right) => {
      const leftRank = Number(left?.budgetRank || 0);
      const rightRank = Number(right?.budgetRank || 0);
      const normalizedLeftRank = leftRank > 0 ? leftRank : Number.MAX_SAFE_INTEGER;
      const normalizedRightRank = rightRank > 0 ? rightRank : Number.MAX_SAFE_INTEGER;
      return (
        normalizedLeftRank - normalizedRightRank ||
        Number(right?.score || 0) - Number(left?.score || 0) ||
        Number(right?.confidence || 0) - Number(left?.confidence || 0) ||
        Number(left?.placementCost || 0) - Number(right?.placementCost || 0) ||
        String(left?.screenId || "").localeCompare(String(right?.screenId || "")) ||
        Number(left?._fallbackIndex || 0) - Number(right?._fallbackIndex || 0)
      );
    });
}

function getGoalPlacementPool(plan = {}) {
  const pool = new Map();
  const sourceEntries = [
    ...resolveGoalPlacements(plan),
    ...(Array.isArray(plan?.excludedScreens) ? plan.excludedScreens : [])
  ];

  sourceEntries.forEach((entry, index) => {
    const normalized = normalizeGoalPlacementEntry(entry, index);
    if (normalized.screenId && !pool.has(normalized.screenId)) {
      pool.set(normalized.screenId, normalized);
    }
  });

  return [...pool.values()];
}

function getDefaultGoalPlacementSelectionIds(plan = {}) {
  const explicitSelection = sanitizeGoalPlacementIds(plan?.selectedPlacementScreenIds);
  if (explicitSelection.length > 0) {
    return explicitSelection;
  }
  return sortGoalPlacementEntries(resolveGoalPlacements(plan).map((entry, index) => normalizeGoalPlacementEntry(entry, index)))
    .map((entry) => entry.screenId)
    .filter(Boolean);
}

function syncGoalPlacementSelectionFromPlan(plan, { overwrite = false } = {}) {
  const planId = String(plan?.planId || "").trim();
  if (!planId) {
    return;
  }
  if (!overwrite && state.goalPlacementSelections.has(planId)) {
    return;
  }
  state.goalPlacementSelections.set(planId, getDefaultGoalPlacementSelectionIds(plan));
}

function getGoalPlacementSelectionIds(plan = state.activeGoalPlan) {
  const planId = String(plan?.planId || "").trim();
  if (!planId) {
    return [];
  }
  if (!state.goalPlacementSelections.has(planId)) {
    syncGoalPlacementSelectionFromPlan(plan);
  }
  return sanitizeGoalPlacementIds(state.goalPlacementSelections.get(planId) || []);
}

function getSelectedGoalPlacements(plan = state.activeGoalPlan) {
  const selectionIds = getGoalPlacementSelectionIds(plan);
  const pool = new Map(getGoalPlacementPool(plan).map((entry) => [entry.screenId, entry]));
  return selectionIds
    .map((screenId, index) => {
      const entry = pool.get(screenId);
      if (!entry) {
        return null;
      }
      return {
        ...entry,
        selectionRank: index + 1
      };
    })
    .filter(Boolean);
}

function getAvailableGoalPlacements(plan = state.activeGoalPlan) {
  const selectedIds = new Set(getGoalPlacementSelectionIds(plan));
  return sortGoalPlacementEntries(getGoalPlacementPool(plan).filter((entry) => !selectedIds.has(entry.screenId)));
}

function setGoalPlacementSelection(plan, nextScreenIds) {
  const planId = String(plan?.planId || "").trim();
  if (!planId) {
    return [];
  }
  const poolIds = new Set(getGoalPlacementPool(plan).map((entry) => entry.screenId));
  const selection = sanitizeGoalPlacementIds(nextScreenIds).filter((screenId) => poolIds.has(screenId));
  state.goalPlacementSelections.set(planId, selection);
  state.goalBudgetPlanId = planId;
  state.goalBudgetSpend = normalizeGoalBudgetSpend(
    plan,
    state.goalBudgetPlanId === planId && Number.isFinite(Number(state.goalBudgetSpend))
      ? state.goalBudgetSpend
      : plan?.budget?.selectedSpend
  );
  return selection;
}

function isGoalPlacementSelectionEdited(plan = state.activeGoalPlan) {
  const current = getGoalPlacementSelectionIds(plan);
  const baseline = getDefaultGoalPlacementSelectionIds(plan);
  if (current.length !== baseline.length) {
    return true;
  }
  return current.some((screenId, index) => screenId !== baseline[index]);
}

function getGoalScopeLabel(goal = {}) {
  const requestedPageId = String(goal.requestedPageId || "").trim();
  const effectivePageId = String(goal.effectivePageId || goal.pageId || "").trim();
  if (goal.scopeMode === "auto-matched" && !String(goal.effectivePageId || "").trim()) {
    return requestedPageId ? `${requestedPageId} -> All mapped pages` : "All mapped pages";
  }
  if (requestedPageId && effectivePageId && requestedPageId !== effectivePageId) {
    return `${requestedPageId} -> ${effectivePageId}`;
  }
  return effectivePageId || requestedPageId || "All mapped pages";
}

function getStageConfig(stageId = state.stage) {
  return state.demo.stages[stageId] || DEFAULT_DEMO_CONFIG.stages[stageId] || DEFAULT_DEMO_CONFIG.stages.supply;
}

function getScreenDisplayLabel(screenId) {
  const normalizedId = String(screenId || "").trim();
  if (!normalizedId) {
    return "";
  }
  const demoScreen = (state.demo.screens || []).find((screen) => screen.screenId === normalizedId);
  if (demoScreen?.label) {
    return demoScreen.label;
  }
  const liveScreen = (state.activeGoalPlan?.liveScreens || []).find((screen) => screen.screenId === normalizedId);
  if (liveScreen?.location) {
    return `${titleCase(liveScreen.location)} ${titleCase(liveScreen.screenType || "Placement")}`.trim();
  }
  const inventoryScreen = (state.screens || []).find((screen) => screen.screenId === normalizedId);
  if (inventoryScreen?.location) {
    return `${titleCase(inventoryScreen.location)} ${titleCase(inventoryScreen.screenType || "Placement")}`.trim();
  }
  return normalizedId;
}

function formatPlacementList(screenIds) {
  return (screenIds || []).map((screenId) => getScreenDisplayLabel(screenId)).filter(Boolean).join(", ");
}

function getStagePillText(stageId = state.stage) {
  if (stageId === "buying") {
    return String(elements.buyingStagePill?.textContent || "").trim();
  }
  if (stageId === "monitoring") {
    return String(elements.monitoringStagePill?.textContent || "").trim();
  }
  return String(elements.supplyStagePill?.textContent || "").trim();
}

function getPresenterChannel() {
  if (!("BroadcastChannel" in window)) {
    return null;
  }
  if (!presenterChannel) {
    presenterChannel = new BroadcastChannel(PRESENTER_CHANNEL_NAME);
  }
  return presenterChannel;
}

function buildPresenterCards() {
  const plan = state.activeGoalPlan;
  const draftGoal = getGoalDraftForDisplay();
  const telemetryTotals = state.telemetrySummary?.totals || {};
  if (state.stage === "buying") {
    return [
      { label: "Scope", value: getGoalScopeLabel(plan?.goal || draftGoal) },
      { label: "SKUs", value: String((plan?.goal?.targetSkuIds || [...state.selectedGoalSkuIds]).length || 0) },
      { label: "Compatible screens", value: String(countPlannedScreens(plan) || 0) }
    ];
  }
  if (state.stage === "monitoring") {
    return [
      { label: "Live screens", value: String(plan?.liveCount || plan?.liveScreens?.length || 0) },
      { label: "Plays", value: formatCount(telemetryTotals.playCount || 0) },
      { label: "Exposure", value: formatDuration(telemetryTotals.exposureMs || 0) }
    ];
  }
  return [
    { label: "Anchor", value: isManualSupplyConfirmed() ? "Ready" : "Pending" },
    { label: "Preset", value: `${getDemoStoreCount()} stores` },
    { label: "Shared URL", value: SHARED_PLAYER_URL }
  ];
}

function buildPresenterSnapshot() {
  const stageConfig = getStageConfig(state.stage);
  const plan = state.activeGoalPlan;
  const draftGoal = getGoalDraftForDisplay();
  const plannedScreens = countPlannedScreens(plan);
  const telemetryTotals = state.telemetrySummary?.totals || {};
  const primaryScreenId = getPrimaryScreenId();
  return {
    updatedAt: new Date().toISOString(),
    stage: state.stage,
    stageLabel: stageConfig.label || titleCase(state.stage),
    stageDescription: stageConfig.description || "",
    stagePill: getStagePillText(state.stage),
    speakerSummary: String(stageConfig.speakerSummary || "").trim(),
    presenterNotes: Array.isArray(stageConfig.presenterNotes) ? stageConfig.presenterNotes : [],
    proofPoints: Array.isArray(stageConfig.proofPoints) ? stageConfig.proofPoints : [],
    cards: buildPresenterCards(),
    planSummary: String(plan?.summary || "").trim(),
    planScope: getGoalScopeLabel(plan?.goal || draftGoal),
    planScopeMessage: String(plan?.goal?.scopeMessage || "").trim(),
    plannedScreens,
    liveScreens: Number(plan?.liveCount || plan?.liveScreens?.length || 0),
    selectedSkuCount: Number(plan?.goal?.targetSkuIds?.length || state.selectedGoalSkuIds.size || 0),
    previewUrl: primaryScreenId ? buildSharedPreviewUrl(primaryScreenId) : SHARED_PLAYER_URL,
    previewLabel: primaryScreenId || "",
    statusText: String(elements.statusText?.textContent || "").trim(),
    telemetryText: `Plays ${formatCount(telemetryTotals.playCount || 0)} | Exposure ${formatDuration(
      telemetryTotals.exposureMs || 0
    )}`
  };
}

function publishPresenterSnapshot() {
  const snapshot = buildPresenterSnapshot();
  try {
    window.localStorage.setItem(PRESENTER_SNAPSHOT_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures in private/incognito contexts.
  }
  try {
    getPresenterChannel()?.postMessage(snapshot);
  } catch {
    // Ignore channel failures and keep the shared demo page functional.
  }
}

function resolveGoalScopeSuggestion(payload, selectedProducts) {
  const products = Array.isArray(selectedProducts) ? selectedProducts : [];
  if (!payload.pageId || products.length === 0) {
    return { pageId: payload.pageId, changed: false, message: "" };
  }
  const scopedScreens = (state.screens || []).filter((screen) => {
    if (payload.storeId && screen.storeId !== payload.storeId) {
      return false;
    }
    return true;
  });
  const compatibleScreens = scopedScreens.filter((screen) => isScreenCompatibleWithProductsLocal(screen, products));
  if (compatibleScreens.some((screen) => screen.pageId === payload.pageId)) {
    return { pageId: payload.pageId, changed: false, message: "" };
  }
  const compatiblePageIds = [...new Set(compatibleScreens.map((screen) => String(screen.pageId || "").trim()).filter(Boolean))];
  if (compatiblePageIds.length === 1) {
    return {
      pageId: compatiblePageIds[0],
      changed: compatiblePageIds[0] !== payload.pageId,
      message:
        compatiblePageIds[0] !== payload.pageId
          ? `Selected SKUs align more naturally with ${titleCase(compatiblePageIds[0])} placements than ${titleCase(payload.pageId)}. Updating scope automatically.`
          : ""
    };
  }
  if (compatiblePageIds.length > 1) {
    return {
      pageId: "",
      changed: Boolean(payload.pageId),
      message: payload.pageId ? "Selected SKUs span multiple mapped placements. Expanding scope automatically." : ""
    };
  }
  return { pageId: payload.pageId, changed: false, message: "" };
}

function syncGoalFormFromRun(run) {
  syncGoalPlacementSelectionFromPlan(run, { overwrite: run?.status === "applied" });
  if (elements.goalObjective && run?.goal?.objective) {
    elements.goalObjective.value = run.goal.objective;
  }
  if (elements.goalAggressiveness && run?.goal?.aggressiveness) {
    elements.goalAggressiveness.value = run.goal.aggressiveness;
  }
  if (elements.goalBrandAccount) {
    elements.goalBrandAccount.value = run?.goal?.advertiserId || "";
  }
  if (elements.goalStoreScope) {
    elements.goalStoreScope.value = run?.goal?.requestedStoreId || "";
  }
  if (elements.goalPageScope) {
    elements.goalPageScope.value = run?.goal?.requestedPageId || run?.goal?.pageId || "";
  }
  if (elements.goalFlightStart) {
    elements.goalFlightStart.value = run?.goal?.flightStartDate || elements.goalFlightStart.value || getTodayDateInputValue();
  }
  if (elements.goalFlightEnd) {
    elements.goalFlightEnd.value =
      run?.goal?.flightEndDate ||
      elements.goalFlightEnd.value ||
      shiftDateInputValue(elements.goalFlightStart?.value || getTodayDateInputValue(), DEFAULT_GOAL_FLIGHT_DAYS - 1);
  }
  if (elements.goalProductCategory) {
    elements.goalProductCategory.value = run?.goal?.assortmentCategory || "";
  }
  if (elements.goalPrompt) {
    elements.goalPrompt.value = run?.goal?.prompt || "";
  }
  state.goalScopeStepAcknowledged = Boolean(run?.goal);
  state.goalPlanningStep = run?.goal ? 3 : 1;
  state.goalRetailerRateCard = sanitizeGoalRateCard(state.options?.screenTypePricingDefaults || {});
  renderGoalRateCard(state.goalRetailerRateCard);
  setSelectedGoalSkus(run?.goal?.targetSkuIds || []);
  setGoalBudgetStateFromPlan(run);
}

function renderRadioGroup(container, groupName, options, selected, labelMap = {}) {
  if (!container) {
    return;
  }
  container.innerHTML = (options || [])
    .map((value) => {
      const checked = value === selected ? "checked" : "";
      return `<label class="choice-card">
        <input type="radio" name="${escapeHtml(groupName)}" value="${escapeHtml(value)}" ${checked}>
        <span>${escapeHtml(labelMap[value] || value)}</span>
      </label>`;
    })
    .join("");
}

function renderSelectOptions(selectElement, options, selected, labelMap = {}, blankLabel = "") {
  if (!selectElement) {
    return;
  }
  const rendered = [];
  if (blankLabel) {
    rendered.push(`<option value="">${escapeHtml(blankLabel)}</option>`);
  }
  for (const value of options || []) {
    const selectedAttr = value === selected ? "selected" : "";
    rendered.push(
      `<option value="${escapeHtml(value)}" ${selectedAttr}>${escapeHtml(labelMap[value] || value)}</option>`
    );
  }
  selectElement.innerHTML = rendered.join("");
}

function setRadioGroupValue(container, value) {
  if (!container) {
    return;
  }
  const escaped =
    window.CSS && typeof window.CSS.escape === "function"
      ? window.CSS.escape(value)
      : String(value).replace(/["\\]/g, "\\$&");
  const input = container.querySelector(`input[value="${escaped}"]`);
  if (input) {
    input.checked = true;
  }
}

function getRadioGroupValue(form, name) {
  return String(form?.querySelector(`input[name="${name}"]:checked`)?.value || "").trim();
}

function refreshPageCounter() {
  if (elements.pageIdCount && elements.pageId) {
    elements.pageIdCount.textContent = String(elements.pageId.value.length);
  }
}

function populatePageSelect(preferredPageId = "") {
  if (!elements.pageIdSelect) {
    return;
  }
  const manualPageId = getManualSupplyConfig().page.pageId;
  const pageIds = [...new Set([manualPageId, ...state.pages.map((page) => page.pageId)].filter(Boolean))];
  const selected = pageIds.includes(preferredPageId)
    ? preferredPageId
    : pageIds.includes(manualPageId)
      ? manualPageId
      : pageIds[0] || "";

  renderSelectOptions(elements.pageIdSelect, pageIds, selected);
  elements.pageIdSelect.disabled = pageIds.length === 0;
}

function renderTemplatePreview(templateId, note = "") {
  if (!elements.templatePreview) {
    return;
  }
  const template = getTemplateById(templateId);
  if (!template) {
    elements.templatePreview.innerHTML = `<strong>Custom template</strong><p class="template-preview__description">${escapeHtml(
      templateId || "Unknown"
    )}</p>${note ? `<p class="template-preview__note">${escapeHtml(note)}</p>` : ""}`;
    return;
  }
  elements.templatePreview.innerHTML = `<strong>${escapeHtml(template.name)}</strong>
    <p class="template-preview__description">${escapeHtml(template.description)}</p>
    <div class="template-preview__meta">
      <div class="template-preview__meta-item">
        <span class="template-preview__label">Screen type</span>
        <span class="template-preview__value">${escapeHtml(template.defaultScreenType)}</span>
      </div>
      <div class="template-preview__meta-item">
        <span class="template-preview__label">Size</span>
        <span class="template-preview__value">${escapeHtml(template.defaultScreenSize)}</span>
      </div>
      <div class="template-preview__meta-item">
        <span class="template-preview__label">Refresh</span>
        <span class="template-preview__value">${escapeHtml(`${template.defaultRefreshInterval}ms`)}</span>
      </div>
    </div>
    ${note ? `<p class="template-preview__note">${escapeHtml(note)}</p>` : ""}`;
}

function applyTemplatePreset(templateId, overwriteFields = true) {
  const template = getTemplateById(templateId);
  if (!template) {
    renderTemplatePreview(templateId);
    return;
  }
  if (overwriteFields) {
    if (elements.screenType) {
      elements.screenType.value = template.defaultScreenType;
    }
    if (elements.screenSize) {
      elements.screenSize.value = template.defaultScreenSize;
    }
    if (elements.refreshInterval) {
      elements.refreshInterval.value = String(template.defaultRefreshInterval);
    }
  }
  renderTemplatePreview(template.id);
}

function renderOptions() {
  const manual = getManualSupplyConfig();
  renderRadioGroup(elements.pageTypeGrid, "pageType", state.options?.pageTypes || [], manual.page.pageType);
  renderRadioGroup(
    elements.environmentGrid,
    "environment",
    state.options?.environments || [],
    manual.page.environment
  );

  renderSelectOptions(elements.screenType, state.options?.screenTypes || [], manual.screen.screenType);

  renderSelectOptions(
    elements.templateId,
    (state.options?.templates || []).map((template) => template.id),
    manual.screen.templateId,
    Object.fromEntries((state.options?.templates || []).map((template) => [template.id, template.name]))
  );

  renderSelectOptions(
    elements.goalObjective,
    (state.options?.goalObjectives || []).map((objective) => objective.id),
    String(elements.goalObjective?.value || "").trim(),
    Object.fromEntries((state.options?.goalObjectives || []).map((objective) => [objective.id, objective.label])),
    "Select a goal"
  );

  renderSelectOptions(
    elements.goalAggressiveness,
    state.options?.goalAggressivenessOptions || ["Balanced"],
    String(elements.goalAggressiveness?.value || "").trim(),
    {},
    "Select a style"
  );

  renderRetailerRateCard(state.options?.screenTypePricingDefaults || null);
  renderGoalRateCard();
}

function syncSupplyFormDefaults() {
  const manual = getManualSupplyConfig();
  state.editingScreenId = "";
  if (elements.editScreenId) {
    elements.editScreenId.value = "";
  }
  if (elements.pageId) {
    elements.pageId.value = manual.page.pageId;
  }
  setRadioGroupValue(elements.pageTypeGrid, manual.page.pageType);
  setRadioGroupValue(elements.environmentGrid, manual.page.environment);
  if (elements.firePageBeacons) {
    elements.firePageBeacons.checked = Boolean(manual.page.firePageBeacons);
  }
  if (elements.oneTagHybridIntegration) {
    elements.oneTagHybridIntegration.checked = Boolean(manual.page.oneTagHybridIntegration);
  }
  if (elements.includeBidInResponse) {
    elements.includeBidInResponse.checked = Boolean(manual.page.includeBidInResponse);
  }

  if (elements.screenId) {
    elements.screenId.value = manual.screen.screenId;
    elements.screenId.disabled = false;
  }
  if (elements.storeId) {
    elements.storeId.value = manual.screen.storeId;
  }
  if (elements.location) {
    elements.location.value = manual.screen.location;
  }
  populatePageSelect(manual.screen.pageId);
  if (elements.screenType) {
    elements.screenType.value = manual.screen.screenType;
  }
  if (elements.screenSize) {
    elements.screenSize.value = manual.screen.screenSize;
  }
  if (elements.templateId) {
    elements.templateId.value = manual.screen.templateId;
  }
  if (elements.refreshInterval) {
    elements.refreshInterval.value = String(manual.screen.refreshInterval);
  }
  if (elements.screenSubmitBtn) {
    elements.screenSubmitBtn.textContent = "Create screen";
  }
  if (elements.screenCancelBtn) {
    elements.screenCancelBtn.classList.add("is-hidden");
  }

  refreshPageCounter();
  renderTemplatePreview(manual.screen.templateId);
}

function syncBuyingFormDefaults(force = false) {
  const defaultFlightStart = getTodayDateInputValue();
  const defaultFlightEnd = shiftDateInputValue(defaultFlightStart, DEFAULT_GOAL_FLIGHT_DAYS - 1);
  if (force) {
    if (elements.goalBrandAccount) {
      elements.goalBrandAccount.value = "";
    }
    if (elements.goalObjective) {
      elements.goalObjective.value = "";
    }
    if (elements.goalAggressiveness) {
      elements.goalAggressiveness.value = "";
    }
    if (elements.goalStoreScope) {
      elements.goalStoreScope.value = "";
    }
    if (elements.goalPageScope) {
      elements.goalPageScope.value = "";
    }
    if (elements.goalFlightStart) {
      elements.goalFlightStart.value = defaultFlightStart;
    }
    if (elements.goalFlightEnd) {
      elements.goalFlightEnd.value = defaultFlightEnd;
    }
    if (elements.goalPrompt) {
      elements.goalPrompt.value = "";
    }
    if (elements.goalProductCategory) {
      elements.goalProductCategory.value = "";
    }
    if (elements.goalProductSearch) {
      elements.goalProductSearch.value = "";
    }
    state.goalPlanningStep = 1;
    state.goalScopeStepAcknowledged = false;
    state.goalRetailerRateCard = null;
    state.goalPlacementSelections.clear();
    state.goalBudgetPlanId = "";
    state.goalBudgetSpend = null;
    setSelectedGoalSkus([]);
  }

  if (elements.goalFlightStart && !elements.goalFlightStart.value) {
    elements.goalFlightStart.value = defaultFlightStart;
  }
  if (elements.goalFlightEnd && !elements.goalFlightEnd.value) {
    elements.goalFlightEnd.value = defaultFlightEnd;
  }

  renderGoalBrandOptions();
  renderGoalScopeSelects();
  renderGoalProductCategoryOptions();
  renderRetailerRateCard(state.options?.screenTypePricingDefaults || null);
  renderGoalRateCard();
  renderGoalProducts();
}

function beginScreenEdit(screenId) {
  const screen = (state.screens || []).find((entry) => entry.screenId === screenId);
  if (!screen) {
    return;
  }
  state.editingScreenId = screen.screenId;
  if (elements.editScreenId) {
    elements.editScreenId.value = screen.screenId;
  }
  if (elements.screenId) {
    elements.screenId.value = screen.screenId;
    elements.screenId.disabled = true;
  }
  if (elements.storeId) {
    elements.storeId.value = screen.storeId || "";
  }
  if (elements.location) {
    elements.location.value = screen.location || "";
  }
  populatePageSelect(screen.pageId || "");
  if (elements.pageIdSelect) {
    elements.pageIdSelect.value = screen.pageId || "";
  }
  if (elements.screenType) {
    elements.screenType.value = screen.screenType || "";
  }
  if (elements.screenSize) {
    elements.screenSize.value = screen.screenSize || "";
  }
  if (elements.templateId) {
    elements.templateId.value = screen.templateId || "";
  }
  if (elements.refreshInterval) {
    elements.refreshInterval.value = String(screen.refreshInterval || 30000);
  }
  if (elements.screenSubmitBtn) {
    elements.screenSubmitBtn.textContent = "Save changes";
  }
  if (elements.screenCancelBtn) {
    elements.screenCancelBtn.classList.remove("is-hidden");
  }
  renderTemplatePreview(screen.templateId || "", "Editing existing screen config.");
  elements.screenForm?.scrollIntoView({ behavior: "smooth", block: "start" });
  showStatus(`Editing ${screenId}.`);
}

function renderStageButtons() {
  for (const button of qsa(".js-stage-jump")) {
    button.classList.toggle("is-active", button.dataset.stage === state.stage);
  }
}

function setStage(stage, shouldScroll = false) {
  let nextStage = UI_STAGES.includes(stage) ? stage : "supply";
  if (nextStage === "buying" && !isSupplyPresetReady()) {
    nextStage = "supply";
  }
  if (nextStage === "monitoring" && state.activeGoalPlan?.status !== "applied") {
    nextStage = isSupplyPresetReady() ? "buying" : "supply";
  }

  state.stage = nextStage;
  document.body.dataset.demoStage = state.stage;
  renderStageButtons();

  const panels = {
    supply: elements.supplySection,
    buying: elements.buyingSection,
    monitoring: elements.monitoringSection
  };

  for (const [panelStage, panel] of Object.entries(panels)) {
    if (panel) {
      panel.hidden = panelStage !== state.stage;
    }
  }

  updateActionButtons();
  updateStagePills();
  publishPresenterSnapshot();

  if (shouldScroll && panels[state.stage]) {
    panels[state.stage].scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function updateStagePills() {
  const manualReady = isManualSupplyConfirmed();
  const supplyReady = isSupplyPresetReady();
  const hasAppliedPlan = state.activeGoalPlan?.status === "applied";
  const hasPlan = Boolean(state.activeGoalPlan);
  const totalTelemetryEvents = Number(state.telemetrySummary?.totals?.total || 0);

  if (elements.supplyStagePill) {
    elements.supplyStagePill.textContent =
      supplyReady
        ? "Preset ready"
        : manualReady
          ? "Anchor added"
          : "Start here";
  }
  if (elements.buyingStagePill) {
    elements.buyingStagePill.textContent = hasAppliedPlan ? "In market" : hasPlan ? "Brief ready" : supplyReady ? "Awaiting brief" : "Locked";
  }
  if (elements.monitoringStagePill) {
    elements.monitoringStagePill.textContent = totalTelemetryEvents > 0 ? "Live telemetry" : hasAppliedPlan ? "Live" : "Locked";
  }
}

function updateActionButtons() {
  const manualReady = isManualSupplyConfirmed();
  const supplyReady = isSupplyPresetReady();
  const hasAppliedPlan = state.activeGoalPlan?.status === "applied";
  const primaryScreenId = manualReady ? getPrimaryScreenId() : "";

  if (elements.createAnchorBtn) {
    elements.createAnchorBtn.disabled = manualReady;
    elements.createAnchorBtn.textContent = manualReady ? "Anchor ready" : "Add one anchor placement";
  }

  for (const button of qsa("#loadPresetBtn, #loadPresetBtnSecondary")) {
    button.disabled = !manualReady || state.presetLoadedInSession;
    button.textContent = state.presetLoadedInSession ? "Shared preset applied" : "Apply shared preset";
  }

  for (const button of qsa("#nextToBuyingBtn, #nextToBuyingBtnSecondary")) {
    button.disabled = !supplyReady;
  }
  for (const button of qsa("#nextToMonitoringBtn, #nextToMonitoringBtnSecondary")) {
    button.disabled = !hasAppliedPlan;
  }
  for (const button of qsa(".js-stage-jump")) {
    const targetStage = button.dataset.stage || "supply";
    button.disabled = (targetStage === "buying" && !supplyReady) || (targetStage === "monitoring" && !hasAppliedPlan);
  }

  if (elements.demoScreenLink) {
    elements.demoScreenLink.href = primaryScreenId ? buildSharedPreviewUrl(primaryScreenId) : SHARED_PLAYER_URL;
    elements.demoScreenLink.textContent = primaryScreenId ? "Open shared player" : "Open player";
  }
  if (elements.monitorPreviewLink) {
    elements.monitorPreviewLink.href = primaryScreenId ? buildSharedPreviewUrl(primaryScreenId) : SHARED_PLAYER_URL;
  }
}

function buildDemoActionMessage(kind, result) {
  const createdPages = Number(result?.createdPageIds?.length || 0);
  const updatedPages = Number(result?.updatedPageIds?.length || 0);
  const createdScreens = Number(result?.createdScreenIds?.length || 0);
  const updatedScreens = Number(result?.updatedScreenIds?.length || 0);
  const affectedStoreCount = Number(result?.seededStoreIds?.length || result?.removedStoreIds?.length || 0);

  if (kind === "reset") {
    const removedScreens = Number(result?.removedScreenIds?.length || 0);
    return `Demo baseline restored. ${removedScreens} demo screen(s)${affectedStoreCount ? ` across ${affectedStoreCount} store(s)` : ""} cleared. Telemetry and plan history cleared.`;
  }

  if (createdPages + createdScreens === 0 && updatedPages + updatedScreens === 0) {
    return "Preset already matched the current configuration.";
  }

  return `Shared preset ready. ${affectedStoreCount ? `${affectedStoreCount} store(s) seeded, ` : ""}${createdPages} page(s) created, ${updatedPages} refreshed, ${createdScreens} screen(s) created, ${updatedScreens} refreshed.`;
}

function renderSupplySummary() {
  if (!elements.supplySummaryCards) {
    return;
  }

  const demoStoreCount = getDemoStoreCount();

  elements.supplySummaryCards.innerHTML = [
    {
      value: isManualSupplyConfirmed() ? "Done" : "Pending",
      label: "Anchor screen"
    },
    {
      value: `${demoStoreCount} stores`,
      label: "Preset rollout"
    },
    {
      value: isSupplyPresetReady() ? "Unlocked" : "Locked",
      label: "CMax handoff"
    },
    {
      value: SHARED_PLAYER_URL,
      label: "Shared URL"
    }
  ]
    .map(
      (card) => `<div class="summary-card">
        <strong>${escapeHtml(card.value)}</strong>
        <span>${escapeHtml(card.label)}</span>
      </div>`
    )
    .join("");
}

function renderPresetSummary() {
  if (!elements.presetSummary) {
    return;
  }

  const supplyStage = getSupplyStage();
  const configured = Number(supplyStage.configuredScreenIds?.length || 0);
  const total = Number(supplyStage.screenCount || supplyStage.screenIds?.length || 0);
  const remaining = Math.max(total - configured, 0);
  const demoStoreCount = getDemoStoreCount();
  const actionMessage = state.lastDemoAction?.message || "";
  const summaryMessage = !isManualSupplyConfirmed()
    ? "Add one anchor placement, then apply the shared preset to finish the supply setup."
    : state.presetLoadedInSession
      ? "Setup complete: minimal CYield change, shared backend-resolved player URL."
      : `Anchor screen saved. Load the preset to roll out the remaining ${remaining} supply-stage screen(s) across ${demoStoreCount} stores.`;

  elements.presetSummary.classList.remove("empty");
  elements.presetSummary.innerHTML = `
    <strong>Shared player URL: ${escapeHtml(SHARED_PLAYER_URL)}</strong>
    <p>${escapeHtml(summaryMessage)}</p>
    <p class="goal-change__metrics">Retailer rate card: ${escapeHtml(summarizeGoalRateCard())}</p>
    <p class="goal-change__metrics">
      ${escapeHtml(
        state.presetLoadedInSession
          ? actionMessage || "Shared preset applied across the demo inventory."
          : "CYield keeps the same page-like request model. The only extra layer is a resolver that maps the TV/browser footprint to the right screen config."
      )}
    </p>
  `;
}

function renderPagesList() {
  if (!elements.pagesList) {
    return;
  }

  const pageCards = getRelevantPageSummaries();
  if (!pageCards.length) {
    elements.pagesList.innerHTML = '<div class="empty">No demo pages tracked yet.</div>';
    return;
  }

  elements.pagesList.innerHTML = pageCards
    .map((page) => {
      const displayConfigured = page.isManual ? isManualSupplyConfirmed() : state.presetLoadedInSession && page.configured;
      const status = page.isManual
        ? isManualSupplyConfirmed()
          ? "Anchor saved"
          : "Add this first"
        : state.presetLoadedInSession
          ? page.configured
            ? "Configured"
            : "Pending"
          : "Loaded by preset";
      return `<article class="record ${displayConfigured ? "" : "record--muted"}">
        <div class="record__top">
          <strong>${escapeHtml(page.pageId)}</strong>
          <span>${escapeHtml(status)}</span>
        </div>
        <p>${escapeHtml(page.pageType || "Page")} | ${escapeHtml(page.environment || "In-Store")}</p>
        <p>${page.isManual ? "Show one page-to-screen mapping manually." : "The preset expands the same CYield page model across the rest of the store."}</p>
      </article>`;
    })
    .join("");
}

function renderScreensList() {
  if (!elements.screensList) {
    return;
  }

  const screenMap = screenRecordMap();
  const screenCards = getRelevantScreenSummaries();
  if (!screenCards.length) {
    elements.screensList.innerHTML = '<div class="empty">No demo screens tracked yet.</div>';
    return;
  }

  elements.screensList.innerHTML = screenCards
    .map((summary) => {
      const screen = screenMap.get(summary.screenId);
      const templateName = getTemplateById(summary.templateId)?.name || summary.templateId || "Template";
      const sharedPreviewUrl = buildSharedPreviewUrl(summary);
      const displayConfigured = summary.isManual ? isManualSupplyConfirmed() : state.presetLoadedInSession && summary.configured;
      const status = summary.isManual
        ? isManualSupplyConfirmed()
          ? "Anchor saved"
          : "Add this first"
        : state.presetLoadedInSession
          ? summary.configured
            ? "Configured"
            : "Pending"
          : "Loaded by preset";
      const actions = displayConfigured
        ? `<span class="record__actions">
            <button type="button" class="btn btn--tiny js-edit-screen" data-screen-id="${escapeHtml(summary.screenId)}">Edit</button>
            <button type="button" class="btn btn--tiny btn--tiny-danger js-delete-screen" data-screen-id="${escapeHtml(summary.screenId)}">Delete</button>
            <a href="${escapeHtml(sharedPreviewUrl)}" target="_blank" rel="noreferrer">Shared preview</a>
            <a href="${escapeHtml(buildDebugScreenUrl(summary.screenId))}" target="_blank" rel="noreferrer">Debug preview</a>
          </span>`
        : "";
      return `<article class="record ${displayConfigured ? "" : "record--muted"}">
        <div class="record__top">
          <strong>${escapeHtml(summary.screenId)}</strong>
          <span>${escapeHtml(status)}</span>
        </div>
        <p>${escapeHtml(summary.storeId || "")} | ${escapeHtml(summary.pageId || "")} | ${escapeHtml(summary.location || "")}</p>
        <p>${escapeHtml(summary.screenType || "")} | ${escapeHtml(summary.screenSize || "")} | ${escapeHtml(templateName)}</p>
        <p>Shared player URL: ${escapeHtml(SHARED_PLAYER_URL)}${getScreenResolverId(summary) ? ` | Resolver key: ${escapeHtml(getScreenResolverId(summary))}` : ""}</p>
        ${actions}
      </article>`;
    })
    .join("");
}

function renderSupplyLists() {
  renderPagesList();
  renderScreensList();
}

function renderGoalScopeSelects() {
  const stores = [...new Set(state.screens.map((screen) => screen.storeId).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );
  const pages = [...new Set(state.pages.map((page) => page.pageId).filter(Boolean))].sort(
    (left, right) => left.localeCompare(right)
  );

  const currentStore = elements.goalStoreScope?.value || "";
  const currentPage = elements.goalPageScope?.value || "";

  renderSelectOptions(elements.goalStoreScope, stores, stores.includes(currentStore) ? currentStore : "", {}, "All stores");
  renderSelectOptions(elements.goalPageScope, pages, pages.includes(currentPage) ? currentPage : "", {}, "All mapped placements");
}

function renderGoalBrandOptions() {
  const current = getSelectedGoalAdvertiserId();
  const accounts = Array.isArray(state.productAccounts) && state.productAccounts.length > 0
    ? state.productAccounts
    : buildProductAccountsFromProducts(state.productFeed || []);
  const advertiserIds = accounts.map((entry) => entry.advertiserId).filter(Boolean);
  const labelMap = Object.fromEntries(accounts.map((entry) => [entry.advertiserId, getProductAccountLabel(entry)]));
  const selected = advertiserIds.includes(current) ? current : "";
  renderSelectOptions(
    elements.goalBrandAccount,
    advertiserIds,
    selected,
    labelMap,
    "Select an account"
  );
}

function renderGoalProductCategoryOptions() {
  const advertiserId = getSelectedGoalAdvertiserId();
  const current = elements.goalProductCategory?.value || "";
  const categories = advertiserId
    ? [...new Set(getBrandScopedProducts(advertiserId).map((product) => product.category).filter(Boolean))].sort(
      (left, right) => left.localeCompare(right)
    )
    : [];
  renderSelectOptions(
    elements.goalProductCategory,
    categories,
    categories.includes(current) ? current : "",
    {},
    advertiserId ? "All categories" : "Choose an account first"
  );
}

function getMissingGoalBriefFields() {
  const missing = [];
  if (!getSelectedGoalAdvertiserId()) {
    missing.push("an account");
  }
  if (!String(elements.goalObjective?.value || "").trim()) {
    missing.push("a goal");
  }
  if (!String(elements.goalAggressiveness?.value || "").trim()) {
    missing.push("a planning style");
  }
  return missing;
}

function isGoalBriefStepComplete() {
  return getMissingGoalBriefFields().length === 0;
}

function getGoalPlanningMaxStep() {
  if (!isGoalBriefStepComplete()) {
    return 1;
  }
  if (!state.goalScopeStepAcknowledged || !hasValidGoalFlightDates()) {
    return 2;
  }
  return 3;
}

function setGoalPlanningStep(stepNumber) {
  const requested = Math.max(1, Math.min(3, Number(stepNumber) || 1));
  state.goalPlanningStep = Math.min(requested, getGoalPlanningMaxStep());
  renderGoalPlanningFlow();
}

function getGoalPlanningStepSummary(stepNumber) {
  if (stepNumber === 1) {
    const parts = [];
    const account = getGoalAccountByAdvertiserId();
    const objectiveId = String(elements.goalObjective?.value || "").trim();
    const aggressiveness = String(elements.goalAggressiveness?.value || "").trim();
    if (account) {
      parts.push(getProductAccountLabel(account));
    }
    if (objectiveId) {
      parts.push(objectiveLabelById(objectiveId));
    }
    if (aggressiveness) {
      parts.push(`${aggressiveness} planning`);
    }
    return parts.join(" | ") || "Pick the account, goal, and planning style before you shape the buy.";
  }

  if (stepNumber === 2) {
    const storeId = String(elements.goalStoreScope?.value || "").trim();
    const pageId = String(elements.goalPageScope?.value || "").trim();
    const prompt = String(elements.goalPrompt?.value || "").trim();
    const parts = [formatGoalFlightSummary(), storeId || "All stores", pageId || "All mapped placements"];
    if (prompt) {
      parts.push(prompt.length > 72 ? `${prompt.slice(0, 69)}...` : prompt);
    }
    return parts.join(" | ");
  }

  const advertiserId = getSelectedGoalAdvertiserId();
  const selectedCount = state.selectedGoalSkuIds.size;
  const category = String(elements.goalProductCategory?.value || "").trim();
  if (!advertiserId) {
    return "Choose an account first to browse its assortment.";
  }
  if (selectedCount > 0) {
    return `${selectedCount} priority SKU(s) selected${category ? ` in ${titleCase(category)}` : ""}.`;
  }
  if (category) {
    return `Browsing ${titleCase(category)} with no SKU shortlist yet.`;
  }
  return "Choose priority SKUs or leave the list empty and let the brief drive inference.";
}

function getGoalPlanningStepStatus(stepNumber) {
  const briefComplete = isGoalBriefStepComplete();
  if (stepNumber === 1) {
    return briefComplete ? (state.goalPlanningStep > 1 ? "Complete" : "Ready") : "Required";
  }
  if (stepNumber === 2) {
    if (!briefComplete) {
      return "Locked";
    }
    if (!hasValidGoalFlightDates()) {
      return state.goalPlanningStep === 2 ? "Required" : "Required";
    }
    if (state.goalScopeStepAcknowledged) {
      return state.goalPlanningStep > 2 ? "Complete" : "Ready";
    }
    return state.goalPlanningStep === 2 ? "Active" : "Optional";
  }
  if (!briefComplete || !state.goalScopeStepAcknowledged || !hasValidGoalFlightDates()) {
    return "Locked";
  }
  return state.goalPlanningStep === 3 ? "Active" : "Ready";
}

function renderGoalPlanningFlow() {
  const maxStep = getGoalPlanningMaxStep();
  if (state.goalPlanningStep > maxStep) {
    state.goalPlanningStep = maxStep;
  }
  if (state.goalPlanningStep < 1) {
    state.goalPlanningStep = 1;
  }

  const briefComplete = isGoalBriefStepComplete();
  for (const section of qsa(".planner-step")) {
    const stepNumber = Number(section.dataset.plannerStep || 0);
    if (!stepNumber) {
      continue;
    }
    const accessible = stepNumber <= maxStep;
    const active = stepNumber === state.goalPlanningStep;
    const completed = accessible && stepNumber < state.goalPlanningStep;
    section.dataset.stepState = active ? "active" : accessible ? (completed ? "complete" : "available") : "locked";

    const summary = section.querySelector("[data-planner-step-summary]");
    if (summary) {
      summary.textContent = getGoalPlanningStepSummary(stepNumber);
    }

    const status = section.querySelector("[data-planner-step-status]");
    if (status) {
      status.textContent = getGoalPlanningStepStatus(stepNumber);
    }

    const openButton = section.querySelector(".js-open-planner-step");
    if (openButton) {
      openButton.disabled = !accessible || active;
      openButton.textContent = !accessible ? "Locked" : completed ? "Edit" : "Open";
    }
  }

  if (elements.goalStep1NextBtn) {
    elements.goalStep1NextBtn.disabled = !briefComplete;
  }
  if (elements.goalStep2NextBtn) {
    elements.goalStep2NextBtn.disabled = !briefComplete || !hasValidGoalFlightDates();
  }
  if (elements.goalPlanBtn) {
    elements.goalPlanBtn.disabled = !briefComplete || !state.goalScopeStepAcknowledged || !hasValidGoalFlightDates();
  }
}

function ensureGoalBriefStepComplete() {
  const missing = getMissingGoalBriefFields();
  if (missing.length === 0) {
    return true;
  }
  state.goalPlanningStep = 1;
  renderGoalPlanningFlow();
  showStatus(`Complete step 1 by choosing ${formatSentenceList(missing)}.`, true);
  return false;
}

function ensureGoalPlanningReadyForSubmit() {
  if (!ensureGoalBriefStepComplete()) {
    return false;
  }
  if (!hasValidGoalFlightDates()) {
    state.goalPlanningStep = 2;
    renderGoalPlanningFlow();
    showStatus("Add a valid flight date range before building the buy.", true);
    return false;
  }
  if (!state.goalScopeStepAcknowledged) {
    state.goalPlanningStep = 2;
    renderGoalPlanningFlow();
    showStatus("Continue through step 2 to confirm the flight and scope before building the buy.", true);
    return false;
  }
  return true;
}

function getFilteredProducts() {
  const advertiserId = getSelectedGoalAdvertiserId();
  if (!advertiserId) {
    return [];
  }
  const query = String(elements.goalProductSearch?.value || "").trim().toLowerCase();
  const category = String(elements.goalProductCategory?.value || "").trim().toLowerCase();
  return getBrandScopedProducts(advertiserId)
    .filter((product) => {
      if (category && product.category !== category) {
        return false;
      }
      if (!query) {
        return true;
      }
      const searchText = [
        product.sku,
        product.name,
        product.category,
        product.brand,
        product.advertiserId,
        ...(Array.isArray(product.tags) ? product.tags : [])
      ]
        .join(" ")
        .toLowerCase();
      return searchText.includes(query);
    })
    .sort((left, right) => {
      const leftSelected = state.selectedGoalSkuIds.has(normalizeSku(left.sku)) ? 0 : 1;
      const rightSelected = state.selectedGoalSkuIds.has(normalizeSku(right.sku)) ? 0 : 1;
      return leftSelected - rightSelected || left.name.localeCompare(right.name);
    });
}

function renderGoalSkuCount() {
  if (!elements.goalSkuCount) {
    return;
  }
  const advertiserId = getSelectedGoalAdvertiserId();
  if (!advertiserId) {
    elements.goalSkuCount.textContent = "Choose an account in Step 1 to browse SKUs.";
    return;
  }
  const products = getFilteredProducts();
  const account = getGoalAccountByAdvertiserId(advertiserId);
  const category = String(elements.goalProductCategory?.value || "").trim();
  if (products.length === 0) {
    elements.goalSkuCount.textContent = "No SKUs in this account/category. Try another account or clear the category filter.";
    return;
  }
  const scopeParts = [];
  if (account?.brand) {
    scopeParts.push(account.brand);
  }
  if (category) {
    scopeParts.push(titleCase(category));
  }
  const scopeSuffix = scopeParts.length > 0 ? ` for ${scopeParts.join(" | ")}` : "";
  elements.goalSkuCount.textContent = `Showing ${products.length} SKU(s)${scopeSuffix}.`;
}

function renderGoalSelectedSkus() {
  if (!elements.goalSelectedSkus || !elements.goalSelectedSkuHeadline) {
    return;
  }
  const selectedProducts = getSelectedGoalProducts().sort((left, right) => left.name.localeCompare(right.name));
  elements.goalSelectedSkuHeadline.textContent = `${selectedProducts.length} selected`;

  if (selectedProducts.length === 0) {
    elements.goalSelectedSkus.classList.add("empty");
    elements.goalSelectedSkus.textContent = "No priority SKUs selected yet.";
  } else {
    elements.goalSelectedSkus.classList.remove("empty");
    elements.goalSelectedSkus.innerHTML = selectedProducts
      .map((product) => {
        const sku = normalizeSku(product.sku);
        return `<button type="button" class="goal-chip js-remove-goal-sku" data-sku="${escapeHtml(sku)}">
          <span class="goal-chip__body">
            <span class="goal-chip__name">${escapeHtml(product.name)}</span>
            <span class="goal-chip__meta">${escapeHtml(product.brand)} | ${escapeHtml(titleCase(product.category))}</span>
          </span>
          <span class="goal-chip__remove">Remove</span>
        </button>`;
      })
      .join("");
  }
}

function renderGoalSelectionActions(products = getFilteredProducts()) {
  if (elements.goalSelectCategoryBtn) {
    elements.goalSelectCategoryBtn.textContent = elements.goalProductCategory?.value ? "Select category" : "Select visible";
    elements.goalSelectCategoryBtn.disabled = products.length === 0;
  }
  if (elements.goalClearSkusBtn) {
    elements.goalClearSkusBtn.disabled = state.selectedGoalSkuIds.size === 0;
  }
}

function renderGoalProducts() {
  if (!elements.goalProductList) {
    return;
  }
  const advertiserId = getSelectedGoalAdvertiserId();
  const products = getFilteredProducts();
  if (!advertiserId) {
    elements.goalProductList.innerHTML = '<div class="empty">Choose an account in Step 1 to browse that assortment.</div>';
    renderGoalSelectedSkus();
    renderGoalSkuCount();
    renderGoalSelectionActions(products);
    renderGoalPlanningFlow();
    return;
  }
  if (products.length === 0) {
    elements.goalProductList.innerHTML = '<div class="empty">No SKUs in this account/category. Try another account or clear the category filter.</div>';
    renderGoalSelectedSkus();
    renderGoalSkuCount();
    renderGoalSelectionActions(products);
    renderGoalPlanningFlow();
    return;
  }

  elements.goalProductList.innerHTML = products
    .slice(0, 160)
    .map((product) => {
      const sku = normalizeSku(product.sku);
      const selected = state.selectedGoalSkuIds.has(sku);
      return `<label class="goal-products__item${selected ? " goal-products__item--selected" : ""}">
        <input type="checkbox" class="js-goal-product-sku" value="${escapeHtml(sku)}" ${selected ? "checked" : ""}>
        <span class="goal-products__label">
          <span class="goal-products__sku">${escapeHtml(sku)}</span>
          <span class="goal-products__name">${escapeHtml(product.name)}</span>
          <span class="goal-products__meta">${escapeHtml(product.brand)} | ${escapeHtml(titleCase(product.category))}</span>
        </span>
      </label>`;
    })
    .join("");

  renderGoalSelectedSkus();
  renderGoalSkuCount();
  renderGoalSelectionActions(products);
  renderGoalPlanningFlow();
}

function setSelectedGoalSkus(skus) {
  state.selectedGoalSkuIds.clear();
  const allowed = new Set((state.productFeed || []).map((product) => normalizeSku(product.sku)));
  for (const sku of skus || []) {
    const normalized = normalizeSku(sku);
    if (normalized && allowed.has(normalized)) {
      state.selectedGoalSkuIds.add(normalized);
    }
  }
  renderGoalProducts();
}

function reconcileSelectedGoalSkusToBrand() {
  const advertiserId = getSelectedGoalAdvertiserId();
  if (!advertiserId) {
    const removed = state.selectedGoalSkuIds.size;
    state.selectedGoalSkuIds.clear();
    return removed;
  }
  const allowed = new Set(getBrandScopedProducts(advertiserId).map((product) => normalizeSku(product.sku)));
  let removed = 0;
  for (const sku of [...state.selectedGoalSkuIds]) {
    if (!allowed.has(sku)) {
      state.selectedGoalSkuIds.delete(sku);
      removed += 1;
    }
  }
  return removed;
}

function applyGoalScopeSuggestionFromSelection() {
  // Keep the requested planner scope stable. The server can widen recommendations when needed.
}

function selectFilteredGoalSkus() {
  const products = getFilteredProducts();
  if (products.length === 0) {
    showStatus("No SKUs are visible in this filter.", true);
    return;
  }
  const before = state.selectedGoalSkuIds.size;
  for (const product of products) {
    const sku = normalizeSku(product.sku);
    if (sku) {
      state.selectedGoalSkuIds.add(sku);
    }
  }
  renderGoalProducts();
  applyGoalScopeSuggestionFromSelection();
  const added = state.selectedGoalSkuIds.size - before;
  const category = String(elements.goalProductCategory?.value || "").trim();
  const scopeLabel = category ? `${titleCase(category)} category` : "visible assortment";
  showStatus(added > 0 ? `Added ${added} SKU(s) from the ${scopeLabel}.` : `All SKUs in the ${scopeLabel} are already selected.`);
  publishPresenterSnapshot();
}

function clearGoalSkuSelection() {
  if (state.selectedGoalSkuIds.size === 0) {
    return;
  }
  state.selectedGoalSkuIds.clear();
  renderGoalProducts();
  showStatus("Cleared the priority SKU selection.");
  publishPresenterSnapshot();
}

function getGoalPlanTargetProducts(plan) {
  const targetProducts = Array.isArray(plan?.goal?.targetProducts) ? plan.goal.targetProducts : [];
  if (targetProducts.length > 0) {
    return targetProducts;
  }
  const targetSkuIds = Array.isArray(plan?.goal?.targetSkuIds) ? plan.goal.targetSkuIds : [];
  if (targetSkuIds.length === 0) {
    return [];
  }
  const skuSet = new Set(targetSkuIds.map((sku) => normalizeSku(sku)).filter(Boolean));
  return (state.productFeed || []).filter((product) => skuSet.has(normalizeSku(product.sku)));
}

function getGoalPlanAccountLabel(goal = {}, targetProducts = []) {
  const advertiserId = String(goal.advertiserId || "").trim();
  const explicitBrand = String(goal.brand || "").trim();
  const account = getGoalAccountByAdvertiserId(advertiserId);
  if (account) {
    return getProductAccountLabel(account);
  }
  if (explicitBrand && advertiserId) {
    return `${explicitBrand} | ${advertiserId}`;
  }
  if (explicitBrand) {
    return explicitBrand;
  }
  const pairs = [
    ...new Set(
      targetProducts
        .map((product) => {
          const brand = String(product?.brand || "").trim();
          const productAdvertiserId = String(product?.advertiserId || "").trim();
          return brand && productAdvertiserId ? `${brand} | ${productAdvertiserId}` : brand || productAdvertiserId;
        })
        .filter(Boolean)
    )
  ];
  if (pairs.length === 1) {
    return pairs[0];
  }
  return pairs.length > 1 ? "Multiple brands" : "Account required";
}

function getGoalPlanBrandContext(plan = state.activeGoalPlan) {
  const goal = plan?.goal || {};
  const advertiserId = String(goal.advertiserId || getSelectedGoalAdvertiserId() || "").trim();
  const account = getGoalAccountByAdvertiserId(advertiserId);
  const brand = String(account?.brand || goal.brand || "").trim();
  const accountLabel = brand && advertiserId ? `${brand} | ${advertiserId}` : brand || advertiserId || "";
  return {
    advertiserId,
    brand,
    accountLabel,
    objectiveLabel: objectiveLabelById(goal.objective || "")
  };
}

function runMatchesBrandWorkspace(run, brandContext = getGoalPlanBrandContext()) {
  const scopedAdvertiserId = String(brandContext?.advertiserId || "").trim();
  const scopedBrand = String(brandContext?.brand || "").trim().toLowerCase();
  const runAdvertiserId = String(run?.goal?.advertiserId || "").trim();
  const runBrand = String(run?.goal?.brand || "").trim().toLowerCase();

  if (scopedAdvertiserId) {
    return runAdvertiserId === scopedAdvertiserId;
  }
  if (scopedBrand) {
    return runBrand === scopedBrand;
  }
  return false;
}

function describeGoalPlanFocus(plan, targetProducts = getGoalPlanTargetProducts(plan)) {
  if (targetProducts.length === 1) {
    return targetProducts[0].name;
  }
  if (targetProducts.length > 1 && targetProducts.length <= 3) {
    return formatSentenceList(targetProducts.map((product) => product.name), targetProducts.length);
  }
  const accountLabel = getGoalPlanAccountLabel(plan?.goal || {}, targetProducts);
  if (accountLabel !== "Account required" && accountLabel !== "Multiple brands") {
    const brand = accountLabel.split(" | ")[0];
    return `${brand} assortment`;
  }
  if (targetProducts.length > 0) {
    return `${targetProducts.length} priority SKUs`;
  }
  return "the selected brief";
}

function getGoalPlanScreen(screenId) {
  const normalizedId = String(screenId || "").trim();
  if (!normalizedId) {
    return null;
  }
  return (
    (state.screens || []).find((screen) => screen.screenId === normalizedId) ||
    (state.activeGoalPlan?.liveScreens || []).find((screen) => screen.screenId === normalizedId) ||
    (state.demo.screens || []).find((screen) => screen.screenId === normalizedId) ||
    null
  );
}

function getGoalPlacementRole(screen = {}, objectiveId = "") {
  const pageId = String(screen.pageId || "").trim().toLowerCase();
  const location = String(screen.location || "").trim().toLowerCase();
  const screenType = String(screen.screenType || "").trim().toLowerCase();

  if (pageId.includes("checkout") || location.includes("checkout") || screenType.includes("kiosk")) {
    return objectiveId === "awareness" ? "high-intent reach" : "checkout conversion";
  }
  if (
    pageId.includes("aisle") ||
    location.includes("aisle") ||
    screenType.includes("shelf") ||
    screenType.includes("endcap")
  ) {
    return objectiveId === "checkout-attach" ? "category-to-conversion bridge" : "category decision point";
  }
  if (pageId.includes("entrance") || location.includes("entrance")) {
    return "early-store reach";
  }
  if (pageId.includes("electronics") || pageId.includes("whitegoods") || location.includes("electronics") || location.includes("whitegoods")) {
    return "category zone presence";
  }
  return "in-store reach";
}

function buildGoalPlacementRecommendation(screen = {}, plan, targetProducts = []) {
  const placementName = getScreenDisplayLabel(screen.screenId || "");
  const focus = describeGoalPlanFocus(plan, targetProducts);
  const objectiveId = String(plan?.goal?.objective || "");
  const sentenceFocus =
    focus === "the selected brief"
      ? ""
      : focus.endsWith("priority SKUs")
        ? "this assortment"
        : focus;
  const focusClause = sentenceFocus ? ` For ${sentenceFocus},` : "";
  const location = titleCase(screen.location || screen.pageId || "store");
  const pageId = String(screen.pageId || "").trim().toLowerCase();
  const screenType = String(screen.screenType || "").trim().toLowerCase();

  switch (objectiveId) {
    case "checkout-attach":
      if (pageId.includes("checkout") || location.toLowerCase().includes("checkout") || screenType.includes("kiosk")) {
        return `We recommend ${placementName} because it reaches shoppers at the final purchase moment, where add-on messaging is most likely to convert.${focusClause} that keeps the brand close to the basket decision.`;
      }
      if (pageId.includes("aisle") || location.toLowerCase().includes("aisle") || screenType.includes("shelf")) {
        return `We recommend ${placementName} because it sits beside the category shelf, which keeps the message close to the product decision before shoppers reach checkout.${focusClause} that helps seed the add-on earlier in the trip.`;
      }
      return `We recommend ${placementName} because it keeps the brand visible in ${location} before the final purchase moment.${focusClause} that adds another conversion touchpoint in-store.`;
    case "clearance":
      if (pageId.includes("aisle") || location.toLowerCase().includes("aisle") || screenType.includes("shelf")) {
        return `We recommend ${placementName} because it sits beside the product, which keeps the offer close to the sell-through moment and supports faster stock movement.${focusClause} that makes the clearance message easier to act on.`;
      }
      return `We recommend ${placementName} because it gives the clearance message strong in-store visibility in ${location}.${focusClause} that helps move excess stock without losing store context.`;
    case "premium":
      if (pageId.includes("entrance") || location.toLowerCase().includes("entrance")) {
        return `We recommend ${placementName} because it captures shoppers as they enter the store, which is the best moment to frame the range as premium before comparison begins.${focusClause} that gives the brand stronger hero presence.`;
      }
      return `We recommend ${placementName} because it holds attention in ${location}, where premium storytelling can justify value before the shopper commits.${focusClause} that gives the range a stronger premium presence in-store.`;
    case "awareness":
    default:
      if (pageId.includes("entrance") || location.toLowerCase().includes("entrance")) {
        return `We recommend ${placementName} because it catches shoppers early in the trip and builds broad in-store reach before category decisions are made.${focusClause} that gives the brand early visibility.`;
      }
      return `We recommend ${placementName} because it keeps the campaign visible in ${location}, helping the brand stay present while shoppers browse.${focusClause} that reinforces the message inside the category journey.`;
  }
}

function formatGoalScoreValue(value, decimals = 2) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  const fixed = parsed.toFixed(decimals);
  return fixed.replace(/\.?0+$/, "");
}

function formatGoalConfidenceValue(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return "";
  }
  if (parsed <= 1.5) {
    return `${Math.max(0, Math.min(100, Math.round(parsed * 100)))}%`;
  }
  return `${Math.max(0, Math.min(100, Math.round(parsed)))}%`;
}

function formatGoalScoreBreakdown(scoreBreakdown = {}) {
  const orderedKeys = [
    ["objectiveFit", "Objective fit"],
    ["assortmentFit", "Assortment fit"],
    ["stockFit", "Stock fit"],
    ["trafficFit", "Traffic fit"],
    ["capabilityFit", "Capability fit"],
    ["continuityFit", "Continuity fit"]
  ];
  const parts = orderedKeys
    .map(([key, label]) => {
      const value = formatGoalScoreValue(scoreBreakdown[key]);
      return value ? `${label} ${value}` : "";
    })
    .filter(Boolean);
  return parts.join(" | ");
}

function getGoalPlacementReason(entry = {}, screen = {}, plan, targetProducts = []) {
  const reason =
    String(entry.reasonShort || "").trim() ||
    String(entry.reason || "").trim() ||
    buildGoalPlacementRecommendation(screen, plan, targetProducts);
  return reason;
}

function getGoalPlacementScoreLine(entry = {}) {
  const metrics = [];
  const confidence = formatGoalConfidenceValue(entry.confidence);
  const score = formatGoalScoreValue(entry.score);
  const breakdown = formatGoalScoreBreakdown(entry.scoreBreakdown || {});

  if (confidence) {
    metrics.push(`Confidence ${confidence}`);
  }
  if (score) {
    metrics.push(`Score ${score}`);
  }
  if (breakdown) {
    metrics.push(breakdown);
  }

  return metrics.join(" | ");
}

function resolveGoalPlacements(plan = {}) {
  const plannedScreenIds = Array.isArray(plan.plannedScreenIds) ? plan.plannedScreenIds : [];
  const recommendedPlacements = Array.isArray(plan.recommendedPlacements) ? plan.recommendedPlacements : [];
  const proposedChanges = Array.isArray(plan.proposedChanges) ? plan.proposedChanges : [];
  const sourceEntries = recommendedPlacements.length > 0 ? recommendedPlacements : proposedChanges;

  if (plannedScreenIds.length === 0) {
    return sourceEntries.slice();
  }

  const byScreenId = new Map();
  for (const entry of sourceEntries) {
    const screenId = String(entry?.screenId || "").trim();
    if (screenId && !byScreenId.has(screenId)) {
      byScreenId.set(screenId, entry);
    }
  }

  return plannedScreenIds.map((screenId, index) => {
    const existing = byScreenId.get(screenId);
    if (existing) {
      return existing;
    }
    return sourceEntries[index] || { screenId };
  });
}

function getPlanBudgetMaxSpend(plan = {}) {
  const selectedPlacements = getSelectedGoalPlacements(plan);
  if (selectedPlacements.length > 0 || state.goalPlacementSelections.has(String(plan?.planId || "").trim())) {
    return Math.max(
      0,
      Math.round(
        selectedPlacements.reduce((sum, placement) => sum + Number(placement?.placementCost || 0), 0)
      )
    );
  }
  return Math.max(0, Math.round(Number(plan?.budget?.maxSpend || plan?.totals?.maxSpend || 0)));
}

function getGoalBudgetSliderStep(maxSpend, currentSpend = maxSpend) {
  const normalizedMax = Math.max(0, Math.round(Number(maxSpend) || 0));
  const normalizedCurrent = Math.max(0, Math.round(Number(currentSpend) || 0));
  if (normalizedMax <= 0) {
    return 1;
  }
  const preferredSteps = normalizedMax > 2000 ? [25, 5, 1] : [5, 1];
  return preferredSteps.find((step) => normalizedMax % step === 0 && normalizedCurrent % step === 0) || 1;
}

function normalizeGoalBudgetSpend(plan, value) {
  const maxSpend = getPlanBudgetMaxSpend(plan);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return maxSpend;
  }
  return Math.max(0, Math.min(maxSpend, Math.round(parsed)));
}

function setGoalBudgetStateFromPlan(plan, preferredSpend = null) {
  if (!plan?.planId) {
    state.goalBudgetPlanId = "";
    state.goalBudgetSpend = null;
    return;
  }
  state.goalBudgetPlanId = plan.planId;
  state.goalBudgetSpend = normalizeGoalBudgetSpend(
    plan,
    preferredSpend ?? plan?.budget?.selectedSpend ?? getPlanBudgetMaxSpend(plan)
  );
}

function getActiveGoalBudgetSpend(plan = state.activeGoalPlan) {
  if (!plan) {
    return 0;
  }
  if (state.goalBudgetPlanId === plan.planId && Number.isFinite(Number(state.goalBudgetSpend))) {
    return normalizeGoalBudgetSpend(plan, state.goalBudgetSpend);
  }
  return normalizeGoalBudgetSpend(plan, plan?.budget?.selectedSpend ?? getPlanBudgetMaxSpend(plan));
}

function buildGoalBudgetScenario(plan = state.activeGoalPlan) {
  if (!plan) {
    return {
      maxSpend: 0,
      selectedSpend: 0,
      fundedSpend: 0,
      fundedIds: new Set(),
      heldBackIds: new Set(),
      fundedPlacements: [],
      heldBackPlacements: [],
      flightDays: 0
    };
  }

  const placements = getSelectedGoalPlacements(plan).map((entry, index) => ({
    ...normalizeGoalPlacementEntry(entry, index),
    selectionRank: Number(entry?.selectionRank || index + 1)
  }));
  const maxSpend = Math.max(
    0,
    Math.round(placements.reduce((sum, placement) => sum + Number(placement?.placementCost || 0), 0))
  );
  const selectedSpend = Math.max(0, Math.min(maxSpend, getActiveGoalBudgetSpend(plan)));
  const fundedPlacements = [];
  const heldBackPlacements = [];
  const fundedIds = new Set();
  const heldBackIds = new Set();
  let fundedSpend = 0;

  for (const placement of placements) {
    const nextCost = Math.max(0, placement.placementCost);
    if (fundedSpend + nextCost <= selectedSpend) {
      fundedPlacements.push(placement);
      fundedSpend += nextCost;
      fundedIds.add(placement.screenId);
    } else {
      heldBackPlacements.push(placement);
      heldBackIds.add(placement.screenId);
    }
  }

  return {
    maxSpend,
    selectedSpend,
    fundedSpend,
    fundedIds,
    heldBackIds,
    fundedPlacements,
    heldBackPlacements,
    selectedPlacementCount: placements.length,
    flightDays: Number(plan?.goal?.flightDays || plan?.budget?.flightDays || 0)
  };
}

function renderGoalPlanBudget(plan, budgetScenario) {
  if (!elements.goalPlanBudget) {
    return;
  }

  if (!plan) {
    elements.goalPlanBudget.innerHTML = "";
    elements.goalPlanBudget.classList.add("empty");
    return;
  }

  const maxSpend = budgetScenario.maxSpend;
  const selectedSpend = budgetScenario.selectedSpend;
  const fundedCount = budgetScenario.fundedPlacements.length;
  const heldBackCount = budgetScenario.heldBackPlacements.length;
  const selectedCount = getGoalPlacementSelectionIds(plan).length;
  const availableCount = getAvailableGoalPlacements(plan).length;
  const flightSummary = formatGoalFlightSummary(plan.goal?.flightStartDate, plan.goal?.flightEndDate);
  const pricingModelLabel = String(plan?.budget?.pricingModelLabel || plan?.goal?.pricingModelLabel || "Retailer-set daily screen rate").trim();
  const sliderStep = getGoalBudgetSliderStep(maxSpend, selectedSpend);
  const sliderDisabled = plan.status === "applied" || selectedCount === 0;
  const maxShortcutDisabled = sliderDisabled || selectedSpend >= maxSpend;
  const launchDisabled = plan.status === "applied" || fundedCount === 0 || selectedCount === 0;
  const sliderProgress = maxSpend > 0 ? ((selectedSpend / maxSpend) * 100).toFixed(2) : "0";

  elements.goalPlanBudget.classList.remove("empty");
  elements.goalPlanBudget.innerHTML = `
    <section class="goal-budget">
      <div class="goal-budget__header">
        <div class="goal-budget__copy">
          <p class="section-kicker">Budget control</p>
          <h4>${escapeHtml(plan.status === "applied" ? "Approved budget" : "Set budget after editing the plan")}</h4>
        </div>
        <span class="card__badge">${escapeHtml(plan.status === "applied" ? "Budget locked" : `${selectedCount} in plan`)}</span>
      </div>
      <p class="goal-budget__lede">
        ${escapeHtml(
          `${pricingModelLabel}. Finalize the placement mix on the right, then choose how much of the edited plan to fund.`
        )}
      </p>
      <div class="goal-budget__row">
        <div class="goal-budget__range">
          <div class="goal-budget__range-head">
          <label for="goalBudgetSlider">Budget slider</label>
            <button
              type="button"
              class="btn btn--ghost btn--compact js-goal-budget-max"
              data-plan-id="${escapeHtml(plan.planId || "")}"
              ${maxShortcutDisabled ? "disabled" : ""}
            >Use max budget</button>
          </div>
          <input
            id="goalBudgetSlider"
            type="range"
            min="0"
            max="${escapeHtml(String(maxSpend))}"
            step="${escapeHtml(String(sliderStep))}"
            value="${escapeHtml(String(selectedSpend))}"
            style="--goal-budget-progress: ${escapeHtml(sliderProgress)}%;"
            ${sliderDisabled ? "disabled" : ""}
          >
          <div class="goal-budget__range-meta">
            <span>${escapeHtml(formatMoney(0))}</span>
            <strong>${escapeHtml(formatMoney(selectedSpend))}</strong>
            <span>${escapeHtml(formatMoney(maxSpend))}</span>
          </div>
        </div>
        <div class="goal-budget__cta">
          <button
            type="button"
            class="btn btn--primary js-goal-budget-apply"
            data-plan-id="${escapeHtml(plan.planId || "")}"
            ${launchDisabled ? "disabled" : ""}
          >Approve and launch</button>
        </div>
      </div>
      <div class="goal-budget__totals">
        <div class="goal-budget__total">
          <span>Flight</span>
          <strong>${escapeHtml(flightSummary)}</strong>
        </div>
        <div class="goal-budget__total">
          <span>Max spend</span>
          <strong>${escapeHtml(formatMoney(maxSpend))}</strong>
        </div>
        <div class="goal-budget__total">
          <span>Selected budget</span>
          <strong>${escapeHtml(formatMoney(selectedSpend))}</strong>
        </div>
        <div class="goal-budget__total">
          <span>Funded placements</span>
          <strong>${escapeHtml(`${fundedCount}${selectedCount > 0 ? ` of ${selectedCount}` : ""}`)}</strong>
        </div>
      </div>
      <p class="goal-budget__note">
        ${escapeHtml(
          selectedCount === 0
            ? "Add at least one placement from the dropdown before setting a budget."
            : fundedCount > 0
              ? `${fundedCount} placement(s) are currently funded. ${
                  heldBackCount > 0
                    ? `${heldBackCount} sit below the budget line.${
                        selectedSpend < maxSpend ? " Use Max budget to fund the full line-up instantly." : ""
                      }`
                    : "The edited plan is fully funded."
                }${availableCount > 0 ? ` ${availableCount} more placement(s) remain available in the dropdown.` : ""}`
              : "Increase the budget to fund at least one placement."
        )}
      </p>
    </section>
  `;
}

function renderGoalPlan() {
  if (!elements.goalPlanSummary || !elements.goalPlanChanges) {
    return;
  }

  const plan = state.activeGoalPlan;
  if (!plan) {
    elements.goalPlanSummary.classList.add("empty");
    elements.goalPlanSummary.textContent = "Build a buy to see the placement rationale.";
    elements.goalPlanChanges.innerHTML = "";
    renderGoalPlanBudget(null, buildGoalBudgetScenario(null));
    return;
  }

  const compatibleScreens = countPlannedScreens(plan);
  const placementEntries = getSelectedGoalPlacements(plan);
  const availablePlacements = getAvailableGoalPlacements(plan);
  const budgetScenario = buildGoalBudgetScenario(plan);
  const targetProducts = getGoalPlanTargetProducts(plan);
  const accountLabel = getGoalPlanAccountLabel(plan.goal || {}, targetProducts);
  const focusLabel = describeGoalPlanFocus(plan, targetProducts);
  const selectionEdited = isGoalPlacementSelectionEdited(plan);
  const placementNames = placementEntries
    .map((entry) => getScreenDisplayLabel(entry?.screenId || ""))
    .filter(Boolean);
  const placementSummary =
    placementNames.length > 2
      ? `${formatSentenceList(placementNames.slice(0, 2), 2)} +${placementNames.length - 2} more`
      : formatSentenceList(placementNames, placementNames.length);
  const strategyHeadline = String(plan.strategy?.headline || "").trim();
  const strategyBullets = Array.isArray(plan.strategy?.summaryBullets)
    ? plan.strategy.summaryBullets.map((bullet) => String(bullet || "").trim()).filter(Boolean)
    : [];
  const inferredTerms =
    Array.isArray(plan.goal?.inferredTerms) && plan.goal.inferredTerms.length > 0
      ? plan.goal.inferredTerms.join(", ")
      : "";
  const scopeMessage = String(plan.goal?.scopeMessage || "").trim();
  const storeSelectionReason = String(plan.goal?.storeSelectionReason || "").trim();
  const scopeSelectionReason = String(plan.goal?.scopeSelectionReason || "").trim();
  const assortmentCategory = String(plan.goal?.assortmentCategory || "").trim();
  const storeLabel = plan.goal?.objective === "clearance" ? "Store focus" : "Store";
  const storeValue = String(plan.goal?.storeFocusLabel || plan.goal?.effectiveStoreId || plan.goal?.storeId || "All stores").trim() || "All stores";
  const primaryPillLabel =
    plan.status === "applied" ? "In market" : selectionEdited ? "Plan edited" : compatibleScreens > 0 ? "Brief ready" : "Needs revision";
  const planPlacements = placementEntries;
  const flightSummary = formatGoalFlightSummary(plan.goal?.flightStartDate, plan.goal?.flightEndDate);
  const maxSpend = getPlanBudgetMaxSpend(plan);
  const renderDetailRow = (label, value, className = "") => {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    return `
      <div class="goal-summary__detail-row${className ? ` ${className}` : ""}">
        <dt>${escapeHtml(label)}</dt>
        <dd>${escapeHtml(text)}</dd>
      </div>
    `;
  };
  const renderDetailGroup = (title, rows, className = "") => {
    const content = rows.filter(Boolean).join("");
    if (!content) {
      return "";
    }
    return `
      <section class="summary-panel goal-summary__panel${className ? ` ${className}` : ""}">
        <h4>${escapeHtml(title)}</h4>
        <dl class="goal-summary__detail-list">
          ${content}
        </dl>
      </section>
    `;
  };
  const introText =
    compatibleScreens === 0
      ? "We could not find a strong in-store line-up for this brief. Try widening the placement focus or selecting a different account/category."
      : selectionEdited
        ? `The editable line-up currently includes ${placementSummary || `${compatibleScreens} placement(s)`}.`
        : `We recommend ${placementSummary || `${compatibleScreens} placement(s)`}${
            focusLabel && focusLabel !== "the selected brief" ? ` for ${focusLabel}` : ""
          }.`;
  const readinessText =
    compatibleScreens === 0
      ? ""
      : plan.status === "applied"
        ? `This recommendation is now live in monitoring with ${formatMoney(budgetScenario.fundedSpend)} approved.`
        : "Edit the placement mix if needed, then set the budget in the left column and launch.";
  const priorityLabel =
    focusLabel && focusLabel !== "the selected brief"
      ? focusLabel
      : targetProducts.length > 0
        ? formatSentenceList(targetProducts.map((product) => product.name), Math.min(targetProducts.length, 3))
        : goalTargetSourceLabel(plan.goal?.targetSource);
  const detailGroups = [
    renderDetailGroup("Decision logic", [
      renderDetailRow("Strategy", strategyHeadline),
      renderDetailRow("Strategy notes", strategyBullets.length > 0 ? strategyBullets.join(" | ") : ""),
      renderDetailRow("Readiness", readinessText),
      renderDetailRow("Stock note", plan.goal?.stockMessage || ""),
      renderDetailRow("Flight", flightSummary),
      renderDetailRow("Pricing model", String(plan?.budget?.pricingModelLabel || "").trim())
    ]),
    renderDetailGroup("Brief metadata", [
      renderDetailRow(
        "Placement scope",
        `${getGoalScopeLabel(plan.goal || {})} | Priority SKUs: ${priorityLabel}${inferredTerms ? ` | Prompt terms: ${inferredTerms}` : ""}`
      ),
      renderDetailRow("Store choice", storeSelectionReason),
      renderDetailRow("Scope logic", scopeSelectionReason),
      renderDetailRow("Assortment category", assortmentCategory),
      renderDetailRow("Campaign brief", plan.goal?.prompt || ""),
      renderDetailRow("Scope note", scopeMessage),
      renderDetailRow("Plan metadata", `Plan ID: ${plan.planId || ""} | Created: ${formatTimestamp(plan.createdAt)}`),
      renderDetailRow("Budget", `${formatMoney(budgetScenario.selectedSpend)} selected from ${formatMoney(maxSpend)} max spend`)
    ])
  ]
    .filter(Boolean)
    .join("");

  elements.goalPlanSummary.classList.remove("empty");
  elements.goalPlanSummary.innerHTML = `
    <div class="goal-summary__hero">
      <div class="goal-summary__hero-copy">
        <p class="section-kicker">Recommended media line-up</p>
        <strong>${escapeHtml(objectiveLabelById(plan.goal?.objective))}</strong>
        <p class="goal-summary__lede">${escapeHtml(introText)}</p>
      </div>
      <div class="goal-summary__hero-status">
        <span class="pill ${plan.status === "applied" ? "pill--applied" : "pill--planned"}">${escapeHtml(primaryPillLabel)}</span>
        <p class="goal-summary__meta">Plan ${escapeHtml(plan.planId || "")}</p>
        <p class="goal-summary__meta">${escapeHtml(formatTimestamp(plan.createdAt))}</p>
      </div>
    </div>
    <div class="summary-cards goal-summary__cards">
      <div class="summary-card">
        <span class="kpi-card__label">Account</span>
        <strong>${escapeHtml(accountLabel)}</strong>
      </div>
      <div class="summary-card">
        <span class="kpi-card__label">${escapeHtml(storeLabel)}</span>
        <strong>${escapeHtml(storeValue)}</strong>
      </div>
      <div class="summary-card">
        <span class="kpi-card__label">Placements</span>
        <strong>${escapeHtml(String(compatibleScreens || 0))}</strong>
      </div>
      <div class="summary-card">
        <span class="kpi-card__label">Max spend</span>
        <strong>${escapeHtml(formatMoney(maxSpend))}</strong>
      </div>
    </div>
    <div class="goal-summary__details summary-split">
      ${detailGroups}
    </div>
  `;

  const describeAvailablePlacementReason = (entry, fallbackReason) => {
    const raw = String(entry?.reasonShort || entry?.reason || "").trim();
    if (!raw) {
      return fallbackReason;
    }
    return raw
      .replace(/^Skipped by context guardrail\.?\s*/i, "")
      .replace(/^Skipped by context guardrail/i, "")
      .replace(/^No compatible target products were found for this screen\.?/i, "it does not fit the current SKU brief.");
  };

  const renderPlacementCard = (entry, index, { funded = true, available = false } = {}) => {
      const screenId = String(entry?.screenId || "").trim();
      const screen = { ...(getGoalPlanScreen(screenId) || {}), ...(entry || {}), screenId };
      const recommendedSkus = Array.isArray(entry?.recommendedTargetSkus)
        ? entry.recommendedTargetSkus
        : Array.isArray(
              (plan.proposedChanges || []).find((change) => String(change.screenId || "") === screenId)?.recommendedTargetSkus
            )
          ? (plan.proposedChanges || []).find((change) => String(change.screenId || "") === screenId)?.recommendedTargetSkus
          : [];
      const recommendedSkuLabels = recommendedSkus.map((sku) => getProductLabelBySku(sku)).filter(Boolean);
      const placementLabel = available
        ? "Available"
        : plan.status === "applied"
          ? funded
            ? "Live"
            : "Budget hold"
          : funded
            ? "Funded"
            : "Held by budget";
      const placementReason = available
        ? describeAvailablePlacementReason(entry, getGoalPlacementReason(entry || {}, screen, plan, targetProducts))
        : getGoalPlacementReason(entry || {}, screen, plan, targetProducts);
      const scoreLine = getGoalPlacementScoreLine(entry || {});
      const templateRationale = String(entry?.templateRationale || "").trim();
      const refreshRationale = String(entry?.refreshRationale || "").trim();
      const placementRole = String(entry?.placementRole || "").trim();
      const expectedOutcome = String(entry?.expectedOutcome || "").trim();
      const placementCost = Math.max(0, Math.round(Number(entry?.placementCost || 0)));
      const dailyRate = Math.max(0, Math.round(Number(entry?.dailyRate || 0)));
      const screenType = String(entry?.screenType || screen?.screenType || "").trim();
      const normalizedExpectedOutcome = expectedOutcome.replace(/^Expected outcome:\s*/i, "");
      const actionButton =
        plan.status === "applied"
          ? ""
          : available
            ? `<button type="button" class="btn btn--tiny js-goal-placement-add" data-plan-id="${escapeHtml(plan.planId || "")}" data-screen-id="${escapeHtml(screenId)}">Add placement</button>`
            : `<button type="button" class="btn btn--tiny js-goal-placement-remove" data-plan-id="${escapeHtml(plan.planId || "")}" data-screen-id="${escapeHtml(screenId)}">Remove</button>`;
      const placementMetaRows = [
        placementRole
          ? `<div class="goal-placement-card__meta-block">
              <span class="goal-placement-card__meta-label">Role</span>
              <strong>${escapeHtml(placementRole)}</strong>
              ${
                normalizedExpectedOutcome
                  ? `<span class="goal-placement-card__meta-copy">Expected outcome: ${escapeHtml(normalizedExpectedOutcome)}</span>`
                  : ""
              }
            </div>`
          : "",
        scoreLine
          ? `<div class="goal-placement-card__meta-block">
              <span class="goal-placement-card__meta-label">Score</span>
              <strong>${escapeHtml(scoreLine)}</strong>
            </div>`
          : "",
        placementCost > 0
          ? `<div class="goal-placement-card__meta-block">
              <span class="goal-placement-card__meta-label">Cost</span>
              <strong>${escapeHtml(formatMoney(placementCost))}</strong>
              <span class="goal-placement-card__meta-copy">${escapeHtml(`${formatMoney(dailyRate)} / day${screenType ? ` | ${screenType}` : ""}`)}</span>
            </div>`
          : "",
        templateRationale || refreshRationale
          ? `<div class="goal-placement-card__meta-block">
              <span class="goal-placement-card__meta-label">Creative logic</span>
              <strong>${escapeHtml(
                [templateRationale && `Template: ${templateRationale}`, refreshRationale && `Refresh: ${refreshRationale}`]
                  .filter(Boolean)
                  .join(" | ")
              )}</strong>
            </div>`
          : "",
        available && String(entry?.reasonCode || "").trim()
          ? `<div class="goal-placement-card__meta-block goal-placement-card__meta-block--muted">
              <span class="goal-placement-card__meta-label">Status</span>
              <strong>${escapeHtml(String(entry.reasonCode).trim())}</strong>
              <span class="goal-placement-card__meta-copy">This placement is currently outside the active plan.</span>
            </div>`
          : "",
        `<div class="goal-placement-card__meta-block">
            <span class="goal-placement-card__meta-label">Priority SKU focus</span>
            <strong>${escapeHtml(
              recommendedSkuLabels.length > 0
                ? formatSentenceList(recommendedSkuLabels, recommendedSkuLabels.length)
                : focusLabel === "the selected brief"
                  ? goalTargetSourceLabel(plan.goal?.targetSource)
                  : focusLabel
            )}</strong>
            ${
              available
                ? '<span class="goal-placement-card__meta-copy">Add this placement to include it before budgeting.</span>'
                : funded
                  ? ""
                  : '<span class="goal-placement-card__meta-copy">This placement drops below the current budget cut line.</span>'
            }
          </div>`
      ]
        .filter(Boolean)
        .join("");
      const placementNumber = Number(entry?.budgetRank || entry?.selectionRank || index + 1);
      const eyebrow = available && Number(entry?.budgetRank || 0) <= 0
        ? "Available placement"
        : `Placement ${String(placementNumber).padStart(2, "0")}`;
      return `<article class="record goal-placement-card${funded && !available ? "" : " record--muted"}${available ? " goal-placement-card--available" : ""}">
        <div class="record__top goal-placement-card__top">
          <div class="goal-placement-card__headline">
            <p class="goal-placement-card__eyebrow">${escapeHtml(eyebrow)}</p>
            <strong>${escapeHtml(getScreenDisplayLabel(screenId) || screenId || "")}</strong>
          </div>
          <div class="goal-placement-card__actions">
            <span class="goal-placement__status pill ${available ? "" : plan.status === "applied" ? "pill--applied" : "pill--planned"}">${escapeHtml(placementLabel)}</span>
            ${actionButton}
          </div>
        </div>
        <p class="goal-placement-card__reason">${escapeHtml(placementReason)}</p>
        <div class="goal-placement-card__meta-grid">
          ${placementMetaRows}
        </div>
      </article>`;
    };

  const fundedPlacementMarkup = planPlacements
    .filter((entry) => budgetScenario.fundedIds.has(String(entry?.screenId || "").trim()))
    .map((entry, index) => renderPlacementCard(entry, index, { funded: true }))
    .join("");

  const heldPlacementMarkup = planPlacements
    .filter((entry) => budgetScenario.heldBackIds.has(String(entry?.screenId || "").trim()))
    .map((entry, index) => renderPlacementCard(entry, index, { funded: false }))
    .join("");

  const availablePlacementMarkup = availablePlacements
    .map((entry, index) => renderPlacementCard(entry, index, { available: true }))
    .join("");

  elements.goalPlanChanges.innerHTML =
    [
      fundedPlacementMarkup
        ? `<section class="goal-placement-group goal-placement-group--recommended">
            <div class="goal-placement-group__header">
              <p class="section-kicker">${escapeHtml(plan.status === "applied" ? "Approved line-up" : "Funded line-up")}</p>
              <h3>${escapeHtml(plan.status === "applied" ? "Live placements" : "Placements within budget")}</h3>
            </div>
            <div class="stack-list">
              ${fundedPlacementMarkup}
            </div>
          </section>`
        : "",
      heldPlacementMarkup
        ? `<section class="goal-placement-group goal-placement-group--excluded">
            <div class="goal-placement-group__header">
              <p class="section-kicker">Budget hold</p>
              <h3>Selected placements below the cut line</h3>
            </div>
            <div class="stack-list">
              ${heldPlacementMarkup}
            </div>
          </section>`
        : "",
      availablePlacementMarkup
        ? `<details class="goal-placement-group goal-placement-group--available goal-placement-dropdown"${compatibleScreens === 0 ? " open" : ""}>
            <summary class="goal-placement-dropdown__summary">
              <div class="goal-placement-dropdown__summary-copy">
                <p class="section-kicker">Available placements</p>
                <h3>${escapeHtml(`${availablePlacements.length} placement${availablePlacements.length === 1 ? "" : "s"} not in the current plan`)}</h3>
                <p>Add or restore placements here before setting the budget and sending the plan live.</p>
              </div>
              <span class="card__badge">${escapeHtml(`${availablePlacements.length} available`)}</span>
            </summary>
            <div class="stack-list">
              ${availablePlacementMarkup}
            </div>
          </details>`
        : ""
    ]
      .filter(Boolean)
      .join("") || '<div class="empty">No placements are ready for this brief yet.</div>';

  renderGoalPlanBudget(plan, budgetScenario);
}

function renderMonitoringOverview() {
  const brandContext = getGoalPlanBrandContext();
  const brandName = brandContext.brand || "Selected brand";
  const liveScreens = Number(state.activeGoalPlan?.liveCount || state.activeGoalPlan?.liveScreens?.length || 0);
  const campaignCount = (state.agentRuns || []).length;

  if (elements.monitoringOverviewKicker) {
    elements.monitoringOverviewKicker.textContent = brandContext.brand ? `${brandName} dashboard` : "Brand dashboard";
  }
  if (elements.monitoringOverviewTitle) {
    elements.monitoringOverviewTitle.textContent = brandContext.brand
      ? `${brandName} in-store campaign performance`
      : "Campaign delivery, engagement, and in-store sales impact";
  }
  if (elements.monitoringOverviewLede) {
    elements.monitoringOverviewLede.textContent = brandContext.brand
      ? `Delivery, shopper engagement, and in-store sales impact for ${brandName}'s active retail media campaigns.`
      : "Review live delivery, shopper response, and retail outcomes for the selected brand.";
  }
  if (elements.monitoringOverviewSignals) {
    const signals = [
      brandContext.brand || "Brand view",
      brandContext.objectiveLabel || "Campaign results",
      `${formatCount(liveScreens)} live screen${liveScreens === 1 ? "" : "s"}`,
      `${formatCount(campaignCount)} campaign${campaignCount === 1 ? "" : "s"}`
    ].filter(Boolean);
    elements.monitoringOverviewSignals.innerHTML = signals
      .map((label) => `<span class="monitoring-signal">${escapeHtml(label)}</span>`)
      .join("");
  }
  if (elements.monitoringOverviewAsideEyebrow) {
    elements.monitoringOverviewAsideEyebrow.textContent = brandContext.accountLabel ? "Account view" : "Workspace";
  }
  if (elements.monitoringOverviewAsideTitle) {
    elements.monitoringOverviewAsideTitle.textContent = brandContext.brand
      ? `${brandName} campaign workspace`
      : "Selected brand workspace";
  }
  if (elements.monitoringOverviewAsideCopy) {
    elements.monitoringOverviewAsideCopy.textContent = brandContext.accountLabel
      ? `This dashboard is scoped to ${brandContext.accountLabel}, with live placements, campaign history, and measured results for that brand only.`
      : "The dashboard below is scoped to the active brand and surfaces only that brand's campaigns, live placements, and measured results.";
  }
  if (elements.monitoringMeasurementTitle) {
    elements.monitoringMeasurementTitle.textContent = brandContext.brand
      ? `${brandName} campaign performance`
      : "Campaign performance";
  }
  if (elements.monitoringMeasurementIntro) {
    elements.monitoringMeasurementIntro.textContent = brandContext.brand
      ? `Delivery, shopper action, and retail outcome metrics for ${brandName}'s active campaign.`
      : "Delivery, shopper action, and retail outcome metrics for the active brand.";
  }
  if (elements.measurementBriefTitle) {
    elements.measurementBriefTitle.textContent = brandContext.brand
      ? `How ${brandName} is performing in store`
      : "How the selected brand is performing in store";
  }
  if (elements.measurementBriefCopy) {
    elements.measurementBriefCopy.textContent = brandContext.brand
      ? `Track live delivery, shopper action, and in-store sales impact for ${brandName} in one view.`
      : "Track live delivery, shopper action, and in-store sales impact in one view.";
  }
}

function renderGoalRuns() {
  if (!elements.agentRunsList) {
    return;
  }

  if ((state.agentRuns || []).length === 0) {
    const brandContext = getGoalPlanBrandContext();
    elements.agentRunsList.innerHTML = `<div class="empty">${
      brandContext.brand ? `${escapeHtml(brandContext.brand)} has no campaigns in this workspace yet.` : "No campaigns yet."
    }</div>`;
    return;
  }

  elements.agentRunsList.innerHTML = state.agentRuns
    .map((run) => {
      const canApply = run.status !== "applied" && countPlannedScreens(run) > 0;
      const pillLabel = run.status === "applied" ? "Live" : "Planned";
      const runStoreLabel = String(run.goal?.storeFocusLabel || run.goal?.requestedStoreId || run.goal?.storeId || "All stores").trim() || "All stores";
      const primaryActionLabel = canApply ? "Review budget" : "Open campaign";
      const selectedSpend =
        state.goalBudgetPlanId === run.planId ? getActiveGoalBudgetSpend(run) : Math.max(0, Math.round(Number(run?.budget?.selectedSpend || run?.budget?.maxSpend || 0)));
      const maxSpend = getPlanBudgetMaxSpend(run);
      const brandContext = getGoalPlanBrandContext(run);
      return `<article class="record">
        <div class="record__top">
          <strong>${escapeHtml(brandContext.brand ? `${brandContext.brand} | ${objectiveLabelById(run.goal?.objective)}` : objectiveLabelById(run.goal?.objective))}</strong>
          <span class="pill ${run.status === "applied" ? "pill--applied" : "pill--planned"}">${escapeHtml(pillLabel)}</span>
        </div>
        <p>${escapeHtml(runStoreLabel)} | ${escapeHtml(
          getGoalScopeLabel(run.goal || {})
        )}</p>
        <p>Placements ${escapeHtml(countPlannedScreens(run) || 0)} | Live ${escapeHtml(run.liveCount || 0)}</p>
        <p>Flight ${escapeHtml(formatGoalFlightSummary(run.goal?.flightStartDate, run.goal?.flightEndDate))} | Budget ${escapeHtml(
          maxSpend > 0 ? `${formatMoney(selectedSpend)} / ${formatMoney(maxSpend)}` : "Not priced"
        )}</p>
        <p>Campaign ${escapeHtml(run.planId || "")} | Created ${escapeHtml(formatTimestamp(run.createdAt))}${run.appliedAt ? ` | Live ${escapeHtml(formatTimestamp(run.appliedAt))}` : ""}</p>
        <span class="record__actions">
          <button type="button" class="btn btn--tiny js-load-goal-plan" data-plan-id="${escapeHtml(run.planId || "")}">${escapeHtml(primaryActionLabel)}</button>
        </span>
      </article>`;
    })
    .join("");
}

function renderMonitoringKpis() {
  const totals = state.telemetrySummary?.totals || {};
  const appliedPlans = (state.agentRuns || []).filter((run) => run.status === "applied").length;
  const liveScreens = Number(state.activeGoalPlan?.liveCount || state.activeGoalPlan?.liveScreens?.length || 0);

  if (elements.monitorKpiPlays) {
    elements.monitorKpiPlays.textContent = formatCount(totals.playCount || 0);
  }
  if (elements.monitorKpiExposure) {
    elements.monitorKpiExposure.textContent = formatDuration(totals.exposureMs || 0);
  }
  if (elements.monitorKpiScreens) {
    elements.monitorKpiScreens.textContent = formatCount(liveScreens);
  }
  if (elements.monitorKpiPlans) {
    elements.monitorKpiPlans.textContent = formatCount(appliedPlans);
  }
}

function renderTelemetryList(container, entries, type) {
  if (!container) {
    return;
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    container.innerHTML = '<div class="empty">No campaign data yet.</div>';
    return;
  }

  container.innerHTML = entries
    .map((entry) => {
      const title =
        type === "screen"
          ? entry.screenId
          : type === "template"
            ? entry.templateName || entry.templateId
            : entry.sku || entry.productName || "Tracked SKU";
      const subtitle =
        type === "screen"
          ? [entry.storeId, entry.pageId].filter(Boolean).join(" | ")
          : type === "template"
            ? entry.templateId || ""
            : entry.productName || "";
      return `<article class="record">
        <div class="record__top">
          <strong>${escapeHtml(title || "Tracked item")}</strong>
          <span>${escapeHtml(entry.lastSeenAt ? formatTimestamp(entry.lastSeenAt) : "")}</span>
        </div>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
        <p class="telemetry-record__meta">
          Plays ${escapeHtml(formatCount(entry.playCount || 0))} | Exposure ${escapeHtml(
            formatDuration(entry.exposureMs || 0)
          )} | Avg dwell ${escapeHtml(formatDuration(entry.avgExposureMs || 0))}
        </p>
      </article>`;
    })
    .join("");
}

function formatMeasurementSourceTag(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) {
    return "";
  }
  switch (raw) {
    case "qr":
      return "QR";
    case "pos-model":
      return "POS model";
    case "sales-signal":
      return "Sales signal";
    case "telemetry":
      return "Telemetry";
    case "engagement":
      return "Engagement";
    case "modeled":
      return "Modeled";
    case "model":
      return "Model";
    case "plan":
      return "Plan";
    default:
      return titleCase(raw);
  }
}

function getMeasurementComparisonText(metric = {}) {
  const comparison = metric?.comparison;
  if (!comparison) {
    return "";
  }
  const baselineText = String(comparison.baselineText || "").trim();
  const deltaText = String(comparison.deltaText || "").trim();
  if (!baselineText && !deltaText) {
    return "";
  }
  if (!baselineText) {
    return deltaText;
  }
  if (!deltaText || comparison.direction === "flat") {
    return `vs baseline ${baselineText}`;
  }
  return `vs baseline ${baselineText} (${deltaText})`;
}

function renderMeasurementBoard(board) {
  if (!elements.measurementBoardGrid) {
    return;
  }

  const metrics = Array.isArray(board?.metrics) ? board.metrics : [];
  if (metrics.length === 0) {
    elements.measurementBoardGrid.innerHTML = DEFAULT_MEASUREMENT_BOARD_GRID_HTML;
    return;
  }

  elements.measurementBoardGrid.innerHTML = metrics
    .map((metric) => {
      const comparisonText = getMeasurementComparisonText(metric);
      const sourceTags = Array.isArray(metric?.sourceTags)
        ? metric.sourceTags.map(formatMeasurementSourceTag).filter(Boolean)
        : [];
      const accentClass =
        metric?.key === "totalExposureTime" || metric?.key === "totalAdPlays" ? " measurement-card--accent" : "";

      return `<article class="measurement-card${accentClass}">
        <p class="measurement-card__label">${escapeHtml(metric?.label || "Metric")}</p>
        <strong>${escapeHtml(metric?.valueText || formatCount(metric?.value || 0))}</strong>
        ${metric?.formula ? `<p class="measurement-card__formula">Formula: ${escapeHtml(metric.formula)}</p>` : ""}
        ${metric?.description ? `<p class="measurement-card__description">${escapeHtml(metric.description)}</p>` : ""}
        ${comparisonText ? `<p class="measurement-card__comparison">${escapeHtml(comparisonText)}</p>` : ""}
        ${
          sourceTags.length > 0
            ? `<div class="measurement-card__tags">${sourceTags
                .map((tag) => `<span class="measurement-card__tag">${escapeHtml(tag)}</span>`)
                .join("")}</div>`
            : ""
        }
      </article>`;
    })
    .join("");
}

function renderTelemetry() {
  if (!elements.telemetrySummary) {
    return;
  }

  const telemetry = state.telemetrySummary;
  const totals = telemetry?.totals || {};
  const totalEvents = Number(totals.total || 0);

  if (!telemetry || totalEvents === 0) {
    const brandContext = getGoalPlanBrandContext();
    elements.telemetrySummary.classList.add("empty");
    elements.telemetrySummary.textContent = brandContext.brand
      ? `Launch ${brandContext.brand}'s campaign to populate delivery, engagement, and sales metrics.`
      : "Launch a campaign to populate delivery, engagement, and sales metrics.";
    renderMeasurementBoard(null);
    renderTelemetryList(elements.telemetryByScreen, [], "screen");
    renderTelemetryList(elements.telemetryByTemplate, [], "template");
    renderTelemetryList(elements.telemetryBySku, [], "sku");
    return;
  }

  const measurementBoard = telemetry.measurementBoard;
  const comparison = telemetry.planComparison;
  elements.telemetrySummary.classList.remove("empty");
  if (measurementBoard?.narrative) {
    const brandContext = getGoalPlanBrandContext();
    const scope = measurementBoard.scope || {};
    const summaryMeta = [
      brandContext.accountLabel,
      scope.scopeLabel,
      scope.objective ? `Objective ${titleCase(scope.objective)}` : "",
      Number(scope.storeCount || 0) > 0 ? `${formatCount(scope.storeCount || 0)} store${Number(scope.storeCount || 0) === 1 ? "" : "s"}` : "",
      Number(scope.screenCount || 0) > 0
        ? `${formatCount(scope.screenCount || 0)} screen${Number(scope.screenCount || 0) === 1 ? "" : "s"}`
        : "",
      Number(scope.targetSkuCount || 0) > 0 ? `${formatCount(scope.targetSkuCount || 0)} target SKU${Number(scope.targetSkuCount || 0) === 1 ? "" : "s"}` : "",
      Number(scope.selectedSpend || 0) > 0 ? `Budget ${formatMoney(scope.selectedSpend || 0)}` : "",
      totals.lastSeenAt ? `Last seen ${formatTimestamp(totals.lastSeenAt)}` : ""
    ].filter(Boolean);
    const summaryHeadline = brandContext.brand
      ? `${brandContext.brand} campaign results`
      : measurementBoard.narrative.headline || "Campaign results";
    const summaryCopy = brandContext.brand
      ? `Observed delivery and shopper action for ${brandContext.brand}, with modeled QR, incrementality, new-to-brand, and in-store sales impact layered on top of live telemetry.`
      : measurementBoard.narrative.summary || "Observed and modeled performance signals for the live activation.";

    elements.telemetrySummary.innerHTML = `
      <strong>${escapeHtml(summaryHeadline)}</strong>
      <p class="measurement-summary__lede">${escapeHtml(summaryCopy)}</p>
      ${summaryMeta.length > 0 ? `<p class="measurement-summary__meta">${escapeHtml(summaryMeta.join(" | "))}</p>` : ""}
      ${
        measurementBoard.narrative.trend
          ? `<p class="measurement-summary__trend">${escapeHtml(measurementBoard.narrative.trend)}</p>`
          : ""
      }
      ${
        measurementBoard.narrative.comparisonStory
          ? `<p class="measurement-summary__comparison">${escapeHtml(measurementBoard.narrative.comparisonStory)}</p>`
          : comparison?.planId
            ? `<p class="measurement-summary__comparison">Plan ${escapeHtml(
                comparison.planId
              )} is loaded. Before/after telemetry will deepen as more live events arrive.</p>`
            : ""
      }
      ${
        measurementBoard.narrative.sourceNote
          ? `<p class="measurement-summary__note">${escapeHtml(measurementBoard.narrative.sourceNote)}</p>`
          : ""
      }
    `;
  } else {
    const comparisonMarkup =
      comparison?.afterApply && comparison?.beforeApply
        ? `<p class="goal-change__metrics">
            Plan ${escapeHtml(comparison.planId || "")} | Before apply: ${escapeHtml(
              formatCount(comparison.beforeApply.playCount)
            )} plays / ${escapeHtml(formatDuration(comparison.beforeApply.exposureMs))} |
            After apply: ${escapeHtml(formatCount(comparison.afterApply.playCount))} plays /
            ${escapeHtml(formatDuration(comparison.afterApply.exposureMs))}
          </p>`
        : comparison?.planId
          ? `<p class="goal-change__metrics">Plan ${escapeHtml(comparison.planId)} is loaded. Before/after telemetry appears after apply.</p>`
          : "";

    elements.telemetrySummary.innerHTML = `
      <strong>Proof of play</strong>
      <p class="goal-change__metrics">
        Events: ${escapeHtml(formatCount(totalEvents))} | Plays: ${escapeHtml(formatCount(totals.playCount || 0))} |
        Exposure: ${escapeHtml(formatDuration(totals.exposureMs || 0))} | Avg dwell:
        ${escapeHtml(formatDuration(totals.avgExposureMs || 0))}
      </p>
      <p class="goal-change__metrics">
        Screens: ${escapeHtml(formatCount(totals.screenCount || 0))} | Templates:
        ${escapeHtml(formatCount(totals.templateCount || 0))} | SKUs:
        ${escapeHtml(formatCount(totals.skuCount || 0))}
        ${totals.lastSeenAt ? ` | Last seen: ${escapeHtml(formatTimestamp(totals.lastSeenAt))}` : ""}
      </p>
      ${comparisonMarkup}
    `;
  }

  renderMeasurementBoard(measurementBoard);
  renderTelemetryList(elements.telemetryByScreen, telemetry.byScreen || [], "screen");
  renderTelemetryList(elements.telemetryByTemplate, telemetry.byTemplate || [], "template");
  renderTelemetryList(elements.telemetryBySku, telemetry.bySku || [], "sku");
}

function renderPreviewRail(screenIds) {
  if (!elements.monitorPreviewRail) {
    return;
  }

  const brandContext = getGoalPlanBrandContext();
  const uniqueIds = [...new Set((screenIds || []).filter(Boolean))].slice(0, 2);
  const nextKey = uniqueIds.join("|");
  if (state.previewRailKey === nextKey) {
    return;
  }
  state.previewRailKey = nextKey;

  if (uniqueIds.length === 0) {
    elements.monitorPreviewRail.innerHTML = `
      <p class="preview-pane__eyebrow">${escapeHtml(brandContext.brand ? `${brandContext.brand} preview` : "Campaign preview")}</p>
      <h4>Awaiting live screens</h4>
      <p id="monitoringNarrative">${escapeHtml(
        brandContext.brand
          ? `${brandContext.brand} previews will appear here once the selected campaign is live.`
          : "Live campaign previews will appear here once the selected brand has active screens."
      )}</p>
    `;
    elements.monitoringNarrative = qs("#monitoringNarrative");
    return;
  }

  elements.monitorPreviewRail.innerHTML = `
    <p class="preview-pane__eyebrow">${escapeHtml(brandContext.brand ? `${brandContext.brand} live preview` : "Live campaign preview")}</p>
    <h4>${escapeHtml(brandContext.brand ? `${brandContext.brand} creative in market` : "Creative in market")}</h4>
    <p id="monitoringNarrative">${escapeHtml(
      brandContext.brand
        ? `${brandContext.brand} creative is running on the active in-store screens below.`
        : "These previews are pulled from the same live player path used across the active in-store screens."
    )}</p>
    <div style="display:grid;gap:12px;margin-top:6px;">
      ${uniqueIds
        .map(
          (screenId) => `<div style="display:grid;gap:8px;">
            <strong style="font-size:0.95rem;">${escapeHtml(screenId)}</strong>
            <iframe
              title="${escapeHtml(screenId)}"
              loading="lazy"
              src="${escapeHtml(buildSharedPreviewUrl(screenId))}"
              style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px;background:#fff;"
            ></iframe>
          </div>`
        )
        .join("")}
    </div>
  `;
  elements.monitoringNarrative = qs("#monitoringNarrative");
}

function renderLiveScreens() {
  if (!elements.goalLiveSummary || !elements.goalLiveScreens) {
    return;
  }

  const plan = state.activeGoalPlan;
  const brandContext = getGoalPlanBrandContext(plan);
  if (!plan || plan.status !== "applied") {
    elements.goalLiveSummary.classList.add("empty");
    elements.goalLiveSummary.textContent = brandContext.brand
      ? `Launch ${brandContext.brand}'s campaign to view live placements and creatives.`
      : "Launch the selected campaign to view live placements and creatives.";
    elements.goalLiveScreens.innerHTML = "";
    renderPreviewRail(getPreferredPreviewScreenIds());
    return;
  }

  const liveScreens = Array.isArray(plan.liveScreens) ? plan.liveScreens : [];
  elements.goalLiveSummary.classList.remove("empty");
  elements.goalLiveSummary.innerHTML = `
    <strong>${escapeHtml(brandContext.brand ? `${brandContext.brand} live campaign snapshot` : "Live campaign snapshot")}</strong>
    <p class="goal-change__metrics">
      ${brandContext.objectiveLabel ? `${escapeHtml(brandContext.objectiveLabel)} | ` : ""}Live screens: ${escapeHtml(formatCount(plan.liveCount || liveScreens.length || 0))} | Live since:
      ${escapeHtml(formatTimestamp(plan.appliedAt || plan.updatedAt || plan.createdAt))}
    </p>
    <p class="goal-change__metrics">
      ${brandContext.accountLabel ? `Account: ${escapeHtml(brandContext.accountLabel)} | ` : ""}Campaign ID: ${escapeHtml(plan.planId || "")} | Budget:
      ${escapeHtml(formatMoney(plan?.budget?.selectedSpend || 0))}
    </p>
  `;

  if (liveScreens.length === 0) {
    elements.goalLiveScreens.innerHTML = '<div class="empty">No live screens were captured for this applied run.</div>';
    renderPreviewRail(getPreferredPreviewScreenIds());
    return;
  }

  elements.goalLiveScreens.innerHTML = liveScreens
    .map((screen) => {
      const products = Array.isArray(screen.products) ? screen.products : [];
      const productMarkup =
        products.length > 0
          ? `<p class="goal-change__metrics">Products: ${escapeHtml(products.map((product) => product.name || product.sku).join(", "))}</p>`
          : "";

      return `<article class="record">
        <div class="record__top">
          <strong>${escapeHtml(screen.screenId || "")}</strong>
          <span>${escapeHtml(screen.templateName || screen.templateId || "")}</span>
        </div>
        <p>${escapeHtml(screen.storeId || "")} | ${escapeHtml(screen.pageId || "")} | ${escapeHtml(screen.location || "")}</p>
        <p>${escapeHtml(screen.screenType || "")} ${escapeHtml(screen.screenSize || "")} | Refresh ${escapeHtml(
          screen.refreshInterval || 0
        )}ms</p>
        <p>Shared player URL: ${escapeHtml(SHARED_PLAYER_URL)}${getScreenResolverId(screen) ? ` | Resolver key: ${escapeHtml(getScreenResolverId(screen))}` : ""}</p>
        ${productMarkup}
        <p class="record__actions">
          <a href="${escapeHtml(buildSharedPreviewUrl(screen))}" target="_blank" rel="noreferrer">Shared preview</a>
          <a href="${escapeHtml(buildDebugScreenUrl(screen.screenId || ""))}" target="_blank" rel="noreferrer">Debug preview</a>
        </p>
      </article>`;
    })
    .join("");

  renderPreviewRail(liveScreens.map((screen) => screen.screenId));
}

function updateMonitoringNarrative() {
  elements.monitoringNarrative = qs("#monitoringNarrative");
  if (!elements.monitoringNarrative) {
    return;
  }

  const brandContext = getGoalPlanBrandContext();
  if (state.activeGoalPlan?.status === "applied") {
    elements.monitoringNarrative.textContent = brandContext.brand
      ? `${brandContext.brand} is live across ${
          state.activeGoalPlan.liveCount || state.activeGoalPlan.liveScreens?.length || 0
        } in-store screen(s). The preview rail is scoped to the active campaign only.`
      : `The active campaign is live across ${
          state.activeGoalPlan.liveCount || state.activeGoalPlan.liveScreens?.length || 0
        } in-store screen(s). The preview rail is scoped to the active campaign only.`;
    return;
  }

  elements.monitoringNarrative.textContent = brandContext.brand
    ? `${brandContext.brand} previews will appear here once the selected campaign is live.`
    : "Live campaign previews will appear here once the selected brand has active screens.";
}

function renderAll() {
  refreshPageCounter();
  renderSupplySummary();
  renderPresetSummary();
  renderSupplyLists();
  renderGoalScopeSelects();
  renderGoalBrandOptions();
  renderGoalProductCategoryOptions();
  renderGoalProducts();
  renderGoalPlanningFlow();
  renderGoalPlan();
  renderGoalRuns();
  renderMonitoringOverview();
  renderMonitoringKpis();
  renderTelemetry();
  renderLiveScreens();
  updateMonitoringNarrative();
  updateActionButtons();
  updateStagePills();
  renderStageButtons();
  publishPresenterSnapshot();
}

async function refreshDemoConfig() {
  const response = await requestOptionalJson("/api/demo/config");
  if (response) {
    state.demo = normalizeDemoConfig(response);
  }
}

async function refreshInventory() {
  const [pagesResponse, screensResponse] = await Promise.all([requestJson("/api/pages"), requestJson("/api/screens")]);
  state.pages = Array.isArray(pagesResponse.pages) ? pagesResponse.pages : [];
  state.screens = Array.isArray(screensResponse.screens) ? screensResponse.screens : [];
}

async function refreshProductFeed() {
  const response = await requestJson("/api/products?limit=300");
  state.productFeed = Array.isArray(response.products) ? response.products : [];
  state.productAccounts =
    Array.isArray(response.accounts) && response.accounts.length > 0
      ? response.accounts
      : buildProductAccountsFromProducts(state.productFeed);
  state.productCategories = Array.isArray(response.categories) ? response.categories : [];
}

async function refreshGoalRunsData() {
  const response = await requestJson("/api/agent/goals/runs");
  const allRuns = Array.isArray(response.runs) ? response.runs : [];
  const brandContext = getGoalPlanBrandContext();
  const visiblePlanIds = new Set([...state.sessionPlanIds, state.activeGoalPlan?.planId].filter(Boolean));
  if (brandContext.advertiserId || brandContext.brand) {
    state.agentRuns = allRuns.filter((run) => runMatchesBrandWorkspace(run, brandContext));
  } else {
    state.agentRuns = visiblePlanIds.size > 0 ? allRuns.filter((run) => visiblePlanIds.has(run.planId)) : [];
  }

  if (state.activeGoalPlan?.planId) {
    const latest = allRuns.find((run) => run.planId === state.activeGoalPlan.planId);
    if (latest) {
      const preferredBudget =
        state.goalBudgetPlanId === latest.planId && Number.isFinite(Number(state.goalBudgetSpend))
          ? state.goalBudgetSpend
          : latest?.budget?.selectedSpend;
      state.activeGoalPlan = latest;
      syncGoalPlacementSelectionFromPlan(latest, { overwrite: latest.status === "applied" });
      setGoalBudgetStateFromPlan(latest, preferredBudget);
      if (!state.agentRuns.some((entry) => entry.planId === latest.planId)) {
        state.agentRuns = [...state.agentRuns, latest];
      }
      return;
    }
  }
}

async function refreshLiveState(planId = "") {
  const chosenPlanId = String(planId || state.activeGoalPlan?.planId || "").trim();
  if (!chosenPlanId) {
    return;
  }

  try {
    const response = await requestJson(`/api/agent/goals/live?planId=${encodeURIComponent(chosenPlanId)}`);
    if (state.activeGoalPlan?.planId === chosenPlanId) {
      state.activeGoalPlan = {
        ...state.activeGoalPlan,
        status: response.status || state.activeGoalPlan.status,
        appliedAt: response.appliedAt || state.activeGoalPlan.appliedAt,
        liveCount: Number(response.liveCount || 0),
        liveScreens: Array.isArray(response.liveScreens) ? response.liveScreens : state.activeGoalPlan.liveScreens || []
      };
    }
  } catch {
    // Keep existing plan state when no live snapshot is available.
  }
}

async function refreshTelemetryData(planId = "") {
  const chosenPlanId = String(planId || state.activeGoalPlan?.planId || "").trim();
  if (!chosenPlanId) {
    state.telemetrySummary = null;
    return;
  }
  state.telemetrySummary = await requestJson(`/api/telemetry/summary?planId=${encodeURIComponent(chosenPlanId)}`);
}

function readPagePayload() {
  return {
    pageId: String(elements.pageId?.value || "").trim(),
    pageType: getRadioGroupValue(elements.pageForm, "pageType"),
    environment: getRadioGroupValue(elements.pageForm, "environment"),
    firePageBeacons: Boolean(elements.firePageBeacons?.checked),
    oneTagHybridIntegration: Boolean(elements.oneTagHybridIntegration?.checked),
    includeBidInResponse: Boolean(elements.includeBidInResponse?.checked)
  };
}

function readScreenPayload() {
  const formData = new FormData(elements.screenForm);
  return {
    screenId: String(formData.get("screenId") || "").trim(),
    storeId: String(formData.get("storeId") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    pageId: String(formData.get("pageId") || "").trim(),
    screenType: String(formData.get("screenType") || "").trim(),
    screenSize: String(formData.get("screenSize") || "").trim(),
    templateId: String(formData.get("templateId") || "").trim(),
    refreshInterval: Number(formData.get("refreshInterval"))
  };
}

function readGoalPayload() {
  const formData = new FormData(elements.goalAgentForm);
  const advertiserId = String(formData.get("advertiserId") || "").trim();
  const account = getGoalAccountByAdvertiserId(advertiserId);
  return {
    objective: String(formData.get("objective") || "").trim(),
    aggressiveness: String(formData.get("aggressiveness") || "").trim(),
    storeId: String(formData.get("storeId") || "").trim(),
    pageId: String(formData.get("pageId") || "").trim(),
    flightStartDate: String(elements.goalFlightStart?.value || "").trim(),
    flightEndDate: String(elements.goalFlightEnd?.value || "").trim(),
    assortmentCategory: String(elements.goalProductCategory?.value || "").trim().toLowerCase(),
    prompt: String(formData.get("prompt") || "").trim(),
    advertiserId,
    brand: account?.brand || "",
    targetSkuIds: [...state.selectedGoalSkuIds]
  };
}

function prepareGoalPayloadForDemo() {
  const payload = readGoalPayload();
  return {
    payload,
    scopeMessage: ""
  };
}

async function saveRetailerRateCard() {
  const rateCard = readRetailerRateCardInputs();
  const response = await requestJson("/api/pricing/screen-types", {
    method: "PUT",
    body: JSON.stringify({ screenTypeRates: rateCard })
  });

  if (!state.options || typeof state.options !== "object") {
    state.options = {};
  }
  state.options.screenTypePricingDefaults = sanitizeGoalRateCard(response.screenTypeRates || rateCard);
  renderRetailerRateCard(state.options.screenTypePricingDefaults);
  state.goalRetailerRateCard = sanitizeGoalRateCard(state.options.screenTypePricingDefaults);
  renderGoalRateCard(state.goalRetailerRateCard);
  renderGoalPlanningFlow();
  renderPresetSummary();
  showToast("Retailer rate card saved.");
  showStatus("Retailer pricing updated. New buying plans will use the saved daily rates.");
}

function updateGoalPlacementSelection(screenId, include) {
  const plan = state.activeGoalPlan;
  const normalizedScreenId = String(screenId || "").trim();
  if (!plan?.planId || !normalizedScreenId || plan.status === "applied") {
    return;
  }

  const currentSelection = getGoalPlacementSelectionIds(plan);
  const nextSelection = include
    ? currentSelection.includes(normalizedScreenId)
      ? currentSelection
      : [...currentSelection, normalizedScreenId]
    : currentSelection.filter((entry) => entry !== normalizedScreenId);

  if (nextSelection.length === currentSelection.length && nextSelection.every((entry, index) => entry === currentSelection[index])) {
    return;
  }

  setGoalPlacementSelection(plan, nextSelection);
  renderGoalPlan();
  publishPresenterSnapshot();
  showStatus(
    include
      ? `${getScreenDisplayLabel(normalizedScreenId) || normalizedScreenId} added to the editable plan.`
      : `${getScreenDisplayLabel(normalizedScreenId) || normalizedScreenId} removed from the editable plan.`
  );
}

async function handlePageSubmit(event) {
  event.preventDefault();
  const payload = readPagePayload();
  try {
    await requestJson("/api/pages", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showToast(`Page ${payload.pageId} added.`);
  } catch (error) {
    if (error?.status !== 409) {
      throw error;
    }
    showToast(`Page ${payload.pageId} already exists. Continuing with the existing page.`);
  }

  await Promise.all([refreshDemoConfig(), refreshInventory()]);
  populatePageSelect(payload.pageId);
  renderAll();
  showStatus(`Page ${payload.pageId} is ready.`);
}

async function createAnchorPlacement() {
  const pagePayload = readPagePayload();
  const screenPayload = readScreenPayload();
  screenPayload.pageId = screenPayload.pageId || pagePayload.pageId;

  if (!pagePayload.pageId) {
    throw new Error("Anchor page configuration is missing.");
  }
  if (!screenPayload.screenId) {
    throw new Error("Anchor screen configuration is missing.");
  }

  showStatus("Creating the anchor placement...");

  try {
    await requestJson("/api/pages", {
      method: "POST",
      body: JSON.stringify(pagePayload)
    });
  } catch (error) {
    if (error?.status !== 409) {
      throw error;
    }
  }

  try {
    await requestJson("/api/screens", {
      method: "POST",
      body: JSON.stringify(screenPayload)
    });
  } catch (error) {
    if (error?.status !== 409) {
      throw error;
    }
  }

  await Promise.all([refreshDemoConfig(), refreshInventory()]);
  state.manualSupplyConfirmed = state.screens.some((screen) => screen.screenId === getManualSupplyConfig().screen.screenId);
  state.lastDemoAction = {
    kind: "anchor",
    message: `Anchor ready. ${screenPayload.screenId} is mapped to ${pagePayload.pageId}.`
  };

  syncSupplyFormDefaults();
  renderAll();
  showToast("Anchor placement ready.");
  showStatus("Anchor placement is ready. Apply the shared preset to finish Supply.");
}

async function handleScreenSubmit(event) {
  event.preventDefault();
  const payload = readScreenPayload();
  if (!payload.pageId) {
    throw new Error("A mapped page is required before adding a screen.");
  }

  const editingId = String(state.editingScreenId || "").trim();
  const effectiveScreenId = editingId || payload.screenId;
  let shouldEnterEditMode = false;
  if (editingId) {
    await requestJson(`/api/screens/${encodeURIComponent(editingId)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    showToast(`Screen ${editingId} updated.`);
  } else {
    try {
      await requestJson("/api/screens", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showToast(`Screen ${payload.screenId} added.`);
    } catch (error) {
      if (error?.status !== 409) {
        throw error;
      }
      shouldEnterEditMode = true;
      showToast(`Screen ${payload.screenId} already exists. Loading it into edit mode.`);
    }
  }

  await Promise.all([refreshDemoConfig(), refreshInventory()]);
  if (
    effectiveScreenId === getManualSupplyConfig().screen.screenId &&
    state.screens.some((screen) => screen.screenId === effectiveScreenId)
  ) {
    state.manualSupplyConfirmed = true;
  }
  syncSupplyFormDefaults();
  renderAll();

  if (!editingId && shouldEnterEditMode && state.screens.some((screen) => screen.screenId === payload.screenId)) {
    beginScreenEdit(payload.screenId);
  }

  if (effectiveScreenId === getManualSupplyConfig().screen.screenId) {
    showStatus("Anchor screen is ready. Load the preset to expand the rest of the supply setup.");
  }
}

async function deleteScreen(screenId) {
  if (!screenId) {
    return;
  }

  const confirmed = window.confirm(`Delete screen ${screenId}?`);
  if (!confirmed) {
    return;
  }

  await requestJson(`/api/screens/${encodeURIComponent(screenId)}`, {
    method: "DELETE"
  });

  if (state.editingScreenId === screenId) {
    syncSupplyFormDefaults();
  }

  await Promise.all([refreshDemoConfig(), refreshInventory()]);
  if (screenId === getManualSupplyConfig().screen.screenId) {
    state.manualSupplyConfirmed = false;
    state.presetLoadedInSession = false;
    state.activeGoalPlan = null;
    state.goalPlacementSelections.clear();
    state.goalBudgetPlanId = "";
    state.goalBudgetSpend = null;
    state.agentRuns = [];
    state.telemetrySummary = null;
    state.sessionPlanIds.clear();
  }
  renderAll();
  showToast(`Screen ${screenId} deleted.`);
}

async function handleGoalPlanSubmit(event) {
  event.preventDefault();
  if (!ensureGoalPlanningReadyForSubmit()) {
    return;
  }
  const prepared = prepareGoalPayloadForDemo();
  const response = await requestJson("/api/agent/goals/plan", {
    method: "POST",
    body: JSON.stringify(prepared.payload)
  });

  state.activeGoalPlan = response.run || null;
  if (state.activeGoalPlan?.planId) {
    state.sessionPlanIds.add(state.activeGoalPlan.planId);
  }
  syncGoalPlacementSelectionFromPlan(state.activeGoalPlan, { overwrite: true });
  setGoalBudgetStateFromPlan(state.activeGoalPlan);
  syncGoalFormFromRun(state.activeGoalPlan);
  await Promise.all([refreshGoalRunsData(), refreshTelemetryData(state.activeGoalPlan?.planId || "")]);
  renderAll();
  setStage("buying", true);
  showToast("In-store buy ready.");
  showStatus(
    state.activeGoalPlan?.goal?.scopeMessage ||
      state.activeGoalPlan?.goal?.stockMessage ||
      prepared.scopeMessage ||
      "In-store buy ready. Edit placements if needed, then set the budget and launch."
  );
}

async function applyGoalPlan(planId = "") {
  const chosenPlanId = String(planId || state.activeGoalPlan?.planId || "").trim();
  if (!chosenPlanId) {
    throw new Error("No plan selected.");
  }
  const targetPlan =
    chosenPlanId === state.activeGoalPlan?.planId
      ? state.activeGoalPlan
      : state.agentRuns.find((entry) => entry.planId === chosenPlanId) || state.activeGoalPlan;
  const budgetSpend = getActiveGoalBudgetSpend(targetPlan);
  const selectedScreenIds = getGoalPlacementSelectionIds(targetPlan);

  const response = await requestJson("/api/agent/goals/apply", {
    method: "POST",
    body: JSON.stringify({ planId: chosenPlanId, budgetSpend, selectedScreenIds })
  });

  state.activeGoalPlan = response.run || state.activeGoalPlan;
  state.sessionPlanIds.add(chosenPlanId);
  syncGoalPlacementSelectionFromPlan(state.activeGoalPlan, { overwrite: true });
  setGoalBudgetStateFromPlan(state.activeGoalPlan, state.activeGoalPlan?.budget?.selectedSpend ?? budgetSpend);
  await Promise.all([
    refreshDemoConfig(),
    refreshInventory(),
    refreshGoalRunsData(),
    refreshLiveState(chosenPlanId),
    refreshTelemetryData(chosenPlanId)
  ]);

  renderAll();
  setStage("monitoring", true);
  showToast(`Activation live on ${response.liveCount || response.appliedCount || 0} placement(s).`);
  showStatus(
    `Activation ${chosenPlanId} is live at ${formatMoney(response.run?.budget?.selectedSpend || budgetSpend)}. Monitoring is ready.`
  );
}

async function loadGoalPlan(planId) {
  const run = state.agentRuns.find((entry) => entry.planId === planId);
  if (!run) {
    showToast(`Plan ${planId} not found.`, true);
    return;
  }

  state.activeGoalPlan = run;
  if (run.planId) {
    state.sessionPlanIds.add(run.planId);
  }
  syncGoalPlacementSelectionFromPlan(run, { overwrite: run.status === "applied" });
  setGoalBudgetStateFromPlan(run);
  syncGoalFormFromRun(run);

  if (run.status === "applied") {
    await Promise.all([refreshLiveState(run.planId), refreshTelemetryData(run.planId)]);
    setStage("monitoring", true);
  } else {
    await refreshTelemetryData(run.planId);
    setStage("buying", true);
  }

  renderAll();
  showStatus(`Loaded recommendation ${planId}.`);
}

async function loadPresetFallback() {
  const pageSpecs = state.demo.pages || [];
  const screenSpecs = state.demo.screens || [];
  const createdPageIds = [];
  const updatedPageIds = [];
  const createdScreenIds = [];
  const updatedScreenIds = [];

  for (const page of pageSpecs) {
    const payload = {
      pageId: page.pageId,
      pageType: page.pageType,
      environment: page.environment,
      firePageBeacons: page.firePageBeacons,
      oneTagHybridIntegration: page.oneTagHybridIntegration,
      includeBidInResponse: page.includeBidInResponse
    };
    try {
      await requestJson("/api/pages", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      createdPageIds.push(page.pageId);
    } catch (error) {
      if (error?.status === 409) {
        updatedPageIds.push(page.pageId);
        continue;
      }
      throw error;
    }
  }

  for (const screen of screenSpecs) {
    const payload = {
      screenId: screen.screenId,
      storeId: state.demo.storeId,
      location: screen.location,
      pageId: screen.pageId,
      screenType: screen.screenType,
      screenSize: screen.screenSize,
      templateId: screen.templateId,
      refreshInterval: screen.refreshInterval,
      deviceHints: screen.resolverId ? { resolverId: screen.resolverId } : undefined
    };
    try {
      await requestJson("/api/screens", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      createdScreenIds.push(screen.screenId);
    } catch (error) {
      if (error?.status === 409) {
        updatedScreenIds.push(screen.screenId);
        continue;
      }
      throw error;
    }
  }

  return {
    result: {
      createdPageIds,
      updatedPageIds,
      createdScreenIds,
      updatedScreenIds
    }
  };
}

async function loadPreset() {
  if (!isManualSupplyConfirmed()) {
    throw new Error("Add the anchor screen first, then load the preset.");
  }

  showStatus("Applying the shared preset...");
  const response = (await requestOptionalJson("/api/demo/preset", { method: "POST" })) || (await loadPresetFallback());

  if (response.demo) {
    state.demo = normalizeDemoConfig(response.demo);
  } else {
    await refreshDemoConfig();
  }

  state.lastDemoAction = {
    kind: "preset",
    result: response.result || {},
    message: buildDemoActionMessage("preset", response.result || {})
  };

  state.presetLoadedInSession = true;
  state.activeGoalPlan = null;
  state.goalPlacementSelections.clear();
  state.goalBudgetPlanId = "";
  state.goalBudgetSpend = null;
  state.agentRuns = [];
  state.telemetrySummary = null;
  state.sessionPlanIds.clear();

  await refreshInventory();
  syncBuyingFormDefaults(true);
  renderAll();
  setStage("buying", true);
  showToast(state.lastDemoAction.message);
  showStatus("Shared preset is applied. Move into CMax buying.");
}

async function resetDemo() {
  showStatus("Resetting the demo...");
  const response = await requestJson("/api/demo/reset", { method: "POST" });

  state.demo = response.demo ? normalizeDemoConfig(response.demo) : state.demo;
  state.lastDemoAction = {
    kind: "reset",
    result: response.result || {},
    message: buildDemoActionMessage("reset", response.result || {})
  };

  state.manualSupplyConfirmed = false;
  state.presetLoadedInSession = false;
  state.activeGoalPlan = null;
  state.goalPlacementSelections.clear();
  state.goalBudgetPlanId = "";
  state.goalBudgetSpend = null;
  state.agentRuns = [];
  state.telemetrySummary = null;
  state.selectedGoalSkuIds.clear();
  state.sessionPlanIds.clear();
  state.previewRailKey = "";

  await refreshInventory();
  syncSupplyFormDefaults();
  syncBuyingFormDefaults(true);
  renderAll();
  setStage("supply", true);
  showToast(state.lastDemoAction.message);
  showStatus("Demo reset complete.");
}

function handleError(error) {
  showToast(error.message, true);
  showStatus(error.message, true);
}

function wireEvents() {
  document.addEventListener("click", (event) => {
    const stageJump = event.target.closest(".js-stage-jump");
    if (stageJump) {
      setStage(stageJump.dataset.stage || "supply", true);
      return;
    }

    if (event.target.closest("#createAnchorBtn")) {
      createAnchorPlacement().catch(handleError);
      return;
    }

    if (event.target.closest("#loadPresetBtn, #loadPresetBtnSecondary")) {
      loadPreset().catch(handleError);
      return;
    }

    if (event.target.closest("#resetDemoBtn")) {
      resetDemo().catch(handleError);
      return;
    }

    const openPlannerStep = event.target.closest(".js-open-planner-step");
    if (openPlannerStep) {
      setGoalPlanningStep(openPlannerStep.dataset.plannerStepTarget || "1");
      publishPresenterSnapshot();
      return;
    }

    const loadPlanButton = event.target.closest(".js-load-goal-plan");
    if (loadPlanButton) {
      loadGoalPlan(loadPlanButton.dataset.planId || "").catch(handleError);
      return;
    }

    const applyPlanButton = event.target.closest(".js-apply-goal-plan");
    if (applyPlanButton) {
      applyGoalPlan(applyPlanButton.dataset.planId || "").catch(handleError);
      return;
    }

    const budgetApplyButton = event.target.closest(".js-goal-budget-apply");
    if (budgetApplyButton) {
      applyGoalPlan(budgetApplyButton.dataset.planId || "").catch(handleError);
      return;
    }

    const budgetMaxButton = event.target.closest(".js-goal-budget-max");
    if (budgetMaxButton) {
      if (!state.activeGoalPlan) {
        return;
      }
      state.goalBudgetPlanId = state.activeGoalPlan.planId || budgetMaxButton.dataset.planId || "";
      state.goalBudgetSpend = getPlanBudgetMaxSpend(state.activeGoalPlan);
      renderGoalPlan();
      publishPresenterSnapshot();
      return;
    }

    const addPlacementButton = event.target.closest(".js-goal-placement-add");
    if (addPlacementButton) {
      updateGoalPlacementSelection(addPlacementButton.dataset.screenId || "", true);
      return;
    }

    const removePlacementButton = event.target.closest(".js-goal-placement-remove");
    if (removePlacementButton) {
      updateGoalPlacementSelection(removePlacementButton.dataset.screenId || "", false);
      return;
    }

    const editScreenButton = event.target.closest(".js-edit-screen");
    if (editScreenButton) {
      beginScreenEdit(editScreenButton.dataset.screenId || "");
      return;
    }

    const deleteScreenButton = event.target.closest(".js-delete-screen");
    if (deleteScreenButton) {
      deleteScreen(deleteScreenButton.dataset.screenId || "").catch(handleError);
    }
  });

  elements.pageId?.addEventListener("input", refreshPageCounter);
  elements.pageForm?.addEventListener("submit", (event) => {
    handlePageSubmit(event).catch(handleError);
  });
  elements.screenForm?.addEventListener("submit", (event) => {
    handleScreenSubmit(event).catch(handleError);
  });
  elements.goalAgentForm?.addEventListener("submit", (event) => {
    handleGoalPlanSubmit(event).catch(handleError);
  });
  elements.goalStep1NextBtn?.addEventListener("click", () => {
    if (!ensureGoalBriefStepComplete()) {
      return;
    }
    state.goalPlanningStep = 2;
    renderGoalPlanningFlow();
    showStatus("Step 2 unlocked. Set the flight window and optional scope filters.");
    publishPresenterSnapshot();
  });
  elements.goalStep2NextBtn?.addEventListener("click", () => {
    if (!ensureGoalBriefStepComplete()) {
      return;
    }
    if (!hasValidGoalFlightDates()) {
      state.goalPlanningStep = 2;
      renderGoalPlanningFlow();
      showStatus("Add a valid flight date range before moving to Step 3.", true);
      return;
    }
    state.goalScopeStepAcknowledged = true;
    state.goalPlanningStep = 3;
    renderGoalPlanningFlow();
    showStatus("Step 3 unlocked. Choose the SKU focus and build the buy.");
    publishPresenterSnapshot();
  });
  elements.goalBrandAccount?.addEventListener("change", () => {
    const removedCount = reconcileSelectedGoalSkusToBrand();
    renderGoalProductCategoryOptions();
    renderGoalProducts();
    applyGoalScopeSuggestionFromSelection();
    const account = getGoalAccountByAdvertiserId();
    if (removedCount > 0) {
      showStatus(`Account changed. Removed ${removedCount} SKU(s) from the previous account.`);
    } else if (account?.brand) {
      showStatus(`Assortment filtered to ${getProductAccountLabel(account)}.`);
    } else {
      showStatus("Choose an account to continue planning.");
    }
    publishPresenterSnapshot();
  });
  elements.goalObjective?.addEventListener("change", () => {
    renderGoalPlanningFlow();
    publishPresenterSnapshot();
  });
  elements.goalAggressiveness?.addEventListener("change", () => {
    renderGoalPlanningFlow();
    publishPresenterSnapshot();
  });
  elements.goalStoreScope?.addEventListener("change", () => {
    renderGoalPlanningFlow();
    publishPresenterSnapshot();
  });
  elements.goalPageScope?.addEventListener("change", () => {
    renderGoalPlanningFlow();
    publishPresenterSnapshot();
  });
  elements.goalFlightStart?.addEventListener("change", () => {
    renderGoalPlanningFlow();
    publishPresenterSnapshot();
  });
  elements.goalFlightEnd?.addEventListener("change", () => {
    renderGoalPlanningFlow();
    publishPresenterSnapshot();
  });
  elements.goalPrompt?.addEventListener("input", () => {
    renderGoalPlanningFlow();
    publishPresenterSnapshot();
  });
  elements.retailerRateCard?.addEventListener("input", (event) => {
    if (!event.target.closest(".js-retailer-rate-input")) {
      return;
    }
    publishPresenterSnapshot();
  });
  elements.saveRetailerRatesBtn?.addEventListener("click", () => {
    saveRetailerRateCard().catch(handleError);
  });
  elements.goalProductCategory?.addEventListener("change", () => {
    renderGoalProducts();
    publishPresenterSnapshot();
  });
  elements.goalProductSearch?.addEventListener("input", () => {
    renderGoalProducts();
    publishPresenterSnapshot();
  });
  elements.goalSelectCategoryBtn?.addEventListener("click", () => {
    selectFilteredGoalSkus();
  });
  elements.goalClearSkusBtn?.addEventListener("click", () => {
    clearGoalSkuSelection();
  });
  elements.goalSelectedSkus?.addEventListener("click", (event) => {
    const button = event.target.closest(".js-remove-goal-sku");
    if (!button) {
      return;
    }
    const sku = normalizeSku(button.dataset.sku || "");
    if (!sku) {
      return;
    }
    state.selectedGoalSkuIds.delete(sku);
    renderGoalProducts();
    applyGoalScopeSuggestionFromSelection();
    showStatus(`Removed ${getProductLabelBySku(sku) || sku} from the priority list.`);
    publishPresenterSnapshot();
  });
  elements.goalProductList?.addEventListener("change", (event) => {
    const checkbox = event.target.closest(".js-goal-product-sku");
    if (!checkbox) {
      return;
    }
    const sku = normalizeSku(checkbox.value);
    if (!sku) {
      return;
    }
    if (checkbox.checked) {
      state.selectedGoalSkuIds.add(sku);
    } else {
      state.selectedGoalSkuIds.delete(sku);
    }
    renderGoalProducts();
    applyGoalScopeSuggestionFromSelection();
    publishPresenterSnapshot();
  });
  elements.goalPlanBudget?.addEventListener("input", (event) => {
    const slider = event.target.closest("#goalBudgetSlider");
    if (!slider || !state.activeGoalPlan) {
      return;
    }
    state.goalBudgetPlanId = state.activeGoalPlan.planId || "";
    state.goalBudgetSpend = normalizeGoalBudgetSpend(state.activeGoalPlan, slider.value);
    renderGoalPlan();
    publishPresenterSnapshot();
  });
  elements.screenCancelBtn?.addEventListener("click", () => {
    syncSupplyFormDefaults();
    renderAll();
    showStatus("Edit mode cancelled.");
  });
  elements.templateId?.addEventListener("change", () => {
    applyTemplatePreset(elements.templateId.value, true);
  });
  elements.screenType?.addEventListener("change", () => {
    if (elements.screenType.value === "Kiosk" && elements.templateId?.value !== "kiosk-interactive") {
      elements.templateId.value = "kiosk-interactive";
      applyTemplatePreset("kiosk-interactive", true);
      showStatus("Kiosk selected. Switched to the kiosk template defaults.");
    }
  });
  elements.refreshInventoryBtn?.addEventListener("click", () => {
    Promise.all([refreshDemoConfig(), refreshInventory()])
      .then(() => {
        renderAll();
        showToast("Supply refreshed.");
      })
      .catch(handleError);
  });
  elements.refreshRunsBtn?.addEventListener("click", () => {
    Promise.all([
      refreshGoalRunsData(),
      refreshLiveState(state.activeGoalPlan?.planId || ""),
      refreshTelemetryData(state.activeGoalPlan?.planId || "")
    ])
      .then(() => {
        renderAll();
        showToast("Runs refreshed.");
      })
      .catch(handleError);
  });
  elements.refreshTelemetryBtn?.addEventListener("click", () => {
    refreshTelemetryData(state.activeGoalPlan?.planId || "")
      .then(() => {
        renderAll();
        showToast("Telemetry refreshed.");
      })
      .catch(handleError);
  });
  window.addEventListener("beforeunload", () => {
    presenterChannel?.close();
    presenterChannel = null;
  });
}

async function init() {
  try {
    await refreshDemoConfig();
    state.options = await requestJson("/api/options");
    await Promise.all([refreshProductFeed(), refreshInventory(), refreshGoalRunsData()]);

    renderOptions();
    syncSupplyFormDefaults();
    syncBuyingFormDefaults(true);
    renderGoalProductCategoryOptions();
    renderGoalProducts();

    await refreshTelemetryData();

    wireEvents();
    renderAll();
    setStage("supply", false);
    showStatus("Ready for the CYield supply setup.");
  } catch (error) {
    handleError(error);
  }
}

await init();
