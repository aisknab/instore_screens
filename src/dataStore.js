import fs from "node:fs/promises";
import path from "node:path";

const DB_FILE = path.join(process.cwd(), "data", "db.json");
const EMPTY_DB = { pages: [], screens: [] };

async function ensureDbFile() {
  await fs.mkdir(path.dirname(DB_FILE), { recursive: true });

  try {
    await fs.access(DB_FILE);
  } catch {
    await fs.writeFile(DB_FILE, JSON.stringify(EMPTY_DB, null, 2), "utf8");
  }
}

export async function readDb() {
  await ensureDbFile();
  const raw = await fs.readFile(DB_FILE, "utf8");
  const normalizedRaw = raw.replace(/^\uFEFF/, "");

  try {
    const parsed = JSON.parse(normalizedRaw);
    if (!Array.isArray(parsed.pages) || !Array.isArray(parsed.screens)) {
      return structuredClone(EMPTY_DB);
    }
    return parsed;
  } catch {
    return structuredClone(EMPTY_DB);
  }
}

export async function writeDb(data) {
  await ensureDbFile();
  await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function mutateDb(mutator) {
  const db = await readDb();
  const result = await mutator(db);
  await writeDb(db);
  return result;
}
