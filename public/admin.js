const UI_STAGES = ["supply", "buying", "monitoring"];
const SHARED_PLAYER_URL = "/screen.html";
const PRESENTER_CHANNEL_NAME = "instore-demo-presenter";
const PRESENTER_SNAPSHOT_KEY = "instore-demo-presenter-snapshot";
const DEFAULT_DEMO_STORE_ID = "DEMO-ANCHOR";
const DEMO_SUPPLY_STARTER_SUFFIX = "CYIELD_ENTRANCE_HERO";
const DEMO_BUYING_STARTER_SUFFIX = "CMAX_CHECKOUT_KIOSK";
const LIVE_SCREEN_RESULT_LIMIT = 12;
let presenterChannel = null;
let workspaceRecoveryScheduled = false;

function buildDemoScreenId(storeId, suffix) {
  const normalizedStoreId = String(storeId || "").trim();
  const normalizedSuffix = String(suffix || "").trim();
  if (!normalizedStoreId || !normalizedSuffix) {
    return "";
  }
  return `${normalizedStoreId}_${normalizedSuffix}`;
}

function buildDefaultGoalPrompt(storeId = DEFAULT_DEMO_STORE_ID) {
  const normalizedStoreId = String(storeId || "").trim();
  return `Drive checkout demand for Northfield accessories in ${normalizedStoreId || "the lead store"}.`;
}

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
    screenId: "",
    storeId: "",
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
  prompt: buildDefaultGoalPrompt(),
  targetSkuIds: ["ACC-MOUSE-001"]
};

const DEFAULT_SCREEN_TYPE_CPMS = {
  "Vertical Screen": 22,
  "Horizontal Screen": 18,
  "Shelf Edge": 15,
  Endcap: 18,
  Kiosk: 24,
  "Digital Menu Board": 20
};
const DEFAULT_GOAL_FLIGHT_DAYS = 7;
const GOAL_INFERRED_PRODUCT_LIMIT = 8;
const GOAL_PROMPT_MIN_SCORE = 0.75;
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

