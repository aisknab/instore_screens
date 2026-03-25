import fs from "node:fs/promises";
import path from "node:path";

const SEED_DB_FILE = path.join(process.cwd(), "data", "db.json");
const DEFAULT_DB_FILE = path.join(process.cwd(), "temp", "db.json");
const DB_FILE =
  typeof process.env.DB_FILE === "string" && process.env.DB_FILE.trim().length > 0
    ? path.resolve(process.env.DB_FILE.trim())
    : DEFAULT_DB_FILE;
const EMPTY_DB = { pages: [], screens: [], agentRuns: [], telemetryEvents: [], pricing: {} };
let dbAccessQueue = Promise.resolve();
let lastKnownDb = null;

function normalizeDbShape(data) {
  const source = data && typeof data === "object" ? data : {};
  return {
    ...source,
    pages: Array.isArray(source.pages) ? source.pages : [],
    screens: Array.isArray(source.screens) ? source.screens : [],
    agentRuns: Array.isArray(source.agentRuns) ? source.agentRuns : [],
    telemetryEvents: Array.isArray(source.telemetryEvents) ? source.telemetryEvents : [],
    pricing: source.pricing && typeof source.pricing === "object" ? source.pricing : {}
  };
}

function parseDbPayload(raw) {
  const normalizedRaw = String(raw).replace(/^\uFEFF/, "");
  return normalizeDbShape(JSON.parse(normalizedRaw));
}

async function loadInitialDb() {
  if (path.resolve(DB_FILE) === path.resolve(SEED_DB_FILE)) {
    return EMPTY_DB;
  }

  try {
    const raw = await fs.readFile(SEED_DB_FILE, "utf8");
    return parseDbPayload(raw);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return EMPTY_DB;
    }
    throw error;
  }
}

async function writeDbFileUnlocked(data) {
  const normalized = normalizeDbShape(data);
  const payload = JSON.stringify(normalized, null, 2);
  const tempFile = `${DB_FILE}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempFile, payload, "utf8");
  try {
    await fs.rename(tempFile, DB_FILE);
  } catch (error) {
    if (error?.code !== "EPERM") {
      await fs.rm(tempFile, { force: true }).catch(() => undefined);
      throw error;
    }

    await fs.writeFile(DB_FILE, payload, "utf8");
    await fs.rm(tempFile, { force: true }).catch(() => undefined);
  }
  lastKnownDb = structuredClone(normalized);
}

function queueDbAccess(task) {
  const run = dbAccessQueue.then(task, task);
  dbAccessQueue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });

  try {
    await fs.access(DB_FILE);
  } catch {
    // Keep the tracked seed data separate from the writable runtime DB.
    await writeDbFileUnlocked(await loadInitialDb());
  }
}

async function readDbFileUnlocked() {
  await ensureDbFile();
  const raw = await fs.readFile(DB_FILE, "utf8");

  try {
    const normalized = parseDbPayload(raw);
    lastKnownDb = structuredClone(normalized);
    return normalized;
  } catch (error) {
    if (lastKnownDb) {
      return structuredClone(lastKnownDb);
    }
    throw error;
  }
}

export async function readDb() {
  return queueDbAccess(async () => structuredClone(await readDbFileUnlocked()));
}

export async function writeDb(data) {
  await queueDbAccess(async () => {
    await ensureDbFile();
    await writeDbFileUnlocked(data);
  });
}

export async function mutateDb(mutator) {
  return queueDbAccess(async () => {
    const db = await readDbFileUnlocked();
    const result = await mutator(db);
    await writeDbFileUnlocked(db);
    return result;
  });
}
