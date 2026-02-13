const state = {
  options: null,
  pages: [],
  screens: [],
  agentRuns: [],
  activeGoalPlan: null,
  productFeed: [],
  productCategories: [],
  selectedGoalSkuIds: new Set(),
  editingScreenId: null,
  collapsedStores: new Set(),
  collapsedPages: new Set(),
  toastTimeoutId: null
};

const elements = {
  pageForm: document.getElementById("page-form"),
  screenForm: document.getElementById("screen-form"),
  pageTypeGrid: document.getElementById("pageTypeGrid"),
  environmentGrid: document.getElementById("environmentGrid"),
  pageId: document.getElementById("pageId"),
  pageIdCount: document.getElementById("pageIdCount"),
  pageIdSelect: document.getElementById("pageIdSelect"),
  screenId: document.getElementById("screenId"),
  storeId: document.getElementById("storeId"),
  location: document.getElementById("location"),
  screenType: document.getElementById("screenType"),
  screenSize: document.getElementById("screenSize"),
  templateId: document.getElementById("templateId"),
  templatePreview: document.getElementById("templatePreview"),
  refreshInterval: document.getElementById("refreshInterval"),
  editScreenId: document.getElementById("editScreenId"),
  screenSubmitBtn: document.getElementById("screenSubmitBtn"),
  screenCancelBtn: document.getElementById("screenCancelBtn"),
  goalAgentForm: document.getElementById("goalAgentForm"),
  goalObjective: document.getElementById("goalObjective"),
  goalAggressiveness: document.getElementById("goalAggressiveness"),
  goalStoreScope: document.getElementById("goalStoreScope"),
  goalPageScope: document.getElementById("goalPageScope"),
  goalPrompt: document.getElementById("goalPrompt"),
  goalProductCategory: document.getElementById("goalProductCategory"),
  goalProductSearch: document.getElementById("goalProductSearch"),
  goalProductList: document.getElementById("goalProductList"),
  goalSkuCount: document.getElementById("goalSkuCount"),
  goalPlanBtn: document.getElementById("goalPlanBtn"),
  goalApplyBtn: document.getElementById("goalApplyBtn"),
  goalPlanSummary: document.getElementById("goalPlanSummary"),
  goalPlanChanges: document.getElementById("goalPlanChanges"),
  goalLiveSummary: document.getElementById("goalLiveSummary"),
  goalLiveScreens: document.getElementById("goalLiveScreens"),
  agentRunsList: document.getElementById("agentRunsList"),
  agentRefreshBtn: document.getElementById("agentRefreshBtn"),
  pagesList: document.getElementById("pagesList"),
  screensList: document.getElementById("screensList"),
  refreshBtn: document.getElementById("refreshBtn"),
  statusText: document.getElementById("statusText"),
  toast: document.getElementById("toast")
};

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function defaultValueOrFirst(options, preferred) {
  if (!Array.isArray(options) || !options.length) {
    return "";
  }
  return options.includes(preferred) ? preferred : options[0];
}

function escapeSelectorValue(value) {
  if (window.CSS && typeof window.CSS.escape === "function") {
    return window.CSS.escape(value);
  }
  return String(value).replace(/["\\]/g, "\\$&");
}

function showStatus(message, isError = false) {
  elements.statusText.textContent = message;
  elements.statusText.style.color = isError ? "#b42318" : "#5f6f87";
}

function showToast(message, isError = false) {
  if (state.toastTimeoutId) {
    clearTimeout(state.toastTimeoutId);
  }

  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  elements.toast.classList.toggle("is-error", isError);

  state.toastTimeoutId = setTimeout(() => {
    elements.toast.classList.remove("is-visible");
  }, 2500);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }
  return data;
}

function formatTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "Unknown time";
  }
  return date.toLocaleString();
}

function objectiveLabelById(objectiveId) {
  const objective = (state.options?.goalObjectives || []).find((entry) => entry.id === objectiveId);
  return objective?.label || objectiveId || "Goal";
}

function goalTargetSourceLabel(source) {
  switch (source) {
    case "manual":
      return "Manual SKU selection";
    case "prompt":
      return "Prompt-inferred SKU selection";
    default:
      return "Objective-only optimization";
  }
}

function normalizeSku(value) {
  return String(value || "").trim().toUpperCase();
}

function getTemplateById(templateId) {
  return (state.options?.templates || []).find((template) => template.id === templateId) || null;
}

function getFilteredGoalProducts() {
  const query = String(elements.goalProductSearch?.value || "").trim().toLowerCase();
  const category = String(elements.goalProductCategory?.value || "").trim().toLowerCase();
  const source = Array.isArray(state.productFeed) ? state.productFeed : [];
  return source.filter((product) => {
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
      ...(Array.isArray(product.tags) ? product.tags : [])
    ]
      .join(" ")
      .toLowerCase();
    return searchText.includes(query);
  });
}

function renderGoalSkuCount() {
  if (!elements.goalSkuCount) {
    return;
  }
  const selectedSkus = [...state.selectedGoalSkuIds];
  if (!selectedSkus.length) {
    elements.goalSkuCount.textContent = "0 SKU(s) selected.";
    return;
  }

  const selectedProducts = state.productFeed.filter((product) => state.selectedGoalSkuIds.has(normalizeSku(product.sku)));
  const namePreview = selectedProducts.slice(0, 3).map((product) => product.name).join(", ");
  const suffix = selectedProducts.length > 3 ? ` +${selectedProducts.length - 3} more` : "";
  elements.goalSkuCount.textContent = `${selectedSkus.length} SKU(s) selected: ${namePreview}${suffix}`;
}

function renderGoalProductCategoryOptions() {
  if (!elements.goalProductCategory) {
    return;
  }

  const selected = String(elements.goalProductCategory.value || "");
  const categories = Array.isArray(state.productCategories) ? state.productCategories : [];
  elements.goalProductCategory.innerHTML = [
    '<option value="">All categories</option>',
    ...categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
  ].join("");

  if (selected && categories.includes(selected)) {
    elements.goalProductCategory.value = selected;
  }
}

