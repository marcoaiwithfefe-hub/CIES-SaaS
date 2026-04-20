import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_ROOT = process.env.CIES_DATA_DIR ?? '/data';
const CAPTURES_ROOT = path.join(DATA_ROOT, 'captures');
const RETENTION_MS = 24 * 60 * 60 * 1000;

export type Tool = 'hkex' | 'sfc' | 'afrc' | 'afrc-firm';

export interface StoredCaptureMeta {
  id: string;
  tool: Tool;
  query: string;
  language?: 'en' | 'tc';
  timestamp: number;
}

function datePart(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export interface StoreInput {
  tool: Tool;
  query: string;
  language?: 'en' | 'tc';
  image: Buffer;
}

export async function storeCapture(input: StoreInput): Promise<StoredCaptureMeta> {
  const id = randomUUID();
  const timestamp = Date.now();
  const dir = path.join(CAPTURES_ROOT, input.tool, datePart(timestamp));
  await mkdir(dir, { recursive: true });
  const meta: StoredCaptureMeta = {
    id,
    tool: input.tool,
    query: input.query,
    language: input.language,
    timestamp,
  };
  await Promise.all([
    writeFile(path.join(dir, `${id}.png`), input.image),
    writeFile(path.join(dir, `${id}.json`), JSON.stringify(meta)),
  ]);
  return meta;
}

export async function listHistory(tool: Tool, limit: number): Promise<StoredCaptureMeta[]> {
  const toolDir = path.join(CAPTURES_ROOT, tool);
  const results: StoredCaptureMeta[] = [];
  let dayDirs: string[];
  try {
    dayDirs = await readdir(toolDir);
  } catch {
    return [];
  }
  dayDirs.sort().reverse();
  for (const day of dayDirs) {
    const dayPath = path.join(toolDir, day);
    const files = await readdir(dayPath);
    const metaFiles = files.filter((f) => f.endsWith('.json'));
    for (const f of metaFiles) {
      try {
        const raw = await readFile(path.join(dayPath, f), 'utf8');
        results.push(JSON.parse(raw));
      } catch {
        /* skip corrupt */
      }
    }
    if (results.length >= limit) break;
  }
  return results
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export async function readImage(id: string): Promise<{ data: Buffer; meta: StoredCaptureMeta } | null> {
  let tools: Tool[];
  try {
    tools = (await readdir(CAPTURES_ROOT)) as Tool[];
  } catch {
    return null;
  }
  for (const tool of tools) {
    const toolDir = path.join(CAPTURES_ROOT, tool);
    let dayDirs: string[];
    try {
      dayDirs = await readdir(toolDir);
    } catch {
      continue;
    }
    for (const day of dayDirs) {
      const imgPath = path.join(toolDir, day, `${id}.png`);
      const metaPath = path.join(toolDir, day, `${id}.json`);
      try {
        const [data, rawMeta] = await Promise.all([readFile(imgPath), readFile(metaPath, 'utf8')]);
        return { data, meta: JSON.parse(rawMeta) };
      } catch {
        /* not here, keep looking */
      }
    }
  }
  return null;
}

export async function cleanup(): Promise<void> {
  const cutoff = Date.now() - RETENTION_MS;
  let tools: string[];
  try {
    tools = await readdir(CAPTURES_ROOT);
  } catch {
    return;
  }
  for (const tool of tools) {
    const toolDir = path.join(CAPTURES_ROOT, tool);
    const days = await readdir(toolDir).catch(() => []);
    for (const day of days) {
      const dayMs = Date.parse(day);
      if (Number.isFinite(dayMs) && dayMs < cutoff - RETENTION_MS) {
        await rm(path.join(toolDir, day), { recursive: true, force: true }).catch(() => {});
      }
    }
  }
}

let cleanupStarted = false;
export function startCleanupTimer(): void {
  if (cleanupStarted) return;
  cleanupStarted = true;
  setInterval(() => {
    cleanup().catch((err) => console.error('[capture-store] cleanup:', err));
  }, 15 * 60 * 1000);
}
