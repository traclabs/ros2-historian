/* eslint-disable no-console */
import { parentPort, workerData } from 'node:worker_threads';
import { iterateRange } from '../mcap/rangeIter.js';

const TIMEOUT_MS = parseInt(process.env.WORKER_TIMEOUT_MS ?? '30000', 10);

// Handle single task at a time – parent keeps pool.
parentPort.on('message', async ({ id, params, port }) => {
  // Acknowledge to parent; transfer readable side of MessagePort.
  parentPort.postMessage({ ready: true, id, port }, [port]);

  const timer = setTimeout(() => {
    port.close();
    parentPort.postMessage({ error: 'timeout', id });
  }, TIMEOUT_MS);

  try {
    for await (const line of iterateRange(params)) {
      port.postMessage(line);
    }
    clearTimeout(timer);
    port.close();
    parentPort.postMessage({ done: true, id });
  } catch (err) {
    clearTimeout(timer);
    port.close();
    parentPort.postMessage({ error: String(err), id });
  }
});
