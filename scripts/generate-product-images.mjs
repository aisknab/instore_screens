import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const ROOT_DIR = process.cwd();
const DEFAULT_FEED_FILE = path.join(ROOT_DIR, "data", "productFeed.json");
const DEFAULT_MANIFEST_FILE = path.join(ROOT_DIR, "data", "productImageManifest.json");
const DEFAULT_OUTPUT_DIR = path.join(ROOT_DIR, "public", "assets", "products", "generated");
const DEFAULT_OUTPUT_BASE_PATH = "/assets/products/generated";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_MODEL = "gpt-5.4";
const DEFAULT_SIZE = "1024x1024";
const DEFAULT_QUALITY = "medium";
const DEFAULT_TIMEOUT_MS = 240000;
const DEFAULT_RETRIES = 3;
const DEFAULT_CONCURRENCY = 1;
const PROMPT_VERSION = "product-packshot-v1";

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
const MANIFEST_FILE = resolvePathFromEnv("PRODUCT_IMAGE_MANIFEST_FILE", DEFAULT_MANIFEST_FILE);
const OUTPUT_DIR = resolvePathFromEnv("PRODUCT_IMAGE_OUTPUT_DIR", DEFAULT_OUTPUT_DIR);
const OUTPUT_BASE_PATH = readText(process.env.PRODUCT_IMAGE_BASE_PATH, 200) || DEFAULT_OUTPUT_BASE_PATH;

function normalizeSku(value, fallback = "") {
  return readText(value, 120).toUpperCase() || fallback;
}

function slugify(value) {
  const normalized = readText(value, 200)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "product";
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
    "Usage: node scripts/generate-product-images.mjs [options]",
    "",
    "Options:",
    "  --sku SKU1,SKU2        Only generate the listed SKU(s)",
    "  --limit N              Stop after N eligible products",
    "  --force                Regenerate even when a local generated asset already exists",
    "  --dry-run              Show the planned work without calling OpenAI",
    "  --concurrency N        Parallel requests (default 1)",
    "  --quality VALUE        Image quality: low | medium | high (default medium)",
    "  --size VALUE           Image size: 1024x1024 | 1536x1024 | 1024x1536",
    "  --timeout-ms N         Per-request timeout in milliseconds (default 240000)",
    "  --help                 Show this message",
    "",
    "Environment:",
    "  OPENAI_API_KEY                  Required for real generation",
    "  OPENAI_BASE_URL                 Optional, defaults to https://api.openai.com/v1",
    "  OPENAI_PRODUCT_IMAGE_MODEL      Optional, defaults to gpt-5.4",
    "  OPENAI_PRODUCT_IMAGE_QUALITY    Optional, defaults to medium",
    "  OPENAI_PRODUCT_IMAGE_SIZE       Optional, defaults to 1024x1024",
    "  PRODUCT_FEED_FILE               Optional feed path override",
    "  PRODUCT_IMAGE_MANIFEST_FILE     Optional manifest path override",
    "  PRODUCT_IMAGE_OUTPUT_DIR        Optional generated-image directory override",
    "  PRODUCT_IMAGE_BASE_PATH         Optional public URL base, defaults to /assets/products/generated"
  ].join("\n");
}

