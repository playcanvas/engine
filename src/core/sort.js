/**
 * @param {{priority: number}} a
 * @param {{priority: number}} b
 */

export const cmpPriority  = (a, b) => a.priority - b.priority;

/**
 * @param {Array<{priority: number}>} arr
 */

export const sortPriority = arr => arr.sort(cmpPriority);
