import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { config } from '../server.js';

/**
 * Watches BAG_DIR for .mcap files and keeps an in-memory newest→oldest array.
 * All range queries call getFiles() which is free of disk I/O.
 */

const DEBOUNCE_MS = 100;
const RESCAN_INTERVAL_MS = 3000;

const dir = config.bagDir;
let files = []; // newest → oldest full paths
let scanPending = false;
let lastScan = 0;

/**
 * Perform a full directory scan and update `files`.
 */
async function refreshList() {
  const names = await fs.readdir(dir);
  const mcapNames = names.filter((n) => n.endsWith('.mcap'));
  mcapNames.sort().reverse(); // newest (lexicographically highest) first
  files = mcapNames.map((n) => join(dir, n));
  lastScan = Date.now();
}

// Initial scan at module load
await refreshList();

// fs.watch for fast updates
try {
  const watcher = fs.watch(dir, { persistent: false });
  watcher.on('error', () => {
    // ignore, fallback to periodic rescan
  });
  watcher.on('change', (eventType, filename) => {
    if (eventType === 'rename' && filename.endsWith('.mcap')) {
      scanPending = true;
    }
  });
} catch {
  /* some platforms may not support watch; rely on timer */
}

// Debounced refresh timer
setInterval(async () => {
  if (scanPending) {
    scanPending = false;
    await refreshList();
  }
}, DEBOUNCE_MS);

// Fallback periodic rescan
setInterval(async () => {
  if (Date.now() - lastScan > RESCAN_INTERVAL_MS) {
    await refreshList();
  }
}, RESCAN_INTERVAL_MS);

/**
 * Return the cached list newest→oldest.
 * In future we may slice by time window t0/t1, but caller can also filter.
 *
 * @returns {string[]} absolute file paths
 */
export function getFiles() {
  return files;
}
