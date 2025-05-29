import { attachClient } from '../dds/liveBridge.js';

/**
 * WebSocket /live/:topic
 *
 * Upgrades handled by HyperExpress; this function is called once the
 * connection is established.
 *
 * @param {import('hyper-express').Websocket} ws
 * @param {import('hyper-express').Request} req
 */
export default async function liveHandler(ws, req) {
  const topic = '/' + (req.path_params.topic || '').replace(/^\/+/, '');

  const ok = await attachClient(topic, ws);
  if (!ok) {
    try {
      ws.close(4404, 'topic not found');
    } catch {
      /* ignore */
    }
  }
}
