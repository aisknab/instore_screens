import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT_DIR = process.cwd();
const DEFAULT_FEED_FILE = path.join(ROOT_DIR, "data", "productFeed.json");
const DEFAULT_MANIFEST_FILE = path.join(ROOT_DIR, "data", "brandLogoManifest.json");
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, "public", "assets", "brands", "generated");
const DEFAULT_OUTPUT_BASE_PATH = "/assets/brands/generated";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5.4";
const DEFAULT_SIZE = "1024x1024";
const DEFAULT_QUALITY = "high";
const DEFAULT_TIMEOUT_MS = 240000;
const DEFAULT_RETRIES = 3;
const DEFAULT_CONCURRENCY = 1;
const PROMPT_VERSION = "brand-logo-v1";

function readText(value, maxLength = 500) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.slice(0, maxLength);
}

function resolvePathFromEnv(envName, fallbackPath) {
  const override = readText(process.env[envName], 1000);
  return override ? path.resolve(override) : fallbackPath;
}

const FEED_FILE = resolvePathFromEnv("PRODUCT_FEED_FILE", DEFAULT_FEED_FILE);
const MANIFEST_FILE = resolvePathFromEnv("BRAND_LOGO_MANIFEST_FILE", DEFAULT_MANIFEST_FILE);
const OUTPUT_DIR = resolvePathFromEnv("BRAND_LOGO_OUTPUT_DIR", DEFAULT_OUTPUT_DIR);
const OUTPUT_BASE_PATH = readText(process.env.BRAND_LOGO_BASE_PATH, 200) || DEFAULT_OUTPUT_BASE_PATH;

function slugify(value) {
  const normalized = readText(value, 200)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "brand";
}

function parseInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isInteger(parsed) ? parsed : fallback;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readJsonFile(filePath, fallbackValue) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return fallbackValue;
  }
}

