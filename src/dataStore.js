import fs from "node:fs/promises";
import path from "node:path";

const DB_FILE = path.join(process.cwd(), "data", "db.json");
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
    await writeDbFileUnlocked(EMPTY_DB);
  }
}

async function readDbFileUnlocked() {
  await ensureDbFile();
  const raw = await fs.readFile(DB_FILE, "utf8");
  const normalizedRaw = raw.replace(/^\uFEFF/, "");

  try {
    const parsed = JSON.parse(normalizedRaw);
    const normalized = normalizeDbShape(parsed);
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
