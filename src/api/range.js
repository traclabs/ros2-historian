import { getFiles } from '../mcap/fileScanner.js';
import { open } from '@mcap/nodejs';
import WorkerPool from '../workers/workerPool.js';
import { config } from '../server.js';

/**
 * Parse integer query parameter.
 */
function intQuery(req, name, def) {
  const v = req.query[name];
  if (v === undefined) return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * GET /range/:topic?start=ms&end=ms&decimate=1
 *
 * Stream ND-JSON of decoded messages.
 *
 * start/end are UNIX epoch millis.  Required.
 * decimate (optional) sends every Nth message.
 */
export default async function rangeHandler(req, res) {
  const topic = '/' + (req.path_params.topic || '').replace(/^\/+/, '');

  const t0 = intQuery(req, 'start');
  const t1 = intQuery(req, 'end');
  const decimate = intQuery(req, 'decimate', 1);

  if (t0 === undefined || t1 === undefined || t1 <= t0) {
    return res.status(400).json({ error: 'invalid start/end' });
  }

  if ((t1 - t0) / (1000 * 60 * 60) > config.maxRangeHours) {
    return res.status(413).json({ error: 'window too large' });
  }

  const files = getFiles(); // newest→oldest
  if (!files.length) return res.status(404).json({ error: 'no bag files' });

  // --- quick channel lookup (first hitting file) --------------------------
  let channelId;
  for (const path of files) {
    try {
      const reader = await open(path, { lazy: true });
      const info = await reader.summary();
      for (const ch of info.channelInfos) {
        if (ch.topic === topic) {
          channelId = ch.id;
          break;
        }
      }
      await reader.close();
      if (channelId) break;
    } catch {
      /* skip unreadable file */
    }
  }
  if (!channelId) {
    return res.status(404).json({ error: 'topic not found' });
  }

  // schedule worker
  try {
    const port = await WorkerPool.schedule({
      files,
      channelId,
      t0,
      t1,
      decimate
    });

    // HyperExpress Response.stream() – bridge MessagePort to HTTP
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.stream(port);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