async function writeJsonFileAtomic(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  try {
    await fs.rename(tempPath, filePath);
  } catch (error) {
    if (error?.code !== "EPERM") {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
    await fs.writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }
}

async function writeBinaryFileAtomic(filePath, buffer) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(tempPath, buffer);
  try {
    await fs.rename(tempPath, filePath);
  } catch (error) {
    if (error?.code !== "EPERM") {
      await fs.rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
    await fs.writeFile(filePath, buffer);
    await fs.rm(tempPath, { force: true }).catch(() => undefined);
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function buildUsage() {
  return [
    "Usage: node scripts/generate-brand-logos.mjs [options]",
    "",
    "Options:",
    "  --brand NAME1,NAME2      Only generate the listed brand name(s)",
    "  --advertiser ID1,ID2     Only generate the listed advertiser account(s)",
    "  --limit N                Stop after N eligible brands",
    "  --force                  Regenerate even when a local generated asset already exists",
    "  --dry-run                Show the planned work without calling OpenAI",
    "  --concurrency N          Parallel requests (default 1)",
    "  --quality VALUE          Image quality: low | medium | high (default high)",
    "  --size VALUE             Image size: 1024x1024 | 1536x1024 | 1024x1536",
    "  --timeout-ms N           Per-request timeout in milliseconds (default 240000)",
    "  --help                   Show this message",
    "",
    "Environment:",
    "  OPENAI_API_KEY                Required for real generation",
    "  OPENAI_BASE_URL               Optional, defaults to https://api.openai.com/v1",
    "  OPENAI_BRAND_LOGO_MODEL       Optional, defaults to gpt-5.4",
    "  OPENAI_BRAND_LOGO_QUALITY     Optional, defaults to high",
    "  OPENAI_BRAND_LOGO_SIZE        Optional, defaults to 1024x1024",
    "  PRODUCT_FEED_FILE             Optional feed path override",
    "  BRAND_LOGO_MANIFEST_FILE      Optional manifest path override",
    "  BRAND_LOGO_OUTPUT_DIR         Optional generated-logo directory override",
    "  BRAND_LOGO_BASE_PATH          Optional public URL base, defaults to /assets/brands/generated"
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    brandFilter: [],
    advertiserFilter: [],
    limit: null,
    force: false,
    dryRun: false,
    concurrency: parseInteger(process.env.OPENAI_BRAND_LOGO_CONCURRENCY, DEFAULT_CONCURRENCY),
    quality: readText(process.env.OPENAI_BRAND_LOGO_QUALITY, 20) || DEFAULT_QUALITY,
    size: readText(process.env.OPENAI_BRAND_LOGO_SIZE, 20) || DEFAULT_SIZE,
    timeoutMs: parseInteger(process.env.OPENAI_BRAND_LOGO_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--brand":
        index += 1;
        if (index >= argv.length) {
          throw new Error("--brand requires a value.");
        }
        options.brandFilter.push(
          ...argv[index]
            .split(",")
            .map((entry) => readText(entry, 120))
            .filter(Boolean)
        );
        break;
      case "--advertiser":
        index += 1;
        if (index >= argv.length) {
          throw new Error("--advertiser requires a value.");
        }
        options.advertiserFilter.push(
          ...argv[index]
            .split(",")
            .map((entry) => readText(entry, 120))
            .filter(Boolean)
        );
        break;
      case "--limit":
        index += 1;
        if (index >= argv.length) {
          throw new Error("--limit requires a value.");
        }
        options.limit = Math.max(1, parseInteger(argv[index], 0));
        break;
      case "--concurrency":
        index += 1;
        if (index >= argv.length) {
          throw new Error("--concurrency requires a value.");
        }
        options.concurrency = Math.max(1, parseInteger(argv[index], DEFAULT_CONCURRENCY));
        break;
      case "--quality":
        index += 1;
        if (index >= argv.length) {
          throw new Error("--quality requires a value.");
        }
        options.quality = readText(argv[index], 20) || DEFAULT_QUALITY;
        break;
      case "--size":
        index += 1;
        if (index >= argv.length) {
          throw new Error("--size requires a value.");
        }
        options.size = readText(argv[index], 20) || DEFAULT_SIZE;
        break;
      case "--timeout-ms":
        index += 1;
        if (index >= argv.length) {
          throw new Error("--timeout-ms requires a value.");
        }
        options.timeoutMs = Math.max(1000, parseInteger(argv[index], DEFAULT_TIMEOUT_MS));
        break;
      case "--force":
        options.force = true;
        break;
      case "--dry-run":
        options.dryRun = true;
        break;
      case "--help":
      case "-h":
        options.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function buildBrandCatalog(rawFeed) {
  const brands = new Map();

  for (let index = 0; index < rawFeed.length; index += 1) {
    const product = rawFeed[index] && typeof rawFeed[index] === "object" ? rawFeed[index] : {};
    const brand = readText(product.brand, 120) || "Store Brand";
    const advertiserId = readText(product.advertiserId || product.ClientAdvertiserId, 120) || `advertiser-${slugify(brand)}`;
    const key = advertiserId || slugify(brand);
    if (!brands.has(key)) {
      brands.set(key, {
        key,
        brand,
        advertiserId,
        categories: new Set(),
        tags: new Set(),
        sampleProducts: new Set(),
        productIndexes: [],
        logo: readText(product.logo || product.brandLogo, 500)
      });
    }

    const entry = brands.get(key);
    entry.productIndexes.push(index);
    const category = readText(product.category, 80).toLowerCase();
    if (category) {
      entry.categories.add(category);
    }
    const productName = readText(product.name || product.ProductName, 120);
    if (productName && entry.sampleProducts.size < 3) {
      entry.sampleProducts.add(productName);
    }
    if (Array.isArray(product.tags)) {
      for (const tag of product.tags) {
        const normalized = readText(tag, 40).toLowerCase();
        if (normalized) {
          entry.tags.add(normalized);
        }
        if (entry.tags.size >= 8) {
          break;
        }
      }
    }
    if (!entry.logo) {
      entry.logo = readText(product.logo || product.brandLogo, 500);
    }
  }

  return [...brands.values()]
    .map((entry) => ({
      key: entry.key,
      brand: entry.brand,
      advertiserId: entry.advertiserId,
      categories: [...entry.categories].sort((left, right) => left.localeCompare(right)),
      tags: [...entry.tags].sort((left, right) => left.localeCompare(right)),
      sampleProducts: [...entry.sampleProducts],
      productIndexes: [...entry.productIndexes],
      logo: entry.logo
    }))
    .sort((left, right) => left.brand.localeCompare(right.brand) || left.advertiserId.localeCompare(right.advertiserId));
}

function buildBrandPrompt(brandEntry) {
  const brand = readText(brandEntry.brand, 120) || "Store Brand";
  const categories = Array.isArray(brandEntry.categories)
    ? brandEntry.categories.map((entry) => readText(entry, 40)).filter(Boolean).slice(0, 4)
    : [];
  const tags = Array.isArray(brandEntry.tags)
    ? brandEntry.tags.map((entry) => readText(entry, 40)).filter(Boolean).slice(0, 8)
    : [];
  const sampleProducts = Array.isArray(brandEntry.sampleProducts)
    ? brandEntry.sampleProducts.map((entry) => readText(entry, 60)).filter(Boolean).slice(0, 3)
    : [];

  return [
    "Create a polished retail brand logo with a transparent background.",
    "Return exactly one logo or wordmark only, centered on the canvas.",
    "No background plate, no box, no label sticker, no mockup, no billboard, no paper texture, no product, no mascot costume, no watermark, and no extra words beyond the brand identity itself.",
    "Use crisp vector-style edges, modern brand design, and strong readability at small sizes for dashboards, live previews, and in-store screens.",
    "Prefer a clean wordmark or a simple combined icon-plus-wordmark lockup.",
    `Brand name: ${brand}.`,
    categories.length > 0 ? `Retail context: ${categories.join(", ")}.` : "",
    tags.length > 0 ? `Brand cues: ${tags.join(", ")}.` : "",
    sampleProducts.length > 0 ? `Representative products: ${sampleProducts.join(", ")}.` : "",
    "Leave enough transparent padding around the logo so it can sit on different backgrounds."
  ]
    .filter(Boolean)
    .join(" ");
}

function createAssetPaths(brandEntry) {
  const slug = slugify(brandEntry.advertiserId || brandEntry.brand);
  return {
    key: readText(brandEntry.key, 160) || slug,
    relativeAssetPath: `${OUTPUT_BASE_PATH}/${slug}.png`,
    absoluteAssetPath: path.join(OUTPUT_DIR, `${slug}.png`)
  };
}

function buildPromptHash(prompt) {
  return crypto.createHash("sha256").update(prompt).digest("hex");
}

function extractImageBase64(payload) {
  const output = Array.isArray(payload?.output) ? payload.output : [];
  for (const entry of output) {
    if (entry?.type === "image_generation_call" && typeof entry.result === "string" && entry.result) {
      return entry.result;
    }
  }
  return "";
}

async function callOpenAiForImage(prompt, { apiKey, baseUrl, model, quality, size, timeoutMs }) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl}/responses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        input: prompt,
        tools: [
          {
            type: "image_generation",
            background: "transparent",
            quality,
            size
          }
        ]
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
      const message =
        payload?.error?.message ||
        payload?.message ||
        `OpenAI image request failed with status ${response.status}.`;
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }

    const imageBase64 = extractImageBase64(payload);
    if (!imageBase64) {
      throw new Error("OpenAI response did not include an image_generation_call result.");
    }

    return {
      imageBase64,
      responseId: readText(payload?.id, 120)
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

async function generateImageWithRetry(brandEntry, prompt, runtimeOptions, manifestItem) {
  const maxAttempts = Math.max(1, DEFAULT_RETRIES);
  let attempt = 0;
  let lastError = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const startedAt = Date.now();
      const result = await callOpenAiForImage(prompt, runtimeOptions);
      return {
        ...result,
        attempts: attempt,
        durationMs: Date.now() - startedAt
      };
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      const retryable = error?.name === "AbortError" || status === 429 || status >= 500;
      if (!retryable || attempt >= maxAttempts) {
        break;
      }
      const backoffMs = attempt * 2000;
      // eslint-disable-next-line no-console
      console.warn(
        `[retry] ${readText(brandEntry.brand, 120)} attempt ${attempt} failed (${error.message}). Waiting ${backoffMs}ms before retrying.`
      );
      await delay(backoffMs);
    }
  }

  const priorAttempts = parseInteger(manifestItem?.attempts, 0);
  const nextError = lastError instanceof Error ? lastError : new Error("Logo generation failed.");
  nextError.attempts = priorAttempts + attempt;
  throw nextError;
}

function selectEligibleBrands(catalog, manifest, options) {
  const brandFilter = new Set(options.brandFilter.map((entry) => entry.toLowerCase()));
  const advertiserFilter = new Set(options.advertiserFilter);
  const selected = [];

  for (const brandEntry of catalog) {
    if (brandFilter.size > 0 && !brandFilter.has(readText(brandEntry.brand, 120).toLowerCase())) {
      continue;
    }
    if (advertiserFilter.size > 0 && !advertiserFilter.has(readText(brandEntry.advertiserId, 120))) {
      continue;
    }
    selected.push(brandEntry);
  }

  const candidates = [];
  for (const brandEntry of selected) {
    const { key, relativeAssetPath, absoluteAssetPath } = createAssetPaths(brandEntry);
    const manifestItem = manifest.items[key] && typeof manifest.items[key] === "object" ? manifest.items[key] : {};
    candidates.push({
      brandEntry,
      key,
      relativeAssetPath,
      absoluteAssetPath,
      manifestItem
    });
  }

  return typeof options.limit === "number" ? candidates.slice(0, options.limit) : candidates;
}

function updateGeneratedLogoFields(rawFeed, brandEntry, relativeAssetPath, runtimeOptions, promptHash) {
  for (const index of brandEntry.productIndexes) {
    const product = rawFeed[index];
    if (!product || typeof product !== "object") {
      continue;
    }
    const currentLogo = readText(product.logo || product.brandLogo, 500);
    if (currentLogo && currentLogo !== relativeAssetPath && !readText(product.sourceLogo, 500)) {
      product.sourceLogo = currentLogo;
    }
    product.logo = relativeAssetPath;
    product.brandLogo = relativeAssetPath;
    product.logoSource = "openai-generated";
    product.logoUpdatedAt = new Date().toISOString();
    product.logoPromptVersion = PROMPT_VERSION;
    product.logoModel = runtimeOptions.model;
    product.logoBackground = "transparent";
    product.logoQuality = runtimeOptions.quality;
    product.logoSize = runtimeOptions.size;
    product.logoPromptHash = promptHash;
  }
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    // eslint-disable-next-line no-console
    console.log(buildUsage());
    return;
  }

  const apiKey = readText(process.env.OPENAI_API_KEY, 400);
  const baseUrl = (readText(process.env.OPENAI_BASE_URL, 500) || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = readText(process.env.OPENAI_BRAND_LOGO_MODEL, 80) || DEFAULT_MODEL;
  const runtimeOptions = {
    apiKey,
    baseUrl,
    model,
    quality: options.quality,
    size: options.size,
    timeoutMs: options.timeoutMs
  };

  const rawFeed = await readJsonFile(FEED_FILE, []);
  if (!Array.isArray(rawFeed) || rawFeed.length === 0) {
    throw new Error(`No products were found in ${FEED_FILE}.`);
  }

  const catalog = buildBrandCatalog(rawFeed);
  if (catalog.length === 0) {
    throw new Error(`No brands were found in ${FEED_FILE}.`);
  }

  const manifest = await readJsonFile(MANIFEST_FILE, {
    promptVersion: PROMPT_VERSION,
    updatedAt: "",
    items: {}
  });
  manifest.promptVersion = PROMPT_VERSION;
  manifest.items = manifest.items && typeof manifest.items === "object" ? manifest.items : {};

  const candidates = selectEligibleBrands(catalog, manifest, options);
  if (candidates.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No matching brands were found.");
    return;
  }

  const summary = {
    totalConsidered: candidates.length,
    skipped: 0,
    generated: 0,
    failed: 0
  };

  // eslint-disable-next-line no-console
  console.log(
    `Preparing brand logos for ${candidates.length} brand(s) with model ${model}, quality ${runtimeOptions.quality}, size ${runtimeOptions.size}.`
  );

  const queue = [...candidates];
  const saveState = async () => {
    manifest.updatedAt = new Date().toISOString();
    await writeJsonFileAtomic(FEED_FILE, rawFeed);
    await writeJsonFileAtomic(MANIFEST_FILE, manifest);
  };
  let saveQueue = Promise.resolve();
  const queueSaveState = async () => {
    saveQueue = saveQueue.then(
      () => saveState(),
      () => saveState()
    );
    await saveQueue;
  };

  const workerCount = Math.max(1, options.concurrency);
  const workers = Array.from({ length: workerCount }, async () => {
    while (queue.length > 0) {
      const next = queue.shift();
      if (!next) {
        return;
      }

      const { brandEntry, key, relativeAssetPath, absoluteAssetPath, manifestItem } = next;
      const existingGeneratedAsset = !options.force && (await fileExists(absoluteAssetPath));

      if (existingGeneratedAsset) {
        summary.skipped += 1;
        updateGeneratedLogoFields(rawFeed, brandEntry, relativeAssetPath, runtimeOptions, readText(manifestItem?.promptHash, 80));
        manifest.items[key] = {
          ...manifestItem,
          key,
          advertiserId: brandEntry.advertiserId,
          brand: brandEntry.brand,
          status: "generated",
          imagePath: relativeAssetPath,
          categories: brandEntry.categories,
          recoveredAt: new Date().toISOString(),
          model: readText(manifestItem?.model, 80) || runtimeOptions.model,
          quality: readText(manifestItem?.quality, 20) || runtimeOptions.quality,
          size: readText(manifestItem?.size, 20) || runtimeOptions.size
        };
        await queueSaveState();
        // eslint-disable-next-line no-console
        console.log(`[skip] ${brandEntry.brand} already has a generated local asset.`);
        continue;
      }

      const prompt = buildBrandPrompt(brandEntry);
      const promptHash = buildPromptHash(prompt);
      if (options.dryRun) {
        summary.skipped += 1;
        // eslint-disable-next-line no-console
        console.log(`[dry-run] ${brandEntry.brand} (${brandEntry.advertiserId}) -> ${relativeAssetPath}`);
        continue;
      }
      if (!runtimeOptions.apiKey) {
        throw new Error("OPENAI_API_KEY is required unless --dry-run is used.");
      }

      try {
        const result = await generateImageWithRetry(brandEntry, prompt, runtimeOptions, manifestItem);
        const imageBuffer = Buffer.from(result.imageBase64, "base64");
        await writeBinaryFileAtomic(absoluteAssetPath, imageBuffer);
        updateGeneratedLogoFields(rawFeed, brandEntry, relativeAssetPath, runtimeOptions, promptHash);
        manifest.items[key] = {
          key,
          advertiserId: brandEntry.advertiserId,
          brand: brandEntry.brand,
          status: "generated",
          imagePath: relativeAssetPath,
          categories: brandEntry.categories,
          generatedAt: new Date().toISOString(),
          prompt,
          promptHash,
          promptVersion: PROMPT_VERSION,
          model: runtimeOptions.model,
          quality: runtimeOptions.quality,
          size: runtimeOptions.size,
          attempts: result.attempts,
          durationMs: result.durationMs,
          responseId: result.responseId
        };
        summary.generated += 1;
        await queueSaveState();
        // eslint-disable-next-line no-console
        console.log(`[generated] ${brandEntry.brand} -> ${relativeAssetPath}`);
      } catch (error) {
        summary.failed += 1;
        manifest.items[key] = {
          key,
          advertiserId: brandEntry.advertiserId,
          brand: brandEntry.brand,
          status: "failed",
          imagePath: relativeAssetPath,
          categories: brandEntry.categories,
          failedAt: new Date().toISOString(),
          prompt,
          promptHash,
          promptVersion: PROMPT_VERSION,
          model: runtimeOptions.model,
          quality: runtimeOptions.quality,
          size: runtimeOptions.size,
          attempts: parseInteger(error?.attempts, parseInteger(manifestItem?.attempts, 0) + 1),
          error: readText(error?.message, 500) || "Unknown logo generation failure."
        };
        await queueSaveState();
        // eslint-disable-next-line no-console
        console.error(`[failed] ${brandEntry.brand}: ${error.message}`);
      }
    }
  });

  await Promise.all(workers);

  // eslint-disable-next-line no-console
  console.log(
    `Finished. Generated ${summary.generated}, skipped ${summary.skipped}, failed ${summary.failed}, total ${summary.totalConsidered}.`
  );
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error?.message || error);
  process.exitCode = 1;
});
