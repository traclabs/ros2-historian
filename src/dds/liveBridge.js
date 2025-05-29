/* DDS Live Multiplexer
 *
 * Maintains a single DDS subscription per topic and forwards decoded ROS
 * messages to all connected WebSocket clients, with per-client frequency
 * throttling.  Uses rclnodejs from introspect.js (already initialised).
 */
import { node, getTypeForTopic, ensureInit } from './introspect.js';
import { config } from '../server.js';

const rooms = new Map(); // topic => Room

class Room {
  constructor(topic, msgType) {
    this.topic = topic;
    this.msgType = msgType;
    this.clients = new Set();
    this.queue = [];
    this.interval = null;

    // Create DDS subscription once
    this.sub = node.createSubscription(msgType, topic, (msg) => {
      const entry = { t: Date.now(), data: msg };
      this.queue.push(entry);
    });

    // Start throttled broadcast loop
    const periodMs = 1000 / config.liveThrottleHz;
    this.interval = setInterval(() => this.flush(periodMs), periodMs);
  }

  attach(ws) {
    ws.rateMs = 1000 / config.liveThrottleHz;
    ws.lastSent = 0;
    this.clients.add(ws);

    ws.on('message', (data) => {
      try {
        const cmd = JSON.parse(data);
        if (typeof cmd.rate === 'number' && cmd.rate > 0) {
          ws.rateMs = 1000 / Math.max(1, Math.min(cmd.rate, config.liveThrottleHz));
        }
      } catch {
        /* ignore */
      }
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      if (!this.clients.size) this.cleanup();
    });
  }

  flush(periodMs) {
    if (!this.queue.length) return;
    const batch = this.queue;
    this.queue = [];

    for (const ws of this.clients) {
      const now = Date.now();
      if (now - ws.lastSent < ws.rateMs) continue;
      ws.lastSent = now;

      try {
        for (const msg of batch) ws.send(JSON.stringify(msg));
      } catch {
        /* ignore broken socket */
      }
    }
  }

  cleanup() {
    clearInterval(this.interval);
    this.sub?.destroy();
    rooms.delete(this.topic);
  }
}

/**
 * Attach a WebSocket client to a live ROS 2 topic.
 *
 * @param {string} topic absolute topic name starting with /
 * @param {import('hyper-express').Websocket} ws
 * @returns {Promise<boolean>} true if attached, false if topic unknown
 */
export async function attachClient(topic, ws) {
  await ensureInit();
  let room = rooms.get(topic);
  if (!room) {
    const msgType = await getTypeForTopic(topic);
    if (!msgType) return false;

    room = new Room(topic, msgType);
    rooms.set(topic, room);
  }
  room.attach(ws);
  return true;
}
