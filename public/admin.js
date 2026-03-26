const UI_STAGES = ["supply", "buying", "monitoring"];
const SHARED_PLAYER_URL = "/screen.html";
const DEFAULT_DEMO_STORE_ID = "DEMO-ANCHOR";
const DEMO_SUPPLY_STARTER_SUFFIX = "CYIELD_ENTRANCE_HERO";
const DEMO_BUYING_STARTER_SUFFIX = "CMAX_CHECKOUT_KIOSK";
const LIVE_SCREEN_RESULT_LIMIT = 12;
let workspaceRecoveryScheduled = false;
const WORKSPACE_INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const WORKSPACE_ACTIVITY_HEARTBEAT_INTERVAL_MS = 60 * 1000;
const WORKSPACE_ACTIVITY_ACTIVE_GRACE_MS = WORKSPACE_ACTIVITY_HEARTBEAT_INTERVAL_MS + 5000;

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
    pageType: "In-Store Zone",
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
    refreshInterval: 30000,
    screenShareSlots: 6,
    defaultSellableShareSlots: 1
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
const GOAL_AGGRESSIVENESS_EXPLANATIONS = Object.freeze({
  default: "Controls how hard the planner pushes for scale, scope expansion, and placement pressure. Screen cadence stays fixed.",
  Conservative: "Conservative keeps the buy tighter, stays closer to your chosen scope, and widens only when the upside is clear. Screen cadence stays fixed.",
  Balanced: "Balanced is the default. It opens up when there is clear upside, without pushing the broadest possible plan. Screen cadence stays fixed.",
  Aggressive: "Aggressive pushes harder for scale, widens scope faster, and leans into broader coverage when the model sees upside. Screen cadence stays fixed."
});
const SCREEN_SHARE_PRESETS = Object.freeze([
  { value: "1/6", label: "1/6 share", screenShareSlots: 6, defaultSellableShareSlots: 1 },
  { value: "1/4", label: "1/4 share", screenShareSlots: 4, defaultSellableShareSlots: 1 },
  { value: "1/3", label: "1/3 share", screenShareSlots: 3, defaultSellableShareSlots: 1 },
  { value: "1/2", label: "1/2 share", screenShareSlots: 2, defaultSellableShareSlots: 1 },
  { value: "1/1", label: "Full screen", screenShareSlots: 1, defaultSellableShareSlots: 1 }
]);
const DEFAULT_SCREEN_SHARE_PRESET = "1/6";
const SCREEN_SHARE_PRESET_MAP = new Map(SCREEN_SHARE_PRESETS.map((preset) => [preset.value, preset]));
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
      "Treat screens like pages, create one screen, then auto build the remaining demo inventory.",
      buildDemoScreenId(DEFAULT_DEMO_STORE_ID, DEMO_SUPPLY_STARTER_SUFFIX),
      "Auto build rest of screens"
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
    title: "The in-store display revenue pool is real.",
    body:
      "This is not demand creation from scratch. Statista Market Insights projects global retail platform advertising at $203.89B in 2025, while Grand View Research sizes the global in-store digital advertising display market at $4.59B in 2024. The opportunity is to extend an onsite monetization model that already works into the physical store.",
    note: "Onsite remains the economic center of retail media, which is why extending that model into store is credible.",
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
    kicker: "Regional scale",
    title: "APAC alone is large enough to matter.",
    body:
      "The regional profile mirrors the global one. Statista Market Insights projects APAC retail platform advertising at $90.25B in 2025, while Grand View Research sizes the APAC in-store digital advertising display market at $1.31B in 2024. The point is not sequencing. The point is that APAC on its own is already large enough to justify attention.",
    note: "The comparison stays inside scope: onsite ecommerce media versus in-store screens.",
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
    nextLabel: "Show funding logic"
  },
  {
    id: "funding-logic",
    accent: "#5f8f46",
    kicker: "Funding logic",
    title: "We can grow wallet, not just reshuffle spend.",
    body:
      "The case does not depend on brands taking money away from onsite. A measurable in-store layer can bring shopper and trade budgets into the retail media system, capture the next dollar when onsite marginal returns flatten, and keep more retailer media spend inside one closed-loop platform that we operate.",
    note: "Wallet expansion comes first. Channel mix optimization is a second-order effect, not the core thesis.",
    metrics: [
      {
        headline: "Expand",
        label: "new budget enters the system",
        detail: "Shopper marketing, trade, and in-store activation budgets become measurable media."
      },
      {
        headline: "Optimize",
        label: "the next dollar can work harder",
        detail: "Brands can allocate across site and store by marginal ROI, not by channel silos."
      },
      {
        headline: "Retain",
        label: "we capture more share of wallet",
        detail: "Some mix shift is acceptable if the spend stays inside one closed-loop stack."
      }
    ],
    sources: [],
    nextLabel: "Show strategic fit"
  },
  {
    id: "standup-effort",
    accent: "#6c8f34",
    kicker: "Stand-up effort",
    title: "Most of the work is retailer onboarding, not platform invention.",
    body:
      "CYield already handles supply setup and CMax already handles planning, activation, and measurement logic. The stand-up effort is mainly to harden the shared player, resolver, and reporting path once, then onboard retailers one by one by mapping their feeds, stores, and screen taxonomy into the existing model.",
    note: "The scalable workstream is onboarding each retailer, not rebuilding the platform for each rollout.",
    metrics: [
      {
        headline: "8-12 wks",
        label: "to harden the first deployable version",
        detail: "Shared player, resolver, supply mapping, and reporting on top of CYield and CMax."
      },
      {
        headline: "One-time",
        label: "core productization effort",
        detail: "Build the reusable in-store layer once, then keep reusing it."
      },
      {
        headline: "Retailer-led",
        label: "main scaling effort after launch",
        detail: "Onboard each retailer's feeds, pages, screens, and commercial rules."
      }
    ],
    sources: [],
    nextLabel: "Show proof"
  },
  {
    id: "activation",
    accent: "#ef6a3f",
    kicker: "Performance proof",
    title: "The channel can already be sold on outcomes.",
    body:
      "The value proposition is performance-led, not speculative. Albertsons reported 14% in-store sales lift in a 116-store case study. SMG and Kantar reported 28.3% average product sales lift across 12,558 in-store campaigns. That gives us permission to position screens as a measurable retail media channel rather than a store-tech upgrade.",
    note: "The commercial logic is the same one already used onsite: media that can be measured against sales.",
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
    nextLabel: "Show operating model"
  },
  {
    id: "lightweight-model",
    accent: "#2f74ff",
    kicker: "Low-cost operating model",
    title: "This can run at $0 incremental hosting cost.",
    body:
      "The screen layer can reuse the client's current feeds and the current CYield supply model: think 1 display ad equals 1 screen. Because the same advertiser often owns that screen for the full day, delivery churn stays low and the response can be edge cached aggressively. The point is that this does not require a new hosting estate to create the business.",
    note: "Keep the architecture simple: one shared player, page-like screen mapping, existing feeds, and low-churn delivery.",
    metrics: [
      {
        value: 0,
        decimals: 0,
        prefix: "$",
        suffix: "",
        label: "Incremental hosting cost",
        detail: "Reuse the client's current feeds and one shared player URL."
      },
      {
        headline: "1:1",
        label: "Display ad to screen mapping",
        detail: "Treat each installed screen like a page-level supply endpoint."
      },
      {
        headline: "Edge",
        label: "Caching-friendly delivery profile",
        detail: "The same advertiser creative can typically stay cached for the day."
      }
    ],
    sources: [],
    nextLabel: "Show upside"
  },
  {
    id: "modeled-upside",
    accent: "#f0b54b",
    kicker: "Revenue sizing",
    title: "A conservative Year 1 to Year 3 ramp is already meaningful.",
    body:
      "A retailer-by-retailer rollout does not need heroic assumptions. Using APAC in-store digital display as the conservative reference market, platform revenue reaches meaningful scale if we capture 0.1% in Year 1, 0.35% in Year 2, and 1.0% in Year 3 while the onboarding motion compounds across retailers.",
    note: "This keeps the sizing tied to rollout pace and existing market scope rather than assuming immediate broad penetration.",
    metricSections: [
      {
        kicker: "Platform revenue ramp",
        title: "APAC-only revenue build",
        note: "Modeled from a $1.312B APAC in-store digital display market",
        metrics: [
          {
            value: 1.31,
            decimals: 2,
            prefix: "$",
            suffix: "M",
            label: "Year 1 revenue",
            detail: "0.1% APAC share on a first-wave retailer rollout"
          },
          {
            value: 4.59,
            decimals: 2,
            prefix: "$",
            suffix: "M",
            label: "Year 2 revenue",
            detail: "0.35% APAC share as retailer onboarding expands"
          },
          {
            value: 13.12,
            decimals: 2,
            prefix: "$",
            suffix: "M",
            label: "Year 3 revenue",
            detail: "1.0% APAC share with a scaled onboarding motion"
          }
        ]
      },
      {
        kicker: "Reference market",
        title: "The market stays much larger than the plan",
        note: "Included to show how conservative the three-year ramp remains",
        metrics: [
          {
            value: 90.25,
            decimals: 2,
            prefix: "$",
            suffix: "B",
            label: "APAC onsite ecommerce media",
            detail: "Statista retail platform advertising, 2025"
          },
          {
            value: 1.312,
            decimals: 3,
            prefix: "$",
            suffix: "B",
            label: "APAC in-store digital display",
            detail: "Grand View Research, 2024"
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
  pendingAnchorSharePreset: "",
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
  goalBudgetDraftPlanId: "",
  goalBudgetDraftSpend: null,
  goalBudgetCommitTimer: null,
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
  workspaceInactivityTimeoutId: null,
  workspaceBadgeTickerId: null,
  workspaceTrackedWorkspaceId: "",
  workspaceLastActivityAt: 0,
  workspaceLastHeartbeatAt: 0,
  workspaceInactivityRemainingMs: 0,
  workspaceActivityGraceUntilAt: 0,
  workspaceActivityHeartbeatPending: false,
  workspaceSwitchMode: false,
  pendingActions: new Set()
};
const DEFAULT_BUSY_OVERLAY_COPY = Object.freeze({
  title: "Finishing an update",
  message: "Please wait while the page finishes updating."
});
// Keep the real preset path for normal-sized demos; only short-circuit massive rollouts that time out the UI.
const LARGE_DEMO_PRESET_SCREEN_THRESHOLD = 1000;
const GOAL_BUDGET_IDLE_COMMIT_MS = 1000;

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
  heroBrandContext: qs("#heroBrandContext"),
  buyingBrandContext: qs("#buyingBrandContext"),
  monitoringBrandContext: qs("#monitoringBrandContext"),
  workspaceOverlay: qs("#workspaceOverlay"),
  workspaceOverlayMessage: qs("#workspaceOverlayMessage"),
  workspaceGrid: qs("#workspaceGrid"),
  busyOverlay: qs("#busyOverlay"),
  busyOverlayTitle: qs("#busyOverlayTitle"),
  busyOverlayMessage: qs("#busyOverlayMessage"),
  workspaceBadge: qs("#workspaceBadge"),
  workspaceBadgeName: qs("#workspaceBadgeName"),
  workspaceBadgeStatus: qs("#workspaceBadgeStatus"),
  switchWorkspaceBtn: qs("#switchWorkspaceBtn"),
  demoScreenLink: qs("#demoScreenLink"),
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
  anchorSharePreset: qs("#anchorSharePreset"),
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
  screenSharePreset: qs("#screenSharePreset"),
  templatePreview: qs("#templatePreview"),
  retailerRateCard: qs("#retailerRateCard"),
  saveRetailerRatesBtn: qs("#saveRetailerRatesBtn"),
  screenSubmitBtn: qs("#screenSubmitBtn"),
  screenCancelBtn: qs("#screenCancelBtn"),
  goalAgentForm: qs("#goalAgentForm"),
  goalObjective: qs("#goalObjective"),
  goalAggressiveness: qs("#goalAggressiveness"),
  goalAggressivenessHelp: qs("#goalAggressivenessHelp"),
  goalRateCard: qs("#goalRateCard"),
  goalStoreScope: qs("#goalStoreScope"),
  goalPageScope: qs("#goalPageScope"),
  goalFlightStart: qs("#goalFlightStart"),
  goalFlightEnd: qs("#goalFlightEnd"),
  goalPrompt: qs("#goalPrompt"),
  goalPromptRunBtn: qs("#goalPromptRunBtn"),
  goalPromptAiStatus: qs("#goalPromptAiStatus"),
  goalBrandAccount: qs("#goalBrandAccount"),
  goalBrandPicker: qs("#goalBrandPicker"),
  goalBrandPickerButton: qs("#goalBrandPickerButton"),
  goalBrandPickerMenu: qs("#goalBrandPickerMenu"),
  goalBrandSelection: qs("#goalBrandSelection"),
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
  monitoringMeasurementMeta: qs("#monitoringMeasurementMeta"),
  measurementBriefTitle: qs("#measurementBriefTitle"),
  measurementBriefCopy: qs("#measurementBriefCopy"),
  measurementPrimaryGrid: qs("#measurementPrimaryGrid"),
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

const DEFAULT_MEASUREMENT_PRIMARY_GRID_HTML = elements.measurementPrimaryGrid?.innerHTML || "";
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

function clearMarketIntroAcknowledged(workspaceId = getCurrentWorkspace()?.id) {
  const storageKey = getMarketIntroStorageKey(workspaceId);
  if (!storageKey) {
    return;
  }
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Ignore storage failures and keep the in-memory state.
  }
  if (String(getCurrentWorkspace()?.id || "").trim() === String(workspaceId || "").trim()) {
    state.marketIntroAcknowledged = false;
    state.marketStoryStep = 0;
  }
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

function setBusyOverlayVisible(visible) {
  if (!elements.busyOverlay) {
    return;
  }
  elements.busyOverlay.hidden = !visible;
  document.body.classList.toggle("has-busy-overlay", visible);
  if (visible) {
    document.body.setAttribute("aria-busy", "true");
  } else {
    document.body.removeAttribute("aria-busy");
  }
}

function getBusyOverlayActionKey() {
  for (const pendingKey of state.pendingActions) {
    if (pendingKey !== "goalPlan") {
      return pendingKey;
    }
  }
  return "";
}

function getBusyOverlayCopy() {
  const pendingKey = getBusyOverlayActionKey();
  if (!pendingKey) {
    return DEFAULT_BUSY_OVERLAY_COPY;
  }

  if (pendingKey.startsWith("workspaceClaim:")) {
    const workspaceId = pendingKey.slice("workspaceClaim:".length).trim();
    return {
      title: workspaceId ? `Opening workspace ${workspaceId}` : "Opening workspace",
      message: "Please wait while the demo reserves this avatar and reloads the workspace."
    };
  }

  if (pendingKey === "workspaceRelease") {
    return {
      title: "Releasing the workspace",
      message: "Please wait while the current demo workspace is cleared and handed back."
    };
  }

  if (pendingKey === "pricing:save") {
    return {
      title: "Saving retailer pricing",
      message: "Please wait while the CPM card is saved for future buying plans."
    };
  }

  if (pendingKey === "inventory:page") {
    return {
      title: "Saving the page setup",
      message: "Please wait while the page is added and the supply inventory refreshes."
    };
  }

  if (pendingKey === "inventory:anchor") {
    return {
      title: "Creating the first screen",
      message: "Please wait while the first screen is saved and connected to the selected page."
    };
  }

  if (pendingKey === "inventory:screen") {
    return {
      title: "Saving screen changes",
      message: "Please wait while the screen settings are updated and the supply inventory refreshes."
    };
  }

  if (pendingKey.startsWith("inventory:delete:")) {
    const screenId = pendingKey.slice("inventory:delete:".length).trim();
    return {
      title: screenId ? `Deleting screen ${screenId}` : "Deleting the screen",
      message: "Please wait while the screen is removed and the supply inventory refreshes."
    };
  }

  if (pendingKey === "inventory:preset") {
    return {
      title: "Building the rest of the screens",
      message: "Please wait while the demo creates the remaining supply screens."
    };
  }

  if (pendingKey === "inventory:reset") {
    return {
      title: "Resetting the demo",
      message: "Please wait while the demo workspace is cleared and rebuilt."
    };
  }

  if (pendingKey === "inventory:refresh") {
    return {
      title: "Refreshing the supply inventory",
      message: "Please wait while the latest pages and screens are loaded."
    };
  }

  if (pendingKey.startsWith("goalPlanApply:")) {
    const planId = pendingKey.slice("goalPlanApply:".length).trim();
    return {
      title: planId ? `Launching recommendation ${planId}` : "Launching the recommendation",
      message: "Please wait while the approved buy is pushed live across the selected screens."
    };
  }

  if (pendingKey.startsWith("goalPlanLoad:")) {
    const planId = pendingKey.slice("goalPlanLoad:".length).trim();
    return {
      title: planId ? `Loading recommendation ${planId}` : "Loading the recommendation",
      message: "Please wait while the selected plan and its latest telemetry are loaded."
    };
  }

  if (pendingKey === "goalRunsRefresh") {
    return {
      title: "Refreshing recent launches",
      message: "Please wait while the latest plan runs, live placements, and telemetry are loaded."
    };
  }

  if (pendingKey === "telemetryRefresh") {
    return {
      title: "Refreshing telemetry",
      message: "Please wait while the latest monitoring data is loaded."
    };
  }

  return DEFAULT_BUSY_OVERLAY_COPY;
}

function renderBusyOverlay() {
  const copy = getBusyOverlayCopy();
  if (elements.busyOverlayTitle) {
    elements.busyOverlayTitle.textContent = copy.title;
  }
  if (elements.busyOverlayMessage) {
    elements.busyOverlayMessage.textContent = copy.message;
  }
  setBusyOverlayVisible(shouldShowBusyOverlay());
}

function shouldShowBusyOverlay() {
  if (state.pendingActions.size === 0) {
    return false;
  }
  for (const pendingKey of state.pendingActions) {
    if (pendingKey !== "goalPlan") {
      return true;
    }
  }
  return false;
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
  const staticHeadline = readTextValue(metric?.headline);
  const valueMarkup = staticHeadline
    ? `<strong class="market-story-overlay__metric-value market-story-overlay__metric-value--static">${escapeHtml(staticHeadline)}</strong>`
    : `<strong
        class="market-story-overlay__metric-value js-market-story-metric"
        data-metric-value="${escapeHtml(String(metric.value || 0))}"
        data-metric-decimals="${escapeHtml(String(metric.decimals || 0))}"
        data-metric-prefix="${escapeHtml(metric.prefix || "")}"
        data-metric-suffix="${escapeHtml(metric.suffix || "")}"
      ></strong>`;
  return `
    <article class="market-story-overlay__metric">
      ${valueMarkup}
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
      showStatus(`AI recommended ${state.selectedGoalSkuIds.size} priority SKU(s) from the brief.`);
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
    return "AI is recommending the shortlist...";
  }
  if (state.goalPromptAwaitingRun) {
    return "Brief ready. Click Let AI choose SKU's to build the recommended shortlist.";
  }
  if (isGoalPromptSelectionActive()) {
    if (state.selectedGoalSkuIds.size > 0) {
      if (reasoning) {
        return `Why these SKUs: ${reasoning}`;
      }
      return matchedTerms.length > 0
        ? `AI brief matched ${matchedTerms.join(", ")}.`
        : `AI recommended ${state.selectedGoalSkuIds.size} SKU(s).`;
    }
    if (reasoning) {
      return reasoning;
    }
    return "AI reviewed the brief but did not find a confident shortlist yet.";
  }
  if (state.selectedGoalSkuIds.size > 0) {
    return prompt
      ? "Manual SKU picks are active. Click Let AI choose SKU's if you want to refresh the recommendation from the brief."
      : "Manual SKU picks are active.";
  }
  return "Use AI to recommend the shortlist, or open manual selection below if you need to override it.";
}

function renderGoalPromptAssistant() {
  const prompt = getGoalPromptText();
  const hasAccount = Boolean(getSelectedGoalAdvertiserId());
  const hasSelection = state.selectedGoalSkuIds.size > 0;
  const loading = state.goalPromptInferencePending;
  const runDisabled = !prompt || !hasAccount || loading || hasPendingAction("goalPlan") || hasPendingAction("goalPlanApply");
  if (elements.goalPromptRunBtn) {
    elements.goalPromptRunBtn.disabled = runDisabled;
    elements.goalPromptRunBtn.textContent = loading ? "AI recommending SKU's..." : "Let AI choose SKU's";
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
      kicker: "Recommended Path",
      title: "Let AI recommend the shortlist",
      body: "Write a brief, then click Let AI choose SKU's to generate a recommended product shortlist.",
      detail: "AI reads your brief, account, assortment filters, and placement scope. Manual selection stays available below.",
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
      title: "Recommending the best SKU shortlist",
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
      body: "Click Let AI choose SKU's when you want this brief to generate or refresh the recommended shortlist.",
      detail: hasSelection ? "Your current SKU picks stay in place until you ask AI to update them." : "No AI shortlist has been generated for this brief yet.",
      variant: "ready",
      compact: true
    });
    return;
  }

  if (isGoalPromptSelectionActive()) {
    renderStatus({
      kicker: "AI Shortlist Ready",
      title: hasSelection ? `AI recommended ${state.selectedGoalSkuIds.size} SKU(s)` : "AI reviewed the brief",
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
      ? "The current shortlist is manual. Click Let AI choose SKU's if you want the brief to replace it with a recommendation."
      : "Click Let AI choose SKU's to build a recommended shortlist from this brief.",
    detail: getGoalPromptSelectionNote(),
    variant: "ready",
    compact: true
  });
}

function getSelectedGoalProducts() {
  return (state.productFeed || []).filter((product) => state.selectedGoalSkuIds.has(normalizeSku(product.sku)));
}

function renderGoalAggressivenessHelp() {
  if (!elements.goalAggressivenessHelp) {
    return;
  }
  const selected = String(elements.goalAggressiveness?.value || "").trim();
  elements.goalAggressivenessHelp.textContent =
    GOAL_AGGRESSIVENESS_EXPLANATIONS[selected] || GOAL_AGGRESSIVENESS_EXPLANATIONS.default;
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
        brand: String(product?.brand || "").trim() || "Store Brand",
        logo: readTextValue(product?.logo || product?.brandLogo || product?.BrandLogo)
      });
    }
  }
  return [...accounts.values()].sort(
    (left, right) => left.brand.localeCompare(right.brand) || left.advertiserId.localeCompare(right.advertiserId)
  );
}

function getGoalBrandAccounts() {
  const accountsById = new Map();

  for (const account of state.productAccounts || []) {
    const advertiserId = String(account?.advertiserId || "").trim();
    if (!advertiserId) {
      continue;
    }
    accountsById.set(advertiserId, {
      advertiserId,
      brand: String(account?.brand || "").trim() || "Store Brand",
      logo: readTextValue(account?.logo || account?.brandLogo || account?.BrandLogo)
    });
  }

  for (const account of buildProductAccountsFromProducts(state.productFeed || [])) {
    const advertiserId = String(account?.advertiserId || "").trim();
    if (!advertiserId) {
      continue;
    }
    const existing = accountsById.get(advertiserId) || {};
    accountsById.set(advertiserId, {
      advertiserId,
      brand: String(existing.brand || account.brand || "").trim() || "Store Brand",
      logo: readTextValue(existing.logo || existing.brandLogo || account.logo || account.brandLogo || account.BrandLogo)
    });
  }

  return [...accountsById.values()].sort(
    (left, right) => left.brand.localeCompare(right.brand) || left.advertiserId.localeCompare(right.advertiserId)
  );
}

function deriveGeneratedBrandLogoPath(advertiserId = "") {
  const normalizedId = String(advertiserId || "").trim().toLowerCase();
  if (!/^advertiser-[a-z0-9-]+$/.test(normalizedId)) {
    return "";
  }
  return `/assets/brands/generated/${normalizedId}.png`;
}

function getBrandInitials(value = "") {
  const tokens = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (tokens.length === 0) {
    return "BR";
  }
  return tokens.map((token) => token.charAt(0).toUpperCase()).join("") || "BR";
}

function buildBrandIdentityMarkup(
  brandContext = {},
  { className = "brand-badge", baseClass = "brand-badge", meta, hideTitleWhenLogo = false } = {}
) {
  const brand = String(brandContext?.brand || "").trim();
  const advertiserId = String(brandContext?.advertiserId || "").trim();
  const logo = readTextValue(
    brandContext?.logo || brandContext?.brandLogo || brandContext?.BrandLogo || deriveGeneratedBrandLogoPath(advertiserId)
  );
  const title = brand || advertiserId;
  if (!title && !logo) {
    return "";
  }
  const resolvedMeta = meta !== undefined ? meta : brandContext?.accountLabel || advertiserId || "";
  const metaText = String(resolvedMeta || "").trim();
  const showTitle = !(hideTitleWhenLogo && logo);
  const copyMarkup = showTitle || metaText
    ? `<span class="${escapeHtml(`${baseClass}__copy${showTitle ? "" : ` ${baseClass}__copy--meta-only`}`)}">
      ${showTitle ? `<strong>${escapeHtml(title || "Selected brand")}</strong>` : ""}
      ${metaText ? `<span>${escapeHtml(metaText)}</span>` : ""}
    </span>`
    : "";
  const mediaOnlyClass = copyMarkup ? "" : ` ${baseClass}--media-only`;

  return `<div class="${escapeHtml(`${className}${mediaOnlyClass}`)}">
    <span class="${escapeHtml(`${baseClass}__media`)}">
      ${
        logo
          ? `<img src="${escapeHtml(logo)}" alt="${escapeHtml(title || "Brand logo")}" loading="lazy">`
          : `<span class="${escapeHtml(`${baseClass}__fallback`)}" aria-hidden="true">${escapeHtml(getBrandInitials(title))}</span>`
      }
    </span>
    ${copyMarkup}
  </div>`;
}

function renderBrandContextSlot(
  container,
  brandContext = {},
  { meta, className = "brand-badge brand-badge--compact", hideTitleWhenLogo = true } = {}
) {
  if (!container) {
    return;
  }
  const markup = buildBrandIdentityMarkup(brandContext, { className, meta, hideTitleWhenLogo });
  container.innerHTML = markup;
  container.classList.toggle("is-hidden", !markup);
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
  return getGoalBrandAccounts().find((entry) => entry.advertiserId === normalizedId) || null;
}

function getGoalBrandPickerOptions() {
  return elements.goalBrandPickerMenu ? [...elements.goalBrandPickerMenu.querySelectorAll(".brand-picker__option")] : [];
}

function isGoalBrandPickerOpen() {
  return elements.goalBrandPicker?.dataset.open === "true" && !elements.goalBrandPickerMenu?.hidden;
}

function setGoalBrandPickerOpen(isOpen) {
  if (!elements.goalBrandPicker || !elements.goalBrandPickerButton || !elements.goalBrandPickerMenu) {
    return;
  }
  const canOpen = !elements.goalBrandPickerButton.disabled && getGoalBrandPickerOptions().length > 0;
  const nextOpen = Boolean(isOpen) && canOpen;
  elements.goalBrandPicker.dataset.open = nextOpen ? "true" : "false";
  elements.goalBrandPickerButton.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  elements.goalBrandPickerMenu.hidden = !nextOpen;
}

function focusGoalBrandPickerOption(direction = 1) {
  const options = getGoalBrandPickerOptions();
  if (options.length === 0) {
    return;
  }
  const activeOption =
    document.activeElement instanceof HTMLElement
      ? document.activeElement.closest(".brand-picker__option")
      : null;
  const currentIndex = activeOption ? options.indexOf(activeOption) : -1;
  const fallbackIndex = direction < 0 ? options.length - 1 : 0;
  const nextIndex =
    currentIndex === -1 ? fallbackIndex : (currentIndex + direction + options.length) % options.length;
  options[nextIndex]?.focus();
}

function updateGoalBrandSelectionSlot(account = null) {
  if (elements.goalBrandSelection) {
    elements.goalBrandSelection.innerHTML = "";
    elements.goalBrandSelection.classList.add("is-hidden");
  }
}

function renderGoalBrandPicker(accounts = [], selectedAdvertiserId = "") {
  if (!elements.goalBrandPickerButton || !elements.goalBrandPickerMenu) {
    return;
  }

  const normalizedSelected = String(selectedAdvertiserId || "").trim();
  const selectedAccount = accounts.find((entry) => entry.advertiserId === normalizedSelected) || null;
  const triggerMarkup = selectedAccount
    ? buildBrandIdentityMarkup(selectedAccount, {
        className: "brand-badge brand-badge--picker",
        meta: "",
        hideTitleWhenLogo: true
      })
    : `<span class="brand-picker__trigger-copy">
        <strong>Select an account</strong>
        <span>Brand logos will appear here and carry into the live flow.</span>
      </span>`;
  const optionMarkup =
    accounts.length === 0
      ? '<div class="brand-picker__empty">No brand accounts available yet.</div>'
      : [
          `<button
            type="button"
            class="brand-picker__option brand-picker__option--placeholder${selectedAccount ? "" : " is-selected"}"
            data-advertiser-id=""
            role="option"
            aria-selected="${selectedAccount ? "false" : "true"}"
          >
            <span class="brand-picker__option-placeholder">
              <strong>Select an account</strong>
              <span>Pick a brand to scope the assortment and buying plan.</span>
            </span>
          </button>`,
          ...accounts.map((account) => {
            const isSelected = account.advertiserId === normalizedSelected;
            return `<button
              type="button"
              class="brand-picker__option${isSelected ? " is-selected" : ""}"
              data-advertiser-id="${escapeHtml(account.advertiserId)}"
              role="option"
              aria-selected="${isSelected ? "true" : "false"}"
            >
              ${
                buildBrandIdentityMarkup(account, {
                  className: "brand-badge brand-badge--picker-option",
                  meta: "",
                  hideTitleWhenLogo: true
                }) || ""
              }
            </button>`;
          })
        ].join("");

  elements.goalBrandPickerButton.innerHTML = `
    ${triggerMarkup}
    <span class="brand-picker__trigger-chev" aria-hidden="true"></span>
  `;
  elements.goalBrandPickerMenu.innerHTML = optionMarkup;
  elements.goalBrandPickerButton.disabled = Boolean(elements.goalBrandAccount?.disabled) || accounts.length === 0;
  setGoalBrandPickerOpen(false);
  updateGoalBrandSelectionSlot(selectedAccount);
}

function chooseGoalBrandAccount(advertiserId = "") {
  if (!elements.goalBrandAccount) {
    return;
  }
  const normalizedId = String(advertiserId || "").trim();
  const validValues = new Set([...elements.goalBrandAccount.options].map((option) => option.value));
  const nextValue = validValues.has(normalizedId) ? normalizedId : "";
  const changed = elements.goalBrandAccount.value !== nextValue;

  elements.goalBrandAccount.value = nextValue;
  renderGoalBrandPicker(getGoalBrandAccounts(), nextValue);
  elements.goalBrandPickerButton?.focus();

  if (changed) {
    elements.goalBrandAccount.dispatchEvent(new Event("change", { bubbles: true }));
  }
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

function getProductDisplayLogo(product = {}) {
  return readTextValue(product?.logo || product?.brandLogo || product?.BrandLogo);
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
  const brandMarkup = buildBrandIdentityMarkup(brandContext, {
    className: "brand-badge brand-badge--preview",
    meta: brandContext.objectiveLabel || "",
    hideTitleWhenLogo: true
  });
  return `
    ${brandMarkup}
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
  const metaParts = [
    snapshot.templateName,
    snapshot.deliveryShareLabel,
    snapshot.location && titleCase(snapshot.location),
    snapshot.screenType
  ].filter(Boolean);
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
  const brandMarkup = snapshot.brand || snapshot.brandLogo
    ? buildBrandIdentityMarkup(
        {
          brand: snapshot.brand,
          logo: snapshot.brandLogo,
          advertiserId: snapshot.advertiserId
        },
        {
          className: "brand-badge brand-badge--mini",
          meta: "",
          hideTitleWhenLogo: true
        }
      )
    : "";
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
        ${brandMarkup}
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
        const params = new URLSearchParams({ screenId: String(screenId || "") });
        if (state.stage === "monitoring" && state.activeGoalPlan?.planId) {
          params.set("goalPlanId", String(state.activeGoalPlan.planId || ""));
        }
        const payload = await requestJson(`/api/screen-ad?${params.toString()}`);
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
          deliveryShareLabel: readTextValue(settings.deliveryShareLabel),
          productName: readTextValue(product.ProductName) || templateName,
          image: readTextValue(product.Image),
          brand: readTextValue(product.brand || attributes.targetBrand),
          brandLogo: readTextValue(product.BrandLogo || product.brandLogo || attributes.brandLogo),
          advertiserId: readTextValue(product.ClientAdvertiserId),
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

function formatLeaseDurationLabel(leaseDurationMs = state.workspaceStatus?.leaseDurationMs || 60 * 60 * 1000) {
  const totalMinutes = Math.max(1, Math.round(Number(leaseDurationMs || 0) / 60000));
  if (totalMinutes % 60 === 0) {
    const hours = totalMinutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"} lease`;
  }
  return `${totalMinutes} min${totalMinutes === 1 ? "" : "s"} lease`;
}

function parseWorkspaceTimestamp(value) {
  const parsed = Date.parse(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function getWorkspaceInactivityTimeoutMs() {
  return Math.max(1000, Number(state.workspaceStatus?.inactivityTimeoutMs || WORKSPACE_INACTIVITY_TIMEOUT_MS));
}

function getWorkspaceActivityGraceMs() {
  return Math.max(0, Number(state.workspaceStatus?.activityGraceMs || WORKSPACE_ACTIVITY_ACTIVE_GRACE_MS));
}

function stopWorkspaceInactivityTimer() {
  if (state.workspaceInactivityTimeoutId) {
    window.clearTimeout(state.workspaceInactivityTimeoutId);
    state.workspaceInactivityTimeoutId = null;
  }
}

function stopWorkspaceBadgeTicker() {
  if (state.workspaceBadgeTickerId) {
    window.clearInterval(state.workspaceBadgeTickerId);
    state.workspaceBadgeTickerId = null;
  }
}

function ensureWorkspaceBadgeTicker() {
  if (!getCurrentWorkspace()) {
    stopWorkspaceBadgeTicker();
    return;
  }
  if (state.workspaceBadgeTickerId) {
    return;
  }
  state.workspaceBadgeTickerId = window.setInterval(() => {
    updateWorkspaceBadge();
  }, 1000);
}

function getWorkspaceLocalInactivityRemainingMs(now = Date.now()) {
  const remainingBudgetMs = Math.max(0, Number(state.workspaceInactivityRemainingMs || 0));
  const activeUntilAt = Number(state.workspaceActivityGraceUntilAt || 0);
  if (activeUntilAt <= 0) {
    return remainingBudgetMs;
  }
  return Math.max(0, remainingBudgetMs - Math.max(0, now - activeUntilAt));
}

function getWorkspaceLocalExpiryDelayMs(now = Date.now()) {
  const activeUntilAt = Number(state.workspaceActivityGraceUntilAt || 0);
  return Math.max(0, getWorkspaceLocalInactivityRemainingMs(now) + Math.max(0, activeUntilAt - now));
}

function syncWorkspaceActivityState() {
  const current = getCurrentWorkspace();
  const currentWorkspaceId = String(current?.id || "").trim();
  if (!currentWorkspaceId) {
    state.workspaceTrackedWorkspaceId = "";
    state.workspaceLastActivityAt = 0;
    state.workspaceLastHeartbeatAt = 0;
    state.workspaceInactivityRemainingMs = 0;
    state.workspaceActivityGraceUntilAt = 0;
    state.workspaceActivityHeartbeatPending = false;
    stopWorkspaceInactivityTimer();
    stopWorkspaceBadgeTicker();
    return;
  }

  const now = Date.now();
  const serverLastActivityAt = parseWorkspaceTimestamp(current.lastActivityAt || current.claimedAt);
  const serverInactivityRemainingMs = Math.max(0, Number(current.inactivityRemainingMs || getWorkspaceInactivityTimeoutMs()));
  const serverActivityGraceUntilAt =
    parseWorkspaceTimestamp(current.activeUntilAt || current.lastActivityAt || current.claimedAt) || now;
  const localLastActivityAt = Number(state.workspaceLastActivityAt || 0);
  if (state.workspaceTrackedWorkspaceId !== currentWorkspaceId) {
    state.workspaceTrackedWorkspaceId = currentWorkspaceId;
    state.workspaceLastActivityAt = serverLastActivityAt || Date.now();
    state.workspaceLastHeartbeatAt = 0;
    state.workspaceInactivityRemainingMs = serverInactivityRemainingMs;
    state.workspaceActivityGraceUntilAt = serverActivityGraceUntilAt;
  } else {
    const hasLocalActivitySinceServerSync = localLastActivityAt > serverLastActivityAt;
    state.workspaceLastActivityAt = Math.max(localLastActivityAt, serverLastActivityAt);
    if (!hasLocalActivitySinceServerSync) {
      state.workspaceInactivityRemainingMs = serverInactivityRemainingMs;
      state.workspaceActivityGraceUntilAt = serverActivityGraceUntilAt;
    }
  }
  ensureWorkspaceBadgeTicker();
}

function scheduleWorkspaceInactivityTimeout() {
  stopWorkspaceInactivityTimer();
  if (!getCurrentWorkspace()) {
    return;
  }
  const delayMs = getWorkspaceLocalExpiryDelayMs();
  state.workspaceInactivityTimeoutId = window.setTimeout(() => {
    expireWorkspaceForInactivity().catch(handleError);
  }, delayMs);
}

function buildWorkspaceOverlayMessage(message = "") {
  const explicitMessage = String(message || "").trim();
  if (explicitMessage) {
    return explicitMessage;
  }
  if (!state.workspaceSwitchMode) {
    return "";
  }
  const current = getCurrentWorkspace();
  if (!current) {
    return "";
  }
  return `Choose a different avatar. ${current.label || "Your current avatar"} stays active until you switch. Click outside to keep it.`;
}

function stopWorkspaceOverlayPolling() {
  if (state.workspaceOverlayPollId) {
    window.clearInterval(state.workspaceOverlayPollId);
    state.workspaceOverlayPollId = null;
  }
}

async function sendWorkspaceActivityHeartbeat() {
  if (state.workspaceActivityHeartbeatPending || !getCurrentWorkspace()) {
    return;
  }
  state.workspaceActivityHeartbeatPending = true;
  try {
    const payload = await requestJson("/api/workspaces/activity", { method: "POST" });
    state.workspaceStatus = payload;
    syncWorkspaceActivityState();
    state.workspaceLastHeartbeatAt = Date.now();
    updateWorkspaceBadge();
    scheduleWorkspaceInactivityTimeout();
    if (!elements.workspaceOverlay?.hidden && (!getCurrentWorkspace() || state.workspaceSwitchMode)) {
      renderWorkspaceSelector(elements.workspaceOverlayMessage?.textContent || "");
    }
  } finally {
    state.workspaceActivityHeartbeatPending = false;
  }
}

function registerWorkspaceActivity({ forceHeartbeat = false } = {}) {
  if (!getCurrentWorkspace()) {
    return;
  }
  const now = Date.now();
  state.workspaceInactivityRemainingMs = getWorkspaceLocalInactivityRemainingMs(now);
  state.workspaceLastActivityAt = now;
  state.workspaceActivityGraceUntilAt = now + getWorkspaceActivityGraceMs();
  updateWorkspaceBadge();
  ensureWorkspaceBadgeTicker();
  scheduleWorkspaceInactivityTimeout();
  if (forceHeartbeat || now - Number(state.workspaceLastHeartbeatAt || 0) >= WORKSPACE_ACTIVITY_HEARTBEAT_INTERVAL_MS) {
    sendWorkspaceActivityHeartbeat().catch(handleError);
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
  elements.workspaceBadgeStatus.textContent = formatLeaseRemaining(getWorkspaceLocalInactivityRemainingMs());
}

function buildWorkspaceCardMeta(workspace) {
  return workspace?.status === "claimed-by-you" ? "Current demo workspace" : "Fresh demo on selection";
}

function renderWorkspaceSelector(message = "") {
  if (!elements.workspaceOverlay || !elements.workspaceGrid || !elements.workspaceOverlayMessage) {
    return;
  }
  const pendingWorkspaceId = getPendingActionValue("workspaceClaim");
  const workspaceClaimPending = hasPendingAction("workspaceClaim");
  const workspaces = Array.isArray(state.workspaceStatus?.workspaces) ? state.workspaceStatus.workspaces : [];
  elements.workspaceOverlayMessage.textContent = buildWorkspaceOverlayMessage(message);
  elements.workspaceGrid.innerHTML = workspaces
    .map((workspace) => {
      const inUseByOther = workspace.status === "claimed";
      const switchingFromCurrentWorkspace = state.workspaceSwitchMode && workspace.status === "claimed-by-you";
      const claimingThisWorkspace = pendingWorkspaceId === String(workspace.id || "").trim();
      const actionLabel = inUseByOther
        ? `In use | ${formatLeaseRemaining(workspace.remainingMs || 0)}`
        : claimingThisWorkspace
          ? "Claiming workspace..."
        : switchingFromCurrentWorkspace
          ? "Current avatar"
        : workspace.status === "claimed-by-you"
          ? "Current avatar"
          : "Start fresh demo";
      const availabilityLabel =
        workspace.status === "claimed"
          ? "Locked"
          : switchingFromCurrentWorkspace
            ? "Current"
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
          ${inUseByOther || workspaceClaimPending || switchingFromCurrentWorkspace ? "disabled" : ""}
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
              : formatLeaseDurationLabel()
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
  syncWorkspaceActivityState();
  if (!getCurrentWorkspace()) {
    state.workspaceSwitchMode = false;
  }
  syncMarketIntroAcknowledged();
  updateWorkspaceBadge();
  scheduleWorkspaceInactivityTimeout();
  if (!elements.workspaceOverlay?.hidden) {
    if (!getCurrentWorkspace() || state.workspaceSwitchMode) {
      renderWorkspaceSelector(silent ? elements.workspaceOverlayMessage?.textContent || "" : "");
    } else {
      setWorkspaceOverlayVisible(false);
    }
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
      clearMarketIntroAcknowledged(workspaceId);
      window.location.reload();
    } catch (error) {
      renderWorkspaceSelector(error.message || "Unable to claim workspace.");
      throw error;
    }
  }, { lockKey: "workspaceClaim" });
}

async function releaseWorkspace({ reload = true, reset = false } = {}) {
  return runPendingAction("workspaceRelease", async () => {
    const requestOptions = {
      method: "POST"
    };
    if (reset) {
      requestOptions.body = JSON.stringify({ reset: true });
    }
    const payload = await requestJson("/api/workspaces/release", requestOptions);
    state.workspaceStatus = payload;
    syncWorkspaceActivityState();
    state.workspaceSwitchMode = false;
    scheduleWorkspaceInactivityTimeout();
    if (reload) {
      window.location.reload();
    }
    return payload;
  });
}

async function expireWorkspaceForInactivity() {
  const current = getCurrentWorkspace();
  if (!current) {
    return;
  }
  await releaseWorkspace({ reload: false, reset: true });
  renderWorkspaceSelector("This avatar expired after 30 minutes of inactivity. Pick an avatar again.");
  setWorkspaceOverlayVisible(true);
  showToast("This avatar expired after 30 minutes of inactivity.", true);
  showStatus("This avatar expired after 30 minutes of inactivity. Pick an avatar again.", true);
}

function beginWorkspaceSwitch() {
  const current = getCurrentWorkspace();
  if (!current) {
    return;
  }
  state.workspaceSwitchMode = true;
  renderWorkspaceSelector();
  setWorkspaceOverlayVisible(true);
  showStatus(`Choose a different avatar to switch from ${current.label || "the current avatar"}.`);
}

function cancelWorkspaceSwitch() {
  if (!state.workspaceSwitchMode || !getCurrentWorkspace()) {
    return;
  }
  state.workspaceSwitchMode = false;
  setWorkspaceOverlayVisible(false);
  showStatus(`${getCurrentWorkspace()?.label || "Current avatar"} is still active.`);
}

async function ensureWorkspaceClaim() {
  await refreshWorkspaceStatus();
  if (getCurrentWorkspace()) {
    state.workspaceSwitchMode = false;
    scheduleWorkspaceInactivityTimeout();
    setWorkspaceOverlayVisible(false);
    return;
  }
  state.workspaceSwitchMode = false;
  renderWorkspaceSelector();
  setWorkspaceOverlayVisible(true);
  showStatus("Select an avatar to open a fresh demo workspace.");
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

function getScreenSharePresetConfig(value = "") {
  return SCREEN_SHARE_PRESET_MAP.get(String(value || "").trim()) || SCREEN_SHARE_PRESET_MAP.get(DEFAULT_SCREEN_SHARE_PRESET);
}

function buildScreenShareLabel(screenShareSlots = 6, defaultSellableShareSlots = 1) {
  const totalSlots = Math.max(1, Number(screenShareSlots || 0) || 6);
  const sellableSlots = Math.max(1, Math.min(totalSlots, Number(defaultSellableShareSlots || 0) || 1));
  return `${sellableSlots}/${totalSlots} share`;
}

function getScreenSharePresetValue(screen = {}) {
  const totalSlots = Math.max(1, Number(screen?.screenShareSlots || MANUAL_SUPPLY.screen.screenShareSlots || 6));
  const sellableSlots = Math.max(
    1,
    Math.min(totalSlots, Number(screen?.defaultSellableShareSlots || MANUAL_SUPPLY.screen.defaultSellableShareSlots || 1))
  );
  const matched = SCREEN_SHARE_PRESETS.find(
    (preset) => preset.screenShareSlots === totalSlots && preset.defaultSellableShareSlots === sellableSlots
  );
  return matched?.value || DEFAULT_SCREEN_SHARE_PRESET;
}

function getScreenShareDisplayLabel(screen = {}) {
  const presetValue = getScreenSharePresetValue(screen);
  const preset = SCREEN_SHARE_PRESET_MAP.get(presetValue);
  if (preset) {
    return preset.label;
  }
  return buildScreenShareLabel(screen?.screenShareSlots, screen?.defaultSellableShareSlots);
}

function getAnchorScreenRecord() {
  return findScreenRecord(getManualSupplyConfig().screen.screenId) || null;
}

function getAnchorSharePresetValue() {
  const pendingPreset = String(state.pendingAnchorSharePreset || "").trim();
  if (pendingPreset && SCREEN_SHARE_PRESET_MAP.has(pendingPreset)) {
    return pendingPreset;
  }
  return getScreenSharePresetValue(getAnchorScreenRecord() || getManualSupplyConfig().screen);
}

function getAnchorShareDisplayLabel() {
  return getScreenSharePresetConfig(getAnchorSharePresetValue()).label;
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
      label: "Manual first screen",
      storeId: manual.storeId,
      pageId: manual.pageId,
      location: manual.location,
      screenType: manual.screenType,
      screenSize: manual.screenSize,
      templateId: manual.templateId,
      refreshInterval: manual.refreshInterval,
      screenShareSlots: manual.screenShareSlots,
      defaultSellableShareSlots: manual.defaultSellableShareSlots,
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
  if (screenId) {
    params.set("screenId", screenId);
  } else if (resolverId) {
    params.set("deviceId", resolverId);
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
  commitGoalBudgetDraft(plan, { render: false, publish: false });
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

  const screenShareLabelMap = Object.fromEntries(SCREEN_SHARE_PRESETS.map((preset) => [preset.value, preset.label]));
  renderSelectOptions(
    elements.anchorSharePreset,
    SCREEN_SHARE_PRESETS.map((preset) => preset.value),
    getAnchorSharePresetValue(),
    screenShareLabelMap
  );
  renderSelectOptions(
    elements.screenSharePreset,
    SCREEN_SHARE_PRESETS.map((preset) => preset.value),
    getAnchorSharePresetValue(),
    screenShareLabelMap
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
    "Select a buying style"
  );

  renderRetailerRateCard(state.options?.screenTypePricingDefaults || null);
  renderGoalRateCard();
}

function syncSupplyFormDefaults() {
  const manual = getManualSupplyConfig();
  const anchorSharePreset = getAnchorSharePresetValue();
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
  if (elements.anchorSharePreset) {
    elements.anchorSharePreset.value = anchorSharePreset;
  }
  if (elements.screenSharePreset) {
    elements.screenSharePreset.value = anchorSharePreset;
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
    setGoalBudgetStateFromPlan(null);
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
  const anchorSharePreset = getAnchorSharePresetValue();
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
  if (elements.anchorSharePreset) {
    elements.anchorSharePreset.value = anchorSharePreset;
  }
  if (elements.screenSharePreset) {
    elements.screenSharePreset.value = getScreenSharePresetValue(screen);
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
          ? "Auto build ready"
          : manualReady
            ? "Screen created"
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
  const workspaceClaimPending = hasPendingAction("workspaceClaim");
  const workspaceReleasePending = hasPendingAction("workspaceRelease");

  if (elements.createAnchorBtn) {
    elements.createAnchorBtn.disabled = manualReady || inventoryBusy;
    elements.createAnchorBtn.textContent = anchorPending
      ? "Creating screen..."
      : manualReady
        ? "Screen ready"
        : "Create screen";
  }

  for (const button of qsa("#loadPresetBtn, #loadPresetBtnSecondary")) {
    button.disabled = !manualReady || presetMaterialized || inventoryBusy;
    button.textContent = presetPending
      ? "Auto building screens..."
      : presetMaterialized
        ? "Auto build complete"
        : "Auto build rest of screens";
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
    elements.switchWorkspaceBtn.disabled = workspaceReleasePending || workspaceClaimPending;
    elements.switchWorkspaceBtn.textContent = workspaceClaimPending
      ? "Switching avatar..."
      : workspaceReleasePending
        ? "Releasing avatar..."
        : "Switch avatar";
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
    return "The demo auto-build already matched the current configuration.";
  }

  return `Demo auto-build complete. ${affectedStoreCount ? `${affectedStoreCount} store(s) seeded, ` : ""}${createdPages} page(s) created, ${updatedPages} refreshed, ${createdScreens} screen(s) created, ${updatedScreens} refreshed.`;
}

function renderSupplySummary() {
  if (!elements.supplySummaryCards) {
    return;
  }

  const demoStoreCount = getDemoStoreCount();

  elements.supplySummaryCards.innerHTML = [
    {
      value: isManualSupplyConfirmed() ? "Done" : "Pending",
      label: "First screen"
    },
    {
      value: `${demoStoreCount} stores`,
      label: "Auto build"
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
  const anchorShareLabel = getAnchorShareDisplayLabel();
  const summaryMessage = !isManualSupplyConfirmed()
    ? "Create the first screen, then auto build the rest of the screens to finish the supply setup."
    : presetMaterialized
      ? state.supplyHandoffAcknowledged
        ? "Setup complete: minimal CYield change, shared backend-resolved player URL, and the handoff into CMax is open."
        : "Setup complete. Review the rollout handoff below, then continue into CMax when you're ready."
      : `First screen saved. Auto build the remaining ${remaining} supply-stage screen(s) across ${demoStoreCount} stores.`;

  elements.presetSummary.classList.remove("empty");
  elements.presetSummary.innerHTML = `
    <strong>Shared player URL: ${escapeHtml(SHARED_PLAYER_URL)}</strong>
    <p>${escapeHtml(summaryMessage)}</p>
    <p class="goal-change__metrics">Sellable share: ${escapeHtml(anchorShareLabel)} on the first screen | auto-built screens default to 1/6.</p>
    <p class="goal-change__metrics">Retailer CPM card: ${escapeHtml(summarizeGoalRateCard())}</p>
    <p class="goal-change__metrics">
      ${escapeHtml(
        presetMaterialized
          ? actionMessage || "The demo auto-build is active across the demo inventory."
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
          ? "Screen created"
          : "Add this first"
        : presetMaterialized
          ? presetSimulated
            ? "Demo ready"
            : page.configured
              ? "Configured"
              : "Pending"
          : "Ready for auto build";
      return `<article class="record ${displayConfigured ? "" : "record--muted"}">
        <div class="record__top">
          <strong>${escapeHtml(page.pageId)}</strong>
          <span>${escapeHtml(status)}</span>
        </div>
        <p>${escapeHtml(page.pageType || "Page")} | ${escapeHtml(page.environment || "In-Store")}</p>
        <p>${page.isManual ? "Show one page-to-screen mapping manually." : "The demo auto-build expands the same CYield page model across the rest of the store."}</p>
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
          ? "Screen created"
          : "Add this first"
        : presetMaterialized
          ? presetSimulated
            ? "Demo ready"
            : summary.configured
              ? "Configured"
              : "Pending"
          : "Ready for auto build";
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

function renderBrandContextSlots() {
  const brandContext = getGoalPlanBrandContext();
  renderBrandContextSlot(elements.heroBrandContext, brandContext, {
    meta: "Selected workspace brand",
    className: "brand-badge brand-badge--hero"
  });
  renderBrandContextSlot(elements.buyingBrandContext);
  renderBrandContextSlot(elements.monitoringBrandContext, brandContext, {
    meta: brandContext.objectiveLabel || "",
    className: "brand-badge brand-badge--compact"
  });
}

function renderGoalBrandOptions() {
  const current = getSelectedGoalAdvertiserId();
  const accounts = getGoalBrandAccounts();
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
  renderGoalBrandPicker(accounts, selected);
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
    missing.push("a buying style");
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
      parts.push(`${aggressiveness} buying style`);
    }
    return parts.join(" | ") || "Pick the account, goal, and buying style before you shape the buy.";
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
    return "AI is recommending SKU's for the current brief.";
  }
  if (state.goalPromptAwaitingRun && prompt) {
    return "Brief ready. Click Let AI choose SKU's to build the recommended shortlist.";
  }
  if (isGoalPromptSelectionActive() && selectedCount > 0) {
    return `AI recommended ${selectedCount} priority SKU(s)${category ? ` in ${titleCase(category)}` : ""}.`;
  }
  if (selectedCount > 0) {
    return `${selectedCount} priority SKU(s) selected${category ? ` in ${titleCase(category)}` : ""}.`;
  }
  if (prompt) {
    return isGoalPromptSelectionActive()
      ? "AI reviewed the brief but did not find a confident shortlist yet."
      : "No priority SKUs selected. Click Let AI choose SKU's, or open manual selection.";
  }
  if (category) {
    return `Browsing ${titleCase(category)} with no SKU shortlist yet.`;
  }
  return "Let AI recommend the shortlist, or open manual selection if you need to override it.";
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
  renderGoalAggressivenessHelp();
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
  if (plannerBusy) {
    setGoalBrandPickerOpen(false);
  }
  if (elements.goalBrandPickerButton) {
    elements.goalBrandPickerButton.disabled =
      plannerBusy || Boolean(elements.goalBrandAccount?.disabled) || getGoalBrandPickerOptions().length === 0;
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
  elements.goalSkuCount.textContent = `Browse ${products.length} SKU(s)${scopeSuffix} for manual review.`;
}

function renderGoalSelectedSkus() {
  if (!elements.goalSelectedSkus || !elements.goalSelectedSkuHeadline) {
    return;
  }
  const selectedProducts = getSelectedGoalProducts().sort((left, right) => left.name.localeCompare(right.name));
  const reasoning = readTextValue(state.goalPromptInferenceReasoning);
  elements.goalSelectedSkuHeadline.textContent =
    state.goalPromptInferencePending && getGoalPromptText()
      ? "AI recommending"
      : isGoalPromptSelectionActive()
        ? `${selectedProducts.length} AI-recommended`
        : `${selectedProducts.length} selected`;

  if (selectedProducts.length === 0) {
    elements.goalSelectedSkus.classList.add("empty");
    if (state.goalPromptInferencePending && getGoalPromptText()) {
      elements.goalSelectedSkus.textContent = "AI is recommending SKU's for the current brief.";
    } else if (isGoalPromptSelectionActive()) {
      elements.goalSelectedSkus.textContent = reasoning || "AI reviewed the brief but did not find a confident shortlist yet.";
    } else if (getGoalPromptText()) {
      elements.goalSelectedSkus.textContent = state.goalPromptAwaitingRun
        ? "Brief ready. Click Let AI choose SKU's to build the recommended shortlist, or open manual selection below."
        : "No priority SKUs selected. Click Let AI choose SKU's for a recommended shortlist, or open manual selection below.";
    } else {
      elements.goalSelectedSkus.textContent = "No priority SKUs selected yet. Add an AI brief above, or open manual selection below.";
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
}

function clearGoalSkuSelection() {
  if (state.selectedGoalSkuIds.size === 0) {
    return;
  }
  setGoalSkuSelectionMode("manual");
  state.selectedGoalSkuIds.clear();
  renderGoalProducts();
  showStatus("Cleared the priority SKU selection.");
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
  const targetProducts = getGoalPlanTargetProducts(plan);
  const fallbackLogo =
    readTextValue(goal.logo) ||
    readTextValue(account?.logo) ||
    readTextValue(targetProducts.find((product) => getProductDisplayLogo(product))?.logo) ||
    readTextValue(targetProducts.find((product) => getProductDisplayLogo(product))?.brandLogo);
  const accountLabel = brand && advertiserId ? `${brand} | ${advertiserId}` : brand || advertiserId || "";
  return {
    advertiserId,
    brand,
    logo: fallbackLogo,
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
  const safePlan = plan && typeof plan === "object" ? plan : {};
  const plannedScreenIds = Array.isArray(safePlan.plannedScreenIds) ? safePlan.plannedScreenIds : [];
  const recommendedPlacements = Array.isArray(safePlan.recommendedPlacements) ? safePlan.recommendedPlacements : [];
  const proposedChanges = Array.isArray(safePlan.proposedChanges) ? safePlan.proposedChanges : [];
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

function clearGoalBudgetDraft() {
  if (state.goalBudgetCommitTimer !== null) {
    window.clearTimeout(state.goalBudgetCommitTimer);
  }
  state.goalBudgetCommitTimer = null;
  state.goalBudgetDraftPlanId = "";
  state.goalBudgetDraftSpend = null;
}

function hasGoalBudgetDraft(plan = state.activeGoalPlan) {
  const planId = String(plan?.planId || "").trim();
  return Boolean(planId && state.goalBudgetDraftPlanId === planId && Number.isFinite(Number(state.goalBudgetDraftSpend)));
}

function setGoalBudgetStateFromPlan(plan, preferredSpend = null) {
  clearGoalBudgetDraft();
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

function getGoalBudgetPreviewSpend(plan = state.activeGoalPlan) {
  if (!plan) {
    return 0;
  }
  if (hasGoalBudgetDraft(plan)) {
    return normalizeGoalBudgetSpend(plan, state.goalBudgetDraftSpend);
  }
  return getActiveGoalBudgetSpend(plan);
}

function commitGoalBudgetDraft(plan = state.activeGoalPlan, { render = true } = {}) {
  const planId = String(plan?.planId || "").trim();
  if (!planId) {
    clearGoalBudgetDraft();
    return false;
  }
  if (!hasGoalBudgetDraft(plan)) {
    return false;
  }
  const nextSpend = normalizeGoalBudgetSpend(plan, state.goalBudgetDraftSpend);
  clearGoalBudgetDraft();
  state.goalBudgetPlanId = planId;
  state.goalBudgetSpend = nextSpend;
  if (render) {
    renderGoalPlan();
  }
  return true;
}

function scheduleGoalBudgetCommit(plan = state.activeGoalPlan) {
  const planId = String(plan?.planId || "").trim();
  if (!planId || !hasGoalBudgetDraft(plan)) {
    return;
  }
  if (state.goalBudgetCommitTimer !== null) {
    window.clearTimeout(state.goalBudgetCommitTimer);
  }
  state.goalBudgetCommitTimer = window.setTimeout(() => {
    state.goalBudgetCommitTimer = null;
    if (state.activeGoalPlan?.planId !== planId) {
      clearGoalBudgetDraft();
      return;
    }
    commitGoalBudgetDraft(state.activeGoalPlan);
  }, GOAL_BUDGET_IDLE_COMMIT_MS);
}

function updateGoalBudgetPreviewUi(plan = state.activeGoalPlan) {
  if (!elements.goalPlanBudget || !plan) {
    return;
  }
  const slider = elements.goalPlanBudget.querySelector("#goalBudgetSlider");
  if (!slider) {
    return;
  }
  const previewSpend = getGoalBudgetPreviewSpend(plan);
  const maxSpend = Math.max(0, Number(slider.max) || getPlanBudgetMaxSpend(plan));
  const sliderProgress = maxSpend > 0 ? ((previewSpend / maxSpend) * 100).toFixed(2) : "0";
  slider.value = String(previewSpend);
  slider.style.setProperty("--goal-budget-progress", `${sliderProgress}%`);
  const rangeValue = elements.goalPlanBudget.querySelector("[data-goal-budget-range-value]");
  if (rangeValue) {
    rangeValue.textContent = formatMoney(previewSpend);
  }
  const selectedValue = elements.goalPlanBudget.querySelector("[data-goal-budget-selected-value]");
  if (selectedValue) {
    selectedValue.textContent = formatMoney(previewSpend);
  }
  const maxButton = elements.goalPlanBudget.querySelector(".js-goal-budget-max");
  if (maxButton) {
    maxButton.disabled = slider.disabled || previewSpend >= maxSpend;
  }
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
  const previewSpend = getGoalBudgetPreviewSpend(plan);
  const previewPending = hasGoalBudgetDraft(plan);
  const fundedCount = budgetScenario.fundedPlacements.length;
  const heldBackCount = budgetScenario.heldBackPlacements.length;
  const selectedCount = getGoalPlacementSelectionIds(plan).length;
  const availableCount = getAvailableGoalPlacements(plan).length;
  const flightSummary = formatGoalFlightSummary(plan.goal?.flightStartDate, plan.goal?.flightEndDate);
  const pricingModelLabel = String(plan?.budget?.pricingModelLabel || plan?.goal?.pricingModelLabel || "Retailer-set CPM by screen type").trim();
  const sliderStep = getGoalBudgetSliderStep(maxSpend, previewSpend);
  const pendingApplyPlanId = getPendingActionValue("goalPlanApply");
  const applyPending = hasPendingAction("goalPlanApply");
  const applyingThisPlan = pendingApplyPlanId === String(plan.planId || "").trim();
  const sliderDisabled = plan.status === "applied" || selectedCount === 0 || applyPending;
  const maxShortcutDisabled = sliderDisabled || previewSpend >= maxSpend;
  const launchDisabled = plan.status === "applied" || fundedCount === 0 || selectedCount === 0 || applyPending;
  const sliderProgress = maxSpend > 0 ? ((previewSpend / maxSpend) * 100).toFixed(2) : "0";
  const estimatedImpressions = Math.max(0, Math.round(Number(budgetScenario.maxEstimatedImpressions || 0)));
  const fundedEstimatedImpressions = Math.max(0, Math.round(Number(budgetScenario.fundedEstimatedImpressions || 0)));
  const budgetNote = previewPending
    ? `Previewing ${formatMoney(previewSpend)}. Funding split and estimated delivery refresh after you stop dragging for a second.`
    : selectedCount === 0
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
        : "Increase the budget to fund at least one placement.";

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
            value="${escapeHtml(String(previewSpend))}"
            style="--goal-budget-progress: ${escapeHtml(sliderProgress)}%;"
            ${sliderDisabled ? "disabled" : ""}
          >
          <div class="goal-budget__range-meta">
            <span>${escapeHtml(formatMoney(0))}</span>
            <strong data-goal-budget-range-value>${escapeHtml(formatMoney(previewSpend))}</strong>
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
          <strong data-goal-budget-selected-value>${escapeHtml(formatMoney(previewSpend))}</strong>
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
        ${escapeHtml(budgetNote)}
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
  const brandContext = getGoalPlanBrandContext(plan);
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
  const excludedScreens = Array.isArray(plan.excludedScreens) ? plan.excludedScreens : [];
  const shareCapacityExcludedCount = excludedScreens.filter(
    (entry) => String(entry?.reasonCode || "").trim() === "share-capacity"
  ).length;
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
      ? shareCapacityExcludedCount > 0 && shareCapacityExcludedCount === excludedScreens.length
        ? "The best-fit screens are already fully sold at the current 1/6 share. Try a different store scope, page scope, or flight window."
        : "We could not find a strong in-store line-up for this brief. Try widening the placement focus or selecting a different account/category."
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
        ${
          buildBrandIdentityMarkup(brandContext, {
            className: "brand-badge brand-badge--summary",
            meta: brandContext.objectiveLabel || "",
            hideTitleWhenLogo: true
          }) || ""
        }
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

  const renderPlacementFact = (label, value, copy = "", className = "") => {
    const primary = String(value || "").trim();
    const secondary = String(copy || "").trim();
    if (!primary && !secondary) {
      return "";
    }
    return `<div class="goal-placement-row__fact${className ? ` ${className}` : ""}">
      <span class="goal-placement-row__fact-label">${escapeHtml(label)}</span>
      ${primary ? `<strong>${escapeHtml(primary)}</strong>` : ""}
      ${secondary ? `<span class="goal-placement-row__fact-copy">${escapeHtml(secondary)}</span>` : ""}
    </div>`;
  };

  const renderPlacementMetric = (value) => {
    const text = String(value || "").trim();
    if (!text) {
      return "";
    }
    return `<span class="goal-placement-row__metric">${escapeHtml(text)}</span>`;
  };

  const proposedChangeByScreenId = new Map(
    (plan.proposedChanges || [])
      .map((change) => [String(change?.screenId || "").trim(), change])
      .filter(([screenId]) => screenId)
  );

  const pluralize = (word, count) => (count === 1 ? word : `${word}s`);

  const summarizeListWithOverflow = (values, limit = 2, fallback = "") => {
    const items = [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
    if (items.length === 0) {
      return fallback;
    }
    const visible = items.slice(0, Math.max(1, limit));
    const summary = formatSentenceList(visible, visible.length);
    return items.length > visible.length ? `${summary} +${items.length - visible.length} more` : summary;
  };

  const formatGoalStoreLabel = (storeId) => {
    const raw = String(storeId || "").trim();
    if (!raw) {
      return "";
    }
    const normalized = raw.replace(/[_-]+/g, " ");
    const match = normalized.match(/^store\s*0*(\d+)$/i);
    if (match) {
      return `Store ${match[1]}`;
    }
    return titleCase(normalized);
  };

  const renderPlacementMetaBlock = (label, value, copy = "", className = "") => {
    const primary = String(value || "").trim();
    const secondary = String(copy || "").trim();
    if (!primary && !secondary) {
      return "";
    }
    return `<div class="goal-placement-card__meta-block${className ? ` ${className}` : ""}">
      <span class="goal-placement-card__meta-label">${escapeHtml(label)}</span>
      ${primary ? `<strong>${escapeHtml(primary)}</strong>` : ""}
      ${secondary ? `<span class="goal-placement-card__meta-copy">${escapeHtml(secondary)}</span>` : ""}
    </div>`;
  };

  const renderPlacementCard = (entry, index, { funded = true, available = false } = {}) => {
    const screenId = String(entry?.screenId || "").trim();
    const screen = { ...(getGoalPlanScreen(screenId) || {}), ...(entry || {}), screenId };
    const proposedChange = proposedChangeByScreenId.get(screenId);
    const recommendedSkus = Array.isArray(entry?.recommendedTargetSkus)
      ? entry.recommendedTargetSkus
      : Array.isArray(proposedChange?.recommendedTargetSkus)
        ? proposedChange.recommendedTargetSkus
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
    const shareRationale = String(entry?.shareRationale || "").trim();
    const shareLabel = String(entry?.shareLabel || "").trim();
    const placementRole = String(entry?.placementRole || getGoalPlacementRole(screen, plan.goal?.objective) || "").trim();
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
        ? `${shareLabel ? `${shareLabel} | ` : ""}${formatCount(estimatedImpressions)} est. imps${
            estimatedDailyImpressions > 0 ? ` | ${formatCount(estimatedDailyImpressions)}/day` : ""
          } | ${formatMoney(cpm)} CPM${screenType ? ` | ${screenType}` : ""}`
        : `${shareLabel ? `${shareLabel} | ` : ""}${formatMoney(dailyRate)} / day${screenType ? ` | ${screenType}` : ""}`;
    const actionButton =
      plan.status === "applied"
        ? ""
        : available
          ? `<button type="button" class="btn btn--tiny js-goal-placement-add" data-plan-id="${escapeHtml(plan.planId || "")}" data-screen-id="${escapeHtml(screenId)}">Add placement</button>`
          : `<button type="button" class="btn btn--tiny js-goal-placement-remove" data-plan-id="${escapeHtml(plan.planId || "")}" data-screen-id="${escapeHtml(screenId)}">Remove</button>`;
    const priorityLabel = recommendedSkuLabels.length > 0
      ? formatSentenceList(recommendedSkuLabels, Math.min(recommendedSkuLabels.length, 3))
      : focusLabel === "the selected brief"
        ? goalTargetSourceLabel(plan.goal?.targetSource)
        : focusLabel;
    const placementMetaRows = [
      placementRole
        ? renderPlacementMetaBlock(
            "Role",
            placementRole,
            normalizedExpectedOutcome ? `Expected outcome: ${normalizedExpectedOutcome}` : ""
          )
        : "",
      scoreLine ? renderPlacementMetaBlock("Score", scoreLine) : "",
      placementCost > 0 ? renderPlacementMetaBlock("Cost", formatMoney(placementCost), pricingMetaCopy) : "",
      shareLabel ? renderPlacementMetaBlock("Screen share", shareLabel, shareRationale) : "",
      templateRationale ? renderPlacementMetaBlock("Creative logic", templateRationale) : "",
      available && String(entry?.reasonCode || "").trim()
        ? renderPlacementMetaBlock(
            "Status",
            String(entry.reasonCode).trim(),
            "This placement is currently outside the active plan.",
            "goal-placement-card__meta-block--muted"
          )
        : "",
      `<div class="goal-placement-card__meta-block">
        <span class="goal-placement-card__meta-label">Priority SKU focus</span>
        <strong>${escapeHtml(priorityLabel)}</strong>
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

    return `<article class="record goal-placement-card${funded && !available ? "" : " record--muted"}${
      !funded && !available ? " goal-placement-card--excluded" : ""
    }${available ? " goal-placement-card--available" : ""}">
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

  const renderPlacementTypeCard = (group, index) => {
    const placementCount = group.entries.length;
    const storeCount = group.storeLabels.length;
    const scopedStoreCount = Math.max(storeCount, 1);
    const typeLabel = String(group.title || "screen type").trim().toLowerCase();
    const summaryLead = `${placementCount} ${typeLabel} ${pluralize("placement", placementCount)} ${
      plan.status === "applied" ? "are live" : "sit inside the current budget"
    } across ${scopedStoreCount} ${pluralize("store", scopedStoreCount)}.`;
    const summarySupport =
      group.templateRationales.length === 1
        ? group.templateRationales[0]
        : group.reasonLines.length === 1
          ? group.reasonLines[0]
          : "Showing one card per unique screen type in the funded line-up.";
    const shareSummary =
      group.shareLabels.length === 1 ? group.shareLabels[0] : group.shareLabels.length > 1 ? "Mixed screen shares" : "Standard screen share";
    const storeSummary = summarizeListWithOverflow(group.storeLabels, 3, `${placementCount} ${pluralize("placement", placementCount)}`);
    const screenSummary = summarizeListWithOverflow(group.screenLabels, 2, group.title);
    const focusSummary =
      summarizeListWithOverflow(group.priorityLabels, 1) ||
      summarizeListWithOverflow(targetProducts.map((product) => product.name), 3) ||
      goalTargetSourceLabel(plan.goal?.targetSource);
    const creativeValue =
      group.templateNames.length === 1
        ? group.templateNames[0]
        : group.templateNames.length > 1
          ? `${group.templateNames.length} creative variants`
          : "Creative mix";
    const creativeCopy =
      group.templateRationales.length === 1
        ? group.templateRationales[0]
        : group.templateRationales.length > 1
          ? "Creative logic varies slightly by store."
          : "";
    const impressionsCopy =
      group.totalImpressions > 0
        ? `${formatCount(group.totalImpressions)} est. imps${
            group.totalDailyImpressions > 0 ? ` | ${formatCount(group.totalDailyImpressions)}/day` : ""
          }`
        : group.totalDailyImpressions > 0
          ? `${formatCount(group.totalDailyImpressions)}/day`
          : "";
    const singleEntry = group.entries.length === 1 ? group.entries[0] : null;
    const actionButton =
      singleEntry && plan.status !== "applied"
        ? `<button type="button" class="btn btn--tiny js-goal-placement-remove" data-plan-id="${escapeHtml(plan.planId || "")}" data-screen-id="${escapeHtml(singleEntry.screenId)}">Remove</button>`
        : "";
    const title = group.title || "Screen type";
    const eyebrow = `Screen type ${String(index + 1).padStart(2, "0")}`;
    const placementMetaRows = [
      renderPlacementMetaBlock("Coverage", `${placementCount} funded ${pluralize("placement", placementCount)}`, storeSummary),
      renderPlacementMetaBlock("Commercials", group.totalCost > 0 ? formatMoney(group.totalCost) : "No spend modelled", impressionsCopy),
      renderPlacementMetaBlock("Screen share", shareSummary, screenSummary),
      `<div class="goal-placement-card__meta-block">
        <span class="goal-placement-card__meta-label">Priority SKU focus</span>
        <strong>${escapeHtml(focusSummary)}</strong>
        ${buildProductThumbStripMarkup(group.visiblePriorityProducts, {
          className: "product-thumb product-thumb--xs",
          maxItems: 4
        })}
        ${
          group.sampleExpectedOutcome
            ? `<span class="goal-placement-card__meta-copy">Expected outcome: ${escapeHtml(group.sampleExpectedOutcome)}</span>`
            : '<span class="goal-placement-card__meta-copy">One card per unique screen type to keep the funded view compact.</span>'
        }
      </div>`,
      renderPlacementMetaBlock("Creative", creativeValue, creativeCopy)
    ]
      .filter(Boolean)
      .join("");

    return `<article class="record goal-placement-card">
      <div class="record__top goal-placement-card__top">
        <div class="goal-placement-card__headline">
          <p class="goal-placement-card__eyebrow">${escapeHtml(eyebrow)}</p>
          <strong>${escapeHtml(title)}</strong>
        </div>
        <div class="goal-placement-card__actions">
          <span class="goal-placement__status pill ${plan.status === "applied" ? "pill--applied" : "pill--planned"}">${escapeHtml(plan.status === "applied" ? "Live" : "Funded")}</span>
          ${actionButton}
        </div>
      </div>
      <p class="goal-placement-card__reason">${escapeHtml([summaryLead, summarySupport].filter(Boolean).join(" "))}</p>
      <div class="goal-placement-card__meta-grid">
        ${placementMetaRows}
      </div>
    </article>`;
  };

  const renderPlacementRow = (entry, index, { funded = true, available = false } = {}) => {
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
    const shareRationale = String(entry?.shareRationale || "").trim();
    const shareLabel = String(entry?.shareLabel || "").trim();
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
        ? `${shareLabel ? `${shareLabel} | ` : ""}${formatCount(estimatedImpressions)} est. imps${
            estimatedDailyImpressions > 0 ? ` | ${formatCount(estimatedDailyImpressions)}/day` : ""
          } | ${formatMoney(cpm)} CPM${
            screenType ? ` | ${screenType}` : ""
          }`
        : `${shareLabel ? `${shareLabel} | ` : ""}${formatMoney(dailyRate)} / day${screenType ? ` | ${screenType}` : ""}`;
    const actionButton =
      plan.status === "applied"
        ? ""
        : available
          ? `<button type="button" class="btn btn--tiny js-goal-placement-add" data-plan-id="${escapeHtml(plan.planId || "")}" data-screen-id="${escapeHtml(screenId)}">Add placement</button>`
          : `<button type="button" class="btn btn--tiny js-goal-placement-remove" data-plan-id="${escapeHtml(plan.planId || "")}" data-screen-id="${escapeHtml(screenId)}">Remove</button>`;
    const screenContext = [screen.storeId, screen.pageId]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" | ");
    const priorityLabel = recommendedSkuLabels.length > 0
      ? formatSentenceList(recommendedSkuLabels, Math.min(recommendedSkuLabels.length, 3))
      : focusLabel === "the selected brief"
        ? goalTargetSourceLabel(plan.goal?.targetSource)
        : focusLabel;
    const detailFacts = [
      placementRole
        ? renderPlacementFact(
            "Role",
            placementRole,
            normalizedExpectedOutcome ? `Expected outcome: ${normalizedExpectedOutcome}` : ""
          )
        : "",
      placementCost > 0 ? renderPlacementFact("Cost", formatMoney(placementCost), pricingMetaCopy) : "",
      scoreLine ? renderPlacementFact("Score", scoreLine) : "",
      shareLabel ? renderPlacementFact("Screen share", shareLabel, shareRationale) : "",
      templateRationale ? renderPlacementFact("Creative logic", templateRationale) : "",
      available && String(entry?.reasonCode || "").trim()
        ? renderPlacementFact("Status", String(entry.reasonCode).trim(), "This placement is currently outside the active plan.")
        : "",
      renderPlacementFact("Priority SKU focus", priorityLabel)
    ]
      .filter(Boolean)
      .join("");
    const placementNumber = Number(entry?.budgetRank || entry?.selectionRank || index + 1);
    const eyebrow = available && Number(entry?.budgetRank || 0) <= 0
      ? "Available placement"
      : `Placement ${String(placementNumber).padStart(2, "0")}`;
    const summaryMetrics = [
      placementCost > 0 ? formatMoney(placementCost) : "",
      estimatedImpressions > 0
        ? `${formatCount(estimatedImpressions)} imps`
        : estimatedDailyImpressions > 0
          ? `${formatCount(estimatedDailyImpressions)}/day`
          : "",
      shareLabel || "",
      screenType || ""
    ]
      .filter(Boolean)
      .slice(0, 3)
      .map((value) => renderPlacementMetric(value))
      .join("");
    const detailNote = available
      ? "Add this placement to include it before budgeting."
      : funded
        ? plan.status === "applied"
          ? "This placement is live in the approved line-up."
          : "This placement is above the current budget line."
        : "This placement is selected but drops below the current budget cut line.";
    const groupCount = available
      ? availablePlacements.length
      : funded
        ? budgetScenario.fundedPlacements.length
        : budgetScenario.heldBackPlacements.length;
    const defaultOpen = index === 0 && groupCount > 0 && groupCount <= 4;
    return `<details class="goal-placement-row${funded || available ? "" : " goal-placement-row--held"}${available ? " goal-placement-row--available" : ""}"${defaultOpen ? " open" : ""}>
      <summary class="goal-placement-row__summary">
        <div class="goal-placement-row__summary-main">
          <span class="goal-placement-row__index">${escapeHtml(String(placementNumber).padStart(2, "0"))}</span>
          <div class="goal-placement-row__summary-copy">
            <p class="goal-placement-row__eyebrow">${escapeHtml(eyebrow)}</p>
            <strong>${escapeHtml(getScreenDisplayLabel(screenId) || screenId || "")}</strong>
            ${
              screenContext
                ? `<p class="goal-placement-row__context">${escapeHtml(screenContext)}</p>`
                : ""
            }
            <p class="goal-placement-row__reason">${escapeHtml(placementReason)}</p>
          </div>
        </div>
        <div class="goal-placement-row__summary-side">
          <span class="goal-placement__status pill ${available ? "" : plan.status === "applied" ? "pill--applied" : "pill--planned"}">${escapeHtml(placementLabel)}</span>
          ${summaryMetrics ? `<div class="goal-placement-row__metrics">${summaryMetrics}</div>` : ""}
          <span class="goal-placement-row__chevron" aria-hidden="true"></span>
        </div>
      </summary>
      <div class="goal-placement-row__detail">
        <div class="goal-placement-row__fact-grid">
          ${detailFacts}
        </div>
        ${buildProductThumbStripMarkup(visiblePriorityProducts, {
          className: "product-thumb product-thumb--xs",
          maxItems: 4
        })}
        <div class="goal-placement-row__footer">
          <p class="goal-placement-row__detail-note">${escapeHtml(detailNote)}</p>
          ${actionButton ? `<div class="goal-placement-row__detail-actions">${actionButton}</div>` : ""}
        </div>
      </div>
    </details>`;
  };

  const buildPlacementEntryViewModel = (entry, index, { funded = true, available = false } = {}) => {
    const screenId = String(entry?.screenId || "").trim();
    const screen = { ...(getGoalPlanScreen(screenId) || {}), ...(entry || {}), screenId };
    const proposedChange = proposedChangeByScreenId.get(screenId);
    const recommendedSkus = Array.isArray(entry?.recommendedTargetSkus)
      ? entry.recommendedTargetSkus
      : Array.isArray(proposedChange?.recommendedTargetSkus)
        ? proposedChange.recommendedTargetSkus
        : [];
    const recommendedSkuLabels = recommendedSkus.map((sku) => getProductLabelBySku(sku)).filter(Boolean);
    const priorityProducts = getProductsForSkuList(recommendedSkus, targetProducts);
    const visiblePriorityProducts = priorityProducts.length > 0 ? priorityProducts : uniqueGoalProductsBySku(targetProducts);
    const placementReason = available
      ? describeAvailablePlacementReason(entry, getGoalPlacementReason(entry || {}, screen, plan, targetProducts))
      : getGoalPlacementReason(entry || {}, screen, plan, targetProducts);
    const templateRationale = String(entry?.templateRationale || "").trim();
    const shareLabel = String(entry?.shareLabel || "").trim();
    const expectedOutcome = String(entry?.expectedOutcome || "").trim();
    const placementCost = Math.max(0, Math.round(Number(entry?.placementCost || 0)));
    const estimatedImpressions = Math.max(0, Math.round(Number(entry?.estimatedImpressions || 0)));
    const estimatedDailyImpressions = Math.max(0, Math.round(Number(entry?.estimatedDailyImpressions || 0)));
    const screenType = String(entry?.screenType || screen?.screenType || "").trim();
    const templateId = String(entry?.recommendedTemplateId || entry?.currentTemplateId || screen?.templateId || "").trim();
    const templateName = getTemplateById(templateId)?.name || templateId || "Creative";
    const placementRoleLabel = getGoalPlacementRole(screen, plan.goal?.objective);
    const normalizedExpectedOutcome = expectedOutcome.replace(/^Expected outcome:\s*/i, "");
    const actionButton =
      plan.status === "applied"
        ? ""
        : available
          ? `<button type="button" class="btn btn--tiny js-goal-placement-add" data-plan-id="${escapeHtml(plan.planId || "")}" data-screen-id="${escapeHtml(screenId)}">Add placement</button>`
          : `<button type="button" class="btn btn--tiny js-goal-placement-remove" data-plan-id="${escapeHtml(plan.planId || "")}" data-screen-id="${escapeHtml(screenId)}">Remove</button>`;
    const storeDisplay = formatGoalStoreLabel(screen.storeId || entry?.storeId || "");
    const screenContext = [
      storeDisplay || String(screen.storeId || "").trim(),
      titleCase(screen.location || ""),
      String(screen.pageId || "").trim()
    ]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" | ");
    const entryPriorityLabel = recommendedSkuLabels.length > 0
      ? formatSentenceList(recommendedSkuLabels, Math.min(recommendedSkuLabels.length, 3))
      : focusLabel === "the selected brief"
        ? goalTargetSourceLabel(plan.goal?.targetSource)
        : focusLabel;
    const summaryMetrics = [
      placementCost > 0 ? formatMoney(placementCost) : "",
      estimatedImpressions > 0
        ? `${formatCount(estimatedImpressions)} imps`
        : estimatedDailyImpressions > 0
          ? `${formatCount(estimatedDailyImpressions)}/day`
          : "",
      shareLabel || "",
      templateName || ""
    ]
      .filter(Boolean)
      .slice(0, 3)
      .map((value) => renderPlacementMetric(value))
      .join("");
    const groupTitle = screenType || placementRoleLabel || "Placement";
    const groupKey = groupTitle.toLowerCase() || screenId;

    return {
      key: screenId,
      screenId,
      screenLabel: getScreenDisplayLabel(screenId) || screenId || "Placement",
      screenContext,
      storeDisplay,
      groupKey,
      groupTitle,
      groupEyebrow: placementRoleLabel || "Placement type",
      placementReason,
      templateName,
      templateRationale,
      shareLabel,
      priorityLabel: entryPriorityLabel,
      normalizedExpectedOutcome,
      visiblePriorityProducts,
      placementCost,
      estimatedImpressions,
      estimatedDailyImpressions,
      summaryMetrics,
      actionButton,
      placementNumber: Number(entry?.budgetRank || entry?.selectionRank || index + 1)
    };
  };

  const buildPlacementGroups = (entries, options = {}) => {
    const groups = [];
    const groupByKey = new Map();

    entries.forEach((entry, index) => {
      const view = buildPlacementEntryViewModel(entry, index, options);
      let group = groupByKey.get(view.groupKey);
      if (!group) {
        group = {
          key: view.groupKey,
          title: view.groupTitle,
          eyebrow: view.groupEyebrow,
          entries: [],
          storeLabels: new Set(),
          screenLabels: new Set(),
          shareLabels: new Set(),
          templateNames: new Set(),
          templateRationales: new Set(),
          priorityLabels: new Set(),
          reasonLines: new Set(),
          productMap: new Map(),
          totalCost: 0,
          totalImpressions: 0,
          totalDailyImpressions: 0,
          sampleExpectedOutcome: view.normalizedExpectedOutcome
        };
        groupByKey.set(view.groupKey, group);
        groups.push(group);
      }

      group.entries.push(view);
      if (view.storeDisplay) {
        group.storeLabels.add(view.storeDisplay);
      }
      if (view.screenLabel) {
        group.screenLabels.add(view.screenLabel);
      }
      if (view.shareLabel) {
        group.shareLabels.add(view.shareLabel);
      }
      if (view.templateName) {
        group.templateNames.add(view.templateName);
      }
      if (view.templateRationale) {
        group.templateRationales.add(view.templateRationale);
      }
      if (view.priorityLabel) {
        group.priorityLabels.add(view.priorityLabel);
      }
      if (view.placementReason) {
        group.reasonLines.add(view.placementReason);
      }
      view.visiblePriorityProducts.forEach((product) => {
        const productKey =
          normalizeSku(product?.sku || product?.ProductId || product?.productId) || `${view.screenId}:${group.productMap.size}`;
        if (!group.productMap.has(productKey)) {
          group.productMap.set(productKey, product);
        }
      });
      group.totalCost += view.placementCost;
      group.totalImpressions += view.estimatedImpressions;
      group.totalDailyImpressions += view.estimatedDailyImpressions;
    });

    return groups.map((group) => ({
      ...group,
      storeLabels: [...group.storeLabels],
      screenLabels: [...group.screenLabels],
      shareLabels: [...group.shareLabels],
      templateNames: [...group.templateNames],
      templateRationales: [...group.templateRationales],
      priorityLabels: [...group.priorityLabels],
      reasonLines: [...group.reasonLines],
      visiblePriorityProducts: [...group.productMap.values()]
    }));
  };

  const renderPlacementClusterEntry = (entry) => {
    const detailNote = [
      entry.priorityLabel ? `SKU focus: ${entry.priorityLabel}` : "",
      entry.normalizedExpectedOutcome ? `Expected: ${entry.normalizedExpectedOutcome}` : ""
    ]
      .filter(Boolean)
      .join(" | ");

    return `<div class="goal-placement-cluster__entry">
      <div class="goal-placement-cluster__entry-copy">
        <div class="goal-placement-cluster__entry-top">
          <span class="goal-placement-cluster__entry-index">${escapeHtml(String(entry.placementNumber).padStart(2, "0"))}</span>
          <strong>${escapeHtml(entry.screenLabel)}</strong>
        </div>
        ${entry.screenContext ? `<p class="goal-placement-cluster__entry-context">${escapeHtml(entry.screenContext)}</p>` : ""}
        <p class="goal-placement-cluster__entry-reason">${escapeHtml(entry.placementReason)}</p>
        ${detailNote ? `<p class="goal-placement-cluster__entry-note">${escapeHtml(detailNote)}</p>` : ""}
      </div>
      <div class="goal-placement-cluster__entry-side">
        ${entry.summaryMetrics ? `<div class="goal-placement-row__metrics">${entry.summaryMetrics}</div>` : ""}
        ${entry.actionButton ? `<div class="goal-placement-cluster__entry-actions">${entry.actionButton}</div>` : ""}
      </div>
    </div>`;
  };

  const renderPlacementGroup = (group, index, { funded = true, available = false, totalGroups = 0 } = {}) => {
    const placementCount = group.entries.length;
    const storeCount = group.storeLabels.length;
    const statusText = available
      ? `${placementCount} available`
      : funded
        ? `${placementCount} ${plan.status === "applied" ? "live" : "funded"}`
        : `${placementCount} unfunded`;
    const statusPillClass = available ? "" : funded ? (plan.status === "applied" ? "pill--applied" : "pill--planned") : "";
    const metricMarkup = [
      `${placementCount} ${pluralize("placement", placementCount)}`,
      storeCount > 0 ? `${storeCount} ${pluralize("store", storeCount)}` : "",
      group.totalCost > 0 ? formatMoney(group.totalCost) : "",
      group.totalImpressions > 0
        ? `${formatCount(group.totalImpressions)} imps`
        : group.totalDailyImpressions > 0
          ? `${formatCount(group.totalDailyImpressions)}/day`
          : ""
    ]
      .filter(Boolean)
      .map((value) => renderPlacementMetric(value))
      .join("");
    const typeLabel = String(group.title || "placement").trim().toLowerCase();
    const scopedStoreCount = Math.max(storeCount, 1);
    const summaryLead = available
      ? `${placementCount} ${typeLabel} ${pluralize("placement", placementCount)} can be added across ${scopedStoreCount} ${pluralize("store", scopedStoreCount)}.`
      : funded
        ? `${placementCount} ${typeLabel} ${pluralize("placement", placementCount)} ${plan.status === "applied" ? "are live" : "sit inside the current budget"} across ${scopedStoreCount} ${pluralize("store", scopedStoreCount)}.`
        : `${placementCount} selected ${typeLabel} ${pluralize("placement", placementCount)} are currently outside the funded line-up across ${scopedStoreCount} ${pluralize("store", scopedStoreCount)}.`;
    const summarySupport =
      group.templateRationales.length === 1
        ? group.templateRationales[0]
        : group.reasonLines.length === 1
          ? group.reasonLines[0]
          : "";
    const shareSummary =
      group.shareLabels.length === 1 ? group.shareLabels[0] : group.shareLabels.length > 1 ? "Mixed screen shares" : "Standard screen share";
    const storeSummary = summarizeListWithOverflow(group.storeLabels, 3, `${placementCount} ${pluralize("placement", placementCount)}`);
    const screenSummary = summarizeListWithOverflow(group.screenLabels, 2, group.title);
    const focusSummary =
      summarizeListWithOverflow(group.priorityLabels, 1) ||
      summarizeListWithOverflow(targetProducts.map((product) => product.name), 3) ||
      goalTargetSourceLabel(plan.goal?.targetSource);
    const creativeValue =
      group.templateNames.length === 1
        ? group.templateNames[0]
        : group.templateNames.length > 1
          ? `${group.templateNames.length} creative variants`
          : "Creative mix";
    const creativeCopy =
      group.templateRationales.length === 1
        ? group.templateRationales[0]
        : group.templateRationales.length > 1
          ? "Creative logic shifts slightly by store format."
          : "";
    const footerNote = available
      ? "Expand this type to add individual placements back into the plan before budgeting."
      : funded
        ? plan.status === "applied"
          ? "Expand this type to review the live store-level placements."
          : "Expand this type to review store-level rationale or remove individual placements."
        : "Expand this type to review the unfunded stores or remove selections from the plan.";
    const defaultOpen = totalGroups === 1 || (index === 0 && totalGroups <= 2);

    return `<details class="goal-placement goal-placement-cluster${funded || available ? "" : " goal-placement--muted goal-placement-cluster--held"}${available ? " goal-placement--muted goal-placement-cluster--available" : ""}"${defaultOpen ? " open" : ""}>
      <summary class="goal-placement-cluster__summary">
        <div class="goal-placement-cluster__top">
          <div class="goal-placement-cluster__headline">
            <p class="goal-placement-cluster__eyebrow">${escapeHtml(group.eyebrow)}</p>
            <div class="goal-placement-cluster__title-row">
              <strong class="goal-placement__title">${escapeHtml(group.title)}</strong>
              <span class="goal-placement__status pill ${statusPillClass}">${escapeHtml(statusText)}</span>
            </div>
            <p class="goal-placement-cluster__summary-copy">${escapeHtml([summaryLead, summarySupport].filter(Boolean).join(" "))}</p>
          </div>
          <div class="goal-placement-cluster__summary-meta">
            ${metricMarkup}
            <span class="goal-placement-cluster__chevron" aria-hidden="true"></span>
          </div>
        </div>
      </summary>
      <div class="goal-placement-cluster__detail">
        <div class="goal-placement-card__meta-grid">
          ${renderPlacementMetaBlock("Coverage", `${placementCount} ${pluralize("placement", placementCount)}`, storeSummary)}
          ${renderPlacementMetaBlock(
            "Commercials",
            group.totalCost > 0 ? formatMoney(group.totalCost) : "No spend modelled",
            group.totalImpressions > 0
              ? `${formatCount(group.totalImpressions)} est. imps${
                  group.totalDailyImpressions > 0 ? ` | ${formatCount(group.totalDailyImpressions)}/day` : ""
                }`
              : group.totalDailyImpressions > 0
                ? `${formatCount(group.totalDailyImpressions)}/day`
                : ""
          )}
          ${renderPlacementMetaBlock("Screen share", shareSummary, screenSummary)}
          ${renderPlacementMetaBlock(
            "SKU focus",
            focusSummary,
            group.sampleExpectedOutcome ? `Expected outcome: ${group.sampleExpectedOutcome}` : ""
          )}
          ${renderPlacementMetaBlock("Creative", creativeValue, creativeCopy)}
        </div>
        ${buildProductThumbStripMarkup(group.visiblePriorityProducts, {
          className: "product-thumb product-thumb--xs",
          maxItems: 4
        })}
        <div class="goal-placement-cluster__entry-list">
          ${group.entries.map((entry) => renderPlacementClusterEntry(entry)).join("")}
        </div>
        <div class="goal-placement-cluster__footer">
          <p class="goal-placement-cluster__footer-note">${escapeHtml(footerNote)}</p>
        </div>
      </div>
    </details>`;
  };

  const fundedPlacementGroups = buildPlacementGroups(
    planPlacements.filter((entry) => budgetScenario.fundedIds.has(String(entry?.screenId || "").trim())),
    { funded: true }
  );

  const fundedPlacementMarkup = fundedPlacementGroups
    .map((group, index) => renderPlacementTypeCard(group, index))
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
              <h3>${escapeHtml(plan.status === "applied" ? "Live screen types" : "Funded screen types")}</h3>
              <p class="goal-placement-group__meta">Showing one card per unique screen type. Totals still reflect every funded placement in the plan.</p>
            </div>
            <div class="goal-placement-list">
              ${fundedPlacementMarkup}
            </div>
          </section>`
        : "",
      heldPlacementMarkup
        ? `<section class="goal-placement-group goal-placement-group--excluded">
            <div class="goal-placement-group__header">
              <p class="section-kicker">Budget hold</p>
              <h3>Selected placements below the cut line</h3>
              <p class="goal-placement-group__meta">These stay selected, but they will not launch until the budget line moves down.</p>
            </div>
            <div class="goal-placement-list">
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
            <div class="goal-placement-list">
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
    elements.monitoringMeasurementTitle.textContent = brandContext.brand ? `${brandName} snapshot` : "Campaign snapshot";
  }
  if (elements.monitoringMeasurementIntro) {
    elements.monitoringMeasurementIntro.textContent = brandContext.brand
      ? `Three answers first for ${brandName}: delivery, sales lift, and return on spend.`
      : "Three answers first: delivery, sales lift, and return on spend.";
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

function buildMeasurementSummaryMeta(items = []) {
  const metaItems = items.filter(Boolean);
  if (metaItems.length === 0) {
    return "";
  }
  return `<p class="measurement-summary__meta">${metaItems
    .map((item) => `<span class="measurement-summary__meta-item">${escapeHtml(item)}</span>`)
    .join("")}</p>`;
}

function getMeasurementMetric(board, key) {
  if (!key || !Array.isArray(board?.metrics)) {
    return null;
  }
  return board.metrics.find((metric) => metric?.key === key) || null;
}

function getMeasurementMetricValueText(metric, fallback = "0") {
  const valueText = String(metric?.valueText || "").trim();
  if (valueText) {
    return valueText;
  }
  return String(fallback || "0").trim() || "0";
}

function buildMeasurementFocusCardMarkup({ label = "", value = "", detail = "", comparison = "", accent = false } = {}) {
  return `<article class="measurement-focus-card${accent ? " measurement-focus-card--accent" : ""}">
    <p class="measurement-focus-card__label">${escapeHtml(label)}</p>
    <strong>${escapeHtml(value)}</strong>
    ${detail ? `<p class="measurement-focus-card__detail">${escapeHtml(detail)}</p>` : ""}
    ${comparison ? `<p class="measurement-focus-card__comparison">${escapeHtml(comparison)}</p>` : ""}
  </article>`;
}

function renderMeasurementPrimaryCards(board, totals = {}) {
  if (!elements.measurementPrimaryGrid) {
    return;
  }

  if (!board) {
    elements.measurementPrimaryGrid.innerHTML = DEFAULT_MEASUREMENT_PRIMARY_GRID_HTML;
    return;
  }

  const incrementalMetric = getMeasurementMetric(board, "incrementality");
  const roasMetric = getMeasurementMetric(board, "inStoreROAS");
  const playCount = Number(board?.current?.playCount || totals?.playCount || 0);
  const exposureMs = Number(board?.current?.exposureMs || totals?.exposureMs || 0);

  const cards = [
    buildMeasurementFocusCardMarkup({
      label: "Live delivery",
      value: playCount > 0 ? `${formatCount(playCount)} plays` : "Waiting for delivery",
      detail: playCount > 0 ? `Observed exposure: ${formatDuration(exposureMs)}` : "Ad plays and exposure appear here first."
    }),
    buildMeasurementFocusCardMarkup({
      label: incrementalMetric?.label || "Incremental sales",
      value: getMeasurementMetricValueText(incrementalMetric, formatMoney(board?.current?.incrementalSales || 0)),
      detail: buildMeasurementMetricNote(incrementalMetric) || "Estimated sales lift appears after delivery starts.",
      comparison: getMeasurementComparisonText(incrementalMetric)
    }),
    buildMeasurementFocusCardMarkup({
      label: roasMetric?.label || "Return on spend",
      value: getMeasurementMetricValueText(roasMetric, String(board?.current?.inStoreROAS || 0)),
      detail: buildMeasurementMetricNote(roasMetric) || "Estimated efficiency appears once spend and sales are in scope.",
      comparison: getMeasurementComparisonText(roasMetric),
      accent: true
    })
  ];

  elements.measurementPrimaryGrid.innerHTML = cards.join("");
}

function renderMeasurementBoard(board) {
  if (!elements.measurementBoardGrid) {
    return;
  }

  const metrics = ["interactionRate", "qrScans", "newBuyerAcquisition"]
    .map((key) => getMeasurementMetric(board, key))
    .filter(Boolean);
  if (metrics.length === 0) {
    elements.measurementBoardGrid.innerHTML = DEFAULT_MEASUREMENT_BOARD_GRID_HTML;
    return;
  }

  elements.measurementBoardGrid.innerHTML = metrics
    .map((metric) => {
      const comparisonText = getMeasurementComparisonText(metric);
      const detailText = buildMeasurementMetricNote(metric);
      return `<article class="measurement-card">
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
  const updatedText = totals.lastSeenAt ? `Updated ${formatTimestamp(totals.lastSeenAt)}` : "No telemetry yet.";

  if (elements.monitoringMeasurementMeta) {
    elements.monitoringMeasurementMeta.textContent = updatedText;
  }

  if (!telemetry || totalEvents === 0) {
    const brandContext = getGoalPlanBrandContext();
    elements.telemetrySummary.classList.add("empty");
    elements.telemetrySummary.innerHTML = `
      <p class="measurement-summary__eyebrow">Start here</p>
      <strong class="measurement-summary__headline">${escapeHtml(
        brandContext.brand ? `${brandContext.brand} is not live yet` : "Campaign is not live yet"
      )}</strong>
      <p class="measurement-summary__body">${escapeHtml(
        brandContext.brand
          ? `Launch ${brandContext.brand}'s campaign to populate observed delivery first. Sales and efficiency estimates appear once telemetry is flowing.`
          : "Launch a campaign to populate observed delivery first. Sales and efficiency estimates appear once telemetry is flowing."
      )}</p>
    `;
    renderMeasurementPrimaryCards(null, totals);
    renderMeasurementBoard(null);
    renderTelemetryList(elements.telemetryByScreen, [], "screen");
    renderTelemetryList(elements.telemetryByTemplate, [], "template");
    renderTelemetryList(elements.telemetryBySku, [], "sku");
    return;
  }

  const measurementBoard = telemetry.measurementBoard;
  const comparison = telemetry.planComparison;
  elements.telemetrySummary.classList.remove("empty");
  const brandContext = getGoalPlanBrandContext();
  const scope = measurementBoard?.scope || {};
  const roasMetric = getMeasurementMetric(measurementBoard, "inStoreROAS");
  const roasText = getMeasurementMetricValueText(roasMetric, String(measurementBoard?.current?.inStoreROAS || 0));
  const summaryHeadline = brandContext.brand ? `${brandContext.brand} performance snapshot` : "Performance snapshot";
  const summaryBody = brandContext.brand
    ? `Delivery is live for ${brandContext.brand}. Estimated incremental sales are ${formatMoney(
        measurementBoard?.current?.incrementalSales || 0
      )} and return on spend is ${roasText}.`
    : `Delivery is live. Estimated incremental sales are ${formatMoney(
        measurementBoard?.current?.incrementalSales || 0
      )} and return on spend is ${roasText}.`;
  const coverageText =
    Number(scope.storeCount || 0) > 0 || Number(scope.screenCount || 0) > 0
      ? [
          Number(scope.storeCount || 0) > 0 ? `${formatCount(scope.storeCount || 0)} store${Number(scope.storeCount || 0) === 1 ? "" : "s"}` : "",
          Number(scope.screenCount || 0) > 0 ? `${formatCount(scope.screenCount || 0)} screen${Number(scope.screenCount || 0) === 1 ? "" : "s"}` : ""
        ]
          .filter(Boolean)
          .join(" / ")
      : "";
  const summaryNote =
    comparison?.afterApply && comparison?.beforeApply
      ? `Prior window: ${formatCount(comparison.afterApply.playCount || 0)} plays after apply vs ${formatCount(
          comparison.beforeApply.playCount || 0
        )} before apply.`
      : "";

  elements.telemetrySummary.innerHTML = `
    <p class="measurement-summary__eyebrow">Start here</p>
    <strong class="measurement-summary__headline">${escapeHtml(summaryHeadline)}</strong>
    <p class="measurement-summary__body">${escapeHtml(summaryBody)}</p>
    ${buildMeasurementSummaryMeta(
      [
        coverageText ? `Coverage ${coverageText}` : "",
        Number(scope.selectedSpend || 0) > 0 ? `Budget ${formatMoney(scope.selectedSpend || 0)}` : ""
      ].filter(Boolean)
    )}
    ${summaryNote ? `<p class="measurement-summary__note">${escapeHtml(summaryNote)}</p>` : ""}
  `;

  renderMeasurementPrimaryCards(measurementBoard, totals);
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
  return `${seconds}s screen cadence`;
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
  const leadProduct = products[0] || {};
  const screenBrandMarkup = buildBrandIdentityMarkup(
    {
      brand: getProductDisplayBrand(leadProduct),
      logo: getProductDisplayLogo(leadProduct),
      advertiserId: readTextValue(leadProduct?.advertiserId || leadProduct?.ClientAdvertiserId)
    },
    {
      className: "brand-badge brand-badge--mini",
      meta: "",
      hideTitleWhenLogo: true
    }
  );
  const productMarkup =
    products.length > 0
      ? `<div class="goal-live-products">${products.map((product) => buildGoalLiveProductMarkup(product)).join("")}</div>`
      : '<div class="empty">No product payload attached to this screen.</div>';
  const stats = [
    screen.storeId || "",
    screen.pageId || "",
    screen.location || "",
    screen.activeLineItemShareLabel || "",
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
        ${screenBrandMarkup}
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
    elements.goalLiveSummary.innerHTML = `
      ${
        buildBrandIdentityMarkup(brandContext, {
          className: "brand-badge brand-badge--summary",
          meta: brandContext.objectiveLabel || "",
          hideTitleWhenLogo: true
        }) || ""
      }
      <p>${escapeHtml(
        brandContext.brand
          ? `Launch ${brandContext.brand}'s campaign to view live placements and creatives.`
          : "Launch the selected campaign to view live placements and creatives."
      )}</p>
    `;
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
  const liveShareLabel = String(liveScreens[0]?.activeLineItemShareLabel || "").trim();
  if (elements.goalLiveSearch) {
    elements.goalLiveSearch.disabled = liveScreens.length === 0;
  }
  elements.goalLiveSummary.classList.remove("empty");
  elements.goalLiveSummary.innerHTML = `
    ${
      buildBrandIdentityMarkup(brandContext, {
        className: "brand-badge brand-badge--summary",
        meta: brandContext.objectiveLabel || "",
        hideTitleWhenLogo: true
      }) || ""
    }
    <strong>${escapeHtml(brandContext.brand ? `${brandContext.brand} live network` : "Live network")}</strong>
    <p class="goal-change__metrics">
      ${escapeHtml(formatCount(plan.liveCount || liveScreens.length || 0))} screens | ${escapeHtml(
        brandContext.objectiveLabel || "Active campaign"
      )} | Live since ${escapeHtml(formatTimestamp(plan.appliedAt || plan.updatedAt || plan.createdAt))}
    </p>
    <p class="goal-change__metrics">
      ${brandContext.accountLabel ? `Account ${escapeHtml(brandContext.accountLabel)} | ` : ""}Campaign ${escapeHtml(plan.planId || "")} | Budget ${escapeHtml(
        formatMoney(plan?.budget?.selectedSpend || 0)
      )}${liveShareLabel ? ` | Share ${escapeHtml(liveShareLabel)}` : ""}
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
            const detailLine = [
              screen.activeLineItemShareLabel,
              screen.screenType,
              screen.screenSize,
              formatLiveRefreshInterval(screen.refreshInterval)
            ]
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
  renderBusyOverlay();
  renderMarketStoryOverlay();
  refreshPageCounter();
  renderBrandContextSlots();
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
  const sharePreset = getScreenSharePresetConfig(String(formData.get("screenSharePreset") || "").trim());
  return {
    screenId: String(formData.get("screenId") || "").trim(),
    storeId: String(formData.get("storeId") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    pageId: String(formData.get("pageId") || "").trim(),
    screenType: String(formData.get("screenType") || "").trim(),
    screenSize: String(formData.get("screenSize") || "").trim(),
    templateId: String(formData.get("templateId") || "").trim(),
    refreshInterval: Number(formData.get("refreshInterval")),
    screenShareSlots: sharePreset.screenShareSlots,
    defaultSellableShareSlots: sharePreset.defaultSellableShareSlots
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
    const anchorSharePreset = getScreenSharePresetConfig(String(elements.anchorSharePreset?.value || "").trim());
    state.pendingAnchorSharePreset = anchorSharePreset.value;
    screenPayload.pageId = screenPayload.pageId || pagePayload.pageId;
    screenPayload.screenShareSlots = anchorSharePreset.screenShareSlots;
    screenPayload.defaultSellableShareSlots = anchorSharePreset.defaultSellableShareSlots;

    if (!pagePayload.pageId) {
      throw new Error("First-screen page configuration is missing.");
    }
    if (!screenPayload.screenId) {
      throw new Error("First-screen screen configuration is missing.");
    }

    showStatus("Creating the first screen...");

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
    state.pendingAnchorSharePreset = "";
    state.manualSupplyConfirmed = state.screens.some((screen) => screen.screenId === getManualSupplyConfig().screen.screenId);
    state.supplyHandoffAcknowledged = false;
    state.lastDemoAction = {
      kind: "anchor",
      message: `Screen ready. ${screenPayload.screenId} is mapped to ${pagePayload.pageId} at ${getScreenShareDisplayLabel(screenPayload)}.`
    };

    syncSupplyFormDefaults();
    renderAll();
    showToast("Screen ready.");
    showStatus("The first screen is ready. Auto build the rest of the screens to finish Supply.");
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
      state.pendingAnchorSharePreset = "";
      state.manualSupplyConfirmed = true;
      state.supplyHandoffAcknowledged = false;
    }
    syncSupplyFormDefaults();
    renderAll();

    if (!editingId && shouldEnterEditMode && state.screens.some((screen) => screen.screenId === payload.screenId)) {
      beginScreenEdit(payload.screenId);
    }

    if (effectiveScreenId === getManualSupplyConfig().screen.screenId) {
      showStatus("The first screen is ready. Auto build the rest of the screens to expand the supply setup.");
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
      state.pendingAnchorSharePreset = "";
      state.manualSupplyConfirmed = false;
      state.presetLoadedInSession = false;
      state.presetSimulatedInSession = false;
      state.supplyHandoffAcknowledged = false;
      state.activeGoalPlan = null;
      state.goalPlacementSelections.clear();
      setGoalBudgetStateFromPlan(null);
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
  if (!ensureGoalPlanningReadyForSubmit()) {
    return;
  }
  const prepared = prepareGoalPayloadForDemo();
  return runPendingAction("goalPlan", async () => {
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
  const targetPlanForDraft =
    chosenPlanId === state.activeGoalPlan?.planId
      ? state.activeGoalPlan
      : state.agentRuns.find((entry) => entry.planId === chosenPlanId) || state.activeGoalPlan;
  commitGoalBudgetDraft(targetPlanForDraft, { render: false, publish: false });
  return runPendingAction(`goalPlanApply:${chosenPlanId}`, async () => {
    const targetPlan =
      chosenPlanId === state.activeGoalPlan?.planId
        ? state.activeGoalPlan
        : state.agentRuns.find((entry) => entry.planId === chosenPlanId) || state.activeGoalPlan;
    const budgetSpend = getActiveGoalBudgetSpend(targetPlan);
    const selectedScreenIds = getGoalPlacementSelectionIds(targetPlan);
    const budgetScenario = buildGoalBudgetScenario(targetPlan);

    if (budgetScenario.fundedPlacements.length === 0 || selectedScreenIds.length === 0) {
      renderGoalPlan();
      showToast("Increase the budget to fund at least one placement before launch.", true);
      return;
    }

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
      screenShareSlots: Number(screen.screenShareSlots || 6),
      defaultSellableShareSlots: Number(screen.defaultSellableShareSlots || 1),
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
      throw new Error("Create the first screen first, then auto build the rest.");
    }

    showStatus("Auto building the rest of the screens...");
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
    setGoalBudgetStateFromPlan(null);
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
    state.pendingAnchorSharePreset = "";
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
    setGoalBudgetStateFromPlan(null);
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
  const handleWorkspaceActivity = () => {
    registerWorkspaceActivity();
  };
  document.addEventListener("click", (event) => {
    if (state.workspaceSwitchMode && event.target.closest("#workspaceOverlay .workspace-overlay__backdrop")) {
      cancelWorkspaceSwitch();
      return;
    }

    const workspaceCard = event.target.closest(".workspace-card");
    if (workspaceCard) {
      claimWorkspace(workspaceCard.dataset.workspaceId || "").catch(handleError);
      return;
    }

    if (event.target.closest("#switchWorkspaceBtn")) {
      beginWorkspaceSwitch();
      return;
    }

    const brandPickerOption = event.target.closest(".brand-picker__option");
    if (brandPickerOption && elements.goalBrandPicker?.contains(brandPickerOption)) {
      chooseGoalBrandAccount(brandPickerOption.dataset.advertiserId || "");
      return;
    }

    if (event.target.closest("#goalBrandPickerButton")) {
      setGoalBrandPickerOpen(!isGoalBrandPickerOpen());
      return;
    }

    if (isGoalBrandPickerOpen() && !event.target.closest("#goalBrandPicker")) {
      setGoalBrandPickerOpen(false);
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
      clearGoalBudgetDraft();
      state.goalBudgetPlanId = state.activeGoalPlan.planId || budgetMaxButton.dataset.planId || "";
      state.goalBudgetSpend = getPlanBudgetMaxSpend(state.activeGoalPlan);
      renderGoalPlan();
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
    showStatus("Step 3 unlocked. Let AI recommend the shortlist, or open manual selection if you need to override it.");
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
    renderAll();
    const account = getGoalAccountByAdvertiserId();
    if (removedCount > 0) {
      showStatus(`Account changed. Removed ${removedCount} SKU(s) from the previous account.`);
    } else if (account?.brand) {
      showStatus(
        getGoalPromptText()
          ? `Assortment filtered to ${getProductAccountLabel(account)}. Click Let AI choose SKU's to refresh the recommended shortlist.`
          : `Assortment filtered to ${getProductAccountLabel(account)}.`
      );
    } else {
      showStatus("Choose an account to continue planning.");
    }
  });
  elements.goalBrandPickerButton?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setGoalBrandPickerOpen(true);
      focusGoalBrandPickerOption(event.key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (event.key === "Escape") {
      setGoalBrandPickerOpen(false);
    }
  });
  elements.goalBrandPickerMenu?.addEventListener("keydown", (event) => {
    const option = event.target.closest(".brand-picker__option");
    if (event.key === "Escape") {
      event.preventDefault();
      setGoalBrandPickerOpen(false);
      elements.goalBrandPickerButton?.focus();
      return;
    }
    if (event.key === "Tab") {
      setGoalBrandPickerOpen(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusGoalBrandPickerOption(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusGoalBrandPickerOption(-1);
      return;
    }
    if ((event.key === "Enter" || event.key === " ") && option) {
      event.preventDefault();
      chooseGoalBrandAccount(option.dataset.advertiserId || "");
    }
  });
  elements.goalObjective?.addEventListener("change", () => {
    if (getGoalPromptText()) {
      markGoalPromptSelectionDirty();
    } else {
      renderGoalPlanningFlow();
    }
  });
  elements.goalAggressiveness?.addEventListener("change", () => {
    if (getGoalPromptText()) {
      markGoalPromptSelectionDirty();
    } else {
      renderGoalPlanningFlow();
    }
  });
  elements.goalStoreScope?.addEventListener("change", () => {
    if (getGoalPromptText()) {
      markGoalPromptSelectionDirty();
    } else {
      renderGoalPlanningFlow();
    }
  });
  elements.goalPageScope?.addEventListener("change", () => {
    if (getGoalPromptText()) {
      markGoalPromptSelectionDirty();
    } else {
      renderGoalPlanningFlow();
    }
  });
  elements.goalFlightStart?.addEventListener("change", () => {
    renderGoalPlanningFlow();
  });
  elements.goalFlightEnd?.addEventListener("change", () => {
    renderGoalPlanningFlow();
  });
  elements.goalPrompt?.addEventListener("input", () => {
    markGoalPromptSelectionDirty();
  });
  elements.goalPromptRunBtn?.addEventListener("click", () => {
    applyGoalPromptSelection().catch(handleError);
  });
  elements.retailerRateCard?.addEventListener("input", (event) => {
    if (!event.target.closest(".js-retailer-rate-input")) {
      return;
    }
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
  });
  elements.goalProductSearch?.addEventListener("input", () => {
    renderGoalProducts();
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
  });
  elements.goalPlanBudget?.addEventListener("input", (event) => {
    const slider = event.target.closest("#goalBudgetSlider");
    if (!slider || !state.activeGoalPlan) {
      return;
    }
    state.goalBudgetDraftPlanId = state.activeGoalPlan.planId || "";
    state.goalBudgetDraftSpend = normalizeGoalBudgetSpend(state.activeGoalPlan, slider.value);
    updateGoalBudgetPreviewUi(state.activeGoalPlan);
    scheduleGoalBudgetCommit(state.activeGoalPlan);
  });
  elements.screenCancelBtn?.addEventListener("click", () => {
    if (state.editingScreenId === getManualSupplyConfig().screen.screenId) {
      state.pendingAnchorSharePreset = "";
    }
    syncSupplyFormDefaults();
    renderAll();
    showStatus("Edit mode cancelled.");
  });
  elements.anchorSharePreset?.addEventListener("change", () => {
    const preset = getScreenSharePresetConfig(elements.anchorSharePreset.value);
    state.pendingAnchorSharePreset = preset.value;
    if (!state.editingScreenId || state.editingScreenId === getManualSupplyConfig().screen.screenId) {
      if (elements.screenSharePreset) {
        elements.screenSharePreset.value = preset.value;
      }
    }
    renderPresetSummary();
    showStatus(`First-screen sellable share set to ${preset.label}. Auto-built screens stay at 1/6 unless changed in Advanced config.`);
  });
  elements.screenSharePreset?.addEventListener("change", () => {
    const preset = getScreenSharePresetConfig(elements.screenSharePreset.value);
    if (!state.editingScreenId || state.editingScreenId === getManualSupplyConfig().screen.screenId) {
      state.pendingAnchorSharePreset = preset.value;
      if (elements.anchorSharePreset) {
        elements.anchorSharePreset.value = preset.value;
      }
      renderPresetSummary();
    }
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
  document.addEventListener("pointerdown", handleWorkspaceActivity, { passive: true });
  document.addEventListener("keydown", handleWorkspaceActivity);
  window.addEventListener("scroll", handleWorkspaceActivity, { passive: true });
  window.addEventListener("focus", () => {
    registerWorkspaceActivity({ forceHeartbeat: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      registerWorkspaceActivity({ forceHeartbeat: true });
    }
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
    stopWorkspaceInactivityTimer();
    stopWorkspaceBadgeTicker();
    cancelMarketStoryAnimations();
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

    registerWorkspaceActivity({ forceHeartbeat: true });
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