function renderGoalProductList() {
  if (!elements.goalProductList) {
    return;
  }
  const filtered = getFilteredGoalProducts();
  if (!filtered.length) {
    elements.goalProductList.innerHTML = '<div class="empty">No products match the current filter.</div>';
    renderGoalSkuCount();
    return;
  }

  elements.goalProductList.innerHTML = filtered
    .slice(0, 160)
    .map((product) => {
      const sku = normalizeSku(product.sku);
      const checked = state.selectedGoalSkuIds.has(sku) ? "checked" : "";
      const tags = Array.isArray(product.tags) && product.tags.length > 0 ? product.tags.slice(0, 3).join(", ") : "";
      return `<label class="goal-products__item">
        <input type="checkbox" class="js-goal-product-sku" value="${escapeHtml(sku)}" ${checked}>
        <span class="goal-products__label">
          <span class="goal-products__sku">${escapeHtml(sku)}</span>
          <span class="goal-products__name">${escapeHtml(product.name)}</span>
          <span class="goal-products__meta">${escapeHtml(product.brand)} | ${escapeHtml(product.category)}${
            tags ? ` | ${escapeHtml(tags)}` : ""
          }</span>
        </span>
      </label>`;
    })
    .join("");

  renderGoalSkuCount();
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
  renderGoalProductList();
}

async function refreshGoalProductFeed() {
  const response = await requestJson("/api/products?limit=300");
  state.productFeed = Array.isArray(response.products) ? response.products : [];
  state.productCategories = Array.isArray(response.categories) ? response.categories : [];
  renderGoalProductCategoryOptions();
  renderGoalProductList();
}

