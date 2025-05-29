import { open, close } from '@mcap/nodejs';
import LRU from 'lru-cache';

/**
 * LRU cache of open readers to minimise disk ops.
 * Key: absolute file path
 * Value: reader instance with .close()
 */
const readerCache = new LRU({
  max: 32,
  dispose: (_value, key) => {
    // Close reader when evicted.
    try {
      _value.close?.();
    } catch {
      /* ignore */
    }
  }
});

/**
 * Obtain cached or newly opened MCAP reader (lazy summary read only).
 * @param {string} path
 * @returns {Promise<import('@mcap/nodejs').IndexedMcapReader>}
 */
export async function getReader(path) {
  let reader = readerCache.get(path);
  if (!reader) {
    reader = await open(path, { lazy: true });
    readerCache.set(path, reader);
  }
  return reader;
}

/**
 * Close all cached readers (used during shutdown).
 */
export function closeAllReaders() {
  for (const reader of readerCache.values()) {
    try {
      reader.close?.();
    } catch {
      /* ignore */
    }
  }
  readerCache.clear();
}

/**
 * Async generator that yields JSON strings separated with \\n (ND-JSON) for a time window.
 *
 * @param {{ files: string[], channelId: number, t0: number, t1: number, decimate?: number }} params
 */
export async function* iterateRange({ files, channelId, t0, t1, decimate = 1 }) {
  let counter = 0;

  for (const path of files) {
    const reader = await getReader(path);
    const summary = await reader.summary();
    // Skip sealed files if not overlapping.
    if (
      summary.messageStartTime > t1 ||
      summary.messageEndTime < t0
    ) {
      continue;
    }

    for (const idx of summary.chunkIndexes) {
      if (idx.messageEndTime < t0 || idx.messageStartTime > t1) continue;

      for await (const msg of reader.readChunkMessages(idx)) {
        if (msg.channelId !== channelId) continue;
        if (msg.logTime < t0 || msg.logTime > t1) continue;
        if (decimate > 1 && (counter++ % decimate)) continue;

        // decode() turns binary into JS object using channel schema
        const decoded = await reader.decodeMessage(msg);
        yield JSON.stringify(decoded) + '\n';
      }
    }
  }
}
