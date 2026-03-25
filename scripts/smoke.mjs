import { spawn } from "node:child_process";

const BASE_URL = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const HEALTH_PATH = "/api/health";
let cookieHeader = "";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(path, init = undefined) {
  const headers = new Headers(init?.headers || {});
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) {
    const nextCookie = setCookie.split(";")[0];
    if (nextCookie) {
      cookieHeader = nextCookie;
    }
  }
  const text = await response.text();
  let payload = {};

  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} on ${path}: ${JSON.stringify(payload)}`);
  }

  return payload;
}

async function ensureWorkspaceClaimed() {
  const status = await fetchJson("/api/workspaces");
  if (status.currentWorkspace?.id) {
    return status.currentWorkspace;
  }

  const workspaces = Array.isArray(status.workspaces) ? status.workspaces : [];
  const availableWorkspace =
    workspaces.find((workspace) => workspace.status === "available" && !workspace.hasSavedJourney) ||
    workspaces.find((workspace) => workspace.status === "available" || workspace.status === "claimed-by-you");
  assert(availableWorkspace?.id, "No available workspace found for smoke run");

  const claimed = await fetchJson("/api/workspaces/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId: availableWorkspace.id })
  });
  assert(claimed.currentWorkspace?.id === availableWorkspace.id, `Failed to claim workspace ${availableWorkspace.id}`);
  return claimed.currentWorkspace;
}

async function isServerHealthy() {
  try {
    const health = await fetchJson(HEALTH_PATH);
    return health.status === "ok";
  } catch {
    return false;
  }
}

async function waitForHealth(attempts = 30, delayMs = 250) {
  for (let index = 0; index < attempts; index += 1) {
    if (await isServerHealthy()) {
      return;
    }
    await sleep(delayMs);
  }
  throw new Error(`Server did not become healthy at ${BASE_URL}`);
}

function shortList(values, max = 4) {
  const items = values.slice(0, max);
  if (values.length <= max) {
    return items.join(", ");
  }
  return `${items.join(", ")}, +${values.length - max} more`;
}

function buildScreenSmokeSample(screens, max = 8) {
  const source = Array.isArray(screens) ? screens : [];
  if (source.length <= max) {
    return source;
  }

  const sample = [];
  const seenScreenIds = new Set();
  const seenTemplates = new Set();

  for (const screen of source) {
    const screenId = String(screen.screenId || "");
    const templateId = String(screen.templateId || "");
    if (!screenId || seenScreenIds.has(screenId) || !templateId || seenTemplates.has(templateId)) {
      continue;
    }
    sample.push(screen);
    seenScreenIds.add(screenId);
    seenTemplates.add(templateId);
    if (sample.length >= max) {
      return sample;
    }
  }

  const lastIndex = source.length - 1;
  while (sample.length < Math.min(max, source.length)) {
    const nextIndex = Math.round((sample.length * lastIndex) / Math.max(1, max - 1));
    const candidate = source[nextIndex];
    const screenId = String(candidate?.screenId || "");
    if (!screenId || seenScreenIds.has(screenId)) {
      break;
    }
    sample.push(candidate);
    seenScreenIds.add(screenId);
  }

  for (const screen of source) {
    const screenId = String(screen.screenId || "");
    if (!screenId || seenScreenIds.has(screenId)) {
      continue;
    }
    sample.push(screen);
    seenScreenIds.add(screenId);
    if (sample.length >= max) {
      break;
    }
  }

  return sample;
}

async function checkTemplateScreens(templates, screens) {
  const screenTemplateIds = new Set(screens.map((screen) => String(screen.templateId || "")));
  const missing = templates
    .map((template) => String(template.id || ""))
    .filter((templateId) => templateId && !screenTemplateIds.has(templateId));

  assert(missing.length === 0, `Missing preset screens for template(s): ${missing.join(", ")}`);
}

async function checkScreenDelivery(screens) {
  const failures = [];
  const results = [];

  for (const screen of screens) {
    try {
      const screenId = encodeURIComponent(String(screen.screenId || ""));
      const ad = await fetchJson(`/api/screen-ad?screenId=${screenId}`);
      const products = Array.isArray(ad.products) ? ad.products : [];
      const templateId = String(ad.settings?.templateId || screen.templateId || "");
      const firstImage = String(products[0]?.Image || "").trim();

      assert(Boolean(templateId), `No template id returned for ${screen.screenId}`);
      assert(Boolean(String(ad.format || "").trim()), `No format returned for ${screen.screenId}`);
      assert(products.length > 0, `No products returned for ${screen.screenId}`);
      assert(firstImage.startsWith("/assets/products/"), `Non-local image on ${screen.screenId}: ${firstImage}`);

      if (templateId === "carousel-banner" || templateId === "menu-loop") {
        assert(
          products.length > 1,
          `${templateId} requires multiple products to visibly loop on ${screen.screenId}`
        );
      }

      // Confirm image path actually resolves from static assets.
      const imageResponse = await fetch(`${BASE_URL}${firstImage}`);
      assert(imageResponse.ok, `Image path failed for ${screen.screenId}: ${firstImage}`);

      results.push({
        screenId: screen.screenId,
        templateId,
        products: products.length,
        firstImage
      });
    } catch (error) {
      failures.push(`${screen.screenId}: ${error.message}`);
    }
  }

  assert(failures.length === 0, `Screen smoke failures:\n${failures.join("\n")}`);
  return results;
}

async function checkLiveSnapshots() {
  const runsResponse = await fetchJson("/api/agent/goals/runs");
  const runs = Array.isArray(runsResponse.runs) ? runsResponse.runs : [];
  const appliedRun = runs.find((run) => String(run.status || "") === "applied");

  if (!appliedRun?.planId) {
    return {
      checked: false,
      reason: "No applied goal run found; skipped /api/agent/goals/live validation."
    };
  }

  const planId = encodeURIComponent(String(appliedRun.planId));
  const live = await fetchJson(`/api/agent/goals/live?planId=${planId}`);
  const liveScreens = Array.isArray(live.liveScreens) ? live.liveScreens : [];

  assert(String(live.status || "") === "applied", `Live endpoint status is not applied for ${appliedRun.planId}`);
  assert(Number(live.liveCount || 0) === liveScreens.length, "liveCount does not match liveScreens length");

  for (const liveScreen of liveScreens) {
    const products = Array.isArray(liveScreen.products) ? liveScreen.products : [];
    for (const product of products) {
      const image = String(product.image || "").trim();
      assert(Boolean(image), `Live product missing image on ${liveScreen.screenId}`);
      assert(
        image.startsWith("/assets/products/"),
        `Live product uses non-local image on ${liveScreen.screenId}: ${image}`
      );
    }
  }

  // Smoke check the re-apply path for already-applied plans.
  const reapply = await fetchJson("/api/agent/goals/apply", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId: appliedRun.planId })
  });
  assert(String(reapply.run?.status || "") === "applied", "Re-apply response did not return applied status");
  assert(
    Number(reapply.liveCount || 0) === liveScreens.length,
    "Re-apply liveCount does not match live snapshot count"
  );

  return {
    checked: true,
    planId: appliedRun.planId,
    liveCount: liveScreens.length,
    reapplyLiveCount: Number(reapply.liveCount || 0),
    sampleScreens: liveScreens.slice(0, 4).map((entry) => entry.screenId)
  };
}

async function checkTelemetryLoop(screens, liveResults) {
  const firstScreen = screens[0];
  assert(firstScreen?.screenId, "No screen available for telemetry smoke check");

  const screenId = encodeURIComponent(String(firstScreen.screenId || ""));
  const ad = await fetchJson(`/api/screen-ad?screenId=${screenId}`);
  const firstProduct = Array.isArray(ad.products) ? ad.products[0] : null;
  assert(firstProduct, `No product returned for telemetry smoke on ${firstScreen.screenId}`);

  const basePayload = {
    screenId: firstScreen.screenId,
    adid: String(firstProduct.adid || ""),
    lineItemId: String(ad.settings?.lineItemId || ""),
    templateId: String(ad.settings?.templateId || firstScreen.templateId || ""),
    pageId: String(ad.settings?.pageId || firstScreen.pageId || ""),
    storeId: String(ad.settings?.storeId || firstScreen.storeId || ""),
    location: String(ad.settings?.location || firstScreen.location || ""),
    productId: String(firstProduct.ProductId || ""),
    sku: String(firstProduct.ProductId || ""),
    productName: String(firstProduct.ProductName || ""),
    productPage: String(firstProduct.ProductPage || ""),
    source: "smoke"
  };

  for (const payload of [
    {
      ...basePayload,
      event: "play",
      occurredAt: new Date().toISOString()
    },
    {
      ...basePayload,
      event: "exposure",
      exposureMs: 3500,
      occurredAt: new Date().toISOString()
    }
  ]) {
    await fetchJson("/collect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  const summaryQuery = liveResults.checked ? `?planId=${encodeURIComponent(String(liveResults.planId || ""))}` : "";
  const summary = await fetchJson(`/api/telemetry/summary${summaryQuery}`);
  assert(Number(summary.totals?.total || 0) >= 2, "Telemetry summary did not record smoke events");
  assert(Number(summary.totals?.playCount || 0) >= 1, "Telemetry summary did not record play events");
  assert(Number(summary.totals?.exposureMs || 0) >= 3500, "Telemetry summary did not record exposure duration");

  const byScreen = Array.isArray(summary.byScreen) ? summary.byScreen : [];
  const bySku = Array.isArray(summary.bySku) ? summary.bySku : [];
  const matchingScreen = byScreen.find((entry) => String(entry.screenId || "") === String(firstScreen.screenId || ""));
  assert(matchingScreen, `Telemetry by-screen breakdown missing ${firstScreen.screenId}`);

  if (liveResults.checked) {
    assert(summary.planComparison, "Telemetry summary missing plan comparison for applied plan");
  }

  return {
    checked: true,
    total: Number(summary.totals?.total || 0),
    exposureMs: Number(summary.totals?.exposureMs || 0),
    topScreen: matchingScreen.screenId,
    topSku: String(bySku[0]?.sku || basePayload.sku || "")
  };
}

async function runSmoke() {
  let spawnedServer = null;
  let ownsServer = false;
  let claimedWorkspace = null;

  try {
    if (!(await isServerHealthy())) {
      spawnedServer = spawn(process.execPath, ["src/server.js"], {
        cwd: process.cwd(),
        stdio: ["ignore", "pipe", "pipe"]
      });
      ownsServer = true;

      spawnedServer.stderr.on("data", (chunk) => {
        const message = chunk.toString().trim();
        if (message) {
          process.stderr.write(`[server] ${message}\n`);
        }
      });

      await waitForHealth();
    }

    claimedWorkspace = await ensureWorkspaceClaimed();
    const options = await fetchJson("/api/options");
    const screensResponse = await fetchJson("/api/screens");
    const templates = Array.isArray(options.templates) ? options.templates : [];
    const screens = Array.isArray(screensResponse.screens) ? screensResponse.screens : [];
    const screenSample = buildScreenSmokeSample(screens);

    assert(templates.length > 0, "No templates returned by /api/options");
    assert(screens.length > 0, "No screens returned by /api/screens");

    await checkTemplateScreens(templates, screens);
    const screenResults = await checkScreenDelivery(screenSample);
    const liveResults = await checkLiveSnapshots();
    const telemetryResults = await checkTelemetryLoop(screenSample, liveResults);

    console.log("PASS smoke checks");
    console.log(`Templates: ${templates.length}, Screens: ${screens.length} total (${screenSample.length} sampled)`);
    console.log(`Screen sample: ${shortList(screenResults.map((entry) => entry.screenId))}`);
    console.log(
      `Telemetry: ${telemetryResults.total} event(s) tracked (${Math.round(
        telemetryResults.exposureMs / 1000
      )}s exposure) (${telemetryResults.topScreen} / ${telemetryResults.topSku})`
    );
    if (liveResults.checked) {
      console.log(
        `Live snapshot: ${liveResults.liveCount} screen(s) on plan ${liveResults.planId} (re-apply live: ${
          liveResults.reapplyLiveCount
        }) (${shortList(liveResults.sampleScreens)})`
      );
    } else {
      console.log(`Live snapshot: skipped (${liveResults.reason})`);
    }
  } finally {
    if (claimedWorkspace?.id) {
      try {
        await fetchJson("/api/workspaces/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        });
      } catch {
        // Do not hide the main smoke result behind cleanup errors.
      }
    }
    if (ownsServer && spawnedServer && !spawnedServer.killed) {
      spawnedServer.kill();
      await sleep(250);
    }
  }
}

runSmoke().catch((error) => {
  console.error(`FAIL smoke checks: ${error.message}`);
  process.exitCode = 1;
});