function createDefaultStage(id, label, description, starterScreenId, actionLabel) {
  return {
    id,
    label,
    description,
    starterScreenId,
    actionLabel,
    supportingModules: [],
    demoActions: [],
    qaPrompts: [],
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
  storeId: DEFAULT_DEMO_STORE_ID,
  storeCount: 0,
  storeIds: [],
  title: "CYield / CMax guided demo",
  goalDefaults: { ...DEFAULT_GOAL_DEFAULTS },
  stages: {
    supply: createDefaultStage(
      "cyield-supply",
      "CYield Supply Setup",
      "Treat screens like pages, then load the preset inventory in one click.",
      buildDemoScreenId(DEFAULT_DEMO_STORE_ID, DEMO_SUPPLY_STARTER_SUFFIX),
      "Load supply preset"
    ),
    buying: createDefaultStage(
      "cmax-demand",
      "CMax Buying / Demand",
      "Generate demand against the configured supply and apply it.",
      buildDemoScreenId(DEFAULT_DEMO_STORE_ID, DEMO_BUYING_STARTER_SUFFIX),
      "Generate buying plan"
    ),
    monitoring: createDefaultStage(
      "monitoring",
      "Monitoring",
      "Review campaign delivery, shopper engagement, and in-store outcomes.",
      buildDemoScreenId(DEFAULT_DEMO_STORE_ID, DEMO_BUYING_STARTER_SUFFIX),
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

const MARKET_STORY_STEPS = [
  {
    id: "onsite-base",
    accent: "#2f74ff",
    kicker: "Established revenue base",
    title: "Onsite ecommerce media already proves the revenue pool.",
    body:
      "The opportunity starts from a proven base. Statista Market Insights projects global retail platform advertising at $203.89B in 2025, while Grand View Research sizes the global in-store digital advertising display market at $4.59B in 2024. The in-store screens proposition extends an established onsite monetization model into the physical store.",
    note: "Onsite remains the economic center of retail media, corroborated by WARC, EMARKETER, and RetailX.",
    metrics: [
      {
        value: 203.89,
        decimals: 2,
        prefix: "$",
        suffix: "B",
        label: "Global onsite ecommerce media market",
        detail: "Statista retail platform advertising, 2025"
      },
      {
        value: 4.59,
        decimals: 2,
        prefix: "$",
        suffix: "B",
        label: "Global in-store digital display market",
        detail: "Grand View Research, 2024"
      }
    ],
    sources: [
      {
        label: "Statista global retail platform advertising",
        href: "https://www.statista.com/outlook/amo/advertising/retail-platform-advertising/worldwide"
      },
      {
        label: "Grand View global in-store display",
        href: "https://www.grandviewresearch.com/industry-analysis/in-store-digital-advertising-display-market-report"
      },
      {
        label: "WARC off-site share",
        href: "https://www.warc.com/content/article/warc-curated-datapoints/off-site-accounts-for-less-than-20-of-retail-media-spend/en-gb/162053"
      },
      {
        label: "EMARKETER on-site share",
        href: "https://www.emarketer.com/content/upper-limits-of-retail-media-s-on-site-monetization-coming-focus"
      },
      {
        label: "RetailX onsite report",
        href: "https://internetretailing.net/report-hub/retail-media-onsite-2025/"
      }
    ],
    nextLabel: "Show APAC"
  },
  {
    id: "apac",
    accent: "#2eb7a3",
    kicker: "Beachhead market",
    title: "APAC is the right beachhead for expansion.",
    body:
      "The regional profile mirrors the global one. Statista Market Insights projects APAC retail platform advertising at $90.25B in 2025, while Grand View Research sizes the APAC in-store digital advertising display market at $1.31B in 2024. That creates the classic beachhead dynamic: enough demand to matter, but enough whitespace to win with a focused product.",
    note: "The comparison stays disciplined: onsite ecommerce media versus in-store screens, not total retail media.",
    metrics: [
      {
        value: 90.25,
        decimals: 2,
        prefix: "$",
        suffix: "B",
        label: "APAC onsite ecommerce media market",
        detail: "Statista retail platform advertising, 2025"
      },
      {
        value: 1.312,
        decimals: 3,
        prefix: "$",
        suffix: "B",
        label: "APAC in-store digital display market",
        detail: "Grand View Research, 2024"
      }
    ],
    sources: [
      {
        label: "Statista APAC retail platform advertising",
        href: "https://www.statista.com/outlook/amo/advertising/retail-platform-advertising/apac"
      },
      {
        label: "Grand View APAC in-store digital display",
        href: "https://www.grandviewresearch.com/horizon/outlook/in-store-digital-advertising-display-market/asia-pacific"
      }
    ],
    nextLabel: "Show strategic fit"
  },
  {
    id: "right-to-play",
    accent: "#6c8f34",
    kicker: "Right to win",
    title: "Criteo enters this space from a position of strength.",
    body:
      "This is not a category bet from scratch. Criteo already brings retailer relationships, advertiser demand, and an onsite retail media playbook proven in market. Extending that model into stores builds on capabilities already in hand rather than requiring a new commercial system to be invented.",
    note: "The implementation path is equally pragmatic: extend CYield supply with a lightweight in-store layer and reuse the broader retail media stack.",
    metrics: [
      {
        value: 2,
        decimals: 0,
        prefix: "",
        suffix: "-sided",
        label: "commercial network already in place",
        detail: "Retailer and advertiser relationships already exist."
      },
      {
        value: 1,
        decimals: 0,
        prefix: "",
        suffix: " playbook",
        label: "onsite operating model already proven",
        detail: "Sales, measurement, and optimization capabilities already exist."
      },
      {
        value: 1,
        decimals: 0,
        prefix: "",
        suffix: " extension",
        label: "product path into stores",
        detail: "CYield needs an extension, not a rebuild."
      }
    ],
    sources: [],
    nextLabel: "Show proof"
  },
  {
    id: "activation",
    accent: "#ef6a3f",
    kicker: "Performance proof",
    title: "The channel already shows measurable sales impact.",
    body:
      "The value proposition is performance-led, not speculative. Albertsons reported 14% in-store sales lift in a 116-store case study. SMG and Kantar reported 28.3% average product sales lift across 12,558 in-store campaigns. That evidence supports positioning screens as a measurable retail media channel rather than a store-tech upgrade.",
    note: "The commercial logic stays consistent from site to store: media that can be measured against sales.",
    metrics: [
      {
        value: 14,
        decimals: 0,
        prefix: "+",
        suffix: "%",
        label: "Albertsons in-store sales lift",
        detail: "116-store case study, January 6, 2026"
      },
      {
        value: 28.3,
        decimals: 1,
        prefix: "+",
        suffix: "%",
        label: "Average product sales lift across in-store campaigns",
        detail: "SMG / Kantar, October 2025"
      }
    ],
    sources: [
      {
        label: "Albertsons Media Collective case",
        href: "https://www.retailtouchpoints.com/news/albertsons-media-collective-launches-store-level-measurement-to-gauge-ads-true-impact/156271/"
      },
      {
        label: "SMG / Kantar effectiveness study",
        href: "https://smg.team/wp-content/uploads/2025/10/The-Advertising-Effectiveness-of-In-Store-Retail-Media-SMG-Report.pdf"
      }
    ],
    nextLabel: "Show upside"
  },
  {
    id: "modeled-upside",
    accent: "#f0b54b",
    kicker: "Adjacency economics",
    title: "A focused beachhead can scale into a material business.",
    body:
      "The economics should be read in two layers. First, media budgets that can flow through an in-store extension of onsite retail media. Second, platform revenue from operating the screen layer. Under modest penetration assumptions, both the global market and the APAC beachhead are large enough to support a meaningful new business line.",
    note: "This is a classic adjacency case: large core market, focused beachhead, credible right to win, and conservative share assumptions.",
    metricSections: [
      {
        kicker: "Media flow",
        title: "Budgets that could flow through the channel",
        note: "Modeled at 0.1% of onsite ecommerce media",
        metrics: [
          {
            value: 203.89,
            decimals: 2,
            prefix: "$",
            suffix: "M",
            label: "Global media flow potential",
            detail: "0.1% of worldwide onsite ecommerce media"
          },
          {
            value: 90.25,
            decimals: 2,
            prefix: "$",
            suffix: "M",
            label: "APAC media flow potential",
            detail: "0.1% of APAC onsite ecommerce media"
          }
        ]
      },
      {
        kicker: "Platform revenue",
        title: "Revenue pool for operating the in-store layer",
        note: "Modeled at 1% of the in-store digital display market",
        metrics: [
          {
            value: 45.9,
            decimals: 1,
            prefix: "$",
            suffix: "M",
            label: "Global platform revenue potential",
            detail: "1% of the worldwide in-store display market"
          },
          {
            value: 13.12,
            decimals: 2,
            prefix: "$",
            suffix: "M",
            label: "APAC platform revenue potential",
            detail: "1% of the APAC in-store display market"
          }
        ]
      }
    ],
    sources: [
      {
        label: "Statista global retail platform advertising",
        href: "https://www.statista.com/outlook/amo/advertising/retail-platform-advertising/worldwide"
      },
      {
        label: "Statista APAC retail platform advertising",
        href: "https://www.statista.com/outlook/amo/advertising/retail-platform-advertising/apac"
      },
      {
        label: "Grand View global in-store display",
        href: "https://www.grandviewresearch.com/industry-analysis/in-store-digital-advertising-display-market-report"
      },
      {
        label: "Grand View APAC in-store digital display",
        href: "https://www.grandviewresearch.com/horizon/outlook/in-store-digital-advertising-display-market/asia-pacific"
      }
    ],
    nextLabel: "Enter CYield step 1"
  }
];

const state = {
  stage: "supply",
  options: null,
  workspaceStatus: null,
  demo: { ...DEFAULT_DEMO_CONFIG },
  pages: [],
  screens: [],
  inventoryStoreIds: [],
  inventoryPageIds: [],
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
  supplyHandoffAcknowledged: false,
  goalPlanningStep: 1,
  goalScopeStepAcknowledged: false,
  goalSkuSelectionMode: "",
  goalPromptMatchedTerms: [],
  goalPromptInferencePending: false,
  goalPromptInferenceTimer: null,
  goalPromptInferenceRequestId: 0,
  goalPromptInferenceProvider: "",
  goalPromptInferenceModel: "",
  goalPromptInferenceReasoning: "",
  goalPromptInferenceTargetSource: "",
  goalPromptAwaitingRun: false,
  goalRetailerRateCard: null,
  goalPlacementSelections: new Map(),
  goalBudgetPlanId: "",
  goalBudgetSpend: null,
  goalLiveQuery: "",
  goalLiveSelectedScreenId: "",
  sessionPlanIds: new Set(),
  toastTimeoutId: null,
  previewRailKey: "",
  previewRailRequestId: 0,
  presetSimulatedInSession: false,
  marketIntroAcknowledged: false,
  marketStoryStep: 0,
  marketStoryAnimationFrameIds: [],
  workspaceOverlayPollId: null,
  pendingActions: new Set()
};
// Keep the real preset path for normal-sized demos; only short-circuit massive rollouts that time out the UI.
const LARGE_DEMO_PRESET_SCREEN_THRESHOLD = 1000;

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return [...document.querySelectorAll(selector)];
}

function normalizePendingActionKey(actionKey) {
  return String(actionKey || "").trim();
}

function hasPendingAction(actionKey) {
  const normalizedKey = normalizePendingActionKey(actionKey);
  if (!normalizedKey) {
    return false;
  }
  for (const pendingKey of state.pendingActions) {
    if (pendingKey === normalizedKey || pendingKey.startsWith(`${normalizedKey}:`)) {
      return true;
    }
  }
  return false;
}

function getPendingActionValue(actionKey) {
  const normalizedKey = normalizePendingActionKey(actionKey);
  if (!normalizedKey) {
    return "";
  }
  for (const pendingKey of state.pendingActions) {
    if (pendingKey === normalizedKey) {
      return "";
    }
    if (pendingKey.startsWith(`${normalizedKey}:`)) {
      return pendingKey.slice(normalizedKey.length + 1);
    }
  }
  return "";
}

function setPendingAction(actionKey, pending) {
  const normalizedKey = normalizePendingActionKey(actionKey);
  if (!normalizedKey) {
    return;
  }
  const hadKey = state.pendingActions.has(normalizedKey);
  if (pending) {
    if (!hadKey) {
      state.pendingActions.add(normalizedKey);
      renderAll();
    }
    return;
  }
  if (hadKey) {
    state.pendingActions.delete(normalizedKey);
    renderAll();
  }
}

async function runPendingAction(actionKey, task, { lockKey = actionKey } = {}) {
  const normalizedActionKey = normalizePendingActionKey(actionKey);
  const normalizedLockKey = normalizePendingActionKey(lockKey);
  if (!normalizedActionKey || typeof task !== "function") {
    return undefined;
  }
  if (normalizedLockKey && hasPendingAction(normalizedLockKey)) {
    return undefined;
  }
  setPendingAction(normalizedActionKey, true);
  try {
    return await task();
  } finally {
    setPendingAction(normalizedActionKey, false);
  }
}

const elements = {
  statusText: qs("#statusText"),
  toast: qs("#toast"),
  workspaceOverlay: qs("#workspaceOverlay"),
  workspaceOverlayMessage: qs("#workspaceOverlayMessage"),
  workspaceGrid: qs("#workspaceGrid"),
  workspaceBadge: qs("#workspaceBadge"),
  workspaceBadgeName: qs("#workspaceBadgeName"),
  workspaceBadgeStatus: qs("#workspaceBadgeStatus"),
  switchWorkspaceBtn: qs("#switchWorkspaceBtn"),
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
  supplyHandoffCard: qs("#supplyHandoffCard"),
  supplyHandoffMessage: qs("#supplyHandoffMessage"),
  supplyHandoffStats: qs("#supplyHandoffStats"),
  continueToBuyingBtn: qs("#continueToBuyingBtn"),
  pagesList: qs("#pagesList"),
  screensList: qs("#screensList"),
  pageForm: qs("#page-form"),
  pageSubmitBtn: qs("#page-form button[type='submit']"),
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
  goalPromptRunBtn: qs("#goalPromptRunBtn"),
  goalPromptAiStatus: qs("#goalPromptAiStatus"),
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
  goalLiveSearch: qs("#goalLiveSearch"),
  goalLiveSearchMeta: qs("#goalLiveSearchMeta"),
  goalLiveScreens: qs("#goalLiveScreens"),
  goalLiveDetail: qs("#goalLiveDetail"),
  telemetrySummary: qs("#telemetrySummary"),
  measurementBoardGrid: qs("#measurementBoardGrid"),
  telemetryByScreen: qs("#telemetryByScreen"),
  telemetryByTemplate: qs("#telemetryByTemplate"),
  telemetryBySku: qs("#telemetryBySku"),
  monitoringOverviewKicker: qs("#monitoringOverviewKicker"),
  monitoringOverviewTitle: qs("#monitoringOverviewTitle"),
  monitoringOverviewLede: qs("#monitoringOverviewLede"),
  supplyWorkflowShell: qs("#supplyWorkflowShell"),
  marketStoryOverlay: qs("#marketStoryOverlay"),
  marketStoryPanel: qs("#marketStoryPanel"),
  marketStoryStepLabel: qs("#marketStoryStepLabel"),
  marketStoryProgress: qs("#marketStoryProgress"),
  marketStoryKicker: qs("#marketStoryKicker"),
  marketStoryTitle: qs("#marketStoryTitle"),
  marketStoryBody: qs("#marketStoryBody"),
  marketStoryNote: qs("#marketStoryNote"),
  marketStoryMetrics: qs("#marketStoryMetrics"),
  marketStorySources: qs("#marketStorySources"),
  marketStoryBackBtn: qs("#marketStoryBackBtn"),
  marketStoryNextBtn: qs("#marketStoryNextBtn"),
  marketStorySkipBtn: qs("#marketStorySkipBtn"),
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

function buildAiAssistMarkup({
  kicker = "AI Assist",
  title = "",
  body = "",
  detail = "",
  variant = "ready",
  compact = false
} = {}) {
  const innerMarkup = buildAiAssistInnerMarkup({ kicker, title, body, detail });
  const classNames = [
    "ai-ass",
    variant ? `ai-ass--${variant}` : "",
    compact ? "ai-ass--compact" : ""
  ]
    .filter(Boolean)
    .join(" ");
  const busyAttr = variant === "loading" ? ' aria-busy="true"' : "";
  return `
    <section class="${escapeHtml(classNames)}"${busyAttr}>
      ${innerMarkup}
    </section>
  `;
}

function buildAiAssistInnerMarkup({ kicker = "AI Assist", title = "", body = "", detail = "" } = {}) {
  return `
    <div class="ai-ass__visual" aria-hidden="true">
      <span class="ai-ass__orb"></span>
      <span class="ai-ass__orb"></span>
      <span class="ai-ass__orb"></span>
      <span class="ai-ass__spark"></span>
      <span class="ai-ass__spark"></span>
      <span class="ai-ass__spark"></span>
    </div>
    <div class="ai-ass__copy">
      <p class="ai-ass__kicker">${escapeHtml(kicker)}</p>
      <strong>${escapeHtml(title)}</strong>
      <p>${escapeHtml(body)}</p>
      ${detail ? `<span class="ai-ass__detail">${escapeHtml(detail)}</span>` : ""}
    </div>
  `;
}

function renderAiAssistStatus(
  element,
  {
    kicker = "AI Assist",
    title = "",
    body = "",
    detail = "",
    variant = "ready",
    compact = false,
    extraClasses = []
  } = {}
) {
  if (!element) {
    return;
  }
  const classNames = [
    "ai-ass",
    variant ? `ai-ass--${variant}` : "",
    compact ? "ai-ass--compact" : "",
    ...extraClasses
  ]
    .filter(Boolean)
    .join(" ");
  element.className = classNames;
  if (variant === "loading") {
    element.setAttribute("aria-busy", "true");
  } else {
    element.removeAttribute("aria-busy");
  }
  element.innerHTML = buildAiAssistInnerMarkup({ kicker, title, body, detail });
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

function getMarketIntroStorageKey(workspaceId = getCurrentWorkspace()?.id) {
  const normalizedWorkspaceId = String(workspaceId || "").trim();
  return normalizedWorkspaceId ? `instore-demo-market-intro:${normalizedWorkspaceId}` : "";
}

function readMarketIntroAcknowledged(workspaceId = getCurrentWorkspace()?.id) {
  const storageKey = getMarketIntroStorageKey(workspaceId);
  if (!storageKey) {
    return false;
  }
  try {
    return window.sessionStorage.getItem(storageKey) === "1";
  } catch {
    return false;
  }
}

function syncMarketIntroAcknowledged(workspaceId = getCurrentWorkspace()?.id) {
  state.marketIntroAcknowledged = readMarketIntroAcknowledged(workspaceId);
  state.marketStoryStep = 0;
}

function setMarketIntroAcknowledged(acknowledged) {
  const storageKey = getMarketIntroStorageKey();
  state.marketIntroAcknowledged = Boolean(acknowledged);
  if (state.marketIntroAcknowledged) {
    state.marketStoryStep = 0;
  }
  if (storageKey) {
    try {
      if (state.marketIntroAcknowledged) {
        window.sessionStorage.setItem(storageKey, "1");
      } else {
        window.sessionStorage.removeItem(storageKey);
      }
    } catch {
      // Ignore storage failures and keep the in-memory state.
    }
  }
}

function isSupplyMarketIntroActive() {
  return !state.marketIntroAcknowledged;
}

function getActiveMarketStoryStep() {
  const maxIndex = Math.max(MARKET_STORY_STEPS.length - 1, 0);
  return Math.min(Math.max(Number(state.marketStoryStep || 0), 0), maxIndex);
}

function setMarketStoryOverlayVisible(visible) {
  if (!elements.marketStoryOverlay) {
    return;
  }
  elements.marketStoryOverlay.hidden = !visible;
  document.body.classList.toggle("has-market-story-overlay", visible);
}

function cancelMarketStoryAnimations() {
  for (const frameId of state.marketStoryAnimationFrameIds) {
    window.cancelAnimationFrame(frameId);
  }
  state.marketStoryAnimationFrameIds = [];
}

function formatAnimatedMetricValue(metric, value) {
  const decimals = Math.max(0, Number(metric?.decimals || 0));
  const numeric = Number.isFinite(Number(value)) ? Number(value) : 0;
  const formatted = numeric.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
  return `${metric?.prefix || ""}${formatted}${metric?.suffix || ""}`;
}

function animateMarketStoryMetrics() {
  cancelMarketStoryAnimations();
  if (!elements.marketStoryMetrics) {
    return;
  }

  for (const metricElement of qsa(".js-market-story-metric")) {
    const target = Number(metricElement.dataset.metricValue || 0);
    const decimals = Number(metricElement.dataset.metricDecimals || 0);
    const prefix = metricElement.dataset.metricPrefix || "";
    const suffix = metricElement.dataset.metricSuffix || "";
    const duration = 900;
    const startTime = performance.now();
    const metric = { decimals, prefix, suffix };

    const tick = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      const currentValue = target * eased;
      metricElement.textContent = formatAnimatedMetricValue(metric, progress >= 1 ? target : currentValue);
      if (progress < 1) {
        const frameId = window.requestAnimationFrame(tick);
        state.marketStoryAnimationFrameIds.push(frameId);
      }
    };

    metricElement.textContent = formatAnimatedMetricValue(metric, 0);
    const frameId = window.requestAnimationFrame(tick);
    state.marketStoryAnimationFrameIds.push(frameId);
  }
}

function buildMarketStoryMetricCardHtml(metric) {
  return `
    <article class="market-story-overlay__metric">
      <strong
        class="market-story-overlay__metric-value js-market-story-metric"
        data-metric-value="${escapeHtml(String(metric.value || 0))}"
        data-metric-decimals="${escapeHtml(String(metric.decimals || 0))}"
        data-metric-prefix="${escapeHtml(metric.prefix || "")}"
        data-metric-suffix="${escapeHtml(metric.suffix || "")}"
      ></strong>
      <span class="market-story-overlay__metric-label">${escapeHtml(metric.label || "")}</span>
      <p class="market-story-overlay__metric-detail">${escapeHtml(metric.detail || "")}</p>
    </article>
  `;
}

function renderMarketStoryMetricsContent(step) {
  const metricSections = Array.isArray(step?.metricSections) ? step.metricSections : [];
  if (metricSections.length > 0) {
    return metricSections
      .map(
        (section) => `
          <section class="market-story-overlay__metric-section">
            <div class="market-story-overlay__metric-section-head">
              ${section.kicker ? `<p class="market-story-overlay__metric-section-kicker">${escapeHtml(section.kicker)}</p>` : ""}
              ${section.title ? `<h3>${escapeHtml(section.title)}</h3>` : ""}
              ${section.note ? `<p class="market-story-overlay__metric-section-note">${escapeHtml(section.note)}</p>` : ""}
            </div>
            <div class="market-story-overlay__metric-grid">
              ${Array.isArray(section.metrics) ? section.metrics.map((metric) => buildMarketStoryMetricCardHtml(metric)).join("") : ""}
            </div>
          </section>
        `
      )
      .join("");
  }
  return (step.metrics || []).map((metric) => buildMarketStoryMetricCardHtml(metric)).join("");
}

function renderMarketStoryOverlay() {
  const active = isSupplyMarketIntroActive();
  setMarketStoryOverlayVisible(active);
  if (!active) {
    cancelMarketStoryAnimations();
    return;
  }

  const stepIndex = getActiveMarketStoryStep();
  const step = MARKET_STORY_STEPS[stepIndex] || MARKET_STORY_STEPS[0];
  if (!step) {
    return;
  }

  if (elements.marketStoryPanel) {
    elements.marketStoryPanel.classList.remove("is-loading");
    elements.marketStoryPanel.style.setProperty("--story-accent", step.accent || "#2f74ff");
  }
  if (elements.marketStoryStepLabel) {
    elements.marketStoryStepLabel.textContent = `Story ${stepIndex + 1} / ${MARKET_STORY_STEPS.length}`;
  }
  if (elements.marketStoryKicker) {
    elements.marketStoryKicker.textContent = step.kicker || "Opening story";
  }
  if (elements.marketStoryTitle) {
    elements.marketStoryTitle.textContent = step.title || "Why the in-store screens business case matters";
  }
  if (elements.marketStoryBody) {
    elements.marketStoryBody.textContent = step.body || "";
  }
  if (elements.marketStoryNote) {
    elements.marketStoryNote.textContent = step.note || "";
  }
  if (elements.marketStoryProgress) {
    elements.marketStoryProgress.innerHTML = MARKET_STORY_STEPS.map(
      (_entry, index) =>
        `<span class="market-story-overlay__dot${index === stepIndex ? " is-active" : ""}${index < stepIndex ? " is-complete" : ""}"></span>`
    ).join("");
  }
  if (elements.marketStoryMetrics) {
    elements.marketStoryMetrics.classList.toggle(
      "market-story-overlay__metrics--sections",
      Array.isArray(step.metricSections) && step.metricSections.length > 0
    );
    elements.marketStoryMetrics.innerHTML = renderMarketStoryMetricsContent(step);
  }
  if (elements.marketStorySources) {
    elements.marketStorySources.innerHTML = (step.sources || [])
      .map(
        (source) =>
          `<a href="${escapeHtml(source.href || "")}" target="_blank" rel="noreferrer">${escapeHtml(source.label || "")}</a>`
      )
      .join('<span aria-hidden="true"> | </span>');
  }
  if (elements.marketStoryBackBtn) {
    elements.marketStoryBackBtn.disabled = stepIndex === 0;
  }
  if (elements.marketStoryNextBtn) {
    elements.marketStoryNextBtn.textContent = step.nextLabel || "Next";
  }

  animateMarketStoryMetrics();
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
    : Object.keys(DEFAULT_SCREEN_TYPE_CPMS);
}

function getGoalRateCardDefaults() {
  const serverDefaults = state.options?.screenTypePricingDefaults || {};
  return Object.fromEntries(
    getGoalRateCardScreenTypes().map((screenType) => {
      const fallback = Number(DEFAULT_SCREEN_TYPE_CPMS[screenType] || 10);
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
        <span>CPM</span>
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
            step="1"
            inputmode="numeric"
            class="js-retailer-rate-input"
            data-screen-type="${escapeHtml(screenType)}"
            value="${escapeHtml(String(rateCard[screenType] || 0))}"
          >
        </span>
        <p class="field__meta">CPM</p>
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
  return `${formatMoney(min)}-${formatMoney(max)} CPM`;
}

function getDemoStoreCount() {
  const configuredStoreCount = Number(state.demo.storeCount || 0);
  if (configuredStoreCount > 0) {
    return configuredStoreCount;
  }
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

function readTextValue(value) {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
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

function getGoalPromptText() {
  return readTextValue(elements.goalPrompt?.value);
}

function isGoalPromptSelectionActive() {
  return state.goalSkuSelectionMode === "prompt" && Boolean(getGoalPromptText());
}

function setGoalSkuSelectionMode(mode, matchedTerms = []) {
  state.goalSkuSelectionMode = String(mode || "").trim();
  state.goalPromptMatchedTerms =
    state.goalSkuSelectionMode === "prompt"
      ? [...new Set((matchedTerms || []).map((term) => readTextValue(term).toLowerCase()).filter(Boolean))]
      : [];
}

function clearGoalPromptInferenceTimer() {
  if (state.goalPromptInferenceTimer) {
    window.clearTimeout(state.goalPromptInferenceTimer);
    state.goalPromptInferenceTimer = null;
  }
}

function exitPromptSelectionMode() {
  if (state.goalSkuSelectionMode === "prompt") {
    setGoalSkuSelectionMode(state.selectedGoalSkuIds.size > 0 ? "manual" : "");
  }
}

function resetGoalPromptInferenceState({ awaitingRun = false } = {}) {
  clearGoalPromptInferenceTimer();
  state.goalPromptInferenceRequestId += 1;
  state.goalPromptInferencePending = false;
  state.goalPromptInferenceReasoning = "";
  state.goalPromptInferenceTargetSource = "";
  state.goalPromptAwaitingRun = awaitingRun && Boolean(getGoalPromptText());
}

function markGoalPromptSelectionDirty() {
  exitPromptSelectionMode();
  resetGoalPromptInferenceState({ awaitingRun: Boolean(getGoalPromptText()) });
  renderGoalProducts();
}

function canRunGoalPromptSelection() {
  return (
    Boolean(getGoalPromptText()) &&
    Boolean(getSelectedGoalAdvertiserId()) &&
    !state.goalPromptInferencePending &&
    !hasPendingAction("goalPlan") &&
    !hasPendingAction("goalPlanApply")
  );
}

function tokenizeGoalMatch(value) {
  return readTextValue(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((entry) => entry.length > 2);
}

function normalizeGoalMatchToken(token) {
  const raw = readTextValue(token).toLowerCase();
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

function tokenizeGoalPromptMatch(value, dropStopwords = false) {
  const normalized = tokenizeGoalMatch(value).map((token) => normalizeGoalMatchToken(token)).filter(Boolean);
  const deduped = [...new Set(normalized)];
  return dropStopwords ? deduped.filter((token) => !GOAL_PROMPT_STOPWORDS.has(token)) : deduped;
}

function getGoalPromptCandidateProducts() {
  const advertiserId = getSelectedGoalAdvertiserId();
  const category = readTextValue(elements.goalProductCategory?.value).toLowerCase();
  return getBrandScopedProducts(advertiserId).filter(
    (product) => !category || readTextValue(product?.category).toLowerCase() === category
  );
}

function getGoalPromptScopedScreens() {
  const storeId = readTextValue(elements.goalStoreScope?.value);
  const pageId = readTextValue(elements.goalPageScope?.value);
  return (state.screens || []).filter((screen) => {
    if (storeId && readTextValue(screen?.storeId) !== storeId) {
      return false;
    }
    if (pageId && readTextValue(screen?.pageId) !== pageId) {
      return false;
    }
    return true;
  });
}

function buildGoalPromptScreenContext(screen) {
  const raw = [screen?.pageId, screen?.location, screen?.screenType].filter(Boolean).join(" ").toLowerCase();
  const tokens = new Set(tokenizeGoalPromptMatch(raw));
  const pageToken = normalizeGoalMatchToken(screen?.pageId);
  const locationToken = normalizeGoalMatchToken(screen?.location);
  if (pageToken) {
    tokens.add(pageToken);
  }
  if (locationToken) {
    tokens.add(locationToken);
  }
  return { raw, tokens };
}

function buildGoalPromptProductContext(product) {
  const category = normalizeGoalMatchToken(product?.category);
  const brand = readTextValue(product?.brand).toLowerCase();
  const sku = normalizeSku(product?.sku).toLowerCase();
  const nameTokens = tokenizeGoalPromptMatch(product?.name);
  const categoryTokens = tokenizeGoalPromptMatch(category);
  const brandTokens = tokenizeGoalPromptMatch(brand);
  const tagTokens = tokenizeGoalPromptMatch((Array.isArray(product?.tags) ? product.tags : []).join(" "));
  return {
    category,
    brand,
    sku,
    nameTokens,
    categoryTokens,
    brandTokens,
    tagTokens
  };
}

function uniqueGoalProductsBySku(products = []) {
  const seen = new Set();
  const output = [];
  for (const product of products) {
    const sku = normalizeSku(product?.sku);
    if (!sku || seen.has(sku)) {
      continue;
    }
    seen.add(sku);
    output.push(product);
  }
  return output;
}

function inferGoalSkuProductsFromPrompt(
  prompt,
  products = getGoalPromptCandidateProducts(),
  scopedScreens = getGoalPromptScopedScreens()
) {
  const promptText = readTextValue(prompt).toLowerCase();
  const promptTokens = new Set(tokenizeGoalPromptMatch(promptText, true));
  if (!promptText || promptTokens.size === 0 || !Array.isArray(products) || products.length === 0) {
    return { products: [], matchedTerms: [] };
  }

  const scopedTokens = new Set();
  for (const screen of scopedScreens) {
    const context = buildGoalPromptScreenContext(screen);
    for (const token of context.tokens) {
      scopedTokens.add(token);
    }
  }

  const scored = products.map((product) => {
    const context = buildGoalPromptProductContext(product);
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

    return {
      product,
      score: Number(score.toFixed(2)),
      tokenMatches: tagMatches + nameMatches + brandMatches,
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
  const inferredProducts = uniqueGoalProductsBySku(fallbackMatches.map((entry) => entry.product)).slice(
    0,
    GOAL_INFERRED_PRODUCT_LIMIT
  );
  const inferredSkuSet = new Set(inferredProducts.map((product) => normalizeSku(product.sku)));
  const matchedTerms = [
    ...new Set(
      fallbackMatches
        .filter((entry) => inferredSkuSet.has(normalizeSku(entry.product.sku)))
        .flatMap((entry) => entry.matchedTerms)
    )
  ].slice(0, 10);

  return { products: inferredProducts, matchedTerms };
}

function buildGoalPromptInferencePayload() {
  const advertiserId = getSelectedGoalAdvertiserId();
  const account = getGoalAccountByAdvertiserId(advertiserId);
  return {
    prompt: getGoalPromptText(),
    advertiserId,
    brand: account?.brand || "",
    assortmentCategory: String(elements.goalProductCategory?.value || "").trim().toLowerCase(),
    objective: String(elements.goalObjective?.value || "").trim(),
    aggressiveness: String(elements.goalAggressiveness?.value || "").trim(),
    storeId: String(elements.goalStoreScope?.value || "").trim(),
    pageId: String(elements.goalPageScope?.value || "").trim()
  };
}

async function applyGoalPromptSelection() {
  if (!canRunGoalPromptSelection()) {
    showStatus("Add a brief and choose an account before asking AI to choose SKU's.", true);
    return;
  }

  const payload = buildGoalPromptInferencePayload();
  const requestId = state.goalPromptInferenceRequestId + 1;
  clearGoalPromptInferenceTimer();
  state.goalPromptInferenceRequestId = requestId;
  state.goalPromptInferencePending = true;
  state.goalPromptInferenceReasoning = "";
  state.goalPromptInferenceTargetSource = "";
  state.goalPromptAwaitingRun = false;
  renderGoalProducts();

  try {
    const response = await requestJson("/api/goal-skus/infer", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    if (requestId !== state.goalPromptInferenceRequestId) {
      return;
    }
    state.goalPromptInferencePending = false;
    state.goalPromptInferenceProvider = readTextValue(
      response?.inferenceProvider || state.options?.goalPromptInferenceProvider || ""
    );
    state.goalPromptInferenceModel = readTextValue(
      response?.inferenceModel || state.options?.goalPromptInferenceModel || ""
    );
    state.goalPromptInferenceReasoning = readTextValue(response?.inferenceReasoning || "");
    state.goalPromptInferenceTargetSource = readTextValue(response?.targetSource || "");
    state.goalPromptAwaitingRun = false;
    setGoalSkuSelectionMode("prompt", response?.matchedTerms || []);
    if (String(response?.targetSource || "").startsWith("prompt")) {
      setSelectedGoalSkus(response?.targetSkuIds || []);
    } else {
      setSelectedGoalSkus([]);
    }
    if (state.selectedGoalSkuIds.size > 0) {
      showStatus(`AI chose ${state.selectedGoalSkuIds.size} priority SKU(s) from the brief.`);
    } else {
      showStatus("AI reviewed the brief but did not find a strong SKU shortlist yet.");
    }
  } catch (error) {
    if (requestId !== state.goalPromptInferenceRequestId) {
      return;
    }
    state.goalPromptInferencePending = false;
    state.goalPromptInferenceTargetSource = "prompt";
    state.goalPromptInferenceReasoning = "";
    state.goalPromptAwaitingRun = false;
    const inferred = inferGoalSkuProductsFromPrompt(payload.prompt);
    setGoalSkuSelectionMode("prompt", inferred.matchedTerms);
    setSelectedGoalSkus(inferred.products.map((product) => product.sku));
    showStatus("AI brief fell back to local matching because the server inference request failed.", true);
    // Keep working locally if the server-side inference path is unavailable.
    // eslint-disable-next-line no-console
    console.warn(error);
  }
}

function getGoalPromptSelectionNote() {
  const prompt = getGoalPromptText();
  const matchedTerms = state.goalPromptMatchedTerms.slice(0, 4);
  const reasoning = readTextValue(state.goalPromptInferenceReasoning);
  if (!prompt) {
    return "";
  }
  if (state.goalPromptInferencePending) {
    return "AI is choosing the shortlist...";
  }
  if (state.goalPromptAwaitingRun) {
    return "Brief ready. Click Let AI choose SKU's to refresh the shortlist.";
  }
  if (isGoalPromptSelectionActive()) {
    if (state.selectedGoalSkuIds.size > 0) {
      if (reasoning) {
        return `Why these SKUs: ${reasoning}`;
      }
      return matchedTerms.length > 0
        ? `AI brief matched ${matchedTerms.join(", ")}.`
        : `AI brief selected ${state.selectedGoalSkuIds.size} SKU(s).`;
    }
    if (reasoning) {
      return reasoning;
    }
    return "AI brief is active, but no matching SKUs were found yet.";
  }
  if (state.selectedGoalSkuIds.size > 0) {
    return prompt
      ? "Manual SKU picks are active. Click Let AI choose SKU's if you want to refresh them from the brief."
      : "Manual SKU picks are active.";
  }
  return "Pick SKUs below, or use the AI brief button to shortlist them.";
}

function renderGoalPromptAssistant() {
  const prompt = getGoalPromptText();
  const hasAccount = Boolean(getSelectedGoalAdvertiserId());
  const hasSelection = state.selectedGoalSkuIds.size > 0;
  const loading = state.goalPromptInferencePending;
  const runDisabled = !prompt || !hasAccount || loading || hasPendingAction("goalPlan") || hasPendingAction("goalPlanApply");
  if (elements.goalPromptRunBtn) {
    elements.goalPromptRunBtn.disabled = runDisabled;
    elements.goalPromptRunBtn.textContent = loading ? "AI choosing SKU's..." : "Let AI choose SKU's";
  }
  if (!elements.goalPromptAiStatus) {
    return;
  }
  const renderStatus = (options) =>
    renderAiAssistStatus(elements.goalPromptAiStatus, {
      ...options,
      extraClasses: ["goal-prompt-ai-status"]
    });

  if (!prompt) {
    renderStatus({
      kicker: "AI Shortlist",
      title: "Optional shortlist help",
      body: "Write a brief, then click Let AI choose SKU's to build a priority product shortlist.",
      detail: "AI reads your brief, account, assortment filters, and placement scope.",
      variant: "ready",
      compact: true
    });
    return;
  }

  if (!hasAccount) {
    renderStatus({
      kicker: "AI Shortlist",
      title: "Choose an account first",
      body: "The brief is ready, but AI needs a brand account before it can choose the right SKU's.",
      detail: "Step 1 sets the assortment AI is allowed to search.",
      variant: "ready",
      compact: true
    });
    return;
  }

  if (loading) {
    renderStatus({
      kicker: "AI Working",
      title: "Choosing the best SKU shortlist",
      body: "Scanning the brief, assortment signals, and placement scope for the strongest in-store fit.",
      detail: "This updates the shortlist without changing your manual filters.",
      variant: "loading",
      compact: true
    });
    return;
  }

  if (state.goalPromptAwaitingRun) {
    renderStatus({
      kicker: "Brief Ready",
      title: "AI is standing by",
      body: "Click Let AI choose SKU's when you want this brief to replace or refresh the current shortlist.",
      detail: hasSelection ? "Your current SKU picks stay in place until you ask AI to update them." : "No AI shortlist has been generated for this brief yet.",
      variant: "ready",
      compact: true
    });
    return;
  }

  if (isGoalPromptSelectionActive()) {
    renderStatus({
      kicker: "AI Shortlist Ready",
      title: hasSelection ? `AI picked ${state.selectedGoalSkuIds.size} SKU(s)` : "AI reviewed the brief",
      body:
        readTextValue(state.goalPromptInferenceReasoning) ||
        (hasSelection
          ? "The shortlist now reflects the current brief and assortment scope."
          : "The brief is active, but AI did not find a strong shortlist yet."),
      detail: getGoalPromptSelectionNote(),
      variant: "success",
      compact: true
    });
    return;
  }

  renderStatus({
    kicker: "AI Shortlist",
    title: hasSelection ? "Current picks are manual" : "Brief ready for AI",
    body: hasSelection
      ? "The current shortlist is manual. Click Let AI choose SKU's if you want the brief to replace it."
      : "Click Let AI choose SKU's to build a shortlist from this brief.",
    detail: getGoalPromptSelectionNote(),
    variant: "ready",
    compact: true
  });
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

function getProductBySku(sku, products = state.productFeed || []) {
  const normalizedSku = normalizeSku(sku);
  if (!normalizedSku) {
    return null;
  }
  return (products || []).find((entry) => normalizeSku(entry?.sku || entry?.ProductId || entry?.productId) === normalizedSku) || null;
}

function getProductDisplayName(product = {}) {
  return readTextValue(product?.name || product?.ProductName || product?.productName);
}

function getProductDisplayBrand(product = {}) {
  return readTextValue(product?.brand);
}

function getProductDisplayCategory(product = {}) {
  return readTextValue(product?.category);
}

function getProductDisplayImage(product = {}) {
  return readTextValue(product?.image || product?.Image);
}

function buildProductThumbMarkup(product = {}, { className = "product-thumb", alt = "" } = {}) {
  const label =
    readTextValue(alt) ||
    getProductDisplayName(product) ||
    normalizeSku(product?.sku || product?.ProductId || product?.productId) ||
    "Product";
  const image = getProductDisplayImage(product);
  const fallbackLabel = normalizeSku(product?.sku || product?.ProductId || product?.productId) || label;
  const fallbackText = fallbackLabel.slice(0, 4) || "SKU";

  if (image) {
    return `<span class="${escapeHtml(className)}"><img src="${escapeHtml(image)}" alt="${escapeHtml(label)}" loading="lazy"></span>`;
  }

  return `<span class="${escapeHtml(`${className} product-thumb--fallback`)}" aria-hidden="true">${escapeHtml(
    fallbackText
  )}</span>`;
}

function getProductsForSkuList(skus = [], fallbackProducts = []) {
  const fallbackBySku = new Map(
    uniqueGoalProductsBySku(fallbackProducts)
      .map((product) => [normalizeSku(product?.sku || product?.ProductId || product?.productId), product])
      .filter(([sku]) => Boolean(sku))
  );

  return uniqueGoalProductsBySku(
    (Array.isArray(skus) ? skus : [])
      .map((sku) => fallbackBySku.get(normalizeSku(sku)) || getProductBySku(sku))
      .filter(Boolean)
  );
}

function buildProductThumbStripMarkup(products = [], { className = "product-thumb product-thumb--xs", maxItems = 3 } = {}) {
  const uniqueProducts = uniqueGoalProductsBySku(products);
  if (uniqueProducts.length === 0) {
    return "";
  }

  const visibleProducts = uniqueProducts.slice(0, maxItems);
  const overflow = uniqueProducts.length - visibleProducts.length;

  return `<div class="goal-product-strip">
    ${visibleProducts
      .map((product) => {
        const label =
          getProductDisplayName(product) ||
          normalizeSku(product?.sku || product?.ProductId || product?.productId) ||
          "Priority SKU";
        return `<span class="goal-product-strip__item" title="${escapeHtml(label)}">${buildProductThumbMarkup(product, {
          className,
          alt: label
        })}</span>`;
      })
      .join("")}
    ${overflow > 0 ? `<span class="goal-product-strip__more">+${escapeHtml(String(overflow))}</span>` : ""}
  </div>`;
}

function buildGoalLiveProductMarkup(product = {}) {
  const name =
    getProductDisplayName(product) ||
    normalizeSku(product?.sku || product?.ProductId || product?.productId) ||
    "Featured product";
  const sku = normalizeSku(product?.sku || product?.ProductId || product?.productId);
  const price = formatPreviewPrice(readTextValue(product?.price || product?.Price));
  const comparePrice = formatPreviewPrice(readTextValue(product?.comparePrice || product?.ComparePrice));
  const priceLine =
    price || comparePrice
      ? [price, comparePrice ? `Was ${comparePrice}` : ""].filter(Boolean).join(" | ")
      : "";

  return `<div class="goal-live-product">
    ${buildProductThumbMarkup(product, { className: "product-thumb product-thumb--live", alt: name })}
    <div class="goal-live-product__body">
      <strong>${escapeHtml(name)}</strong>
      ${
        sku || getProductDisplayCategory(product)
          ? `<span class="goal-live-product__meta">${escapeHtml(
              [sku, getProductDisplayCategory(product) ? titleCase(getProductDisplayCategory(product)) : ""]
                .filter(Boolean)
                .join(" | ")
            )}</span>`
          : ""
      }
      ${priceLine ? `<span class="goal-live-product__price">${escapeHtml(priceLine)}</span>` : ""}
    </div>
  </div>`;
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

function parseJsonObjectValue(value) {
  if (!value) {
    return {};
  }
  if (value && typeof value === "object") {
    return value;
  }
  const raw = readTextValue(value);
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function findPageRecord(pageId) {
  const normalizedId = readTextValue(pageId).toLowerCase();
  if (!normalizedId) {
    return null;
  }
  return (state.pages || []).find((page) => readTextValue(page.pageId).toLowerCase() === normalizedId) || null;
}

function findScreenRecord(screenId) {
  const normalizedId = readTextValue(screenId).toLowerCase();
  if (!normalizedId) {
    return null;
  }
  return (state.screens || []).find((screen) => readTextValue(screen.screenId).toLowerCase() === normalizedId) || null;
}

function buildPreviewRailKey(screenIds) {
  const liveScreens = Array.isArray(state.activeGoalPlan?.liveScreens) ? state.activeGoalPlan.liveScreens : [];
  const planKey = [state.activeGoalPlan?.planId || "", state.activeGoalPlan?.updatedAt || "", state.activeGoalPlan?.appliedAt || ""].join(":");
  return screenIds
    .map((screenId) => {
      const inventoryScreen = findScreenRecord(screenId);
      const liveScreen = liveScreens.find((screen) => screen.screenId === screenId);
      return [
        screenId,
        inventoryScreen?.updatedAt || "",
        inventoryScreen?.templateId || "",
        liveScreen?.activeLineItemId || "",
        planKey
      ].join(":");
    })
    .join("|");
}

function formatPreviewPrice(value) {
  const raw = readTextValue(value);
  if (!raw) {
    return "";
  }
  const numeric = Number(raw.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) {
    return raw;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: Number.isInteger(numeric) ? 0 : 2,
    maximumFractionDigits: 2
  }).format(numeric);
}

function parsePreviewScreenSize(value, screenType = "") {
  const raw = readTextValue(value);
  const matched = raw.match(/(\d{3,5})\D+(\d{3,5})/);
  if (matched) {
    const width = Number(matched[1]);
    const height = Number(matched[2]);
    if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
      return {
        width,
        height,
        label: `${width}x${height}`,
        orientation: width >= height ? "landscape" : "portrait",
        aspectCss: `${width} / ${height}`
      };
    }
  }

  const normalizedType = readTextValue(screenType).toLowerCase();
  if (normalizedType === "kiosk" || normalizedType.includes("vertical") || normalizedType.includes("endcap")) {
    return {
      width: 1080,
      height: 1920,
      label: "1080x1920",
      orientation: "portrait",
      aspectCss: "1080 / 1920"
    };
  }
  if (normalizedType.includes("shelf")) {
    return {
      width: 1280,
      height: 720,
      label: "1280x720",
      orientation: "landscape",
      aspectCss: "1280 / 720"
    };
  }
  return {
    width: 1920,
    height: 1080,
    label: "1920x1080",
    orientation: "landscape",
    aspectCss: "1920 / 1080"
  };
}

function resolvePreviewSceneForSnapshot(snapshot = {}) {
  const location = readTextValue(snapshot.location).toLowerCase();
  const screenType = readTextValue(snapshot.screenType).toLowerCase();

  if (screenType === "kiosk" || location.includes("checkout")) {
    return {
      sceneId: "checkout",
      deviceFamily: "kiosk",
      placementLabel: "Checkout kiosk"
    };
  }
  if (screenType.includes("menu") || location.includes("foodcourt")) {
    return {
      sceneId: "foodcourt",
      deviceFamily: "menu-board",
      placementLabel: "Menu board"
    };
  }
  if (screenType.includes("shelf") || screenType.includes("endcap") || location.includes("aisle")) {
    return {
      sceneId: "aisle",
      deviceFamily: "shelf-edge",
      placementLabel: "Shelf-edge display"
    };
  }
  if (screenType.includes("vertical") || location.includes("electronics") || location.includes("entrance")) {
    return {
      sceneId: location.includes("entrance") ? "entrance" : "electronics",
      deviceFamily: "portrait-wall",
      placementLabel: location.includes("entrance") ? "Entrance portrait screen" : "Category portrait screen"
    };
  }
  return {
    sceneId: location.includes("entrance") ? "entrance" : "sales-floor",
    deviceFamily: "landscape-wall",
    placementLabel: location.includes("entrance") ? "Entrance wall screen" : "Wall-mounted screen"
  };
}

function buildPreviewRailFrameMarkup(bodyMarkup) {
  const brandContext = getGoalPlanBrandContext();
  return `
    <p class="preview-pane__eyebrow">${escapeHtml(brandContext.brand ? `${brandContext.brand} live preview` : "Live campaign preview")}</p>
    <h4>${escapeHtml(brandContext.brand ? `${brandContext.brand} creative in market` : "Creative in market")}</h4>
    <p id="monitoringNarrative">${escapeHtml(
      brandContext.brand
        ? `${brandContext.brand} creative is staged below in device-aware retail mockups using the active screen payloads.`
        : "These previews use the same live player payloads, but keep each creative inside a device-aware retail mockup instead of a browser-sized frame."
    )}</p>
    ${bodyMarkup}
  `;
}

function buildMonitoringPreviewCardMarkup(snapshot) {
  const sharedPreviewUrl = buildSharedPreviewUrl(snapshot.screenId);
  const debugPreviewUrl = buildDebugScreenUrl(snapshot.screenId);
  const metaParts = [snapshot.templateName, snapshot.location && titleCase(snapshot.location), snapshot.screenType].filter(Boolean);
  const size = parsePreviewScreenSize(snapshot.screenSize, snapshot.screenType);
  const scene = resolvePreviewSceneForSnapshot(snapshot);
  const stateClassNames = [snapshot.loading ? "is-loading" : "", snapshot.error ? "is-error" : ""].filter(Boolean).join(" ");
  const priceMarkup =
    snapshot.price || snapshot.comparePrice
      ? `<div class="monitoring-preview-card__price">
          <strong>${escapeHtml(snapshot.price || "")}</strong>
          ${snapshot.comparePrice ? `<del>${escapeHtml(snapshot.comparePrice)}</del>` : ""}
        </div>`
      : "";
  const mediaMarkup = snapshot.loading
    ? '<div class="monitoring-preview-card__media-fallback">Loading preview...</div>'
    : snapshot.image
      ? `<img src="${escapeHtml(snapshot.image)}" alt="${escapeHtml(snapshot.productName || snapshot.screenId)}" loading="lazy">`
      : '<div class="monitoring-preview-card__media-fallback">Preview unavailable</div>';
  const title = snapshot.loading
    ? "Loading preview..."
    : snapshot.error
      ? "Preview unavailable"
      : snapshot.productName || "In-store creative";
  const summary = snapshot.loading
    ? "Fetching the latest creative snapshot for this screen."
    : snapshot.error
      ? snapshot.error
      : snapshot.summary || snapshot.promotion || "Live creative snapshot";
  const contextLabel = [scene.placementLabel, size.label].filter(Boolean).join(" | ");
  const actionsMarkup = snapshot.loading
    ? ""
    : `<div class="monitoring-preview-card__actions">
        <a href="${escapeHtml(sharedPreviewUrl)}" target="_blank" rel="noreferrer">Immersive preview</a>
        <a href="${escapeHtml(debugPreviewUrl)}" target="_blank" rel="noreferrer">Debug view</a>
      </div>`;

  return `
    <article
      class="monitoring-preview-card ${escapeHtml(stateClassNames)}"
      data-device-family="${escapeHtml(scene.deviceFamily)}"
      data-scene="${escapeHtml(scene.sceneId)}"
      style="--monitor-preview-aspect: ${escapeHtml(size.aspectCss)};"
    >
      <div class="monitoring-preview-card__media">
        <span class="monitoring-preview-card__fixture monitoring-preview-card__fixture--header"></span>
        <span class="monitoring-preview-card__fixture monitoring-preview-card__fixture--counter"></span>
        <span class="monitoring-preview-card__fixture monitoring-preview-card__fixture--shelf"></span>
        <div class="monitoring-preview-card__device">
          <div class="monitoring-preview-card__device-bezel">
            <div class="monitoring-preview-card__device-screen">
              ${mediaMarkup}
              ${
                snapshot.loading
                  ? ""
                  : `<span class="monitoring-preview-card__badge">${escapeHtml(snapshot.badge || snapshot.templateName || "Live creative")}</span>`
              }
            </div>
          </div>
        </div>
      </div>
      <div class="monitoring-preview-card__body">
        <p class="monitoring-preview-card__screen">${escapeHtml(snapshot.screenId)}</p>
        <h5>${escapeHtml(title)}</h5>
        <p class="monitoring-preview-card__context">${escapeHtml(contextLabel)}</p>
        ${metaParts.length > 0 ? `<p class="monitoring-preview-card__meta">${escapeHtml(metaParts.join(" | "))}</p>` : ""}
        ${priceMarkup}
        <p class="monitoring-preview-card__summary">${escapeHtml(summary)}</p>
        ${actionsMarkup}
      </div>
    </article>
  `;
}

function renderPreviewRailCards(cards) {
  if (!elements.monitorPreviewRail) {
    return;
  }
  elements.monitorPreviewRail.innerHTML = buildPreviewRailFrameMarkup(`
    <div class="monitoring-preview-grid">
      ${cards.map((card) => buildMonitoringPreviewCardMarkup(card)).join("")}
    </div>
  `);
  elements.monitoringNarrative = qs("#monitoringNarrative");
  updateMonitoringNarrative();
}

async function loadPreviewRailSnapshots(screenIds, previewKey, requestId) {
  const snapshots = await Promise.all(
    screenIds.map(async (screenId) => {
      try {
        const payload = await requestJson(`/api/screen-ad?screenId=${encodeURIComponent(screenId)}`);
        const settings = payload?.settings && typeof payload.settings === "object" ? payload.settings : {};
        const product = Array.isArray(payload?.products) ? payload.products[0] || {} : {};
        const attributes = parseJsonObjectValue(product.RenderingAttributes);
        const templateId = readTextValue(settings.templateId);
        const templateName = readTextValue(settings.templateName) || getTemplateById(templateId)?.name || templateId || "Template";

        return {
          screenId,
          templateId,
          templateName,
          location: readTextValue(settings.location),
          screenType: readTextValue(settings.screenType),
          screenSize: readTextValue(settings.screenSize),
          productName: readTextValue(product.ProductName) || templateName,
          image: readTextValue(product.Image),
          badge: readTextValue(attributes.badge),
          promotion: readTextValue(attributes.promotion),
          price: formatPreviewPrice(product.Price),
          comparePrice: formatPreviewPrice(product.ComparePrice),
          summary:
            readTextValue(attributes.subcopy) ||
            readTextValue(attributes.promotion) ||
            readTextValue(settings.resolvedBy)
        };
      } catch (error) {
        return {
          screenId,
          error: readTextValue(error?.message) || "The live snapshot could not be loaded."
        };
      }
    })
  );

  if (state.previewRailKey !== previewKey || state.previewRailRequestId !== requestId) {
    return;
  }

  renderPreviewRailCards(snapshots);
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
    case "prompt-ai":
      return "AI brief-selected SKU shortlist";
    case "prompt":
      return "AI brief-selected SKU shortlist";
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
    error.code = String(payload.code || "").trim();
    error.workspaceSelectionRequired = Boolean(payload.workspaceSelectionRequired);
    if (error.workspaceSelectionRequired && !workspaceRecoveryScheduled) {
      workspaceRecoveryScheduled = true;
      showToast(error.message, true);
      showStatus(error.message, true);
      window.setTimeout(() => {
        window.location.reload();
      }, 240);
    }
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

function getCurrentWorkspace() {
  return state.workspaceStatus?.currentWorkspace || null;
}

function formatLeaseRemaining(remainingMs) {
  const totalMinutes = Math.max(0, Math.ceil(Number(remainingMs || 0) / 60000));
  if (totalMinutes < 1) {
    return "less than 1 min left";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes} min left`;
  }
  if (minutes <= 0) {
    return `${hours}h left`;
  }
  return `${hours}h ${minutes}m left`;
}

function stopWorkspaceOverlayPolling() {
  if (state.workspaceOverlayPollId) {
    window.clearInterval(state.workspaceOverlayPollId);
    state.workspaceOverlayPollId = null;
  }
}

function beginWorkspaceOverlayPolling() {
  stopWorkspaceOverlayPolling();
  state.workspaceOverlayPollId = window.setInterval(() => {
    refreshWorkspaceStatus({ silent: true }).catch(() => undefined);
  }, 15000);
}

function setWorkspaceOverlayVisible(visible) {
  if (!elements.workspaceOverlay) {
    return;
  }
  elements.workspaceOverlay.hidden = !visible;
  document.body.classList.toggle("has-workspace-overlay", visible);
  if (visible) {
    beginWorkspaceOverlayPolling();
  } else {
    stopWorkspaceOverlayPolling();
  }
}

function updateWorkspaceBadge() {
  const current = getCurrentWorkspace();
  if (!elements.workspaceBadge || !elements.workspaceBadgeName || !elements.workspaceBadgeStatus || !elements.switchWorkspaceBtn) {
    return;
  }
  const hasCurrent = Boolean(current);
  elements.workspaceBadge.classList.toggle("is-hidden", !hasCurrent);
  elements.switchWorkspaceBtn.classList.toggle("is-hidden", !hasCurrent);
  if (!hasCurrent) {
    return;
  }
  elements.workspaceBadgeName.textContent = current.label || "Workspace";
  elements.workspaceBadgeStatus.textContent = formatLeaseRemaining(current.remainingMs || 0);
}

function buildWorkspaceCardMeta(workspace) {
  const counts = workspace?.counts || {};
  if (!workspace?.hasSavedJourney) {
    return "Fresh workspace";
  }
  return `${Number(counts.screens || 0)} screens | ${Number(counts.agentRuns || 0)} plans`;
}

function renderWorkspaceSelector(message = "") {
  if (!elements.workspaceOverlay || !elements.workspaceGrid || !elements.workspaceOverlayMessage) {
    return;
  }
  const pendingWorkspaceId = getPendingActionValue("workspaceClaim");
  const workspaceClaimPending = hasPendingAction("workspaceClaim");
  const workspaces = Array.isArray(state.workspaceStatus?.workspaces) ? state.workspaceStatus.workspaces : [];
  elements.workspaceOverlayMessage.textContent = String(message || "").trim();
  elements.workspaceGrid.innerHTML = workspaces
    .map((workspace) => {
      const inUseByOther = workspace.status === "claimed";
      const claimingThisWorkspace = pendingWorkspaceId === String(workspace.id || "").trim();
      const actionLabel = inUseByOther
        ? `In use | ${formatLeaseRemaining(workspace.remainingMs || 0)}`
        : claimingThisWorkspace
          ? "Claiming workspace..."
        : workspace.status === "claimed-by-you"
          ? "Resume workspace"
          : "Open workspace";
      const availabilityLabel =
        workspace.status === "claimed"
          ? "Locked"
          : workspace.status === "claimed-by-you"
            ? "Yours"
            : "Available";
      return `
        <button
          type="button"
          class="workspace-card"
          data-workspace-id="${escapeHtml(workspace.id)}"
          data-status="${escapeHtml(workspace.status || "available")}"
          style="--workspace-accent: ${escapeHtml(workspace.accent || "#4fa7ff")};"
          ${inUseByOther || workspaceClaimPending ? "disabled" : ""}
        >
          <span class="workspace-card__avatar">${escapeHtml(workspace.initials || "WS")}</span>
          <span class="workspace-card__header">
            <span class="workspace-card__title">${escapeHtml(workspace.label || workspace.id || "Workspace")}</span>
            <span class="workspace-card__status">${escapeHtml(availabilityLabel)}</span>
          </span>
          <span class="workspace-card__meta">${escapeHtml(buildWorkspaceCardMeta(workspace))}</span>
          <span class="workspace-card__meta">${escapeHtml(
            workspace.status === "claimed" || workspace.status === "claimed-by-you"
              ? formatLeaseRemaining(workspace.remainingMs || 0)
              : "2 hour lease"
          )}</span>
          <span class="workspace-card__action">${escapeHtml(actionLabel)}</span>
        </button>
      `;
    })
    .join("");
}

async function refreshWorkspaceStatus({ silent = false } = {}) {
  const payload = await requestJson("/api/workspaces");
  state.workspaceStatus = payload;
  syncMarketIntroAcknowledged();
  updateWorkspaceBadge();
  if (!getCurrentWorkspace() && !elements.workspaceOverlay?.hidden) {
    renderWorkspaceSelector(silent ? elements.workspaceOverlayMessage?.textContent || "" : "");
  }
  return payload;
}

async function claimWorkspace(workspaceId) {
  if (!workspaceId) {
    return;
  }
  return runPendingAction(`workspaceClaim:${workspaceId}`, async () => {
    try {
      renderWorkspaceSelector("Claiming workspace...");
      state.workspaceStatus = await requestJson("/api/workspaces/claim", {
        method: "POST",
        body: JSON.stringify({ workspaceId })
      });
      window.location.reload();
    } catch (error) {
      renderWorkspaceSelector(error.message || "Unable to claim workspace.");
      throw error;
    }
  }, { lockKey: "workspaceClaim" });
}

async function releaseWorkspace() {
  return runPendingAction("workspaceRelease", async () => {
    await requestJson("/api/workspaces/release", {
      method: "POST"
    });
    window.location.reload();
  });
}

async function ensureWorkspaceClaim() {
  await refreshWorkspaceStatus();
  if (getCurrentWorkspace()) {
    setWorkspaceOverlayVisible(false);
    return;
  }
  renderWorkspaceSelector();
  setWorkspaceOverlayVisible(true);
  showStatus("Select an avatar to open an isolated demo workspace.");
  await new Promise(() => undefined);
}

function normalizeStage(rawStage, fallbackStage) {
  const stage = rawStage && typeof rawStage === "object" ? rawStage : {};
  const screenIds = Array.isArray(stage.screenIds) ? stage.screenIds : [];
  const configuredScreenIds = Array.isArray(stage.configuredScreenIds) ? stage.configuredScreenIds : [];
  const configuredScreenCount = Number(stage.configuredScreenCount || configuredScreenIds.length || 0);
  const missingScreenIds = Array.isArray(stage.missingScreenIds)
    ? stage.missingScreenIds
    : screenIds.filter((screenId) => !configuredScreenIds.includes(screenId));
  const missingScreenCount = Number(stage.missingScreenCount || missingScreenIds.length || 0);
  const quickLinks = Array.isArray(stage.quickLinks) ? stage.quickLinks : [];

  return {
    ...fallbackStage,
    ...stage,
    screenIds,
    configuredScreenIds,
    configuredScreenCount,
    missingScreenIds,
    missingScreenCount,
    quickLinks,
    screenCount: Number(stage.screenCount || screenIds.length || fallbackStage.screenCount || 0),
    configured: Boolean(stage.configured ?? (Number(stage.screenCount || 0) > 0 && configuredScreenCount === Number(stage.screenCount || 0))),
    completed: Boolean(stage.completed ?? (Number(stage.screenCount || 0) > 0 && configuredScreenCount === Number(stage.screenCount || 0)))
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
    prompt: buildDefaultGoalPrompt(source.storeId || DEFAULT_DEMO_CONFIG.storeId),
    ...(buyingStage?.goalDefaults || {}),
    ...(source.goalDefaults || {})
  };

  return {
    presetId: String(source.presetId || DEFAULT_DEMO_CONFIG.presetId),
    storeId: String(source.storeId || DEFAULT_DEMO_CONFIG.storeId),
    storeCount: Math.max(0, Number(source.storeCount || source.storeIds?.length || DEFAULT_DEMO_CONFIG.storeCount || 0)),
    storeIds: Array.isArray(source.storeIds) ? source.storeIds.map((storeId) => String(storeId || "").trim()).filter(Boolean) : [],
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
  const leadStoreId = state.demo.storeId || DEFAULT_DEMO_CONFIG.storeId;
  return {
    page: {
      ...MANUAL_SUPPLY.page,
      pageType: defaultValue(state.options?.pageTypes || [], MANUAL_SUPPLY.page.pageType),
      environment: defaultValue(state.options?.environments || [], MANUAL_SUPPLY.page.environment)
    },
    screen: {
      ...MANUAL_SUPPLY.screen,
      screenId: buildDemoScreenId(leadStoreId, DEMO_SUPPLY_STARTER_SUFFIX),
      storeId: leadStoreId,
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

function getSupplyProgress() {
  const supplyStage = getSupplyStage();
  const actualConfigured = Number(supplyStage.configuredScreenCount || supplyStage.configuredScreenIds?.length || 0);
  const total = Number(supplyStage.screenCount || supplyStage.screenIds?.length || 0);
  const presetSimulated = Boolean(state.presetSimulatedInSession && total > 0);
  const configured = presetSimulated ? total : actualConfigured;
  return {
    actualConfigured,
    configured,
    total,
    remaining: Math.max(total - configured, 0),
    presetSimulated
  };
}

function shouldSimulateLargePresetLoad() {
  return getSupplyProgress().total > LARGE_DEMO_PRESET_SCREEN_THRESHOLD;
}

function isPresetSimulationActive() {
  return getSupplyProgress().presetSimulated;
}

function isDemoPresetMaterialized() {
  const { configured, total } = getSupplyProgress();
  return Boolean(total > 0 && configured >= total);
}

function isSupplyPresetReady() {
  return isDemoPresetMaterialized();
}

function isSupplyHandoffPending() {
  return Boolean(isSupplyPresetReady() && !state.supplyHandoffAcknowledged && !state.activeGoalPlan);
}

function isBuyingStageUnlocked() {
  return Boolean(state.activeGoalPlan) || Boolean(isSupplyPresetReady() && state.supplyHandoffAcknowledged);
}

function canOpenMonitoringStage() {
  return state.activeGoalPlan?.status === "applied";
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
  const screenId = typeof screenRef === "string" ? screenRef : readTextValue(screenRef?.screenId);
  const resolverId = getScreenResolverId(screenRef);
  if (resolverId) {
    params.set("deviceId", resolverId);
  } else if (screenId) {
    params.set("screenId", screenId);
  }
  if (rmjs) {
    params.set("rmjs", rmjs);
  }
  params.set("preview", "showcase");
  const query = params.toString();
  return `${SHARED_PLAYER_URL}${query ? `?${query}` : ""}`;
}

function getPreferredPreviewScreenIds() {
  const liveIds = (state.activeGoalPlan?.liveScreens || []).map((screen) => screen.screenId).filter(Boolean);
  const presetMaterialized = isDemoPresetMaterialized();
  const configuredDemoIds = presetMaterialized
    ? (state.demo.quickLinks || [])
        .filter((entry) => entry?.configured)
        .map((entry) => entry.screenId)
        .filter(Boolean)
    : isManualSupplyConfirmed()
      ? [getManualSupplyConfig().screen.screenId]
      : [];
  const fallbackIds =
    presetMaterialized || liveIds.length > 0
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
    cpm: Math.max(0, Math.round(Number(entry?.cpm || 0))),
    estimatedDailyImpressions: Math.max(0, Math.round(Number(entry?.estimatedDailyImpressions || 0))),
    estimatedImpressions: Math.max(0, Math.round(Number(entry?.estimatedImpressions || 0))),
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
    const budgetScenario = buildGoalBudgetScenario(plan);
    return [
      { label: "Scope", value: getGoalScopeLabel(plan?.goal || draftGoal) },
      { label: "SKUs", value: String((plan?.goal?.targetSkuIds || [...state.selectedGoalSkuIds]).length || 0) },
      {
        label: plan ? "Budget" : "Compatible screens",
        value: plan ? formatMoney(budgetScenario.selectedSpend || budgetScenario.maxSpend || 0) : String(countPlannedScreens(plan) || 0)
      }
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

function readPresenterStringList(values = [], fallback = []) {
  const source = Array.isArray(values) && values.length > 0 ? values : fallback;
  return source.map((value) => readTextValue(value)).filter(Boolean);
}

function buildPresenterDetailRow(label, value) {
  const normalizedLabel = readTextValue(label);
  const normalizedValue = readTextValue(value);
  if (!normalizedLabel || !normalizedValue) {
    return null;
  }
  return { label: normalizedLabel, value: normalizedValue };
}

function formatPresenterPlacementSummary(entries = [], limit = 2) {
  const labels = entries
    .map((entry) => getScreenDisplayLabel(entry?.screenId || ""))
    .filter(Boolean);
  if (labels.length === 0) {
    return "";
  }
  if (labels.length > limit) {
    return `${formatSentenceList(labels.slice(0, limit), limit)} +${labels.length - limit} more`;
  }
  return formatSentenceList(labels, labels.length);
}

function formatPresenterTelemetryLeader(entries = [], type) {
  const entry = Array.isArray(entries) && entries.length > 0 ? entries[0] : null;
  if (!entry) {
    return "";
  }

  if (type === "screen") {
    const locationMeta = [entry.storeId, entry.pageId].filter(Boolean).join(" | ");
    return `Top screen ${entry.screenId}${locationMeta ? ` (${locationMeta})` : ""}`;
  }
  if (type === "template") {
    return `Top template ${entry.templateName || entry.templateId || "Template"} (${formatCount(entry.playCount || 0)} plays)`;
  }
  return `Top SKU ${entry.productName || entry.sku || "Tracked item"} (${formatCount(entry.playCount || 0)} plays)`;
}

function buildSupplyMarketIntroPresenterPayload() {
  return {
    stageDescription: "The opening case moves from proven onsite economics to a focused beachhead, structural right to win, measurable activation, and adjacency economics before the CYield flow begins.",
    speakerSummary:
      "The opening argument is straightforward: a proven onsite revenue engine, an APAC beachhead with room to win, a credible right to win for Criteo, measurable sales impact, and a scale story that works even under conservative share assumptions.",
    presenterNotes: [
      "The benchmark is onsite ecommerce media rather than total retail media because the proposition extends an existing monetization model instead of entering every channel at once.",
      "Statista's retail platform advertising category provides the cleanest published onsite benchmark, with WARC, EMARKETER, and RetailX corroborating that onsite remains the dominant share of retail media spend.",
      "APAC is the natural beachhead because it combines substantial onsite demand with a relatively early in-store display market.",
      "Criteo's right to win rests on assets already in hand: retailer relationships, advertiser demand, a proven onsite operating model, and a lightweight extension into CYield supply.",
      "The activation evidence matters because it positions in-store screens as a measurable retail media channel rather than a store-tech deployment.",
      "The economics are presented in two layers: media flow through the channel and platform revenue from operating the in-store layer.",
      "Global numbers establish that the adjacency can matter; APAC numbers show that a focused beachhead can still be material."
    ],
    proofPoints: [
      "$203.89B global onsite ecommerce media market",
      "$90.25B APAC onsite ecommerce media market",
      "$4.59B global / $1.31B APAC in-store digital display markets",
      "$203.89M global / $90.25M APAC media-flow scenario at 0.1% share",
      "$45.9M global / $13.12M APAC platform scenario at 1% share",
      "+14% to +28.3% reported sales lift"
    ],
    supportingModules: [
      "Onsite-only market framing",
      "Global market proof",
      "APAC beachhead",
      "Right to win",
      "Activation proof",
      "Adjacency economics"
    ],
    demoActions: [
      "Proven onsite economics establish the revenue pool.",
      "APAC demonstrates the most attractive beachhead market.",
      "Criteo's right to win is grounded in relationships, operating maturity, and lightweight implementation.",
      "Activation evidence proves the channel can be sold on outcomes.",
      "The closing economics show material upside globally and in APAC."
    ],
    qaPrompts: [
      "If someone challenges the onsite number, point to Statista's retail platform advertising market as the cleanest published benchmark and note that WARC, EMARKETER, and RetailX independently show onsite still represents about four-fifths or more of retail media spend.",
      "If someone asks why total retail media is excluded, explain that total retail media includes channels the current platform does not sell; the business case needs to stay inside onsite ecommerce media plus in-store screens.",
      "If someone asks why Criteo should win here, explain that this is an adjacency play built on existing advertiser demand, retailer relationships, onsite execution, and minimal CYield modification.",
      "If someone asks whether this is a media or product opportunity, explain that the upside combines media budgets flowing through the channel with platform revenue from operating the screen layer.",
      "If someone challenges the revenue math, position it as scenario modeling from published market sizes rather than a forecast."
    ],
    liveNarrative:
      "The business case is straightforward: a proven onsite revenue engine, a compelling APAC beachhead, a credible right to win, measurable activation, and material upside even on modest penetration assumptions.",
    detailRows: [
      buildPresenterDetailRow(
        "Onsite base",
        "$203.89B global retail platform advertising market in 2025, with external corroboration that onsite remains the dominant share of retail media spend."
      ),
      buildPresenterDetailRow("Adjacent market", "$4.59B global in-store digital advertising display market in 2024, with APAC at $1.312B."),
      buildPresenterDetailRow("Beachhead market", "$90.25B APAC retail platform advertising market in 2025 alongside the $1.312B APAC in-store digital advertising display market."),
      buildPresenterDetailRow(
        "Right to win",
        "Criteo already brings retailer relationships, advertiser demand, a proven onsite operating model, and a lightweight CYield extension path into stores."
      ),
      buildPresenterDetailRow(
        "Activation proof",
        "Albertsons reported +14% in-store sales lift in a 116-store case study; SMG / Kantar reported +28.3% average product sales lift across 12,558 campaigns."
      ),
      buildPresenterDetailRow(
        "Adjacency economics",
        "0.1% of onsite ecommerce media implies about $203.89M globally and $90.25M in APAC in media flow. Separately, 1% of the in-store display market implies about $45.9M globally and $13.12M in APAC in platform revenue."
      )
    ]
  };
}

function buildSupplyPresenterPayload(stageConfig) {
  if (isSupplyMarketIntroActive()) {
    return buildSupplyMarketIntroPresenterPayload();
  }

  const { configured, total, remaining } = getSupplyProgress();
  const demoStoreCount = getDemoStoreCount();
  const manual = getManualSupplyConfig();
  const actionMessage = readTextValue(state.lastDemoAction?.message);
  const presetMaterialized = isDemoPresetMaterialized();
  const summaryMessage = !isManualSupplyConfirmed()
    ? "Add one anchor placement, then apply the shared preset to finish the supply setup."
    : presetMaterialized
      ? state.supplyHandoffAcknowledged
        ? "Setup complete: minimal CYield change, shared backend-resolved player URL, and the handoff into CMax is open."
        : "Setup complete. Review the rollout handoff below, then continue into CMax when you're ready."
      : `Anchor screen saved. Load the preset to roll out the remaining ${remaining} supply-stage screen(s) across ${demoStoreCount} stores.`;
  const mappedPlacements = total || configured;
  const handoffMessage = isSupplyPresetReady()
    ? `The shared player is mapped across ${mappedPlacements} supply placement${
        mappedPlacements === 1 ? "" : "s"
      } spanning ${demoStoreCount} store${demoStoreCount === 1 ? "" : "s"} and multiple inventory zones.`
    : "";
  const backupConfigSummary = [
    `${manual.page.pageId} (${manual.page.pageType}, ${manual.page.environment})`,
    `${manual.screen.screenId} (${manual.screen.screenType}, ${manual.screen.screenSize})`
  ].join(" -> ");

  return {
    supportingModules: readPresenterStringList(stageConfig.supportingModules, [
      "2-action supply flow",
      "Supply handoff",
      "Retailer CPM card",
      "Backup config"
    ]),
    demoActions: readPresenterStringList(stageConfig.demoActions, [
      "Create the anchor placement.",
      "Apply the shared preset.",
      "Use the handoff card if someone wants rollout scale."
    ]),
    qaPrompts: readPresenterStringList(stageConfig.qaPrompts, [
      "Open Backup config if someone asks how the page and screen are mapped."
    ]),
    liveNarrative: summaryMessage,
    detailRows: [
      buildPresenterDetailRow(
        "Rollout status",
        `${configured} of ${mappedPlacements || configured || 0} supply placement(s) are configured across ${demoStoreCount} store(s).`
      ),
      buildPresenterDetailRow("Shared player", `${SHARED_PLAYER_URL} is reused across the whole supply footprint.`),
      buildPresenterDetailRow("Retailer CPM card", summarizeGoalRateCard()),
      buildPresenterDetailRow(
        "Handoff",
        handoffMessage ||
          actionMessage ||
          (isManualSupplyConfirmed()
            ? `Anchor is live. ${remaining} supply-stage screen(s) remain before full preset rollout.`
            : "Anchor placement still needs to be created.")
      ),
      buildPresenterDetailRow("Backup config", backupConfigSummary)
    ].filter(Boolean)
  };
}

function buildBuyingPresenterPayload(stageConfig) {
  const plan = state.activeGoalPlan;
  const draftGoal = getGoalDraftForDisplay();
  const goal = plan?.goal || draftGoal;
  const targetProducts = plan ? getGoalPlanTargetProducts(plan) : getSelectedGoalProducts();
  const compatibleScreens = countPlannedScreens(plan);
  const placementEntries = getSelectedGoalPlacements(plan);
  const availablePlacements = getAvailableGoalPlacements(plan);
  const budgetScenario = buildGoalBudgetScenario(plan);
  const objectiveLabel = objectiveLabelById(goal.objective || "");
  const scopeLabel = getGoalScopeLabel(goal);
  const storeLabel = goal.objective === "clearance" ? "Store focus" : "Store";
  const storeValue = readTextValue(goal.storeFocusLabel || goal.effectiveStoreId || goal.storeId || "All stores") || "All stores";
  const focusLabel =
    targetProducts.length === 1
      ? targetProducts[0].name
      : targetProducts.length > 1
        ? formatSentenceList(
            targetProducts.map((product) => product.name),
            Math.min(targetProducts.length, 2)
          )
        : goalTargetSourceLabel(goal.targetSource || state.goalPromptInferenceTargetSource);
  const placementSummary = formatPresenterPlacementSummary(placementEntries, 2);
  const promptTerms =
    Array.isArray(goal.inferredTerms) && goal.inferredTerms.length > 0 ? goal.inferredTerms.join(", ") : "";
  const promptSignal = [
    readTextValue(goal.prompt) ? `Brief: ${readTextValue(goal.prompt)}` : "",
    promptTerms ? `Terms: ${promptTerms}` : ""
  ]
    .filter(Boolean)
    .join(" | ");
  const reasoning = readTextValue(goal.inferenceReasoning || state.goalPromptInferenceReasoning);
  const strategyHeadline = readTextValue(plan?.strategy?.headline);
  const strategyNotes = Array.isArray(plan?.strategy?.summaryBullets)
    ? plan.strategy.summaryBullets.map((bullet) => readTextValue(bullet)).filter(Boolean).join(" | ")
    : "";
  const lineUpSummary = plan
    ? `${placementSummary || `${compatibleScreens} placement(s)`}${
        availablePlacements.length > 0 ? `. ${availablePlacements.length} more placement(s) remain available to add back.` : "."
      }`
    : "Generate a plan to show the editable placement line-up and budget cut line.";
  const liveNarrative = !plan
    ? "Choose the account, objective, and assortment focus to build the in-store buy."
    : compatibleScreens === 0
      ? "No strong in-scope line-up is ready yet. Adjust the brief or widen the placement focus."
      : plan.status === "applied"
        ? `The funded line-up is live with ${formatMoney(budgetScenario.fundedSpend)} approved.`
        : `The editable line-up currently includes ${placementSummary || `${compatibleScreens} placement(s)`}.`;

  return {
    supportingModules: readPresenterStringList(stageConfig.supportingModules, [
      "Planner steps",
      "AI brief reasoning",
      "Decision logic",
      "Budget control"
    ]),
    demoActions: readPresenterStringList(stageConfig.demoActions, [
      "Set the brief, build the line-up, then approve the funded plan."
    ]),
    qaPrompts: readPresenterStringList(stageConfig.qaPrompts, [
      "Use store logic and scope logic if someone asks why a placement is included or excluded."
    ]),
    liveNarrative,
    detailRows: [
      buildPresenterDetailRow(
        "Planner brief",
        [objectiveLabel, scopeLabel, `${storeLabel}: ${storeValue}`].filter(Boolean).join(" | ")
      ),
      buildPresenterDetailRow(
        "Account focus",
        getGoalPlanAccountLabel(goal, targetProducts) === "Account required"
          ? "Select an account to scope the planner."
          : getGoalPlanAccountLabel(goal, targetProducts)
      ),
      buildPresenterDetailRow("Priority focus", focusLabel),
      buildPresenterDetailRow(
        "AI / prompt",
        reasoning || promptSignal || goalTargetSourceLabel(goal.targetSource || state.goalPromptInferenceTargetSource)
      ),
      buildPresenterDetailRow(
        "Decision logic",
        strategyHeadline || readTextValue(goal.storeSelectionReason) || readTextValue(goal.scopeSelectionReason) || readTextValue(goal.scopeMessage)
      ),
      buildPresenterDetailRow("Strategy notes", strategyNotes),
      buildPresenterDetailRow(
        "Budget state",
        plan
          ? `${formatMoney(budgetScenario.selectedSpend)} of ${formatMoney(budgetScenario.maxSpend)} currently funds ${
              budgetScenario.fundedPlacements.length
            } of ${Math.max(budgetScenario.selectedPlacementCount, placementEntries.length)} selected placement(s).`
          : "Build a plan to expose selected spend, max spend, and funded impressions."
      ),
      buildPresenterDetailRow("Line-up", lineUpSummary),
      buildPresenterDetailRow("Flight", formatGoalFlightSummary(goal.flightStartDate, goal.flightEndDate))
    ].filter(Boolean)
  };
}

function buildMonitoringPresenterPayload(stageConfig) {
  const plan = state.activeGoalPlan;
  const telemetry = state.telemetrySummary;
  const totals = telemetry?.totals || {};
  const measurementBoard = telemetry?.measurementBoard;
  const narrative = measurementBoard?.narrative || {};
  const metrics = Array.isArray(measurementBoard?.metrics) ? measurementBoard.metrics : [];
  const brandContext = getGoalPlanBrandContext(plan);
  const liveScreens = Array.isArray(plan?.liveScreens) ? plan.liveScreens : [];
  const campaignRuns = (state.agentRuns || []).filter((run) => {
    if (brandContext.advertiserId || brandContext.brand) {
      return runMatchesBrandWorkspace(run, brandContext);
    }
    return true;
  });
  const latestRun = campaignRuns[0] || plan || null;
  const dashboardSummary = [
    brandContext.accountLabel || brandContext.brand || "Selected brand",
    brandContext.objectiveLabel || "Campaign results",
    `${formatCount(plan?.liveCount || liveScreens.length || 0)} live screen${Number(plan?.liveCount || liveScreens.length || 0) === 1 ? "" : "s"}`,
    `${formatCount(campaignRuns.length || (state.agentRuns || []).length)} campaign${(campaignRuns.length || (state.agentRuns || []).length) === 1 ? "" : "s"}`
  ].join(" | ");
  const measurementSummary = metrics
    .slice(0, 3)
    .map((metric) => `${readTextValue(metric?.label || "Metric")}: ${readTextValue(metric?.valueText || formatCount(metric?.value || 0))}`)
    .filter(Boolean)
    .join(" | ");
  const telemetryLeaderSummary = [
    formatPresenterTelemetryLeader(telemetry?.byScreen || [], "screen"),
    formatPresenterTelemetryLeader(telemetry?.byTemplate || [], "template"),
    formatPresenterTelemetryLeader(telemetry?.bySku || [], "sku")
  ]
    .filter(Boolean)
    .join(" | ");
  const previewNarrative = plan?.status === "applied"
    ? `${brandContext.brand || "The active campaign"} is live across ${
        plan?.liveCount || liveScreens.length || 0
      } in-store screen(s). The immersive preview rail is scoped to the active campaign only.`
    : brandContext.brand
      ? `${brandContext.brand} immersive previews will appear here once the selected campaign is live.`
      : "Live campaign previews will appear here once the selected brand has active screens.";
  const timelineSummary = latestRun
    ? [
        latestRun.planId ? `Campaign ${latestRun.planId}` : "",
        latestRun.status === "applied" ? "Live" : "Planned",
        latestRun.createdAt ? `Created ${formatTimestamp(latestRun.createdAt)}` : "",
        latestRun.appliedAt ? `Live ${formatTimestamp(latestRun.appliedAt)}` : ""
      ]
        .filter(Boolean)
        .join(" | ")
    : "";
  const liveNarrative =
    readTextValue(narrative.summary) ||
    (brandContext.brand
      ? `Live delivery anchors ${brandContext.brand}'s view, with estimated shopper response, sales lift, new-to-brand value, and return on spend layered on top.`
      : "Launch a campaign to populate live delivery, shopper response, and sales outcomes.");

  return {
    supportingModules: readPresenterStringList(stageConfig.supportingModules, [
      "Brand dashboard",
      "Measurement board",
      "Telemetry breakdowns",
      "Preview rail"
    ]),
    demoActions: readPresenterStringList(stageConfig.demoActions, [
      "Use the brand dashboard, then show the preview rail and measurement board."
    ]),
    qaPrompts: readPresenterStringList(stageConfig.qaPrompts, [
      "Separate observed telemetry from modeled retail outcomes if someone asks how the measurement board works."
    ]),
    liveNarrative,
    detailRows: [
      buildPresenterDetailRow("Brand workspace", dashboardSummary),
      buildPresenterDetailRow(
        "Measurement story",
        [
          readTextValue(narrative.headline),
          readTextValue(narrative.trend),
          readTextValue(narrative.comparisonStory)
        ]
          .filter(Boolean)
          .join(" | ")
      ),
      buildPresenterDetailRow("Metric families", measurementSummary),
      buildPresenterDetailRow(
        "Delivery summary",
        `Events ${formatCount(totals.total || 0)} | Plays ${formatCount(totals.playCount || 0)} | Exposure ${formatDuration(
          totals.exposureMs || 0
        )}`
      ),
      buildPresenterDetailRow("Telemetry leaders", telemetryLeaderSummary),
      buildPresenterDetailRow("Live preview", previewNarrative),
      buildPresenterDetailRow("Campaign timeline", timelineSummary)
    ].filter(Boolean)
  };
}

function buildPresenterStagePayload(stageConfig) {
  if (state.stage === "buying") {
    return buildBuyingPresenterPayload(stageConfig);
  }
  if (state.stage === "monitoring") {
    return buildMonitoringPresenterPayload(stageConfig);
  }
  return buildSupplyPresenterPayload(stageConfig);
}

function buildPresenterSnapshot() {
  const stageConfig = getStageConfig(state.stage);
  const plan = state.activeGoalPlan;
  const draftGoal = getGoalDraftForDisplay();
  const plannedScreens = countPlannedScreens(plan);
  const telemetryTotals = state.telemetrySummary?.totals || {};
  const primaryScreenId = getPrimaryScreenId();
  const stagePayload = buildPresenterStagePayload(stageConfig);
  const presenterNotes =
    Array.isArray(stagePayload.presenterNotes) && stagePayload.presenterNotes.length > 0
      ? stagePayload.presenterNotes
      : Array.isArray(stageConfig.presenterNotes)
        ? stageConfig.presenterNotes
        : [];
  const proofPoints =
    Array.isArray(stagePayload.proofPoints) && stagePayload.proofPoints.length > 0
      ? stagePayload.proofPoints
      : Array.isArray(stageConfig.proofPoints)
        ? stageConfig.proofPoints
        : [];
  return {
    updatedAt: new Date().toISOString(),
    updatedAtText: formatTimestamp(new Date()),
    stage: state.stage,
    stageLabel: stageConfig.label || titleCase(state.stage),
    stageDescription: readTextValue(stagePayload.stageDescription) || stageConfig.description || "",
    stagePill: getStagePillText(state.stage),
    speakerSummary: readTextValue(stagePayload.speakerSummary) || String(stageConfig.speakerSummary || "").trim(),
    presenterNotes,
    proofPoints,
    supportingModules: Array.isArray(stagePayload.supportingModules) ? stagePayload.supportingModules : [],
    demoActions: Array.isArray(stagePayload.demoActions) ? stagePayload.demoActions : [],
    qaPrompts: Array.isArray(stagePayload.qaPrompts) ? stagePayload.qaPrompts : [],
    cards: buildPresenterCards(),
    liveNarrative: readTextValue(stagePayload.liveNarrative),
    detailRows: Array.isArray(stagePayload.detailRows) ? stagePayload.detailRows : [],
    planSummary: String(plan?.summary || "").trim(),
    planScope: getGoalScopeLabel(plan?.goal || draftGoal),
    planScopeMessage: String(plan?.goal?.scopeMessage || "").trim(),
    plannedScreens,
    liveScreens: Number(plan?.liveCount || plan?.liveScreens?.length || 0),
    selectedSkuCount: Number(plan?.goal?.targetSkuIds?.length || state.selectedGoalSkuIds.size || 0),
    previewUrl: primaryScreenId ? buildSharedPreviewUrl(primaryScreenId) : buildSharedPreviewUrl(""),
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
  clearGoalPromptInferenceTimer();
  state.goalPromptInferencePending = false;
  state.goalPromptInferenceReasoning = readTextValue(run?.goal?.inferenceReasoning || "");
  state.goalPromptInferenceTargetSource = readTextValue(run?.goal?.targetSource || "");
  state.goalPromptAwaitingRun = false;
  state.goalScopeStepAcknowledged = Boolean(run?.goal);
  state.goalPlanningStep = run?.goal ? 3 : 1;
  setGoalSkuSelectionMode(
    String(run?.goal?.targetSource || "").startsWith("prompt") ? "prompt" : run?.goal ? "manual" : "",
    run?.goal?.inferredTerms || []
  );
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
    setGoalSkuSelectionMode("");
    resetGoalPromptInferenceState();
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
  if (isSupplyMarketIntroActive()) {
    nextStage = "supply";
  }
  if (nextStage === "buying" && !isBuyingStageUnlocked()) {
    nextStage = "supply";
  }
  if (nextStage === "monitoring" && !canOpenMonitoringStage()) {
    nextStage = isBuyingStageUnlocked() ? "buying" : "supply";
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
      isSupplyMarketIntroActive()
        ? "Story first"
        : supplyReady
          ? "Preset ready"
          : manualReady
            ? "Anchor added"
            : "Start here";
  }
  if (elements.buyingStagePill) {
    elements.buyingStagePill.textContent =
      hasAppliedPlan
        ? "In market"
        : hasPlan
          ? "Brief ready"
          : supplyReady
            ? state.supplyHandoffAcknowledged
              ? "Awaiting brief"
              : "Awaiting handoff"
            : "Locked";
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
  const presetMaterialized = isDemoPresetMaterialized();
  const inventoryBusy = hasPendingAction("inventory");
  const anchorPending = hasPendingAction("inventory:anchor");
  const presetPending = hasPendingAction("inventory:preset");
  const resetPending = hasPendingAction("inventory:reset");
  const pagePending = hasPendingAction("inventory:page");
  const screenPending = hasPendingAction("inventory:screen");
  const pricingPending = hasPendingAction("pricing");
  const goalPlanPending = hasPendingAction("goalPlan");
  const runsRefreshPending = hasPendingAction("goalRunsRefresh");
  const telemetryRefreshPending = hasPendingAction("telemetryRefresh");
  const workspaceReleasePending = hasPendingAction("workspaceRelease");

  if (elements.createAnchorBtn) {
    elements.createAnchorBtn.disabled = manualReady || inventoryBusy;
    elements.createAnchorBtn.textContent = anchorPending
      ? "Creating anchor..."
      : manualReady
        ? "Anchor ready"
        : "Add one anchor placement";
  }

  for (const button of qsa("#loadPresetBtn, #loadPresetBtnSecondary")) {
    button.disabled = !manualReady || presetMaterialized || inventoryBusy;
    button.textContent = presetPending ? "Applying preset..." : presetMaterialized ? "Shared preset applied" : "Apply shared preset";
  }

  for (const button of qsa("#nextToBuyingBtn, #nextToBuyingBtnSecondary")) {
    button.disabled = !isBuyingStageUnlocked();
  }
  for (const button of qsa("#nextToMonitoringBtn, #nextToMonitoringBtnSecondary")) {
    button.disabled = !hasAppliedPlan;
  }
  for (const button of qsa(".js-stage-jump")) {
    const targetStage = button.dataset.stage || "supply";
    button.disabled =
      (targetStage === "buying" && !isBuyingStageUnlocked()) || (targetStage === "monitoring" && !canOpenMonitoringStage());
  }

  if (elements.pageSubmitBtn) {
    elements.pageSubmitBtn.disabled = inventoryBusy;
    elements.pageSubmitBtn.textContent = pagePending ? "Saving page..." : "Save page";
  }
  if (elements.screenSubmitBtn) {
    elements.screenSubmitBtn.disabled = inventoryBusy;
    elements.screenSubmitBtn.textContent = screenPending
      ? "Saving screen..."
      : String(state.editingScreenId || "").trim()
        ? "Save changes"
        : "Create screen";
  }
  if (elements.screenCancelBtn) {
    elements.screenCancelBtn.disabled = inventoryBusy;
  }
  if (elements.saveRetailerRatesBtn) {
    elements.saveRetailerRatesBtn.disabled = pricingPending || goalPlanPending;
    elements.saveRetailerRatesBtn.textContent = pricingPending ? "Saving CPMs..." : "Save retailer CPM card";
  }
  if (elements.refreshRunsBtn) {
    elements.refreshRunsBtn.disabled = runsRefreshPending || goalPlanPending;
    elements.refreshRunsBtn.textContent = runsRefreshPending ? "Refreshing..." : "Refresh campaigns";
  }
  if (elements.refreshTelemetryBtn) {
    elements.refreshTelemetryBtn.disabled = telemetryRefreshPending || goalPlanPending;
    elements.refreshTelemetryBtn.textContent = telemetryRefreshPending ? "Refreshing..." : "Refresh telemetry";
  }
  if (elements.switchWorkspaceBtn) {
    elements.switchWorkspaceBtn.disabled = workspaceReleasePending;
    elements.switchWorkspaceBtn.textContent = workspaceReleasePending ? "Switching avatar..." : "Switch avatar";
  }
  if (qs("#resetDemoBtn")) {
    const resetButton = qs("#resetDemoBtn");
    resetButton.disabled = inventoryBusy;
    resetButton.textContent = resetPending ? "Resetting demo..." : "Reset demo";
  }

  if (elements.demoScreenLink) {
    elements.demoScreenLink.href = primaryScreenId ? buildSharedPreviewUrl(primaryScreenId) : buildSharedPreviewUrl("");
    elements.demoScreenLink.textContent = primaryScreenId ? "Open immersive preview" : "Open preview";
  }
  if (elements.monitorPreviewLink) {
    elements.monitorPreviewLink.href = primaryScreenId ? buildSharedPreviewUrl(primaryScreenId) : buildSharedPreviewUrl("");
    elements.monitorPreviewLink.textContent = primaryScreenId ? "Open immersive preview" : "Open preview";
  }
}

function buildDemoActionMessage(kind, result) {
  const createdPages = Number(result?.createdPageIds?.length || 0);
  const updatedPages = Number(result?.updatedPageIds?.length || 0);
  const createdScreens = Number(result?.createdScreenIds?.length || 0);
  const updatedScreens = Number(result?.updatedScreenIds?.length || 0);
  const addedScreenCount = Number(result?.addedScreenCount || createdScreens || 0);
  const affectedStoreCount = Number(
    result?.affectedStoreCount || result?.seededStoreIds?.length || result?.removedStoreIds?.length || 0
  );

  if (kind === "reset") {
    const removedScreens = Number(result?.removedScreenIds?.length || 0);
    return `Demo baseline restored. ${removedScreens} demo screen(s)${affectedStoreCount ? ` across ${affectedStoreCount} store(s)` : ""} cleared. Telemetry and plan history cleared.`;
  }

  if (result?.simulated) {
    return `${formatCount(addedScreenCount)} screen${addedScreenCount === 1 ? "" : "s"} added across ${formatCount(
      affectedStoreCount
    )} store${affectedStoreCount === 1 ? "" : "s"}.`;
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
      value: isBuyingStageUnlocked() ? "Unlocked" : isSupplyHandoffPending() ? "Review handoff" : "Locked",
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

  const { remaining } = getSupplyProgress();
  const demoStoreCount = getDemoStoreCount();
  const actionMessage = state.lastDemoAction?.message || "";
  const presetMaterialized = isDemoPresetMaterialized();
  const summaryMessage = !isManualSupplyConfirmed()
    ? "Add one anchor placement, then apply the shared preset to finish the supply setup."
    : presetMaterialized
      ? state.supplyHandoffAcknowledged
        ? "Setup complete: minimal CYield change, shared backend-resolved player URL, and the handoff into CMax is open."
        : "Setup complete. Review the rollout handoff below, then continue into CMax when you're ready."
      : `Anchor screen saved. Load the preset to roll out the remaining ${remaining} supply-stage screen(s) across ${demoStoreCount} stores.`;

  elements.presetSummary.classList.remove("empty");
  elements.presetSummary.innerHTML = `
    <strong>Shared player URL: ${escapeHtml(SHARED_PLAYER_URL)}</strong>
    <p>${escapeHtml(summaryMessage)}</p>
    <p class="goal-change__metrics">Retailer CPM card: ${escapeHtml(summarizeGoalRateCard())}</p>
    <p class="goal-change__metrics">
      ${escapeHtml(
        presetMaterialized
          ? actionMessage || "Shared preset is active across the demo inventory."
          : "CYield keeps the same page-like request model. The only extra layer is a resolver that maps the TV/browser footprint to the right screen config."
      )}
    </p>
  `;
}

function renderSupplyHandoff() {
  if (!elements.supplyHandoffCard) {
    return;
  }

  const pending = isSupplyHandoffPending();
  elements.supplyHandoffCard.classList.toggle("is-hidden", !pending);
  if (!pending) {
    return;
  }

  const { configured, total } = getSupplyProgress();
  const mappedPlacements = total || configured;
  const demoStoreCount = getDemoStoreCount();

  if (elements.supplyHandoffMessage) {
    elements.supplyHandoffMessage.textContent = `The shared player has now been mapped across ${mappedPlacements} supply placement${
      mappedPlacements === 1 ? "" : "s"
    } spanning ${demoStoreCount} store${demoStoreCount === 1 ? "" : "s"} and multiple inventory zones. The retailer can now manage that screen footprint flexibly from one setup instead of rebuilding each placement one by one.`;
  }

  if (elements.supplyHandoffStats) {
    elements.supplyHandoffStats.innerHTML = [
      { value: `${mappedPlacements}`, label: "Mapped placements" },
      { value: `${demoStoreCount}`, label: `Store${demoStoreCount === 1 ? "" : "s"} live` },
      { value: SHARED_PLAYER_URL, label: "Shared player URL" }
    ]
      .map(
        (stat) => `<div class="supply-handoff__stat">
          <strong>${escapeHtml(stat.value)}</strong>
          <span>${escapeHtml(stat.label)}</span>
        </div>`
      )
      .join("");
  }
}

function renderPagesList() {
  if (!elements.pagesList) {
    return;
  }

  const pageCards = getRelevantPageSummaries();
  const presetMaterialized = isDemoPresetMaterialized();
  const presetSimulated = isPresetSimulationActive();
  if (!pageCards.length) {
    elements.pagesList.innerHTML = '<div class="empty">No demo pages tracked yet.</div>';
    return;
  }

  elements.pagesList.innerHTML = pageCards
    .map((page) => {
      const displayConfigured = page.isManual ? isManualSupplyConfirmed() : presetMaterialized && (page.configured || presetSimulated);
      const status = page.isManual
        ? isManualSupplyConfirmed()
          ? "Anchor saved"
          : "Add this first"
        : presetMaterialized
          ? presetSimulated
            ? "Demo ready"
            : page.configured
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
  const presetMaterialized = isDemoPresetMaterialized();
  const presetSimulated = isPresetSimulationActive();
  const inventoryBusy = hasPendingAction("inventory");
  const deletingScreenId = getPendingActionValue("inventory:delete");
  if (!screenCards.length) {
    elements.screensList.innerHTML = '<div class="empty">No demo screens tracked yet.</div>';
    return;
  }

  const totalMappedScreens = Number(state.demo.counts?.baselineScreens || screenCards.length || 0);
  const sampleLeadIn =
    totalMappedScreens > screenCards.length
      ? `<article class="record record--muted">
          <div class="record__top">
            <strong>${escapeHtml(formatCount(screenCards.length))} screen samples shown</strong>
            <span>${escapeHtml(formatCount(totalMappedScreens))} mapped total</span>
          </div>
          <p>This list is a representative swatch of the live network so the admin remains usable at full-store scale.</p>
        </article>`
      : "";

  elements.screensList.innerHTML =
    sampleLeadIn +
    screenCards
    .map((summary) => {
      const screen = screenMap.get(summary.screenId);
      const templateName = getTemplateById(summary.templateId)?.name || summary.templateId || "Template";
      const sharedPreviewUrl = buildSharedPreviewUrl(summary);
      const displayConfigured = summary.isManual
        ? isManualSupplyConfirmed()
        : presetMaterialized && (summary.configured || presetSimulated);
      const canManageLiveScreen = summary.isManual ? isManualSupplyConfirmed() : Boolean(screen);
      const deletingThisScreen = deletingScreenId === summary.screenId;
      const status = summary.isManual
        ? isManualSupplyConfirmed()
          ? "Anchor saved"
          : "Add this first"
        : presetMaterialized
          ? presetSimulated
            ? "Demo ready"
            : summary.configured
              ? "Configured"
              : "Pending"
          : "Loaded by preset";
      const actions = canManageLiveScreen
        ? `<span class="record__actions">
            <button type="button" class="btn btn--tiny js-edit-screen" data-screen-id="${escapeHtml(summary.screenId)}" ${
              inventoryBusy ? "disabled" : ""
            }>Edit</button>
            <button type="button" class="btn btn--tiny btn--tiny-danger js-delete-screen" data-screen-id="${escapeHtml(
              summary.screenId
            )}" ${inventoryBusy ? "disabled" : ""}>${escapeHtml(deletingThisScreen ? "Deleting..." : "Delete")}</button>
            <a href="${escapeHtml(sharedPreviewUrl)}" target="_blank" rel="noreferrer">Immersive preview</a>
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
  const stores = Array.isArray(state.demo.storeIds) && state.demo.storeIds.length > 0
    ? state.demo.storeIds
    : Array.isArray(state.inventoryStoreIds)
      ? state.inventoryStoreIds
      : [];
  const pages = Array.isArray(state.demo.pages) && state.demo.pages.length > 0
    ? state.demo.pages.map((page) => String(page?.pageId || "").trim()).filter(Boolean)
    : Array.isArray(state.inventoryPageIds)
      ? state.inventoryPageIds
      : [];

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
    return [formatGoalFlightSummary(), storeId || "All stores", pageId || "All mapped placements"].join(" | ");
  }

  const advertiserId = getSelectedGoalAdvertiserId();
  const selectedCount = state.selectedGoalSkuIds.size;
  const category = String(elements.goalProductCategory?.value || "").trim();
  const prompt = getGoalPromptText();
  if (!advertiserId) {
    return "Choose an account first to browse its assortment.";
  }
  if (state.goalPromptInferencePending && prompt) {
    return "AI is choosing SKU's for the current brief.";
  }
  if (state.goalPromptAwaitingRun && prompt) {
    return "Brief ready. Click Let AI choose SKU's to build the shortlist.";
  }
  if (isGoalPromptSelectionActive() && selectedCount > 0) {
    return `AI brief selected ${selectedCount} priority SKU(s)${category ? ` in ${titleCase(category)}` : ""}.`;
  }
  if (selectedCount > 0) {
    return `${selectedCount} priority SKU(s) selected${category ? ` in ${titleCase(category)}` : ""}.`;
  }
  if (prompt) {
    return isGoalPromptSelectionActive()
      ? "AI brief is active, but no matching SKUs were found yet."
      : "No priority SKUs selected. Click Let AI choose SKU's, or pick SKUs manually.";
  }
  if (category) {
    return `Browsing ${titleCase(category)} with no SKU shortlist yet.`;
  }
  return "Choose SKUs yourself, or brief AI and click the button to shortlist them.";
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
  const plannerBusy = hasPendingAction("goalPlan");
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
      openButton.disabled = !accessible || active || plannerBusy;
      openButton.textContent = !accessible ? "Locked" : completed ? "Edit" : "Open";
    }
  }

  if (elements.goalStep1NextBtn) {
    elements.goalStep1NextBtn.disabled = !briefComplete || plannerBusy;
  }
  if (elements.goalStep2NextBtn) {
    elements.goalStep2NextBtn.disabled = !briefComplete || !hasValidGoalFlightDates() || plannerBusy;
  }
  if (elements.goalPlanBtn) {
    elements.goalPlanBtn.disabled =
      !briefComplete || !state.goalScopeStepAcknowledged || !hasValidGoalFlightDates() || plannerBusy;
    elements.goalPlanBtn.textContent = plannerBusy ? "AI building buy..." : "Auto-build in-store buy";
  }
  updateGoalPlannerFieldStates();
}

function updateGoalPlannerFieldStates() {
  const plannerBusy = hasPendingAction("goalPlan");
  for (const field of [
    elements.goalObjective,
    elements.goalAggressiveness,
    elements.goalStoreScope,
    elements.goalPageScope,
    elements.goalFlightStart,
    elements.goalFlightEnd,
    elements.goalPrompt,
    elements.goalBrandAccount,
    elements.goalProductCategory,
    elements.goalProductSearch
  ]) {
    if (field) {
      field.disabled = plannerBusy;
    }
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
  const promptNote = getGoalPromptSelectionNote();
  elements.goalSkuCount.textContent = `Showing ${products.length} SKU(s)${scopeSuffix}.${promptNote ? ` ${promptNote}` : ""}`;
}

function renderGoalSelectedSkus() {
  if (!elements.goalSelectedSkus || !elements.goalSelectedSkuHeadline) {
    return;
  }
  const selectedProducts = getSelectedGoalProducts().sort((left, right) => left.name.localeCompare(right.name));
  const reasoning = readTextValue(state.goalPromptInferenceReasoning);
  elements.goalSelectedSkuHeadline.textContent =
    state.goalPromptInferencePending && getGoalPromptText()
      ? "AI choosing"
      : isGoalPromptSelectionActive()
        ? `${selectedProducts.length} AI-selected`
        : `${selectedProducts.length} selected`;

  if (selectedProducts.length === 0) {
    elements.goalSelectedSkus.classList.add("empty");
    if (state.goalPromptInferencePending && getGoalPromptText()) {
      elements.goalSelectedSkus.textContent = "AI is choosing SKU's for the current brief.";
    } else if (isGoalPromptSelectionActive()) {
      elements.goalSelectedSkus.textContent = reasoning || "AI brief is active, but no matching SKUs were found yet.";
    } else if (getGoalPromptText()) {
      elements.goalSelectedSkus.textContent = state.goalPromptAwaitingRun
        ? "Brief ready. Click Let AI choose SKU's to build the shortlist, or pick SKUs below."
        : "No priority SKUs selected. Click Let AI choose SKU's, or pick SKUs below.";
    } else {
      elements.goalSelectedSkus.textContent = "No priority SKUs selected yet. Pick SKUs below or add an AI brief.";
    }
  } else {
    elements.goalSelectedSkus.classList.remove("empty");
    const reasoningMarkup = isGoalPromptSelectionActive() && reasoning
      ? `<div class="goal-selection-reason">${escapeHtml(reasoning)}</div>`
      : "";
    const chipsMarkup = selectedProducts
      .map((product) => {
        const sku = normalizeSku(product.sku);
        return `<button type="button" class="goal-chip js-remove-goal-sku" data-sku="${escapeHtml(sku)}">
          ${buildProductThumbMarkup(product, {
            className: "product-thumb product-thumb--sm",
            alt: getProductDisplayName(product) || sku
          })}
          <span class="goal-chip__body">
            <span class="goal-chip__name">${escapeHtml(product.name)}</span>
            <span class="goal-chip__meta">${escapeHtml(product.brand)} | ${escapeHtml(titleCase(product.category))}</span>
          </span>
          <span class="goal-chip__remove">Remove</span>
        </button>`;
      })
      .join("");
    elements.goalSelectedSkus.innerHTML = `${reasoningMarkup}${chipsMarkup}`;
  }
}

function renderGoalSelectionActions(products = getFilteredProducts()) {
  const selectionBusy = state.goalPromptInferencePending || hasPendingAction("goalPlan");
  if (elements.goalSelectCategoryBtn) {
    elements.goalSelectCategoryBtn.textContent = elements.goalProductCategory?.value ? "Select category" : "Select visible";
    elements.goalSelectCategoryBtn.disabled = products.length === 0 || selectionBusy;
  }
  if (elements.goalClearSkusBtn) {
    elements.goalClearSkusBtn.disabled = state.selectedGoalSkuIds.size === 0 || selectionBusy;
  }
}

function renderGoalProducts() {
  if (!elements.goalProductList) {
    return;
  }
  const advertiserId = getSelectedGoalAdvertiserId();
  const products = getFilteredProducts();
  const selectionBusy = state.goalPromptInferencePending || hasPendingAction("goalPlan");
  if (!advertiserId) {
    elements.goalProductList.innerHTML = '<div class="empty">Choose an account in Step 1 to browse that assortment.</div>';
    renderGoalSelectedSkus();
    renderGoalSkuCount();
    renderGoalSelectionActions(products);
    renderGoalPromptAssistant();
    renderGoalPlanningFlow();
    return;
  }
  if (products.length === 0) {
    elements.goalProductList.innerHTML = '<div class="empty">No SKUs in this account/category. Try another account or clear the category filter.</div>';
    renderGoalSelectedSkus();
    renderGoalSkuCount();
    renderGoalSelectionActions(products);
    renderGoalPromptAssistant();
    renderGoalPlanningFlow();
    return;
  }

  elements.goalProductList.innerHTML = products
    .slice(0, 160)
    .map((product) => {
      const sku = normalizeSku(product.sku);
      const selected = state.selectedGoalSkuIds.has(sku);
      return `<label class="goal-products__item${selected ? " goal-products__item--selected" : ""}">
        <input type="checkbox" class="js-goal-product-sku" value="${escapeHtml(sku)}" ${selected ? "checked" : ""} ${
          selectionBusy ? "disabled" : ""
        }>
        ${buildProductThumbMarkup(product, {
          className: "product-thumb goal-products__thumb",
          alt: getProductDisplayName(product) || sku
        })}
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
  renderGoalPromptAssistant();
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
  setGoalSkuSelectionMode("manual");
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
  setGoalSkuSelectionMode("manual");
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
  let fundedEstimatedImpressions = 0;

  for (const placement of placements) {
    const nextCost = Math.max(0, placement.placementCost);
    if (fundedSpend + nextCost <= selectedSpend) {
      fundedPlacements.push(placement);
      fundedSpend += nextCost;
      fundedEstimatedImpressions += Math.max(0, placement.estimatedImpressions || 0);
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
    maxEstimatedImpressions: Math.max(
      0,
      Math.round(placements.reduce((sum, placement) => sum + Number(placement?.estimatedImpressions || 0), 0))
    ),
    fundedEstimatedImpressions,
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
  const pricingModelLabel = String(plan?.budget?.pricingModelLabel || plan?.goal?.pricingModelLabel || "Retailer-set CPM by screen type").trim();
  const sliderStep = getGoalBudgetSliderStep(maxSpend, selectedSpend);
  const pendingApplyPlanId = getPendingActionValue("goalPlanApply");
  const applyPending = hasPendingAction("goalPlanApply");
  const applyingThisPlan = pendingApplyPlanId === String(plan.planId || "").trim();
  const sliderDisabled = plan.status === "applied" || selectedCount === 0 || applyPending;
  const maxShortcutDisabled = sliderDisabled || selectedSpend >= maxSpend;
  const launchDisabled = plan.status === "applied" || fundedCount === 0 || selectedCount === 0 || applyPending;
  const sliderProgress = maxSpend > 0 ? ((selectedSpend / maxSpend) * 100).toFixed(2) : "0";
  const estimatedImpressions = Math.max(0, Math.round(Number(budgetScenario.maxEstimatedImpressions || 0)));
  const fundedEstimatedImpressions = Math.max(0, Math.round(Number(budgetScenario.fundedEstimatedImpressions || 0)));

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
          >${escapeHtml(applyingThisPlan ? "Launching..." : "Approve and launch")}</button>
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
        <div class="goal-budget__total">
          <span>Estimated impressions</span>
          <strong>${escapeHtml(formatCount(estimatedImpressions))}</strong>
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
                } Funded delivery is modeled at ${formatCount(fundedEstimatedImpressions)} impression(s).${
                  availableCount > 0 ? ` ${availableCount} more placement(s) remain available in the dropdown.` : ""
                }`
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

  if (hasPendingAction("goalPlan")) {
    const account = getGoalAccountByAdvertiserId();
    const objectiveId = String(elements.goalObjective?.value || "").trim();
    const detail = [
      account ? getProductAccountLabel(account) : "",
      objectiveId ? objectiveLabelById(objectiveId) : "",
      formatGoalFlightSummary()
    ]
      .filter(Boolean)
      .join(" | ");
    elements.goalPlanSummary.classList.remove("empty");
    elements.goalPlanSummary.innerHTML = buildAiAssistMarkup({
      kicker: "AI Planning",
      title: "Generating the in-store buy",
      body: "Scoring placements, matching creative logic, and shaping the budget around your brief.",
      detail,
      variant: "loading"
    });
    elements.goalPlanChanges.innerHTML = '<div class="record record--muted">AI is ranking screens, creative changes, and budget coverage for this shortlist.</div>';
    renderGoalPlanBudget(null, buildGoalBudgetScenario(null));
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
  const scopeLabel = getGoalScopeLabel(plan.goal || {});
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
  const promptSignal = [
    String(plan.goal?.prompt || "").trim() ? `Brief: ${String(plan.goal?.prompt || "").trim()}` : "",
    inferredTerms ? `Terms: ${inferredTerms}` : ""
  ]
    .filter(Boolean)
    .join(" | ");
  const plannerInputRows = [
    renderDetailRow(
      "Brief scope",
      [
        scopeLabel,
        `${storeLabel}: ${storeValue}`,
        assortmentCategory ? `Category: ${assortmentCategory}` : ""
      ]
        .filter(Boolean)
        .join(" | ")
    ),
    renderDetailRow("Priority focus", priorityLabel),
    renderDetailRow("Prompt signal", promptSignal),
    renderDetailRow("Store logic", storeSelectionReason),
    renderDetailRow("Scope logic", scopeSelectionReason),
    renderDetailRow("Scope note", scopeMessage)
  ]
    .filter(Boolean)
    .join("");
  const detailGroupList = [
    renderDetailGroup("Decision logic", [
      renderDetailRow("Strategy", strategyHeadline),
      renderDetailRow("Strategy notes", strategyBullets.length > 0 ? strategyBullets.join(" | ") : ""),
      renderDetailRow("Readiness", readinessText),
      renderDetailRow("Stock note", plan.goal?.stockMessage || ""),
      renderDetailRow("Flight", flightSummary),
      renderDetailRow("Pricing model", String(plan?.budget?.pricingModelLabel || "").trim())
    ])
  ].filter(Boolean);
  const detailGroups = detailGroupList.join("");
  const detailGroupClass = detailGroupList.length <= 1 ? " summary-split--single" : "";
  const plannerInputsTooltip = plannerInputRows
    ? `
      <div class="goal-summary__info">
        <button
          type="button"
          class="goal-summary__info-button"
          aria-label="Show planner inputs"
          aria-describedby="goalPlanInputsTooltip"
        >
          <span aria-hidden="true">i</span>
        </button>
        <div id="goalPlanInputsTooltip" class="goal-summary__tooltip" role="tooltip">
          <p class="goal-summary__tooltip-kicker">Planner inputs</p>
          <p class="goal-summary__tooltip-copy">Review the brief signals and scope logic behind this recommendation.</p>
          <dl class="goal-summary__detail-list goal-summary__tooltip-list">
            ${plannerInputRows}
          </dl>
        </div>
      </div>
    `
    : "";
  const detailSection = detailGroups
    ? `
      <div class="goal-summary__details summary-split${detailGroupClass}">
        ${detailGroups}
      </div>
    `
    : "";

  elements.goalPlanSummary.classList.remove("empty");
  elements.goalPlanSummary.innerHTML = `
    <div class="goal-summary__hero">
      <div class="goal-summary__hero-copy">
        <p class="section-kicker">Recommended media line-up</p>
        <div class="goal-summary__title-row">
          <strong>${escapeHtml(objectiveLabelById(plan.goal?.objective))}</strong>
          ${plannerInputsTooltip}
        </div>
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
    ${detailSection}
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
      const priorityProducts = getProductsForSkuList(recommendedSkus, targetProducts);
      const visiblePriorityProducts = priorityProducts.length > 0 ? priorityProducts : uniqueGoalProductsBySku(targetProducts);
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
      const cpm = Math.max(0, Math.round(Number(entry?.cpm || 0)));
      const estimatedImpressions = Math.max(0, Math.round(Number(entry?.estimatedImpressions || 0)));
      const estimatedDailyImpressions = Math.max(0, Math.round(Number(entry?.estimatedDailyImpressions || 0)));
      const dailyRate = Math.max(0, Math.round(Number(entry?.dailyRate || 0)));
      const screenType = String(entry?.screenType || screen?.screenType || "").trim();
      const normalizedExpectedOutcome = expectedOutcome.replace(/^Expected outcome:\s*/i, "");
      const pricingMetaCopy =
        cpm > 0 && estimatedImpressions > 0
          ? `${formatCount(estimatedImpressions)} est. imps${estimatedDailyImpressions > 0 ? ` | ${formatCount(estimatedDailyImpressions)}/day` : ""} | ${formatMoney(cpm)} CPM${
              screenType ? ` | ${screenType}` : ""
            }`
          : `${formatMoney(dailyRate)} / day${screenType ? ` | ${screenType}` : ""}`;
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
              <span class="goal-placement-card__meta-copy">${escapeHtml(pricingMetaCopy)}</span>
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
            ${buildProductThumbStripMarkup(visiblePriorityProducts, {
              className: "product-thumb product-thumb--xs",
              maxItems: 3
            })}
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
      ? `${brandName} in-store performance`
      : "In-store campaign performance";
  }
  if (elements.monitoringOverviewLede) {
    elements.monitoringOverviewLede.textContent = brandContext.brand
      ? `Live delivery, shopper response, and retail impact for ${brandName}.`
      : "Live delivery, shopper response, and retail impact for the selected brand.";
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
    elements.monitoringOverviewAsideEyebrow.textContent = brandContext.accountLabel ? "Account" : "Workspace";
  }
  if (elements.monitoringOverviewAsideTitle) {
    elements.monitoringOverviewAsideTitle.textContent = brandContext.brand ? `${brandName} workspace` : "Selected brand workspace";
  }
  if (elements.monitoringOverviewAsideCopy) {
    elements.monitoringOverviewAsideCopy.textContent = brandContext.accountLabel
      ? `Scoped to ${brandContext.accountLabel}, with live screens, recent campaigns, and measured results for that brand.`
      : "Scoped to the active brand, with live screens, recent campaigns, and measured results.";
  }
  if (elements.monitoringMeasurementTitle) {
    elements.monitoringMeasurementTitle.textContent = brandContext.brand ? `${brandName} performance` : "Campaign performance";
  }
  if (elements.monitoringMeasurementIntro) {
    elements.monitoringMeasurementIntro.textContent = brandContext.brand
      ? `Live delivery first, then estimated shopper and retail outcomes for ${brandName}.`
      : "Live delivery first, then estimated shopper and retail outcomes for the active brand.";
  }
  if (elements.measurementBriefTitle) {
    elements.measurementBriefTitle.textContent = brandContext.brand ? `${brandName} in-store readout` : "In-store readout";
  }
  if (elements.measurementBriefCopy) {
    elements.measurementBriefCopy.textContent = brandContext.brand
      ? `See live plays and exposure for ${brandName}, then layer in estimated shopper response and sales impact.`
      : "See live plays and exposure first, then layer in estimated shopper response and sales impact.";
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

  const runs = [...state.agentRuns]
    .sort((left, right) => {
      const rightMs = Date.parse(right.appliedAt || right.createdAt || 0) || 0;
      const leftMs = Date.parse(left.appliedAt || left.createdAt || 0) || 0;
      return rightMs - leftMs;
    })
    .slice(0, 4);
  const hiddenCount = Math.max(0, state.agentRuns.length - runs.length);
  const pendingPlanId = getPendingActionValue("goalPlanLoad");
  const loadPending = hasPendingAction("goalPlanLoad") || hasPendingAction("goalPlan") || hasPendingAction("goalPlanApply");

  elements.agentRunsList.innerHTML = [
    ...runs.map((run) => {
      const canApply = run.status !== "applied" && countPlannedScreens(run) > 0;
      const pillLabel = run.status === "applied" ? "Live" : "Planned";
      const runStoreLabel = String(run.goal?.storeFocusLabel || run.goal?.requestedStoreId || run.goal?.storeId || "All stores").trim() || "All stores";
      const primaryActionLabel = run.status === "applied" ? "Open" : canApply ? "Review" : "View";
      const selectedSpend =
        state.goalBudgetPlanId === run.planId ? getActiveGoalBudgetSpend(run) : Math.max(0, Math.round(Number(run?.budget?.selectedSpend || run?.budget?.maxSpend || 0)));
      const maxSpend = getPlanBudgetMaxSpend(run);
      const brandContext = getGoalPlanBrandContext(run);
      const loadingThisPlan = pendingPlanId === String(run.planId || "").trim();
      return `<article class="record">
        <div class="record__top">
          <strong>${escapeHtml(brandContext.brand ? `${brandContext.brand} | ${objectiveLabelById(run.goal?.objective)}` : objectiveLabelById(run.goal?.objective))}</strong>
          <span class="pill ${run.status === "applied" ? "pill--applied" : "pill--planned"}">${escapeHtml(pillLabel)}</span>
        </div>
        <p>${escapeHtml(runStoreLabel)} | ${escapeHtml(getGoalScopeLabel(run.goal || {}))}</p>
        <p>${escapeHtml(countPlannedScreens(run) || 0)} placements | ${escapeHtml(run.liveCount || 0)} live | ${escapeHtml(
          formatGoalFlightSummary(run.goal?.flightStartDate, run.goal?.flightEndDate)
        )}</p>
        <p>Budget ${escapeHtml(
          maxSpend > 0 ? `${formatMoney(selectedSpend)} / ${formatMoney(maxSpend)}` : "Not priced"
        )} | ${escapeHtml(run.appliedAt ? `Live ${formatTimestamp(run.appliedAt)}` : `Created ${formatTimestamp(run.createdAt)}`)}</p>
        <span class="record__actions">
          <button type="button" class="btn btn--tiny js-load-goal-plan" data-plan-id="${escapeHtml(run.planId || "")}" ${
            loadPending ? "disabled" : ""
          }>${escapeHtml(loadingThisPlan ? "Opening..." : primaryActionLabel)}</button>
        </span>
      </article>`;
    }),
    hiddenCount > 0 ? `<p class="monitoring-card__note">Showing the latest ${runs.length} of ${state.agentRuns.length} campaigns.</p>` : ""
  ].join("");
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
    container.innerHTML = '<div class="empty">No data yet.</div>';
    return;
  }

  const visibleEntries = entries.slice(0, 6);
  container.innerHTML = visibleEntries
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
          ${escapeHtml(formatCount(entry.playCount || 0))} plays | ${escapeHtml(formatDuration(entry.exposureMs || 0))} exposure | ${escapeHtml(
            formatDuration(entry.avgExposureMs || 0)
          )} avg dwell
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
    return `vs prior window ${baselineText}`;
  }
  return `vs prior window ${baselineText} (${deltaText})`;
}

function getMeasurementCardBadge(metric = {}) {
  switch (metric.key) {
    case "interactionRate":
      return { label: "Live + estimate", className: "measurement-card__badge--blend" };
    case "qrScans":
      return { label: "Estimated action", className: "measurement-card__badge--modeled" };
    case "incrementality":
    case "newBuyerAcquisition":
      return { label: "Estimated outcome", className: "measurement-card__badge--retail" };
    case "inStoreROAS":
      return { label: "Estimated efficiency", className: "measurement-card__badge--accent" };
    default:
      return { label: "Estimated metric", className: "measurement-card__badge--modeled" };
  }
}

function buildMeasurementMetricNote(metric = {}) {
  const secondaryValueText = String(metric?.secondaryValueText || "").trim();
  switch (metric.key) {
    case "interactionRate":
      return secondaryValueText
        ? `${secondaryValueText} loyalty actions included in the response rate.`
        : "Estimated QR and loyalty response against live plays.";
    case "qrScans":
      return secondaryValueText
        ? `${secondaryValueText} modeled loyalty handoffs from scan intent.`
        : "Estimated coupon and product-detail opens from screen exposure.";
    case "incrementality":
      return secondaryValueText
        ? `${secondaryValueText} baseline sales without media.`
        : "Estimated sales lift above the no-media baseline.";
    case "newBuyerAcquisition":
      return secondaryValueText
        ? `${secondaryValueText} estimated new-to-brand transactions.`
        : "Estimated first-time brand purchase value.";
    case "inStoreROAS":
      return "Estimated in-store sales returned per dollar of selected spend.";
    default:
      return String(metric?.description || "").trim();
  }
}

function buildMeasurementSummaryFacts(items = []) {
  const facts = items.filter((item) => item?.label && item?.value);
  if (facts.length === 0) {
    return "";
  }
  return `<div class="measurement-summary__facts">${facts
    .map(
      (item) => `<span class="measurement-summary__fact">
        <span class="measurement-summary__fact-label">${escapeHtml(item.label)}</span>
        <span class="measurement-summary__fact-value">${escapeHtml(item.value)}</span>
      </span>`
    )
    .join("")}</div>`;
}

function renderMeasurementBoard(board) {
  if (!elements.measurementBoardGrid) {
    return;
  }

  const metrics = Array.isArray(board?.metrics)
    ? board.metrics.filter((metric) => !["totalExposureTime", "totalAdPlays"].includes(metric?.key))
    : [];
  if (metrics.length === 0) {
    elements.measurementBoardGrid.innerHTML = DEFAULT_MEASUREMENT_BOARD_GRID_HTML;
    return;
  }

  elements.measurementBoardGrid.innerHTML = metrics
    .map((metric) => {
      const comparisonText = getMeasurementComparisonText(metric);
      const detailText = buildMeasurementMetricNote(metric);
      const badge = getMeasurementCardBadge(metric);
      const accentClass = metric?.key === "inStoreROAS" ? " measurement-card--accent" : "";

      return `<article class="measurement-card${accentClass}">
        <span class="measurement-card__badge ${escapeHtml(badge.className)}">${escapeHtml(badge.label)}</span>
        <p class="measurement-card__label">${escapeHtml(metric?.label || "Metric")}</p>
        <strong>${escapeHtml(metric?.valueText || formatCount(metric?.value || 0))}</strong>
        ${comparisonText ? `<p class="measurement-card__comparison">${escapeHtml(comparisonText)}</p>` : ""}
        ${detailText ? `<p class="measurement-card__detail">${escapeHtml(detailText)}</p>` : ""}
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
      ? `Launch ${brandContext.brand}'s campaign to populate live delivery first. Estimated shopper and sales outcomes appear once telemetry is flowing.`
      : "Launch a campaign to populate live delivery first. Estimated shopper and sales outcomes appear once telemetry is flowing.";
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
    const summaryFacts = [
      scope.scopeLabel ? { label: "Scope", value: scope.scopeLabel } : null,
      Number(scope.storeCount || 0) > 0 || Number(scope.screenCount || 0) > 0
        ? {
            label: "Coverage",
            value: [
              Number(scope.storeCount || 0) > 0 ? `${formatCount(scope.storeCount || 0)} store${Number(scope.storeCount || 0) === 1 ? "" : "s"}` : "",
              Number(scope.screenCount || 0) > 0 ? `${formatCount(scope.screenCount || 0)} screen${Number(scope.screenCount || 0) === 1 ? "" : "s"}` : ""
            ]
              .filter(Boolean)
              .join(" / ")
          }
        : null,
      Number(scope.selectedSpend || 0) > 0 ? { label: "Budget", value: formatMoney(scope.selectedSpend || 0) } : null,
      totals.lastSeenAt ? { label: "Updated", value: formatTimestamp(totals.lastSeenAt) } : null
    ].filter(Boolean);
    const summaryHeadline = brandContext.brand
      ? `${brandContext.brand} measurement readout`
      : measurementBoard.narrative.headline || "Measurement readout";
    const trendText = `Live delivery: ${formatCount(totals.playCount || 0)} plays | ${formatDuration(totals.exposureMs || 0)} exposure`;
    const modeledOutcomeText = `Estimated outcome: ${formatMoney(measurementBoard?.current?.modeledInStoreSales || 0)} in-store sales | ${formatMoney(
      measurementBoard?.current?.incrementalSales || 0
    )} incremental sales`;
    const comparisonText =
      comparison?.afterApply && comparison?.beforeApply
        ? `Compared with the prior window: ${formatCount(comparison.afterApply.playCount || 0)} plays after apply vs ${formatCount(
            comparison.beforeApply.playCount || 0
          )} before apply`
        : comparison?.planId
          ? `Plan ${comparison.planId} is loaded. Before and after comparison will fill in as more live delivery arrives.`
          : "";

    elements.telemetrySummary.innerHTML = `
      <p class="measurement-summary__eyebrow">Measurement snapshot</p>
      <strong class="measurement-summary__headline">${escapeHtml(summaryHeadline)}</strong>
      ${buildMeasurementSummaryFacts(summaryFacts)}
      <p class="measurement-summary__trend">${escapeHtml(trendText)}</p>
      <p class="measurement-summary__comparison">${escapeHtml(modeledOutcomeText)}</p>
      ${comparisonText ? `<p class="measurement-summary__comparison">${escapeHtml(comparisonText)}</p>` : ""}
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
      <strong>Campaign dashboard</strong>
      <p class="goal-change__metrics">
        ${escapeHtml(formatCount(totals.playCount || 0))} plays | ${escapeHtml(formatDuration(totals.exposureMs || 0))} exposure |
        ${escapeHtml(formatCount(totals.screenCount || 0))} screens
      </p>
      <p class="goal-change__metrics">
        ${escapeHtml(formatCount(totals.templateCount || 0))} creative${Number(totals.templateCount || 0) === 1 ? "" : "s"} |
        ${escapeHtml(formatCount(totals.skuCount || 0))} SKU${Number(totals.skuCount || 0) === 1 ? "" : "s"}
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
  const nextKey = buildPreviewRailKey(uniqueIds);
  if (state.previewRailKey === nextKey) {
    return;
  }
  state.previewRailKey = nextKey;
  state.previewRailRequestId += 1;
  const requestId = state.previewRailRequestId;

  if (uniqueIds.length === 0) {
    elements.monitorPreviewRail.innerHTML = `
      <p class="preview-pane__eyebrow">${escapeHtml(brandContext.brand ? `${brandContext.brand} preview` : "Campaign preview")}</p>
      <h4>No live campaigns to show a preview</h4>
      <p id="monitoringNarrative">${escapeHtml("No live campaigns to show a preview.")}</p>
    `;
    elements.monitoringNarrative = qs("#monitoringNarrative");
    return;
  }

  renderPreviewRailCards(uniqueIds.map((screenId) => ({ screenId, loading: true })));
  loadPreviewRailSnapshots(uniqueIds, nextKey, requestId).catch(() => {
    // Preview failures are rendered per-card; ignore unexpected promise rejections.
  });
}

function buildLiveScreenSearchText(screen = {}) {
  const products = Array.isArray(screen.products) ? screen.products : [];
  return [
    screen.screenId,
    screen.storeId,
    screen.pageId,
    screen.location,
    screen.screenType,
    screen.screenSize,
    screen.templateName || screen.templateId,
    getScreenResolverId(screen),
    ...products.flatMap((product) => [product?.sku, product?.name])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getFilteredLiveScreens(liveScreens, query) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  if (!normalizedQuery) {
    return [...liveScreens];
  }
  return liveScreens.filter((screen) => buildLiveScreenSearchText(screen).includes(normalizedQuery));
}

function getSelectedLiveScreenId(filteredScreens) {
  const currentId = String(state.goalLiveSelectedScreenId || "").trim();
  if (currentId && filteredScreens.some((screen) => screen.screenId === currentId)) {
    return currentId;
  }
  const fallbackId = String(filteredScreens[0]?.screenId || "").trim();
  state.goalLiveSelectedScreenId = fallbackId;
  return fallbackId;
}

function buildLiveSearchMeta(totalCount, filteredCount, query) {
  if (totalCount <= 0) {
    return "No live screens yet.";
  }

  const shownCount = Math.min(filteredCount, LIVE_SCREEN_RESULT_LIMIT);
  if (String(query || "").trim()) {
    if (filteredCount <= 0) {
      return `No screens match "${query}".`;
    }
    return `Showing ${formatCount(shownCount)} of ${formatCount(filteredCount)} matches from ${formatCount(totalCount)} live screens.`;
  }

  if (totalCount > LIVE_SCREEN_RESULT_LIMIT) {
    return `${formatCount(totalCount)} live screens. Showing ${formatCount(shownCount)} at a time.`;
  }
  return `${formatCount(totalCount)} live screens.`;
}

function formatLiveRefreshInterval(value) {
  const refreshMs = Math.max(0, Number(value || 0));
  if (!refreshMs) {
    return "";
  }
  const seconds = Math.max(1, Math.round(refreshMs / 1000));
  return `${seconds}s refresh`;
}

function getLivePreviewScreenIds(liveScreens, selectedScreenId) {
  return [...new Set([selectedScreenId, ...liveScreens.map((screen) => screen.screenId)].filter(Boolean))].slice(0, 2);
}

function renderLiveScreenDetail(screen) {
  if (!elements.goalLiveDetail) {
    return;
  }

  if (!screen) {
    elements.goalLiveDetail.innerHTML = '<div class="empty">Select a screen to inspect the live placement.</div>';
    return;
  }

  const products = Array.isArray(screen.products) ? screen.products : [];
  const productMarkup =
    products.length > 0
      ? `<div class="goal-live-products">${products.map((product) => buildGoalLiveProductMarkup(product)).join("")}</div>`
      : '<div class="empty">No product payload attached to this screen.</div>';
  const stats = [
    screen.storeId || "",
    screen.pageId || "",
    screen.location || "",
    screen.screenType || "",
    screen.screenSize || "",
    formatLiveRefreshInterval(screen.refreshInterval)
  ].filter(Boolean);

  elements.goalLiveDetail.innerHTML = `<article class="goal-live-inspector">
    <div class="goal-live-inspector__top">
      <div>
        <p class="section-kicker">Selected screen</p>
        <h4>${escapeHtml(screen.screenId || "Live screen")}</h4>
        <p class="goal-live-inspector__copy">${escapeHtml(
          [screen.storeId, screen.pageId, screen.location].filter(Boolean).join(" | ") || "Active live screen"
        )}</p>
      </div>
      <span class="pill">${escapeHtml(screen.templateName || screen.templateId || "Creative")}</span>
    </div>
    ${stats.length > 0 ? `<div class="goal-live-inspector__stats">${stats.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
    <div class="goal-live-inspector__section">
      <p class="goal-live-inspector__label">Products</p>
      ${productMarkup}
    </div>
    <div class="record__actions">
      <a href="${escapeHtml(buildSharedPreviewUrl(screen))}" target="_blank" rel="noreferrer">Immersive preview</a>
      <a href="${escapeHtml(buildDebugScreenUrl(screen.screenId || ""))}" target="_blank" rel="noreferrer">Debug preview</a>
    </div>
  </article>`;
}

function renderLiveScreens() {
  if (!elements.goalLiveSummary || !elements.goalLiveScreens) {
    return;
  }

  const plan = state.activeGoalPlan;
  const brandContext = getGoalPlanBrandContext(plan);
  if (elements.goalLiveSearch) {
    elements.goalLiveSearch.value = state.goalLiveQuery;
  }

  if (!plan || plan.status !== "applied") {
    elements.goalLiveSummary.classList.add("empty");
    elements.goalLiveSummary.textContent = brandContext.brand
      ? `Launch ${brandContext.brand}'s campaign to view live placements and creatives.`
      : "Launch the selected campaign to view live placements and creatives.";
    if (elements.goalLiveSearch) {
      elements.goalLiveSearch.disabled = true;
    }
    if (elements.goalLiveSearchMeta) {
      elements.goalLiveSearchMeta.textContent = "No live screens yet.";
    }
    elements.goalLiveScreens.innerHTML = "";
    renderLiveScreenDetail(null);
    if (elements.monitorPreviewLink) {
      elements.monitorPreviewLink.href = buildSharedPreviewUrl(getPreferredPreviewScreenIds()[0] || "");
    }
    renderPreviewRail(getPreferredPreviewScreenIds());
    return;
  }

  const liveScreens = Array.isArray(plan.liveScreens) ? plan.liveScreens : [];
  if (elements.goalLiveSearch) {
    elements.goalLiveSearch.disabled = liveScreens.length === 0;
  }
  elements.goalLiveSummary.classList.remove("empty");
  elements.goalLiveSummary.innerHTML = `
    <strong>${escapeHtml(brandContext.brand ? `${brandContext.brand} live network` : "Live network")}</strong>
    <p class="goal-change__metrics">
      ${escapeHtml(formatCount(plan.liveCount || liveScreens.length || 0))} screens | ${escapeHtml(
        brandContext.objectiveLabel || "Active campaign"
      )} | Live since ${escapeHtml(formatTimestamp(plan.appliedAt || plan.updatedAt || plan.createdAt))}
    </p>
    <p class="goal-change__metrics">
      ${brandContext.accountLabel ? `Account ${escapeHtml(brandContext.accountLabel)} | ` : ""}Campaign ${escapeHtml(plan.planId || "")} | Budget ${escapeHtml(
        formatMoney(plan?.budget?.selectedSpend || 0)
      )}
    </p>
  `;

  if (liveScreens.length === 0) {
    if (elements.goalLiveSearchMeta) {
      elements.goalLiveSearchMeta.textContent = "No live screens were captured for this run.";
    }
    elements.goalLiveScreens.innerHTML = '<div class="empty">No live screens were captured for this applied run.</div>';
    renderLiveScreenDetail(null);
    if (elements.monitorPreviewLink) {
      elements.monitorPreviewLink.href = buildSharedPreviewUrl(getPreferredPreviewScreenIds()[0] || "");
    }
    renderPreviewRail(getPreferredPreviewScreenIds());
    return;
  }

  const filteredScreens = getFilteredLiveScreens(liveScreens, state.goalLiveQuery);
  const selectedScreenId = getSelectedLiveScreenId(filteredScreens);
  const selectedScreen = filteredScreens.find((screen) => screen.screenId === selectedScreenId) || null;
  const visibleScreens = filteredScreens.slice(0, LIVE_SCREEN_RESULT_LIMIT);

  if (elements.goalLiveSearchMeta) {
    elements.goalLiveSearchMeta.textContent = buildLiveSearchMeta(liveScreens.length, filteredScreens.length, state.goalLiveQuery);
  }

  elements.goalLiveScreens.innerHTML =
    visibleScreens.length > 0
      ? visibleScreens
          .map((screen) => {
            const isActive = screen.screenId === selectedScreenId;
            const metaLine = [screen.storeId, screen.pageId, screen.location].filter(Boolean).join(" | ");
            const detailLine = [screen.screenType, screen.screenSize, formatLiveRefreshInterval(screen.refreshInterval)]
              .filter(Boolean)
              .join(" | ");
            return `<button type="button" class="goal-live-result${isActive ? " is-active" : ""} js-select-live-screen" data-screen-id="${escapeHtml(
              screen.screenId || ""
            )}">
              <span class="goal-live-result__top">
                <strong>${escapeHtml(screen.screenId || "Live screen")}</strong>
                <span>${escapeHtml(screen.templateName || screen.templateId || "")}</span>
              </span>
              ${metaLine ? `<span class="goal-live-result__meta">${escapeHtml(metaLine)}</span>` : ""}
              ${detailLine ? `<span class="goal-live-result__meta">${escapeHtml(detailLine)}</span>` : ""}
            </button>`;
          })
          .join("")
      : '<div class="empty">No live screens match this search.</div>';

  renderLiveScreenDetail(selectedScreen);
  if (elements.monitorPreviewLink) {
    elements.monitorPreviewLink.href = buildSharedPreviewUrl(selectedScreen || liveScreens[0] || "");
  }
  renderPreviewRail(getLivePreviewScreenIds(liveScreens, selectedScreenId));
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
        } in-store screen(s). The immersive preview rail is scoped to the active campaign only.`
      : `The active campaign is live across ${
          state.activeGoalPlan.liveCount || state.activeGoalPlan.liveScreens?.length || 0
        } in-store screen(s). The immersive preview rail is scoped to the active campaign only.`;
    return;
  }

  elements.monitoringNarrative.textContent = "No live campaigns to show a preview.";
}

function renderAll() {
  renderMarketStoryOverlay();
  refreshPageCounter();
  renderSupplySummary();
  renderPresetSummary();
  renderSupplyHandoff();
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
  state.inventoryStoreIds = [...new Set(state.screens.map((screen) => screen.storeId).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
  state.inventoryPageIds = [...new Set(state.pages.map((page) => page.pageId).filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
  state.manualSupplyConfirmed = state.screens.some((screen) => screen.screenId === getManualSupplyConfig().screen.screenId);
}

async function refreshProductFeed() {
  const response = await requestJson("/api/products?limit=2000");
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
  return runPendingAction("pricing:save", async () => {
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
    showToast("Retailer CPM card saved.");
    showStatus("Retailer pricing updated. New buying plans will use the saved CPMs and modeled impression delivery.");
  }, { lockKey: "pricing" });
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
  return runPendingAction("inventory:page", async () => {
    const payload = readPagePayload();
    if (!findPageRecord(payload.pageId)) {
      await requestJson("/api/pages", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showToast(`Page ${payload.pageId} added.`);
    } else {
      showToast(`Page ${payload.pageId} already exists. Continuing with the existing page.`);
    }

    await Promise.all([refreshDemoConfig(), refreshInventory()]);
    populatePageSelect(payload.pageId);
    renderAll();
    showStatus(`Page ${payload.pageId} is ready.`);
  }, { lockKey: "inventory" });
}

async function createAnchorPlacement() {
  return runPendingAction("inventory:anchor", async () => {
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

    const existingPage = findPageRecord(pagePayload.pageId);
    if (!existingPage) {
      await requestJson("/api/pages", {
        method: "POST",
        body: JSON.stringify(pagePayload)
      });
    }

    const existingScreen = findScreenRecord(screenPayload.screenId);
    if (existingScreen) {
      await requestJson(`/api/screens/${encodeURIComponent(existingScreen.screenId)}`, {
        method: "PUT",
        body: JSON.stringify(screenPayload)
      });
    } else {
      await requestJson("/api/screens", {
        method: "POST",
        body: JSON.stringify(screenPayload)
      });
    }

    await Promise.all([refreshDemoConfig(), refreshInventory()]);
    state.manualSupplyConfirmed = state.screens.some((screen) => screen.screenId === getManualSupplyConfig().screen.screenId);
    state.supplyHandoffAcknowledged = false;
    state.lastDemoAction = {
      kind: "anchor",
      message: `Anchor ready. ${screenPayload.screenId} is mapped to ${pagePayload.pageId}.`
    };

    syncSupplyFormDefaults();
    renderAll();
    showToast("Anchor placement ready.");
    showStatus("Anchor placement is ready. Apply the shared preset to finish Supply.");
  }, { lockKey: "inventory" });
}

async function handleScreenSubmit(event) {
  event.preventDefault();
  return runPendingAction("inventory:screen", async () => {
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
    } else if (!findScreenRecord(payload.screenId)) {
      await requestJson("/api/screens", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      showToast(`Screen ${payload.screenId} added.`);
    } else {
      shouldEnterEditMode = true;
      showToast(`Screen ${payload.screenId} already exists. Loading it into edit mode.`);
    }

    await Promise.all([refreshDemoConfig(), refreshInventory()]);
    if (
      effectiveScreenId === getManualSupplyConfig().screen.screenId &&
      state.screens.some((screen) => screen.screenId === effectiveScreenId)
    ) {
      state.manualSupplyConfirmed = true;
      state.supplyHandoffAcknowledged = false;
    }
    syncSupplyFormDefaults();
    renderAll();

    if (!editingId && shouldEnterEditMode && state.screens.some((screen) => screen.screenId === payload.screenId)) {
      beginScreenEdit(payload.screenId);
    }

    if (effectiveScreenId === getManualSupplyConfig().screen.screenId) {
      showStatus("Anchor screen is ready. Load the preset to expand the rest of the supply setup.");
    }
  }, { lockKey: "inventory" });
}

async function deleteScreen(screenId) {
  if (!screenId) {
    return;
  }

  const confirmed = window.confirm(`Delete screen ${screenId}?`);
  if (!confirmed) {
    return;
  }
  return runPendingAction(`inventory:delete:${screenId}`, async () => {
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
      state.presetSimulatedInSession = false;
      state.supplyHandoffAcknowledged = false;
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
  }, { lockKey: "inventory" });
}

async function handleGoalPlanSubmit(event) {
  event.preventDefault();
  return runPendingAction("goalPlan", async () => {
    if (!ensureGoalPlanningReadyForSubmit()) {
      return;
    }
    const prepared = prepareGoalPayloadForDemo();
    showStatus("AI is generating the in-store buy...");
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
    state.supplyHandoffAcknowledged = true;
    renderAll();
    setStage("buying", true);
    showToast("In-store buy ready.");
    showStatus(
      state.activeGoalPlan?.goal?.scopeMessage ||
        state.activeGoalPlan?.goal?.stockMessage ||
        prepared.scopeMessage ||
        "In-store buy ready. Edit placements if needed, then set the budget and launch."
    );
  });
}

async function applyGoalPlan(planId = "") {
  const chosenPlanId = String(planId || state.activeGoalPlan?.planId || "").trim();
  if (!chosenPlanId) {
    throw new Error("No plan selected.");
  }
  return runPendingAction(`goalPlanApply:${chosenPlanId}`, async () => {
    const targetPlan =
      chosenPlanId === state.activeGoalPlan?.planId
        ? state.activeGoalPlan
        : state.agentRuns.find((entry) => entry.planId === chosenPlanId) || state.activeGoalPlan;
    const budgetSpend = getActiveGoalBudgetSpend(targetPlan);
    const selectedScreenIds = getGoalPlacementSelectionIds(targetPlan);

    showStatus("Launching the approved buy...");
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

    state.supplyHandoffAcknowledged = true;
    renderAll();
    setStage("monitoring", true);
    showToast(`Activation live on ${response.liveCount || response.appliedCount || 0} placement(s).`);
    showStatus(
      `Activation ${chosenPlanId} is live at ${formatMoney(response.run?.budget?.selectedSpend || budgetSpend)}. Monitoring is ready.`
    );
  }, { lockKey: "goalPlanApply" });
}

async function loadGoalPlan(planId) {
  const run = state.agentRuns.find((entry) => entry.planId === planId);
  if (!run) {
    showToast(`Plan ${planId} not found.`, true);
    return;
  }
  return runPendingAction(`goalPlanLoad:${planId}`, async () => {
    state.activeGoalPlan = run;
    if (run.planId) {
      state.sessionPlanIds.add(run.planId);
    }
    syncGoalPlacementSelectionFromPlan(run, { overwrite: run.status === "applied" });
    setGoalBudgetStateFromPlan(run);
    syncGoalFormFromRun(run);
    state.supplyHandoffAcknowledged = true;

    if (run.status === "applied") {
      await Promise.all([refreshLiveState(run.planId), refreshTelemetryData(run.planId)]);
      setStage("monitoring", true);
    } else {
      await refreshTelemetryData(run.planId);
      setStage("buying", true);
    }

    renderAll();
    showStatus(`Loaded recommendation ${planId}.`);
  }, { lockKey: "goalPlanLoad" });
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
    if (!findPageRecord(page.pageId)) {
      await requestJson("/api/pages", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      createdPageIds.push(page.pageId);
    } else {
      updatedPageIds.push(page.pageId);
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
    const existingScreen = findScreenRecord(screen.screenId);
    if (!existingScreen) {
      await requestJson("/api/screens", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      createdScreenIds.push(screen.screenId);
    } else {
      await requestJson(`/api/screens/${encodeURIComponent(existingScreen.screenId)}`, {
        method: "PUT",
        body: JSON.stringify(payload)
      });
      updatedScreenIds.push(screen.screenId);
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

function buildSimulatedPresetResponse() {
  const { actualConfigured, total } = getSupplyProgress();
  return {
    simulated: true,
    result: {
      simulated: true,
      addedScreenCount: Math.max(total - actualConfigured, 0),
      affectedStoreCount: getDemoStoreCount()
    }
  };
}

async function loadPreset() {
  return runPendingAction("inventory:preset", async () => {
    if (!isManualSupplyConfirmed()) {
      throw new Error("Add the anchor screen first, then load the preset.");
    }

    showStatus("Applying the shared preset...");
    const response = shouldSimulateLargePresetLoad()
      ? buildSimulatedPresetResponse()
      : (await requestOptionalJson("/api/demo/preset", { method: "POST" })) || (await loadPresetFallback());

    if (response.demo) {
      state.demo = normalizeDemoConfig(response.demo);
    } else if (!response.simulated) {
      await refreshDemoConfig();
    }

    state.lastDemoAction = {
      kind: "preset",
      result: response.result || {},
      message: buildDemoActionMessage("preset", response.result || {})
    };

    state.presetLoadedInSession = true;
    state.presetSimulatedInSession = Boolean(response.simulated);
    state.supplyHandoffAcknowledged = false;
    state.activeGoalPlan = null;
    state.goalPlacementSelections.clear();
    state.goalBudgetPlanId = "";
    state.goalBudgetSpend = null;
    state.agentRuns = [];
    state.telemetrySummary = null;
    state.sessionPlanIds.clear();

    if (!response.simulated) {
      await refreshInventory();
    }
    syncBuyingFormDefaults(true);
    renderAll();
    elements.supplyHandoffCard?.scrollIntoView({ behavior: "smooth", block: "center" });
    showToast(state.lastDemoAction.message);
    showStatus("Supply setup is complete. Review the handoff, then continue into CMax buying.");
  }, { lockKey: "inventory" });
}

async function resetDemo() {
  return runPendingAction("inventory:reset", async () => {
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
    state.presetSimulatedInSession = false;
    state.supplyHandoffAcknowledged = false;
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
  }, { lockKey: "inventory" });
}

function handleError(error) {
  if (error?.workspaceSelectionRequired) {
    return;
  }
  showToast(error.message, true);
  showStatus(error.message, true);
}

function continueToBuying() {
  if (!isSupplyPresetReady()) {
    return;
  }

  state.supplyHandoffAcknowledged = true;
  renderAll();
  setStage("buying", true);
  showToast("Supply handoff confirmed.");
  showStatus("Supply setup confirmed. Continue with the CMax brief.");
}

function wireEvents() {
  document.addEventListener("click", (event) => {
    const workspaceCard = event.target.closest(".workspace-card");
    if (workspaceCard) {
      claimWorkspace(workspaceCard.dataset.workspaceId || "").catch(handleError);
      return;
    }

    if (event.target.closest("#switchWorkspaceBtn")) {
      releaseWorkspace().catch(handleError);
      return;
    }

    const stageJump = event.target.closest(".js-stage-jump");
    if (stageJump) {
      setStage(stageJump.dataset.stage || "supply", true);
      return;
    }

    if (event.target.closest("#marketStoryBackBtn")) {
      state.marketStoryStep = Math.max(getActiveMarketStoryStep() - 1, 0);
      renderAll();
      return;
    }

    if (event.target.closest("#marketStoryNextBtn")) {
      const atLastStep = getActiveMarketStoryStep() >= MARKET_STORY_STEPS.length - 1;
      if (atLastStep) {
        setMarketIntroAcknowledged(true);
        renderAll();
        elements.supplyWorkflowShell?.scrollIntoView({ behavior: "smooth", block: "start" });
        showStatus("Commercial case covered. CYield step 1 is ready.");
      } else {
        state.marketStoryStep = getActiveMarketStoryStep() + 1;
        renderAll();
      }
      return;
    }

    if (event.target.closest("#marketStorySkipBtn")) {
      setMarketIntroAcknowledged(true);
      renderAll();
      elements.supplyWorkflowShell?.scrollIntoView({ behavior: "smooth", block: "start" });
      showStatus("Skipped the opening story. CYield step 1 is ready.");
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

    if (event.target.closest("#continueToBuyingBtn")) {
      continueToBuying();
      return;
    }

    if (event.target.closest("#resetDemoBtn")) {
      resetDemo().catch(handleError);
      return;
    }

    const selectLiveScreenButton = event.target.closest(".js-select-live-screen");
    if (selectLiveScreenButton) {
      state.goalLiveSelectedScreenId = selectLiveScreenButton.dataset.screenId || "";
      renderLiveScreens();
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
    showStatus("Step 2 unlocked. Set the flight and scope before moving to SKU selection in Step 3.");
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
    showStatus("Step 3 unlocked. Choose SKUs manually or use the AI brief to build the shortlist.");
    publishPresenterSnapshot();
  });
  elements.goalBrandAccount?.addEventListener("change", () => {
    const removedCount = reconcileSelectedGoalSkusToBrand();
    renderGoalProductCategoryOptions();
    if (getGoalPromptText()) {
      markGoalPromptSelectionDirty();
    } else {
      renderGoalProducts();
    }
    applyGoalScopeSuggestionFromSelection();
    const account = getGoalAccountByAdvertiserId();
    if (removedCount > 0) {
      showStatus(`Account changed. Removed ${removedCount} SKU(s) from the previous account.`);
    } else if (account?.brand) {
      showStatus(
        getGoalPromptText()
          ? `Assortment filtered to ${getProductAccountLabel(account)}. Click Let AI choose SKU's to refresh the shortlist.`
          : `Assortment filtered to ${getProductAccountLabel(account)}.`
      );
    } else {
      showStatus("Choose an account to continue planning.");
    }
    publishPresenterSnapshot();
  });
  elements.goalObjective?.addEventListener("change", () => {
    if (getGoalPromptText()) {
      markGoalPromptSelectionDirty();
    } else {
      renderGoalPlanningFlow();
    }
    publishPresenterSnapshot();
  });
  elements.goalAggressiveness?.addEventListener("change", () => {
    if (getGoalPromptText()) {
      markGoalPromptSelectionDirty();
    } else {
      renderGoalPlanningFlow();
    }
    publishPresenterSnapshot();
  });
  elements.goalStoreScope?.addEventListener("change", () => {
    if (getGoalPromptText()) {
      markGoalPromptSelectionDirty();
    } else {
      renderGoalPlanningFlow();
    }
    publishPresenterSnapshot();
  });
  elements.goalPageScope?.addEventListener("change", () => {
    if (getGoalPromptText()) {
      markGoalPromptSelectionDirty();
    } else {
      renderGoalPlanningFlow();
    }
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
    markGoalPromptSelectionDirty();
    publishPresenterSnapshot();
  });
  elements.goalPromptRunBtn?.addEventListener("click", () => {
    applyGoalPromptSelection().catch(handleError);
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
    if (getGoalPromptText()) {
      markGoalPromptSelectionDirty();
    } else {
      renderGoalProducts();
    }
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
    setGoalSkuSelectionMode("manual");
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
    setGoalSkuSelectionMode("manual");
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
    runPendingAction(
      "inventory:refresh",
      () =>
        Promise.all([refreshDemoConfig(), refreshInventory()])
          .then(() => {
            renderAll();
            showToast("Supply refreshed.");
          })
          .catch(handleError),
      { lockKey: "inventory" }
    );
  });
  elements.refreshRunsBtn?.addEventListener("click", () => {
    runPendingAction("goalRunsRefresh", () =>
      Promise.all([
        refreshGoalRunsData(),
        refreshLiveState(state.activeGoalPlan?.planId || ""),
        refreshTelemetryData(state.activeGoalPlan?.planId || "")
      ])
        .then(() => {
          renderAll();
          showToast("Runs refreshed.");
        })
        .catch(handleError)
    );
  });
  elements.refreshTelemetryBtn?.addEventListener("click", () => {
    runPendingAction("telemetryRefresh", () =>
      refreshTelemetryData(state.activeGoalPlan?.planId || "")
        .then(() => {
          renderAll();
          showToast("Telemetry refreshed.");
        })
        .catch(handleError)
    );
  });
  elements.goalLiveSearch?.addEventListener("input", () => {
    state.goalLiveQuery = elements.goalLiveSearch?.value || "";
    state.goalLiveSelectedScreenId = "";
    renderLiveScreens();
  });
  document.addEventListener("keydown", (event) => {
    if (!isSupplyMarketIntroActive()) {
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      state.marketStoryStep = Math.max(getActiveMarketStoryStep() - 1, 0);
      renderAll();
      return;
    }
    if (event.key === "ArrowRight" || event.key === " " || event.key === "Enter") {
      event.preventDefault();
      const atLastStep = getActiveMarketStoryStep() >= MARKET_STORY_STEPS.length - 1;
      if (atLastStep) {
        setMarketIntroAcknowledged(true);
        renderAll();
        elements.supplyWorkflowShell?.scrollIntoView({ behavior: "smooth", block: "start" });
        showStatus("Commercial case covered. CYield step 1 is ready.");
      } else {
        state.marketStoryStep = getActiveMarketStoryStep() + 1;
        renderAll();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setMarketIntroAcknowledged(true);
      renderAll();
      elements.supplyWorkflowShell?.scrollIntoView({ behavior: "smooth", block: "start" });
      showStatus("Skipped the opening story. CYield step 1 is ready.");
    }
  });
  window.addEventListener("beforeunload", () => {
    stopWorkspaceOverlayPolling();
    cancelMarketStoryAnimations();
    presenterChannel?.close();
    presenterChannel = null;
  });
}

async function init() {
  try {
    wireEvents();
    await ensureWorkspaceClaim();
    syncMarketIntroAcknowledged();
    await refreshDemoConfig();
    state.options = await requestJson("/api/options");
    state.goalPromptInferenceProvider = readTextValue(state.options?.goalPromptInferenceProvider || "");
    state.goalPromptInferenceModel = readTextValue(state.options?.goalPromptInferenceModel || "");
    await Promise.all([refreshProductFeed(), refreshInventory(), refreshGoalRunsData()]);

    renderOptions();
    syncSupplyFormDefaults();
    syncBuyingFormDefaults(true);
    renderGoalProductCategoryOptions();
    renderGoalProducts();

    await refreshTelemetryData();

    renderAll();
    setStage("supply", false);
    showStatus(
      isSupplyMarketIntroActive()
        ? "Start with the opening story, then enter CYield step 1."
        : "Ready for the CYield supply setup."
    );
  } catch (error) {
    handleError(error);
  }
}

await init();
