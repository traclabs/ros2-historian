import { getTopicList } from '../dds/introspect.js';

/**
 * GET /topics
 * Returns an array of {topic,type} objects describing DDS topics.
 *
 * @param {import('hyper-express').Request} _req
 * @param {import('hyper-express').Response} res
 */
export default async function topicsHandler(_req, res) {
  try {
    const list = await getTopicList();
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
}
