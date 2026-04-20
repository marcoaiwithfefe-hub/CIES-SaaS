import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const DATA_ROOT = process.env.CIES_DATA_DIR ?? '/data';
const LOG_FILE = path.join(DATA_ROOT, 'logs', 'captures.log');

export interface CaptureLogEntry {
  t: string; // ISO timestamp
  tool: 'hkex' | 'sfc' | 'afrc' | 'afrc-firm';
  query: string;
  ok: boolean;
  ms: number;
  stage?: 'launch' | 'navigate' | 'interact' | 'screenshot';
  err?: string;
}

export async function logCapture(entry: CaptureLogEntry): Promise<void> {
  await mkdir(path.dirname(LOG_FILE), { recursive: true });
  await appendFile(LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
}

export async function readRecentLogs(limit: number): Promise<CaptureLogEntry[]> {
  let raw: string;
  try {
    raw = await readFile(LOG_FILE, 'utf8');
  } catch {
    return [];
  }
  const lines = raw.trim().split('\n').filter(Boolean);
  const recent = lines.slice(-limit);
  return recent
    .map((line) => {
      try {
        return JSON.parse(line) as CaptureLogEntry;
      } catch {
        return null;
      }
    })
    .filter((x): x is CaptureLogEntry => x !== null)
    .reverse();
}
