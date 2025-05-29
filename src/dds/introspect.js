import rclnodejs from 'rclnodejs';
import { config } from '../server.js';

let initPromise;
let node;

/**
 * Initialise rclnodejs exactly once.
 * DDS domain is taken from config.ddsDomain.
 *
 * @returns {Promise<void>}
 */
async function ensureInit() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // rclnodejs must be initialised before using any other API.
    await rclnodejs.init({
      domainId: config.ddsDomain
    });
    node = new rclnodejs.Node('historian_introspector');
    rclnodejs.spin(node);
  })();

  return initPromise;
}

/**
 * Retrieve topic list with single type per topic (first type if more provided).
 * Called by /topics endpoint and liveBridge.
 *
 * @returns {Promise<Array<{topic: string, type: string}>>}
 */
export async function getTopicList() {
  await ensureInit();
  const nameTypes = node.getTopicNamesAndTypes();
  return nameTypes.map(({ name, types }) => ({
    topic: name,
    type: types?.[0] ?? ''
  }));
}

/**
 * Retrieve ROS 2 message type string for a given topic.
 *
 * @param {string} topic
 * @returns {Promise<string|null>} msgType or null if not found
 */
export async function getTypeForTopic(topic) {
  const list = await getTopicList();
  const entry = list.find((t) => t.topic === topic);
  return entry ? entry.type : null;
}

export { ensureInit, node };
