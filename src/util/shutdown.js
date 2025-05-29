/**
 * Graceful shutdown helper for ROS 2 Historian.
 * Attaches SIGINT/SIGTERM handlers that:
 *  1. Stop accepting new HTTP/WS connections.
 *  2. Drain live queues (handled internally by liveBridge).
 *  3. Wait for worker pool to become idle and terminate workers.
 *  4. Close any open MCAP readers.
 *  5. Exit the process.
 *
 * @param {import('hyper-express').Server} app
 */
export default function installShutdown(app) {
  const signals = ['SIGINT', 'SIGTERM'];
  for (const sig of signals) {
    process.once(sig, async () => {
      /* eslint-disable no-console */
      console.log(`Received ${sig}, beginning graceful shutdown…`);
      /* eslint-enable no-console */

      try {
        // 1. Stop accepting new connections.
        await app.close();

        // 2. Drain worker pool.
        const { default: WorkerPool } = await import('../workers/workerPool.js');
        await WorkerPool.drain();

        // 3. Close MCAP readers.
        const { closeAllReaders } = await import('../mcap/rangeIter.js');
        closeAllReaders();
      } catch (err) {
        console.error('Error during shutdown:', err);
      } finally {
        process.exit(0);
      }
    });
  }
}
