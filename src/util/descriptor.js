/**
 * Flatten ROS message descriptor into array of metric leaves.
 * This is a placeholder replicating rosbridge flattening rules.
 *
 * Each leaf is { path: 'pose.position.x', type: 'float64' }.
 *
 * @param {object} descriptor rclnodejs-generated message .descriptor
 * @returns {Array<{path:string,type:string}>}
 */
export function flattenDescriptor(descriptor) {
  const leaves = [];
  function walk(node, prefix = '') {
    const current = prefix ? prefix + '.' + node.name : node.name;
    if (node.fields) {
      for (const field of node.fields) {
        walk(field, current);
      }
    } else {
      leaves.push({ path: current, type: node.type });
    }
  }
  if (descriptor && descriptor.fields) {
    for (const field of descriptor.fields) walk(field, '');
  }
  return leaves;
}
