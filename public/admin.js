const state = {
  options: null,
  pages: [],
  screens: [],
  editingScreenId: null,
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

function getTemplateById(templateId) {
  return (state.options?.templates || []).find((template) => template.id === templateId) || null;
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

  elements.screensList.innerHTML = state.screens
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
        <p>Store: ${escapeHtml(screen.storeId)} | Location: ${escapeHtml(screen.location)}</p>
        <p>Page: ${escapeHtml(screen.pageId)} | ${escapeHtml(screen.screenType)} | ${escapeHtml(screen.screenSize)}</p>
        <p>Template: ${escapeHtml(templateLabel)} | Refresh: ${escapeHtml(
          screen.refreshInterval
        )}ms | Line Items: ${lineItemCount}</p>
      </article>`;
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
  renderPages();
  renderScreens();
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

    wireEvents();
    refreshPageCounter();
    resetPageFormDefaults();
    resetScreenFormDefaults();
    await refreshLists();
  } catch (error) {
    showToast(error.message, true);
    showStatus(error.message, true);
  }
}

await init();