function parseArgs(argv) {
  const options = {
    skuFilter: [],
    limit: null,
    force: false,
    dryRun: false,
    concurrency: parseInteger(process.env.OPENAI_PRODUCT_IMAGE_CONCURRENCY, DEFAULT_CONCURRENCY),
    quality: readText(process.env.OPENAI_PRODUCT_IMAGE_QUALITY, 20) || DEFAULT_QUALITY,
    size: readText(process.env.OPENAI_PRODUCT_IMAGE_SIZE, 20) || DEFAULT_SIZE,
    timeoutMs: parseInteger(process.env.OPENAI_PRODUCT_IMAGE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--sku":
        index += 1;
        if (index >= argv.length) {
          throw new Error("--sku requires a value.");
        }
        options.skuFilter.push(
          ...argv[index]
            .split(",")
            .map((entry) => normalizeSku(entry))
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

function buildCategoryPrompt(category) {
  switch (readText(category, 40).toLowerCase()) {
    case "electronics":
      return "Show a single consumer electronics product in a clean studio packshot, with the full device visible and no accessories unless built in.";
    case "whitegoods":
      return "Show a single home appliance isolated on the canvas, photographed straight and clearly with realistic materials and proportions.";
    case "foodcourt":
      return "Show a single prepared food or beverage item as a menu-board style product shot, appetizing but realistic, without props or plating scenery.";
    case "aisle":
      return "Show a single packaged grocery or aisle product in its retail packaging, upright and centered, without shelf context.";
    default:
      return "Show a single retail product packshot, centered and fully visible.";
  }
}

function buildProductPrompt(product) {
  const sku = normalizeSku(product.sku, "SKU-UNKNOWN");
  const name = readText(product.name, 180) || "Retail product";
  const brand = readText(product.brand, 120) || "Store brand";
  const category = readText(product.category, 80).toLowerCase() || "general";
  const tags = Array.isArray(product.tags)
    ? product.tags.map((entry) => readText(entry, 40)).filter(Boolean).slice(0, 8)
    : [];
  const tagLine = tags.length > 0 ? `Key attributes: ${tags.join(", ")}.` : "";

  return [
    "Create a photorealistic retail product packshot with a transparent background.",
    "Return exactly one product only.",
    "No shelf, no room, no hands, no people, no extra props, no watermark, no frame, no badge, no callout, and no added text overlay.",
    "Center the product, keep the full outline visible, and leave a small margin around it.",
    "Use studio lighting and realistic materials so the image works on in-store digital signage.",
    buildCategoryPrompt(category),
    `Product name: ${name}.`,
    `Brand: ${brand}.`,
    `Category: ${category}.`,
    `SKU: ${sku}.`,
    tagLine,
    "If the item is packaged food or drink, show the retail package rather than plated food unless the product name clearly implies a served item.",
    "If the item is an appliance or electronics device, show the hardware only and avoid environmental staging."
  ]
    .filter(Boolean)
    .join(" ");
}

function createAssetPaths(product) {
  const sku = normalizeSku(product.sku, `SKU-${Date.now()}`);
  const slug = slugify(sku);
  return {
    sku,
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

async function generateImageWithRetry(product, prompt, runtimeOptions, manifestItem) {
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
        `[retry] ${normalizeSku(product.sku)} attempt ${attempt} failed (${error.message}). Waiting ${backoffMs}ms before retrying.`
      );
      await delay(backoffMs);
    }
  }

  const priorAttempts = parseInteger(manifestItem?.attempts, 0);
  const nextError = lastError instanceof Error ? lastError : new Error("Image generation failed.");
  nextError.attempts = priorAttempts + attempt;
  throw nextError;
}

function selectEligibleProducts(feed, manifest, options) {
  const skuFilter = new Set(options.skuFilter.map((entry) => normalizeSku(entry)).filter(Boolean));
  const selected = [];

  for (const product of feed) {
    const sku = normalizeSku(product?.sku);
    if (!sku) {
      continue;
    }
    if (skuFilter.size > 0 && !skuFilter.has(sku)) {
      continue;
    }
    selected.push(product);
  }

  const candidates = [];
  for (const product of selected) {
    const { sku, relativeAssetPath, absoluteAssetPath } = createAssetPaths(product);
    const manifestItem = manifest.items[sku] && typeof manifest.items[sku] === "object" ? manifest.items[sku] : {};
    candidates.push({
      product,
      sku,
      relativeAssetPath,
      absoluteAssetPath,
      manifestItem
    });
  }

  return typeof options.limit === "number" ? candidates.slice(0, options.limit) : candidates;
}

async function updateGeneratedImageFields(product, relativeAssetPath, runtimeOptions, promptHash) {
  const currentImage = readText(product.image, 500) || readText(product.Image, 500);
  if (currentImage && currentImage !== relativeAssetPath && !readText(product.sourceImage, 500)) {
    product.sourceImage = currentImage;
  }
  product.image = relativeAssetPath;
  product.imageSource = "openai-generated";
  product.imageUpdatedAt = new Date().toISOString();
  product.imagePromptVersion = PROMPT_VERSION;
  product.imageModel = runtimeOptions.model;
  product.imageBackground = "transparent";
  product.imageQuality = runtimeOptions.quality;
  product.imageSize = runtimeOptions.size;
  product.imagePromptHash = promptHash;
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
  const model = readText(process.env.OPENAI_PRODUCT_IMAGE_MODEL, 80) || DEFAULT_MODEL;
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

  const manifest = await readJsonFile(MANIFEST_FILE, {
    promptVersion: PROMPT_VERSION,
    updatedAt: "",
    items: {}
  });
  manifest.promptVersion = PROMPT_VERSION;
  manifest.items = manifest.items && typeof manifest.items === "object" ? manifest.items : {};

  const candidates = selectEligibleProducts(rawFeed, manifest, options);
  if (candidates.length === 0) {
    // eslint-disable-next-line no-console
    console.log("No matching products were found.");
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
    `Preparing product images for ${candidates.length} SKU(s) with model ${model}, quality ${runtimeOptions.quality}, size ${runtimeOptions.size}.`
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

      const { product, sku, relativeAssetPath, absoluteAssetPath, manifestItem } = next;
      const existingGeneratedAsset = !options.force && (await fileExists(absoluteAssetPath));

      if (existingGeneratedAsset) {
        summary.skipped += 1;
        await updateGeneratedImageFields(product, relativeAssetPath, runtimeOptions, readText(manifestItem?.promptHash, 80));
        manifest.items[sku] = {
          ...manifestItem,
          sku,
          status: "generated",
          imagePath: relativeAssetPath,
          sourceImage: readText(product.sourceImage, 500),
          recoveredAt: new Date().toISOString(),
          model: readText(manifestItem?.model, 80) || runtimeOptions.model,
          quality: readText(manifestItem?.quality, 20) || runtimeOptions.quality,
          size: readText(manifestItem?.size, 20) || runtimeOptions.size
        };
        await queueSaveState();
        // eslint-disable-next-line no-console
        console.log(`[skip] ${sku} already has a generated local asset.`);
        continue;
      }

      const prompt = buildProductPrompt(product);
      const promptHash = buildPromptHash(prompt);
      if (options.dryRun) {
        summary.skipped += 1;
        // eslint-disable-next-line no-console
        console.log(`[dry-run] ${sku} -> ${relativeAssetPath}`);
        continue;
      }
      if (!runtimeOptions.apiKey) {
        throw new Error("OPENAI_API_KEY is required unless --dry-run is used.");
      }

      try {
        const result = await generateImageWithRetry(product, prompt, runtimeOptions, manifestItem);
        const imageBuffer = Buffer.from(result.imageBase64, "base64");
        await writeBinaryFileAtomic(absoluteAssetPath, imageBuffer);
        await updateGeneratedImageFields(product, relativeAssetPath, runtimeOptions, promptHash);
        manifest.items[sku] = {
          sku,
          status: "generated",
          imagePath: relativeAssetPath,
          sourceImage: readText(product.sourceImage, 500),
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
        console.log(`[generated] ${sku} -> ${relativeAssetPath}`);
      } catch (error) {
        summary.failed += 1;
        manifest.items[sku] = {
          sku,
          status: "failed",
          imagePath: relativeAssetPath,
          sourceImage: readText(product.sourceImage, 500) || readText(product.image, 500),
          failedAt: new Date().toISOString(),
          prompt,
          promptHash,
          promptVersion: PROMPT_VERSION,
          model: runtimeOptions.model,
          quality: runtimeOptions.quality,
          size: runtimeOptions.size,
          attempts: parseInteger(error?.attempts, parseInteger(manifestItem?.attempts, 0) + 1),
          error: readText(error?.message, 500) || "Unknown image generation failure."
        };
        await queueSaveState();
        // eslint-disable-next-line no-console
        console.error(`[failed] ${sku}: ${error.message}`);
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