function refreshGoalScopeSelects() {
  if (!elements.goalStoreScope || !elements.goalPageScope) {
    return;
  }

  const storeIdOptions = [...new Set(state.screens.map((screen) => String(screen.storeId || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
  const pageIdOptions = [...new Set(state.pages.map((page) => String(page.pageId || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  const selectedStoreId = elements.goalStoreScope.value;
  const selectedPageId = elements.goalPageScope.value;

  elements.goalStoreScope.innerHTML = [
    '<option value="">All stores</option>',
    ...storeIdOptions.map((storeId) => `<option value="${escapeHtml(storeId)}">${escapeHtml(storeId)}</option>`)
  ].join("");

  elements.goalPageScope.innerHTML = [
    '<option value="">All mapped pages</option>',
    ...pageIdOptions.map((pageId) => `<option value="${escapeHtml(pageId)}">${escapeHtml(pageId)}</option>`)
  ].join("");

  if (selectedStoreId && storeIdOptions.includes(selectedStoreId)) {
    elements.goalStoreScope.value = selectedStoreId;
  }
  if (selectedPageId && pageIdOptions.includes(selectedPageId)) {
    elements.goalPageScope.value = selectedPageId;
  }
}

function renderGoalLiveState(plan) {
  if (!elements.goalLiveSummary || !elements.goalLiveScreens) {
    return;
  }
  if (!plan || plan.status !== "applied") {
    elements.goalLiveSummary.classList.add("empty");
    elements.goalLiveSummary.textContent = "Apply a plan to view live screens and creatives.";
    elements.goalLiveScreens.innerHTML = "";
    return;
  }

  const liveScreens = Array.isArray(plan.liveScreens) ? plan.liveScreens : [];
  const liveCount = Number(plan.liveCount || liveScreens.length || 0);
  const appliedAtText = formatTimestamp(plan.appliedAt || plan.updatedAt || plan.createdAt);
  const creativeGeneratedCount = Number(plan.creativeGeneratedCount || 0);
  elements.goalLiveSummary.classList.remove("empty");
  elements.goalLiveSummary.innerHTML = `
    <strong>Live Run Snapshot</strong>
    <p class="goal-change__metrics">
      Live screens: ${escapeHtml(liveCount)} | Applied: ${escapeHtml(appliedAtText)} | Auto-created creatives:
      ${escapeHtml(creativeGeneratedCount)}
    </p>
    <p class="goal-change__metrics">
      Plan ID: ${escapeHtml(plan.planId || "")}
    </p>
  `;

  if (!liveScreens.length) {
    elements.goalLiveScreens.innerHTML = '<div class="empty">No live screens were captured for this applied run.</div>';
    return;
  }

  elements.goalLiveScreens.innerHTML = liveScreens
    .map((screen) => {
      const products = Array.isArray(screen.products) ? screen.products : [];
      const productMarkup =
        products.length > 0
          ? `<div class="live-products">${products
              .map((product) => {
                const imageSrc = String(product.image || "").trim();
                const priceParts = [product.price, product.comparePrice ? `was ${product.comparePrice}` : ""]
                  .map((entry) => String(entry || "").trim())
                  .filter(Boolean)
                  .join(" | ");
                return `<div class="live-product">
                  <img src="${escapeHtml(imageSrc)}" alt="${escapeHtml(product.name || product.sku || "Product")}">
                  <div>
                    <p class="live-product__name">${escapeHtml(product.name || "Untitled Product")}</p>
                    <p class="live-product__meta">SKU: ${escapeHtml(product.sku || "")}</p>
                    <p class="live-product__meta">${escapeHtml(priceParts || "")}</p>
                  </div>
                </div>`;
              })
              .join("")}</div>`
          : '<p class="live-screen__meta">No active products found for the selected line item.</p>';

      const screenHref =
        String(screen.screenUrl || "").trim() ||
        `/screen.html?screenId=${encodeURIComponent(screen.screenId || "")}`;
      return `<article class="record">
        <div class="record__top">
          <strong>${escapeHtml(screen.screenId || "")}</strong>
          <span>${escapeHtml(screen.templateName || screen.templateId || "")}</span>
        </div>
        <p class="live-screen__meta">
          ${escapeHtml(screen.storeId || "")} | ${escapeHtml(screen.pageId || "")} | ${escapeHtml(screen.location || "")}
        </p>
        <p class="live-screen__meta">
          ${escapeHtml(screen.screenType || "")} ${escapeHtml(screen.screenSize || "")} | Refresh: ${escapeHtml(
            screen.refreshInterval || 0
          )}ms | Active line item: ${escapeHtml(screen.activeLineItemId || "n/a")}
        </p>
        <p class="live-screen__meta">
          <a href="${escapeHtml(screenHref)}" target="_blank" rel="noreferrer">Open Live Screen</a>
        </p>
        ${productMarkup}
      </article>`;
    })
    .join("");
}

function renderGoalPlan() {
  const plan = state.activeGoalPlan;
  if (!plan) {
    elements.goalPlanSummary.classList.add("empty");
    elements.goalPlanSummary.textContent = "No goal plan generated yet.";
    elements.goalPlanChanges.innerHTML = "";
    renderGoalLiveState(null);
    elements.goalApplyBtn.disabled = true;
    return;
  }

  const totals = plan.totals || {};
  const objectiveLabel = objectiveLabelById(plan.goal?.objective);
  const scopeText = [plan.goal?.storeId ? `Store ${plan.goal.storeId}` : "All stores", plan.goal?.pageId || "All pages"]
    .join(" | ");
  const targetedSkus = Array.isArray(plan.goal?.targetSkuIds) ? plan.goal.targetSkuIds : [];
  const excludedScreens = Array.isArray(plan.excludedScreens) ? plan.excludedScreens : [];
  const targetSource = goalTargetSourceLabel(plan.goal?.targetSource);
  const inferredTerms =
    Array.isArray(plan.goal?.inferredTerms) && plan.goal.inferredTerms.length > 0
      ? plan.goal.inferredTerms.join(", ")
      : "";
  const statusClass = plan.status === "applied" ? "pill--applied" : "pill--planned";
  const statusText = plan.status === "applied" ? "Applied" : "Planned";

  elements.goalPlanSummary.classList.remove("empty");
  elements.goalPlanSummary.innerHTML = `
    <strong>${escapeHtml(objectiveLabel)}</strong>
    <p>${escapeHtml(plan.summary || "")}</p>
    <p class="goal-change__metrics">
      Scope: ${escapeHtml(scopeText)} | Changes: ${escapeHtml(totals.proposedChanges || 0)} | Template switches:
      ${escapeHtml(totals.templateSwitches || 0)} | Refresh updates: ${escapeHtml(totals.refreshUpdates || 0)} | Target SKUs:
      ${escapeHtml(totals.targetSkus || targetedSkus.length || 0)} | SKU target updates:
      ${escapeHtml(totals.skuTargetUpdates || 0)} | Guardrail skips: ${escapeHtml(totals.excludedScreens || excludedScreens.length || 0)}
    </p>
    <p class="goal-change__metrics">
      Target source: ${escapeHtml(targetSource)}${inferredTerms ? ` | Prompt terms: ${escapeHtml(inferredTerms)}` : ""}
    </p>
    <p class="goal-change__metrics">
      Plan ID: ${escapeHtml(plan.planId || "")} | Created: ${escapeHtml(formatTimestamp(plan.createdAt))}
      <span class="pill ${statusClass}">${statusText}</span>
    </p>
  `;

  const changes = Array.isArray(plan.proposedChanges) ? plan.proposedChanges : [];
  const changesMarkup = changes
    .map((change) => {
      const fromTemplate = getTemplateById(change.currentTemplateId)?.name || change.currentTemplateId;
      const toTemplate = getTemplateById(change.recommendedTemplateId)?.name || change.recommendedTemplateId;
      const recommendedSkus = Array.isArray(change.recommendedTargetSkus) ? change.recommendedTargetSkus : [];
      const recommendedSkuPreview = recommendedSkus.slice(0, 3).join(", ");
      const recommendedSkuSuffix = recommendedSkus.length > 3 ? ` +${recommendedSkus.length - 3} more` : "";
      const recommendedSkuText = recommendedSkus.length > 0 ? `${recommendedSkuPreview}${recommendedSkuSuffix}` : "No SKU swap";
      return `<article class="record">
        <div class="record__top">
          <strong>${escapeHtml(change.screenId)}</strong>
          <span>${escapeHtml(Math.round((Number(change.confidence) || 0) * 100))}% confidence</span>
        </div>
        <p>Template: ${escapeHtml(fromTemplate)} -> ${escapeHtml(toTemplate)}</p>
        <p>Refresh: ${escapeHtml(change.currentRefreshInterval)}ms -> ${escapeHtml(
          change.recommendedRefreshInterval
        )}ms | Product relevance: ${escapeHtml(Math.round((Number(change.productRelevance) || 0) * 100))}%</p>
        <p class="goal-change__metrics">SKU targeting update: ${change.targetingChanged ? "Yes" : "No"}</p>
        <p class="goal-change__metrics">Recommended SKUs: ${escapeHtml(recommendedSkuText)}</p>
        <p class="goal-change__metrics">${escapeHtml(change.reason || "")}</p>
      </article>`;
    })
    .join("");
  const excludedMarkup = excludedScreens
    .map(
      (entry) => `<article class="record record--muted">
        <div class="record__top">
          <strong>${escapeHtml(entry.screenId || "")}</strong>
          <span>Skipped by guardrail</span>
        </div>
        <p class="goal-change__metrics">Relevance: ${escapeHtml(Math.round((Number(entry.productRelevance) || 0) * 100))}%</p>
        <p class="goal-change__metrics">${escapeHtml(entry.reason || "")}</p>
      </article>`
    )
    .join("");

  elements.goalPlanChanges.innerHTML =
    changesMarkup || excludedMarkup
      ? `${changesMarkup}${excludedMarkup}`
      : '<div class="empty">No screen changes were required for this scope.</div>';

  renderGoalLiveState(plan);
  elements.goalApplyBtn.disabled = plan.status === "applied" || changes.length === 0;
}

function renderAgentRuns() {
  if (!elements.agentRunsList) {
    return;
  }
  if (!state.agentRuns.length) {
    elements.agentRunsList.innerHTML = '<div class="empty">No agent runs yet.</div>';
    return;
  }

  elements.agentRunsList.innerHTML = state.agentRuns
    .map((run) => {
      const objectiveLabel = objectiveLabelById(run.goal?.objective);
      const scopeText = [run.goal?.storeId || "All stores", run.goal?.pageId || "All pages"].join(" | ");
      const targetSkus = Array.isArray(run.goal?.targetSkuIds) ? run.goal.targetSkuIds.length : 0;
      const guardrailSkips = Number(run.totals?.excludedScreens || 0);
      const liveCount = Number(run.liveCount || 0);
      const createdCreatives = Number(run.creativeGeneratedCount || 0);
      const statusClass = run.status === "applied" ? "pill--applied" : "pill--planned";
      const statusText = run.status === "applied" ? "Applied" : "Planned";
      const canApply = run.status !== "applied";
      const canLoad = state.activeGoalPlan?.planId !== run.planId;

      return `<article class="record">
        <div class="record__top">
          <strong>${escapeHtml(objectiveLabel)}</strong>
          <span class="pill ${statusClass}">${statusText}</span>
        </div>
        <p class="agent-run__meta">
          Plan: ${escapeHtml(run.planId || "")} | Scope: ${escapeHtml(scopeText)} | Changes:
          ${escapeHtml(run.totals?.proposedChanges || 0)} | Guardrail skips: ${escapeHtml(guardrailSkips)} | Target SKUs:
          ${escapeHtml(targetSkus)}
        </p>
        <p class="agent-run__meta">
          Live screens: ${escapeHtml(liveCount)} | Auto-created creatives: ${escapeHtml(createdCreatives)}
        </p>
        <p class="agent-run__meta">
          Created: ${escapeHtml(formatTimestamp(run.createdAt))}${
            run.appliedAt ? ` | Applied: ${escapeHtml(formatTimestamp(run.appliedAt))}` : ""
          }
        </p>
        <span class="record__actions">
          ${canLoad ? `<button type="button" class="btn btn--tiny js-load-goal-plan" data-plan-id="${escapeHtml(run.planId)}">Load Plan</button>` : ""}
          ${canApply ? `<button type="button" class="btn btn--tiny js-apply-goal-plan" data-plan-id="${escapeHtml(run.planId)}">Apply</button>` : ""}
        </span>
      </article>`;
    })
    .join("");
}

async function refreshAgentRuns() {
  const response = await requestJson("/api/agent/goals/runs");
  state.agentRuns = Array.isArray(response.runs) ? response.runs : [];
  renderAgentRuns();

  if (state.activeGoalPlan?.planId) {
    const latest = state.agentRuns.find((entry) => entry.planId === state.activeGoalPlan.planId);
    if (latest) {
      state.activeGoalPlan = latest;
      renderGoalPlan();
      if (latest.status === "applied") {
        refreshGoalLiveState(latest.planId).catch((error) => {
          showStatus(error.message, true);
        });
      }
    }
  }
}

async function refreshGoalLiveState(planId) {
  const trimmedPlanId = String(planId || "").trim();
  if (!trimmedPlanId) {
    return;
  }
  const response = await requestJson(`/api/agent/goals/live?planId=${encodeURIComponent(trimmedPlanId)}`);
  if (!state.activeGoalPlan || state.activeGoalPlan.planId !== trimmedPlanId) {
    return;
  }
  state.activeGoalPlan = {
    ...state.activeGoalPlan,
    status: response.status || state.activeGoalPlan.status,
    appliedAt: response.appliedAt || state.activeGoalPlan.appliedAt,
    liveCount: Number(response.liveCount || 0),
    liveScreens: Array.isArray(response.liveScreens) ? response.liveScreens : state.activeGoalPlan.liveScreens || []
  };
  renderGoalPlan();
}

function readGoalPayloadFromForm() {
  const formData = new FormData(elements.goalAgentForm);
  return {
    objective: String(formData.get("objective") || "").trim(),
    aggressiveness: String(formData.get("aggressiveness") || "").trim(),
    storeId: String(formData.get("storeId") || "").trim(),
    pageId: String(formData.get("pageId") || "").trim(),
    prompt: String(formData.get("prompt") || "").trim(),
    targetSkuIds: [...state.selectedGoalSkuIds]
  };
}

async function handleGoalPlanSubmit(event) {
  event.preventDefault();
  const payload = readGoalPayloadFromForm();
  const response = await requestJson("/api/agent/goals/plan", {
    method: "POST",
    body: JSON.stringify(payload)
  });
  state.activeGoalPlan = response.run || null;
  renderGoalPlan();
  await refreshAgentRuns();
  showToast(`Goal plan ${state.activeGoalPlan?.planId || ""} created.`);
}

function loadGoalPlan(planId) {
  const run = state.agentRuns.find((entry) => entry.planId === planId);
  if (!run) {
    showToast(`Plan ${planId} not found.`, true);
    return;
  }
  if (run.goal) {
    if (run.goal.objective) {
      elements.goalObjective.value = run.goal.objective;
    }
    if (run.goal.aggressiveness) {
      elements.goalAggressiveness.value = run.goal.aggressiveness;
    }
    elements.goalStoreScope.value = run.goal.storeId || "";
    elements.goalPageScope.value = run.goal.pageId || "";
    elements.goalPrompt.value = run.goal.prompt || "";
    setSelectedGoalSkus(run.goal.targetSkuIds || []);
  }
  state.activeGoalPlan = run;
  renderGoalPlan();
  if (run.status === "applied") {
    refreshGoalLiveState(run.planId).catch((error) => {
      showStatus(error.message, true);
    });
  }
  showStatus(`Loaded plan ${planId}.`);
}

async function applyGoalPlan(planId) {
  const trimmedPlanId = String(planId || "").trim();
  if (!trimmedPlanId) {
    throw new Error("No plan selected.");
  }

  const response = await requestJson("/api/agent/goals/apply", {
    method: "POST",
    body: JSON.stringify({ planId: trimmedPlanId })
  });

  state.activeGoalPlan = response.run || state.activeGoalPlan;
  renderGoalPlan();
  await refreshLists();
  await refreshAgentRuns();
  await refreshGoalLiveState(trimmedPlanId);
  showToast(
    `Goal plan applied to ${response.appliedCount || 0} screen(s). Live: ${response.liveCount || 0}. Creative auto-build: ${
      response.creativeGeneratedCount || 0
    }.`
  );
}

function buildPageGroupKey(storeId, pageId) {
  return `${storeId}::${pageId}`;
}

function synchronizeCollapseState() {
  const validStores = new Set();
  const validPages = new Set();

  for (const screen of state.screens) {
    const storeId = String(screen.storeId || "UNASSIGNED_STORE");
    const pageId = String(screen.pageId || "UNMAPPED_PAGE");
    validStores.add(storeId);
    validPages.add(buildPageGroupKey(storeId, pageId));
  }

  for (const storeId of [...state.collapsedStores]) {
    if (!validStores.has(storeId)) {
      state.collapsedStores.delete(storeId);
    }
  }

  for (const pageKey of [...state.collapsedPages]) {
    if (!validPages.has(pageKey)) {
      state.collapsedPages.delete(pageKey);
    }
  }
}

function renderChoiceCards(container, groupName, options, defaultValue) {
  container.innerHTML = options
    .map((option) => {
      const checked = option === defaultValue ? "checked" : "";
      const safeOption = escapeHtml(option);
      return `<label class="choice-card"><input type="radio" name="${groupName}" value="${safeOption}" ${checked}><span>${safeOption}</span></label>`;
    })
    .join("");
}

function populateSelect(selectElement, options, defaultValue) {
  const selected = defaultValueOrFirst(options, defaultValue);
  selectElement.innerHTML = options
    .map((option) => {
      const safeOption = escapeHtml(option);
      const selectedAttr = option === selected ? "selected" : "";
      return `<option value="${safeOption}" ${selectedAttr}>${safeOption}</option>`;
    })
    .join("");
}

function populateTemplateSelect(templates, defaultId) {
  const selected = defaultValueOrFirst(
    templates.map((template) => template.id),
    defaultId
  );

  elements.templateId.innerHTML = templates
    .map((template) => {
      const selectedAttr = template.id === selected ? "selected" : "";
      return `<option value="${escapeHtml(template.id)}" ${selectedAttr}>${escapeHtml(template.name)}</option>`;
    })
    .join("");
}

function ensureTemplateOption(templateId) {
  const existing = Array.from(elements.templateId.options).find((option) => option.value === templateId);
  if (existing) {
    return;
  }

  const option = document.createElement("option");
  option.value = templateId;
  option.textContent = `Custom (${templateId})`;
  elements.templateId.appendChild(option);
}

function updateTemplatePreview(templateId, customNote = "") {
  const template = getTemplateById(templateId);
  if (!template) {
    elements.templatePreview.innerHTML = `<strong>Custom Template</strong>${escapeHtml(templateId)}${
      customNote ? `<br>${escapeHtml(customNote)}` : ""
    }`;
    return;
  }

  const details = [
    `Recommended screen type: ${template.defaultScreenType}`,
    `Recommended size: ${template.defaultScreenSize}`,
    `Default refresh: ${template.defaultRefreshInterval}ms`
  ];

  if (customNote) {
    details.push(customNote);
  }

  elements.templatePreview.innerHTML = `<strong>${escapeHtml(template.name)}</strong>${escapeHtml(
    template.description
  )}<br>${details.map((detail) => escapeHtml(detail)).join(" | ")}`;
}

function applyTemplatePreset(templateId, overwriteFields) {
  const template = getTemplateById(templateId);
  if (!template) {
    updateTemplatePreview(templateId);
    return;
  }

  if (overwriteFields) {
    elements.screenType.value = template.defaultScreenType;
    elements.screenSize.value = template.defaultScreenSize;
    elements.refreshInterval.value = String(template.defaultRefreshInterval);
  }

  updateTemplatePreview(templateId);
}

function refreshPageCounter() {
  elements.pageIdCount.textContent = String(elements.pageId.value.length);
}

function renderPages() {
  if (!state.pages.length) {
    elements.pagesList.innerHTML = '<div class="empty">No pages configured yet.</div>';
    return;
  }

  elements.pagesList.innerHTML = state.pages
    .map((page) => {
      const flags = [
        page.firePageBeacons ? "Page Beacons: On" : "Page Beacons: Off",
        page.oneTagHybridIntegration ? "OneTag Hybrid: On" : "OneTag Hybrid: Off",
        page.includeBidInResponse ? "Bid in Response: On" : "Bid in Response: Off"
      ].join(" | ");

      return `<article class="record">
        <div class="record__top">
          <strong>${escapeHtml(page.pageId)}</strong>
          <span>${escapeHtml(page.pageType)}</span>
        </div>
        <p>Environment: ${escapeHtml(page.environment)}</p>
        <p>${escapeHtml(flags)}</p>
      </article>`;
    })
    .join("");
}

function renderScreens() {
  if (!state.screens.length) {
    elements.screensList.innerHTML = '<div class="empty">No screens configured yet.</div>';
    return;
  }

  const grouped = new Map();
  for (const screen of state.screens) {
    const storeId = String(screen.storeId || "UNASSIGNED_STORE");
    const pageId = String(screen.pageId || "UNMAPPED_PAGE");
    if (!grouped.has(storeId)) {
      grouped.set(storeId, new Map());
    }
    const pageMap = grouped.get(storeId);
    if (!pageMap.has(pageId)) {
      pageMap.set(pageId, []);
    }
    pageMap.get(pageId).push(screen);
  }

  const sortedStoreIds = [...grouped.keys()].sort((a, b) => a.localeCompare(b));
  elements.screensList.innerHTML = sortedStoreIds
    .map((storeId) => {
      const pageMap = grouped.get(storeId);
      const sortedPageIds = [...pageMap.keys()].sort((a, b) => a.localeCompare(b));
      const totalScreens = sortedPageIds.reduce((sum, pageId) => sum + pageMap.get(pageId).length, 0);
      const storeCollapsed = state.collapsedStores.has(storeId);

      const pageSections = sortedPageIds
        .map((pageId) => {
          const screens = [...pageMap.get(pageId)].sort((a, b) => a.screenId.localeCompare(b.screenId));
          const pageKey = buildPageGroupKey(storeId, pageId);
          const pageCollapsed = state.collapsedPages.has(pageKey);
          const screenCards = screens
            .map((screen) => {
              const previewHref = `/screen.html?screenId=${encodeURIComponent(screen.screenId)}`;
              const lineItemCount = Array.isArray(screen.lineItems) ? screen.lineItems.length : 0;
              const templateLabel = getTemplateById(screen.templateId)?.name || screen.templateId || "Unknown";

              return `<article class="record">
                <div class="record__top">
                  <strong>${escapeHtml(screen.screenId)}</strong>
                  <span class="record__actions">
                    <button type="button" class="btn btn--tiny js-edit-screen" data-screen-id="${escapeHtml(
                      screen.screenId
                    )}">Edit</button>
                    <button type="button" class="btn btn--tiny btn--tiny-danger js-delete-screen" data-screen-id="${escapeHtml(
                      screen.screenId
                    )}">Delete</button>
                    <a href="${previewHref}" target="_blank" rel="noreferrer">Open Screen</a>
                  </span>
                </div>
                <p>Location: ${escapeHtml(screen.location)} | ${escapeHtml(screen.screenType)} | ${escapeHtml(
                  screen.screenSize
                )}</p>
                <p>Template: ${escapeHtml(templateLabel)} | Refresh: ${escapeHtml(
                  screen.refreshInterval
                )}ms | Line Items: ${lineItemCount}</p>
              </article>`;
            })
            .join("");

          return `<section class="screen-group__page">
            <div class="screen-group__page-head">
              <button
                type="button"
                class="tree-toggle tree-toggle--page js-toggle-page"
                data-store-id="${escapeHtml(storeId)}"
                data-page-id="${escapeHtml(pageId)}"
                aria-expanded="${pageCollapsed ? "false" : "true"}"
              >
                <span class="tree-toggle__chev">${pageCollapsed ? ">" : "v"}</span>
                <strong>Mapped Page: ${escapeHtml(pageId)}</strong>
              </button>
              <span>${screens.length} screen(s)</span>
            </div>
            <div class="screen-group__items" ${pageCollapsed ? "hidden" : ""}>${screenCards}</div>
          </section>`;
        })
        .join("");

      return `<section class="screen-group">
        <div class="screen-group__store">
          <button
            type="button"
            class="tree-toggle tree-toggle--store js-toggle-store"
            data-store-id="${escapeHtml(storeId)}"
            aria-expanded="${storeCollapsed ? "false" : "true"}"
          >
            <span class="tree-toggle__chev">${storeCollapsed ? ">" : "v"}</span>
            <strong>Store ID: ${escapeHtml(storeId)}</strong>
          </button>
          <span>${totalScreens} screen(s)</span>
        </div>
        <div class="screen-group__pages" ${storeCollapsed ? "hidden" : ""}>${pageSections}</div>
      </section>`;
    })
    .join("");
}

function refreshPageSelect(preferredPageId = "") {
  if (!state.pages.length) {
    elements.pageIdSelect.innerHTML = '<option value="">Create a page first</option>';
    elements.pageIdSelect.disabled = true;
    elements.screenSubmitBtn.disabled = true;
    showStatus("Create at least one page before adding screens.");
    return;
  }

  elements.pageIdSelect.disabled = false;
  elements.screenSubmitBtn.disabled = false;
  const targetPageId = state.pages.some((page) => page.pageId === preferredPageId)
    ? preferredPageId
    : state.pages[0].pageId;

  elements.pageIdSelect.innerHTML = state.pages
    .map((page) => {
      const selected = page.pageId === targetPageId ? "selected" : "";
      const safeId = escapeHtml(page.pageId);
      return `<option value="${safeId}" ${selected}>${safeId}</option>`;
    })
    .join("");
}

async function refreshLists() {
  showStatus("Refreshing pages and screens...");
  const [pagesResponse, screensResponse] = await Promise.all([requestJson("/api/pages"), requestJson("/api/screens")]);
  state.pages = pagesResponse.pages || [];
  state.screens = screensResponse.screens || [];
  synchronizeCollapseState();
  renderPages();
  renderScreens();
  refreshGoalScopeSelects();
  refreshPageSelect(state.editingScreenId ? state.screens.find((entry) => entry.screenId === state.editingScreenId)?.pageId || "" : "");
  showStatus(`Loaded ${state.pages.length} page(s) and ${state.screens.length} screen(s).`);
}

function resetPageFormDefaults() {
  elements.pageForm.reset();
  refreshPageCounter();
  const defaultPageType = defaultValueOrFirst(state.options.pageTypes, "Category");
  const defaultEnvironment = defaultValueOrFirst(state.options.environments, "Desktop");

  const selectedPageTypeInput = elements.pageForm.querySelector(
    `input[name="pageType"][value="${escapeSelectorValue(defaultPageType)}"]`
  );
  const selectedEnvironmentInput = elements.pageForm.querySelector(
    `input[name="environment"][value="${escapeSelectorValue(defaultEnvironment)}"]`
  );

  if (selectedPageTypeInput) {
    selectedPageTypeInput.checked = true;
  }
  if (selectedEnvironmentInput) {
    selectedEnvironmentInput.checked = true;
  }
}

function resetGoalFormDefaults() {
  if (!elements.goalAgentForm) {
    return;
  }
  elements.goalAgentForm.reset();

  const objectiveIds = (state.options?.goalObjectives || []).map((entry) => entry.id);
  const aggressivenessOptions = state.options?.goalAggressivenessOptions || [];
  elements.goalObjective.value = defaultValueOrFirst(objectiveIds, "awareness");
  elements.goalAggressiveness.value = defaultValueOrFirst(aggressivenessOptions, "Balanced");
  elements.goalProductCategory.value = "";
  elements.goalProductSearch.value = "";
  state.selectedGoalSkuIds.clear();
  renderGoalProductList();
  refreshGoalScopeSelects();
}

function resetScreenFormDefaults() {
  state.editingScreenId = null;
  elements.editScreenId.value = "";
  elements.screenForm.reset();
  elements.screenId.disabled = false;
  elements.screenSubmitBtn.textContent = "Add Screen";
  elements.screenCancelBtn.classList.add("is-hidden");

  elements.storeId.value = "STORE_42";
  elements.screenSize.value = "1920x1080";
  elements.refreshInterval.value = "30000";

  if (state.options?.screenTypes?.length) {
    elements.screenType.value = state.options.screenTypes[0];
  }

  const defaultTemplateId = defaultValueOrFirst(
    (state.options?.templates || []).map((template) => template.id),
    "fullscreen-banner"
  );
  elements.templateId.value = defaultTemplateId;
  applyTemplatePreset(defaultTemplateId, true);

  refreshPageSelect();
}

function beginScreenEdit(screenId) {
  const screen = state.screens.find((entry) => entry.screenId === screenId);
  if (!screen) {
    showToast(`Screen ${screenId} not found.`, true);
    return;
  }

  state.editingScreenId = screen.screenId;
  elements.editScreenId.value = screen.screenId;
  elements.screenId.value = screen.screenId;
  elements.screenId.disabled = true;
  elements.storeId.value = screen.storeId || "";
  elements.location.value = screen.location || "";
  refreshPageSelect(screen.pageId);

  elements.screenType.value = screen.screenType || state.options.screenTypes[0];
  elements.screenSize.value = screen.screenSize || "1920x1080";

  if (screen.templateId) {
    ensureTemplateOption(screen.templateId);
    elements.templateId.value = screen.templateId;
  }

  elements.refreshInterval.value = String(screen.refreshInterval || 30000);
  elements.screenSubmitBtn.textContent = "Save Screen";
  elements.screenCancelBtn.classList.remove("is-hidden");
  updateTemplatePreview(elements.templateId.value, "Editing existing screen config.");

  window.scrollTo({ top: elements.screenForm.getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
  showStatus(`Editing ${screenId}. Update fields and click Save Screen.`);
}

async function handlePageSubmit(event) {
  event.preventDefault();
  const formData = new FormData(elements.pageForm);
  const payload = {
    pageId: formData.get("pageId"),
    pageType: formData.get("pageType"),
    environment: formData.get("environment"),
    firePageBeacons: document.getElementById("firePageBeacons").checked,
    oneTagHybridIntegration: document.getElementById("oneTagHybridIntegration").checked,
    includeBidInResponse: document.getElementById("includeBidInResponse").checked
  };

  await requestJson("/api/pages", {
    method: "POST",
    body: JSON.stringify(payload)
  });

  showToast(`Page ${payload.pageId} added.`);
  resetPageFormDefaults();
  await refreshLists();
}

async function handleScreenSubmit(event) {
  event.preventDefault();
  const formData = new FormData(elements.screenForm);
  const payload = {
    storeId: String(formData.get("storeId") || "").trim(),
    location: String(formData.get("location") || "").trim(),
    pageId: String(formData.get("pageId") || "").trim(),
    screenType: String(formData.get("screenType") || "").trim(),
    screenSize: String(formData.get("screenSize") || "").trim(),
    templateId: String(formData.get("templateId") || "").trim(),
    refreshInterval: Number(formData.get("refreshInterval"))
  };

  const isEditing = Boolean(state.editingScreenId);
  if (isEditing) {
    await requestJson(`/api/screens/${encodeURIComponent(state.editingScreenId)}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    showToast(`Screen ${state.editingScreenId} updated.`);
  } else {
    payload.screenId = String(formData.get("screenId") || "").trim();
    await requestJson("/api/screens", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    showToast(`Screen ${payload.screenId} added.`);
  }

  resetScreenFormDefaults();
  await refreshLists();
}

async function handleScreenDelete(screenId) {
  const trimmed = String(screenId || "").trim();
  if (!trimmed) {
    return;
  }

  const confirmed = window.confirm(`Delete screen ${trimmed}? This cannot be undone.`);
  if (!confirmed) {
    return;
  }

  await requestJson(`/api/screens/${encodeURIComponent(trimmed)}`, {
    method: "DELETE"
  });

  if (state.editingScreenId === trimmed) {
    resetScreenFormDefaults();
  }

  showToast(`Screen ${trimmed} deleted.`);
  await refreshLists();
}

function wireEvents() {
  elements.pageId.addEventListener("input", refreshPageCounter);

  elements.pageForm.addEventListener("submit", async (event) => {
    try {
      await handlePageSubmit(event);
    } catch (error) {
      showToast(error.message, true);
      showStatus(error.message, true);
    }
  });

  elements.screenForm.addEventListener("submit", async (event) => {
    try {
      await handleScreenSubmit(event);
    } catch (error) {
      showToast(error.message, true);
      showStatus(error.message, true);
    }
  });

  elements.refreshBtn.addEventListener("click", async () => {
    try {
      await refreshLists();
      showToast("Data refreshed.");
    } catch (error) {
      showToast(error.message, true);
      showStatus(error.message, true);
    }
  });

  elements.goalAgentForm.addEventListener("submit", async (event) => {
    try {
      await handleGoalPlanSubmit(event);
      showStatus("Goal plan generated. Review and apply when ready.");
    } catch (error) {
      showToast(error.message, true);
      showStatus(error.message, true);
    }
  });

  elements.goalApplyBtn.addEventListener("click", async () => {
    try {
      const planId = state.activeGoalPlan?.planId || "";
      await applyGoalPlan(planId);
      showStatus(`Applied plan ${planId}.`);
    } catch (error) {
      showToast(error.message, true);
      showStatus(error.message, true);
    }
  });

  elements.agentRefreshBtn.addEventListener("click", async () => {
    try {
      await refreshAgentRuns();
      showToast("Agent runs refreshed.");
    } catch (error) {
      showToast(error.message, true);
      showStatus(error.message, true);
    }
  });

  elements.goalProductCategory.addEventListener("change", () => {
    renderGoalProductList();
  });

  elements.goalProductSearch.addEventListener("input", () => {
    renderGoalProductList();
  });

  elements.goalProductList.addEventListener("change", (event) => {
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
    renderGoalSkuCount();
  });

  elements.templateId.addEventListener("change", () => {
    applyTemplatePreset(elements.templateId.value, true);
  });

  elements.screenType.addEventListener("change", () => {
    if (elements.screenType.value === "Kiosk" && elements.templateId.value !== "kiosk-interactive") {
      elements.templateId.value = "kiosk-interactive";
      applyTemplatePreset("kiosk-interactive", true);
      showStatus("Kiosk selected: switched to Kiosk Interactive template defaults.");
    }
  });

  elements.screenCancelBtn.addEventListener("click", () => {
    resetScreenFormDefaults();
    showStatus("Edit mode cancelled.");
  });

  elements.screensList.addEventListener("click", (event) => {
    const storeToggle = event.target.closest(".js-toggle-store");
    if (storeToggle) {
      const storeId = String(storeToggle.getAttribute("data-store-id") || "");
      if (storeId) {
        if (state.collapsedStores.has(storeId)) {
          state.collapsedStores.delete(storeId);
        } else {
          state.collapsedStores.add(storeId);
        }
        renderScreens();
      }
      return;
    }

    const pageToggle = event.target.closest(".js-toggle-page");
    if (pageToggle) {
      const storeId = String(pageToggle.getAttribute("data-store-id") || "");
      const pageId = String(pageToggle.getAttribute("data-page-id") || "");
      const pageKey = buildPageGroupKey(storeId, pageId);
      if (state.collapsedPages.has(pageKey)) {
        state.collapsedPages.delete(pageKey);
      } else {
        state.collapsedPages.add(pageKey);
      }
      renderScreens();
      return;
    }

    const editTarget = event.target.closest(".js-edit-screen");
    if (editTarget) {
      const screenId = editTarget.getAttribute("data-screen-id") || "";
      beginScreenEdit(screenId);
      return;
    }

    const deleteTarget = event.target.closest(".js-delete-screen");
    if (deleteTarget) {
      const screenId = deleteTarget.getAttribute("data-screen-id") || "";
      handleScreenDelete(screenId).catch((error) => {
        showToast(error.message, true);
        showStatus(error.message, true);
      });
    }
  });

  elements.agentRunsList.addEventListener("click", (event) => {
    const loadTarget = event.target.closest(".js-load-goal-plan");
    if (loadTarget) {
      const planId = loadTarget.getAttribute("data-plan-id") || "";
      loadGoalPlan(planId);
      return;
    }

    const applyTarget = event.target.closest(".js-apply-goal-plan");
    if (applyTarget) {
      const planId = applyTarget.getAttribute("data-plan-id") || "";
      applyGoalPlan(planId).catch((error) => {
        showToast(error.message, true);
        showStatus(error.message, true);
      });
    }
  });
}

async function init() {
  try {
    state.options = await requestJson("/api/options");

    renderChoiceCards(
      elements.pageTypeGrid,
      "pageType",
      state.options.pageTypes,
      defaultValueOrFirst(state.options.pageTypes, "Category")
    );

    renderChoiceCards(
      elements.environmentGrid,
      "environment",
      state.options.environments,
      defaultValueOrFirst(state.options.environments, "Desktop")
    );

    populateSelect(elements.screenType, state.options.screenTypes, state.options.screenTypes[0]);
    populateTemplateSelect(state.options.templates, "fullscreen-banner");
    populateSelect(
      elements.goalObjective,
      (state.options.goalObjectives || []).map((entry) => entry.id),
      defaultValueOrFirst(
        (state.options.goalObjectives || []).map((entry) => entry.id),
        "awareness"
      )
    );
    if (elements.goalObjective.options.length) {
      Array.from(elements.goalObjective.options).forEach((option) => {
        const objective = (state.options.goalObjectives || []).find((entry) => entry.id === option.value);
        if (objective?.label) {
          option.textContent = objective.label;
        }
      });
    }
    populateSelect(
      elements.goalAggressiveness,
      state.options.goalAggressivenessOptions || ["Balanced"],
      defaultValueOrFirst(state.options.goalAggressivenessOptions || ["Balanced"], "Balanced")
    );

    wireEvents();
    refreshPageCounter();
    resetPageFormDefaults();
    await refreshGoalProductFeed();
    resetGoalFormDefaults();
    resetScreenFormDefaults();
    await refreshLists();
    await refreshAgentRuns();
    renderGoalPlan();
  } catch (error) {
    showToast(error.message, true);
    showStatus(error.message, true);
  }
}

await init();
