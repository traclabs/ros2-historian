import HyperExpress from 'hyper-express';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// ---------------------------------------------------------------------------
// Basic configuration & helpers
// ---------------------------------------------------------------------------
export const config = {
  port: parseInt(process.env.PORT ?? '8080', 10),
  bagDir: process.env.BAG_DIR ?? './bags',
  ddsDomain: parseInt(process.env.DDS_DOMAIN ?? '0', 10),
  liveThrottleHz: parseInt(process.env.LIVE_THROTTLE_HZ ?? '10', 10),
  maxRangeHours: parseInt(process.env.MAX_RANGE_HOURS ?? '24', 10),
  maxSockets: parseInt(process.env.MAX_SOCKETS ?? '128', 10),
  poolSize: process.env.POOL_SIZE ? parseInt(process.env.POOL_SIZE, 10) : undefined,
  workerTimeout: parseInt(process.env.WORKER_TIMEOUT_MS ?? '30000', 10)
};

// Resolve __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// HyperExpress server bootstrap
// ---------------------------------------------------------------------------
const app = new HyperExpress.Server();

app.get('/healthz', (_, res) => res.send('ok'));

// Lazy-loaded route handlers to break circular deps during bootstrap
app.get('/topics', async (req, res) => {
  const handler = (await import('./api/topics.js')).default;
  return handler(req, res);
});

app.get('/range/:topic', async (req, res) => {
  const handler = (await import('./api/range.js')).default;
  return handler(req, res);
});

app.ws('/live/:topic', async (ws, req) => {
  const handler = (await import('./api/live.js')).default;
  return handler(ws, req);
});

// Start listening
app.listen(config.port)
  .then(() => {
    /* eslint-disable no-console */
    console.log(`ROS 2 Historian listening on :${config.port}`);
    /* eslint-enable no-console */
  })
  .catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------
import installShutdown from './util/shutdown.js';
installShutdown(app);

export default app;
