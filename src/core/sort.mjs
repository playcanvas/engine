/**
 * @param {{priority: number}} a - First object with priority property.
 * @param {{priority: number}} b - Second object with priority property.
 * @returns {number} A number indicating the relative position.
 * @ignore
 */
const cmpPriority = (a, b) => a.priority - b.priority;

/**
 * @param {Array<{priority: number}>} arr - Array to be sorted in place where each element contains
 * an object with at least a priority property.
 * @returns {Array<{priority: number}>} In place sorted array.
 * @ignore
 */
export const sortPriority = arr => arr.sort(cmpPriority);
